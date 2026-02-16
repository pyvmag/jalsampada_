"use client";

import * as React from "react";
import axios from "axios";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DynamicForm, TabbedLayout } from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";
const DOCTYPE_NAME = "Asset Interchange";

interface AssetInterchangeData {
    name: string;
    lis_name?: string;
    stage?: string;
    posting_date?: string;
    select_asset?: "Motor" | "Pump";

    pump_asset?: string;
    pump_no?: string;
    current_motor_asset?: string;
    motor_no?: string;
    interchange_motor?: string;
    interchange_motor_no?: string;
    current_motor_no?: string;

    motor_asset?: string;
    motor_no_for_pump?: string;
    current_pump_asset?: string;
    current_pump_no?: string;
    interchange_pump?: string;
    interchange_pump_no?: string;

    docstatus: 0 | 1 | 2;
    modified: string;
}

export default function AssetInterchangeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
    const docname = decodeURIComponent(params.id as string);
    const searchParams = useSearchParams();
    const assetType = searchParams.get("asset");

    const [record, setRecord] = React.useState<AssetInterchangeData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [selectedAsset, setSelectedAsset] = React.useState<"Motor" | "Pump" | "">("");
    const [formDirty, setFormDirty] = React.useState(false);
    const [formInstance, setFormInstance] = React.useState<any>(null);
    const [formVersion, setFormVersion] = React.useState(0);
    const isProgrammaticUpdate = React.useRef(false);

    // Button state
    const [activeButton, setActiveButton] = React.useState<"SAVE" | "SUBMIT" | "CANCEL" | null>(null);

    // STATUS BADGE
    const getCurrentStatus = () => {
        if (!record) return "";
        if (record.docstatus === 2) return "Cancelled";
        if (record.docstatus === 1) return "Submitted";
        return "Draft";
    };

    // FETCH RECORD
    const fetchDoc = async () => {
        if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;
        try {
            setLoading(true);
            const resp = await axios.get(`${API_BASE_URL}/${encodeURIComponent(DOCTYPE_NAME)}/${docname}`, {
                headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            });
            const data = resp.data.data;
            setRecord(data);
            setSelectedAsset(data.select_asset || "");
            setFormDirty(false);

            // Initialize button state based on document status
            if (data.docstatus === 0) { // Draft
                setActiveButton("SUBMIT");
            } else if (data.docstatus === 1) { // Submitted
                setActiveButton("CANCEL");
            }
        } catch {
            setError("Failed to load record");
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchDoc();
    }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

    // Watch for form changes
    React.useEffect(() => {
        if (!formInstance) return;

        const subscription = formInstance.watch((value: any, { name }: { name?: string }) => {
            // Watch for form changes to mark as dirty
            if (name && !isProgrammaticUpdate.current) {
                setFormDirty(true);
                // When form becomes dirty, show SAVE button
                if (record?.docstatus === 0) {
                    setActiveButton("SAVE");
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [formInstance, record?.docstatus]);

    const handleAssetChange = (value: "Motor" | "Pump") => setSelectedAsset(value);

    // Handle form initialization
    const handleFormInit = React.useCallback((form: any) => {
        setFormInstance(form);
    }, []);

    // SAVE (UPDATE) DOCUMENT
    const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
        if (!isDirty) {
            toast.info("No changes to save.");
            return;
        }

        if (!record) {
            toast.error("Record not loaded. Cannot save.", { duration: Infinity });
            return;
        }

        setIsSaving(true);
        isProgrammaticUpdate.current = true;

        try {
            const payload: Record<string, any> = JSON.parse(JSON.stringify(data));

            // Clean payload: remove non-data fields
            const nonDataFields = new Set<string>();
            formTabs.forEach(tab => {
                tab.fields.forEach(field => {
                    if (
                        field.type === "Section Break" ||
                        field.type === "Column Break" ||
                        field.type === "Button" ||
                        field.type === "Read Only"
                    ) {
                        nonDataFields.add(field.name);
                    }
                });
            });

            const finalPayload: Record<string, any> = {};
            for (const key in payload) {
                if (!nonDataFields.has(key)) {
                    finalPayload[key] = payload[key];
                }
            }

            finalPayload.modified = record.modified;
            finalPayload.docstatus = record.docstatus;

            console.log("Sending this PAYLOAD to Frappe:", finalPayload);

            const resp = await axios.put(
                `${API_BASE_URL}/${encodeURIComponent(DOCTYPE_NAME)}/${encodeURIComponent(docname)}`,
                finalPayload,
                {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const messages = getApiMessages(resp, null, "Changes saved!", "Failed to save");

            if (messages.success) {
                toast.success(messages.message, { description: messages.description });
            } else {
                toast.error(messages.message, { description: messages.description, duration: Infinity });
            }

            if (resp.data && resp.data.data) {
                // Update state with new data
                const updatedData = resp.data.data as AssetInterchangeData;
                setRecord(updatedData);
                setFormDirty(false);

                // Update button state after save
                if (updatedData.docstatus === 0) { // Still draft
                    setActiveButton("SUBMIT");
                }

                // Force form remount
                setFormVersion((v) => v + 1);
            }

        } catch (err: any) {
            console.error("Save error:", err);
            const messages = getApiMessages(null, err, "Changes saved!", "Failed to save");
            toast.error(messages.message, { description: messages.description, duration: Infinity });
        } finally {
            setIsSaving(false);
            isProgrammaticUpdate.current = false;
        }
    };

    // SUBMIT DOCUMENT
    const handleSubmitDocument = async () => {
        if (!record || !formInstance) return;

        setIsSaving(true);

        try {
            // Get current form data
            const formData = formInstance.getValues();

            // Clean the form data
            const nonDataFields = new Set<string>();
            formTabs.forEach(tab => {
                tab.fields.forEach(field => {
                    if (
                        field.type === "Section Break" ||
                        field.type === "Column Break" ||
                        field.type === "Button" ||
                        field.type === "Read Only"
                    ) {
                        nonDataFields.add(field.name);
                    }
                });
            });

            const payload: Record<string, any> = {};
            for (const key in formData) {
                if (!nonDataFields.has(key)) {
                    payload[key] = formData[key];
                }
            }

            // Set docstatus to 1 (submitted)
            payload.docstatus = 1;
            payload.modified = record.modified;

            const response = await axios.put(
                `${API_BASE_URL}/${encodeURIComponent(DOCTYPE_NAME)}/${encodeURIComponent(docname)}`,
                payload,
                {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            toast.success("Document submitted successfully!");

            // Update local state without reload
            const updatedData = response.data.data as AssetInterchangeData;
            setRecord(updatedData);
            setFormDirty(false);

            // Update button to CANCEL after submission
            setActiveButton("CANCEL");

            // Force form remount with new docstatus
            setFormVersion((v) => v + 1);
        } catch (err: any) {
            console.error("Submit error:", err);
            const messages = getApiMessages(null, err, "Document submitted successfully!", "Submit failed");
            toast.error(messages.message);
        } finally {
            setIsSaving(false);
        }
    };

    // CANCEL DOCUMENT
    const handleCancelDocument = async () => {
        if (!record) return;

        if (!window.confirm("Are you sure you want to cancel this document? This action cannot be undone.")) {
            return;
        }

        setIsSaving(true);

        try {
            const payload = {
                docstatus: 2,
                modified: record.modified
            };

            const resp = await axios.put(
                `${API_BASE_URL}/${encodeURIComponent(DOCTYPE_NAME)}/${encodeURIComponent(docname)}`,
                payload,
                {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            toast.success("Document cancelled successfully!");

            // Update local state without reload
            const updatedRecord = resp.data.data as AssetInterchangeData;
            setRecord(updatedRecord);
            setActiveButton(null); // Remove cancel button after cancellation
            setFormDirty(false);
        } catch (err: any) {
            console.error("Cancel error:", err);
            const messages = getApiMessages(null, err, "Document cancelled successfully!", "Cancel failed");
            toast.error(messages.message);
        } finally {
            setIsSaving(false);
        }
    };

    // FORM
    const formTabs: TabbedLayout[] = React.useMemo(() => {
        if (!record) return [];
        const getValue = (f: keyof AssetInterchangeData) => record[f];

        return [{
            name: "Details",
            fields: [
                {
                    name: "lis_name",
                    label: "LIS Name",
                    type: "Link",
                    linkTarget: "Lift Irrigation Scheme",
                    defaultValue: getValue("lis_name")
                },
                {
                    name: "stage",
                    label: "Stage",
                    type: "Link",
                    linkTarget: "Stage No",
                    defaultValue: getValue("stage"),
                    filterMapping: [{ sourceField: "lis_name", targetField: "lis_name" }]
                },
                {
                    name: "posting_date",
                    label: "Posting Date",
                    type: "Date",
                    defaultValue: getValue("posting_date")
                },
                {
                    name: "select_asset",
                    label: "Which Asset To Interchange?",
                    type: "Select",
                    options: [{ label: "Motor", value: "Motor" }, { label: "Pump", value: "Pump" }],
                    defaultValue: assetType || getValue("select_asset"),
                    onChange: handleAssetChange,
                },

                // MOTOR SECTION
                {
                    name: "motor_section",
                    type: "Section Break",
                    label: "Interchange Motor",
                    displayDependsOn: { select_asset: "Motor" }
                },
                {
                    name: "pump_asset",
                    label: "Pump Asset",
                    type: "Link",
                    linkTarget: "Asset",
                    displayDependsOn: { select_asset: "Motor" },
                    defaultValue: getValue("pump_asset"),
                    doctype: "Asset",
                    filters: (getValue) => ({
                        custom_lis_name: getValue("lis_name"),
                        custom_stage_no: getValue("stage"),
                        asset_category: "Pump"
                    }),

                    referenceDoctype: "Asset Interchange",
                },
                {
                    name: "pump_no",
                    label: "Pump No",
                    type: "Read Only",
                    fetchFrom: { sourceField: "pump_asset", targetDoctype: "Asset", targetField: "custom_asset_no" },
                    displayDependsOn: { select_asset: "Motor" },
                    defaultValue: getValue("pump_no")
                },
                {
                    name: "current_motor_asset",
                    label: "Current Motor Asset",
                    type: "Read Only",
                    displayDependsOn: { select_asset: "Motor", pump_asset: true },
                    defaultValue: getValue("current_motor_asset")
                },
                {
                    name: "current_motor_no",
                    label: "Current Motor No",
                    type: "Read Only",
                    displayDependsOn: { select_asset: "Motor", pump_asset: true },
                    defaultValue: getValue("current_motor_no")
                },
                {
                    name: "interchange_motor",
                    label: "Interchange Motor",
                    type: "Link",
                    linkTarget: "Asset",
                    displayDependsOn: { select_asset: "Motor", pump_asset: true },
                    defaultValue: getValue("interchange_motor"),
                    filters: (getValue) => ({
                        custom_lis_name: getValue("lis_name"),
                        custom_stage_no: getValue("stage"),
                        asset_category: "Motor"
                    }),
                },
                {
                    name: "interchange_motor_no",
                    label: "Interchange Motor No",
                    type: "Read Only",
                    displayDependsOn: { select_asset: "Motor", pump_asset: true },
                    defaultValue: getValue("interchange_motor_no")
                },

                // PUMP SECTION
                {
                    name: "pump_section",
                    type: "Section Break",
                    label: "Interchange Pump",
                    displayDependsOn: { select_asset: "Pump" }
                },
                {
                    name: "motor_asset",
                    label: "Motor Asset",
                    type: "Link",
                    linkTarget: "Asset",
                    defaultValue: getValue("motor_asset"),
                    displayDependsOn: { select_asset: "Pump" },
                    doctype: "Asset",
                    filters: (getValue) => ({
                        custom_lis_name: getValue("lis_name"),
                        custom_stage_no: getValue("stage"),
                        asset_category: "Motor"
                    }),

                    referenceDoctype: "Asset Interchange",
                },
                {
                    name: "motor_no_for_pump",
                    label: "Motor No",
                    type: "Read Only",
                    fetchFrom: { sourceField: "motor_asset", targetDoctype: "Asset", targetField: "custom_asset_no" },
                    defaultValue: getValue("motor_no_for_pump"),
                    displayDependsOn: { select_asset: "Pump" }
                },
                {
                    name: "current_pump_asset",
                    label: "Current Pump Asset",
                    type: "Read Only",
                    defaultValue: getValue("current_pump_asset"),
                    displayDependsOn: {
                        select_asset: "Pump",
                        motor_asset: true
                    }
                },
                {
                    name: "current_pump_no",
                    label: "Current Pump No",
                    type: "Read Only",
                    defaultValue: getValue("current_pump_no"),
                    displayDependsOn: { select_asset: "Pump", motor_asset: true }
                },
                {
                    name: "interchange_pump",
                    label: "Interchange Pump",
                    type: "Link",
                    linkTarget: "Asset",
                    defaultValue: getValue("interchange_pump"),
                    displayDependsOn: { select_asset: "Pump", motor_asset: true },
                    filters: (getValue) => ({
                        custom_lis_name: getValue("lis_name"),
                        custom_stage_no: getValue("stage"),
                        asset_category: "Pump"
                    }),
                },
                {
                    name: "interchange_pump_no",
                    label: "Interchange Pump No",
                    type: "Read Only",
                    defaultValue: getValue("interchange_pump_no"),
                    displayDependsOn: { select_asset: "Pump", motor_asset: true }
                },
            ],
        }];
    }, [record, selectedAsset, formVersion]);

    if (loading) return <div style={{ padding: "2rem" }}>Loading...</div>;
    if (!record) return <div style={{ padding: "2rem" }}>Not found</div>;

    const isSubmitted = record.docstatus === 1;
    const isDraft = record.docstatus === 0;

    // Determine submit label based on active button
    const getSubmitLabel = () => {
        if (isSaving) {
            switch (activeButton) {
                case "SAVE": return "Saving...";
                case "SUBMIT": return "Submitting...";
                case "CANCEL": return "Cancelling...";
                default: return "Processing...";
            }
        }

        switch (activeButton) {
            case "SAVE": return "Save";
            case "SUBMIT": return "Submit";
            case "CANCEL": return "Cancel";
            default: return undefined;
        }
    };

    const formKey = `${record.name}-${record.docstatus}-${formVersion}`;

    return (
        <DynamicForm
            key={formKey}
            tabs={formTabs}
            onSubmit={activeButton === "SAVE" ? handleSubmit : async () => { }}
            onSubmitDocument={activeButton === "SUBMIT" ? handleSubmitDocument : undefined}
            onCancelDocument={activeButton === "CANCEL" ? handleCancelDocument : undefined}
            onCancel={() => router.back()}
            title={`${DOCTYPE_NAME}: ${record.name}`}
            description="Update Asset Interchange"
            submitLabel={getSubmitLabel()}
            isSubmittable={activeButton === "SUBMIT"}
            docstatus={record.docstatus}
            initialStatus={isDraft ? "Draft" : isSubmitted ? "Submitted" : "Cancelled"}
            deleteConfig={{
                doctypeName: DOCTYPE_NAME,
                docName: docname,
                redirectUrl: "/assets/doctype/asset-interchange"
            }}
            onFormInit={handleFormInit}
        />
    );
}