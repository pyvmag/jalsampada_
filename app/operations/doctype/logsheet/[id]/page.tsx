"use client";

import * as React from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import {
    DynamicForm,
    TabbedLayout,
    FormField,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

/* -------------------------------------------------
   1. Log Sheet type – mirrors fields from CSV
   ------------------------------------------------- */
interface LogSheetData {
    name: string;
    lis?: string;                    // Link → Lift Irrigation Scheme
    date?: string;                   // Date
    stage?: string;                  // Link → Stage No
    time?: string;                   // Time
    asset?: string;                  // Link → Asset
    operator_id?: string;            // Link → User
    logbook?: string;                // Link → Logbook Ledger (Pump No)
    operator_name?: string;          // Data (fetched)
    water_level?: number;            // Float (2 precision)
    pressure_guage?: number;         // Float (2 precision)
    br?: number;                     // Float – Voltage BR
    ry?: number;                     // Float – Voltage RY
    yb?: number;                     // Float – Voltage YB
    r?: number;                      // Float – Current R
    y?: number;                      // Float – Current Y
    b?: number;                      // Float – Current B
    temperature_readings?: Array<{
        name?: string;               // Optional - row name/id from Frappe
        temperature?: number;        // Temperature field
        temp_value?: number;         // Temp Value field
    }>;                              // Table → Temperature Reading Details
    remark?: string;                 // Text
    amended_from?: string;           // Link → Log Sheet
    // System fields
    docstatus: 0 | 1 | 2;
    modified: string;
    owner?: string;
    modified_by?: string;
}

/* -------------------------------------------------
   2. Page component
   ------------------------------------------------- */
export default function LogSheetDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const docname = params.id as string;
    const doctypeName = "Log Sheet";

    const [record, setRecord] = React.useState<LogSheetData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const isProgrammaticUpdate = React.useRef(false);
    const [formVersion, setFormVersion] = React.useState(0);
    const [formInstance, setFormInstance] = React.useState<any>(null);

    // NEW: Track which button to show
    const [activeButton, setActiveButton] = React.useState<"SAVE" | "SUBMIT" | "CANCEL" | null>(null);
    const [formDirty, setFormDirty] = React.useState(false);

    /* -------------------------------------------------
       3. FETCH RECORD
       ------------------------------------------------- */
    React.useEffect(() => {
        const fetchRecord = async () => {
            if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const resp = await axios.get(
                    `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${encodeURIComponent(docname)}`,
                    {
                        headers: {
                            Authorization: `token ${apiKey}:${apiSecret}`,
                            "Content-Type": "application/json",
                        },
                        withCredentials: true,
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                    }
                );

                const data = resp.data.data as LogSheetData;
                setRecord(data);

                // Initialize button state based on document status
                if (data.docstatus === 0) { // Draft
                    setActiveButton("SUBMIT");
                } else if (data.docstatus === 1) { // Submitted
                    setActiveButton("CANCEL");
                }

                setFormDirty(false);
            } catch (err: any) {
                console.error("API Error:", err);

                const messages = getApiMessages(
                    null,
                    err,
                    "Record loaded successfully",
                    "Failed to load record",
                    (error) => {
                        if (error.response?.status === 404) return "Log Sheet not found";
                        if (error.response?.status === 403) return "Unauthorized";
                        return "Failed to load record";
                    }
                );

                setError(messages.description || messages.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRecord();
    }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

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

    const handleFormInit = React.useCallback((form: any) => {
        setFormInstance(form);
    }, []);

    /* -------------------------------------------------
       4. Build form tabs structure
       ------------------------------------------------- */
    const formTabs: TabbedLayout[] = React.useMemo(() => {
        if (!record) return [];

        const fields = (list: FormField[]): FormField[] =>
            list.map((f) => ({
                ...f,
                defaultValue:
                    f.name in record
                        ? // @ts-ignore
                        record[f.name as keyof LogSheetData]
                        : f.defaultValue,
            }));

        return [
            {
                name: "Details",
                fields: fields([
                    { name: "lis", label: "LIS", type: "Link", linkTarget: "Lift Irrigation Scheme", required: true },
                    {
                        name: "stage",
                        label: "Stage/ Sub Scheme",
                        type: "Link",
                        linkTarget: "Stage No",
                        defaultValue: record?.stage,
                        required: true,
                        filterMapping: [
                            { sourceField: "lis", targetField: "lis_name" }
                        ]
                    },
                    { name: "date", label: "Date", type: "Date", defaultValue: "Today", required: true },
                    { name: "time", label: "Time", type: "Time", defaultValue: record?.time, required: true },
                    {
                        name: "asset",
                        label: "Asset",
                        type: "Link",
                        linkTarget: "Asset",
                        required: true,
                        customSearchUrl: "http://103.219.1.138:4412/api/method/frappe.desk.search.search_link",
                        customSearchParams: {
                            filters: {
                                asset_category: "Pump",
                                custom_pump_status: "Running"
                            }
                        },
                        filters: (getValue) => ({
                            custom_stage_no: getValue("stage"),
                            custom_lis_name: getValue("lis")
                        }),
                        referenceDoctype: "Log Sheet",
                        doctype: "Asset",
                        defaultValue: record?.asset,
                    },

                    { name: "logbook", label: "Pump No", type: "Link", linkTarget: "Logbook Ledger", fetchFrom: { sourceField: "asset", targetDoctype: "Asset", targetField: "custom_asset_no" } },
                    { name: "operator_id", label: "Operator ID", type: "Read Only" },
                    { name: "operator_name", label: "Operator Name", type: "Read Only" },
                    { name: "section_break_mgrv", label: "", type: "Section Break" },
                    { name: "water_level", label: "Water Level (In Meters)", type: "Float", precision: 2 },
                    { name: "pressure_guage", label: "Pressure Guage Reading (in Kg/cm2)", type: "Float", precision: 2 },
                    { name: "voltage_section", label: "Voltage Reading (In Volt)", type: "Section Break" },
                    { name: "br", label: "BR", type: "Float", precision: 2 },
                    { name: "ry", label: "RY", type: "Float", precision: 2 },
                    { name: "yb", label: "YB", type: "Float", precision: 2 },
                    { name: "current_reading_section", label: "Current Reading (In Ampere)", type: "Section Break" },
                    { name: "r", label: "R", type: "Float", precision: 2 },
                    { name: "y", label: "Y", type: "Float", precision: 2 },
                    { name: "b", label: "B", type: "Float", precision: 2 },
                    { name: "section_break_qzro", label: "", type: "Section Break" },
                    {
                        name: "temperature_readings",
                        label: "Temperature Readings (In °C)",
                        className: "big-table-label",
                        type: "Table",
                        columns: [
                            {
                                name: "temperature",
                                label: "Temperature",
                                type: "Link",
                                linkTarget: "Temperature Readings",
                            },
                            {
                                name: "temp_value",
                                label: "Temp Value",
                                type: "Float",
                                precision: 2,
                            },
                        ],
                    },
                    { name: "remark", label: "Remark", type: "Small Text" },
                ]),
            }
        ];
    }, [record]);

    /* -------------------------------------------------
       5. SAVE (UPDATE) DOCUMENT
       ------------------------------------------------- */
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

            const allFields = formTabs.flatMap((tab) => tab.fields);
            const nonDataFields = new Set<string>();
            allFields.forEach((field) => {
                if (
                    field.type === "Section Break" ||
                    field.type === "Column Break" ||
                    field.type === "Button" ||
                    field.type === "Read Only"
                ) {
                    nonDataFields.add(field.name);
                }
            });

            const finalPayload: Record<string, any> = {};
            for (const key in payload) {
                if (!nonDataFields.has(key)) {
                    finalPayload[key] = payload[key];
                }
            }

            finalPayload.modified = record.modified;
            finalPayload.docstatus = record.docstatus;

            const floatFields = [
                "water_level", "pressure_guage",
                "br", "ry", "yb",
                "r", "y", "b"
            ];
            floatFields.forEach((f) => {
                if (f in finalPayload) {
                    finalPayload[f] = Number(finalPayload[f]) || 0;
                }
            });

            // Child table numeric conversions
            if (Array.isArray(finalPayload.temperature_readings)) {
                finalPayload.temperature_readings = finalPayload.temperature_readings.map(
                    (row: any) => {
                        return {
                            ...row,
                            temp_value: Number(row.temp_value) || 0,
                        };
                    }
                );
            }

            console.log("Sending this PAYLOAD to Frappe:", finalPayload);

            const resp = await axios.put(
                `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${encodeURIComponent(docname)}`,
                finalPayload,
                {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json",
                    },
                    withCredentials: true,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
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
                const updatedData = resp.data.data as LogSheetData;
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

    /* -------------------------------------------------
       6. SUBMIT DOCUMENT
       ------------------------------------------------- */
    const handleSubmitDocument = async () => {
        if (!record) return;

        setIsSaving(true);

        try {
            // Prepare payload similar to handleSubmit
            const payload: Record<string, any> = { ...record };

            // Convert numeric fields
            const floatFields = [
                "water_level", "pressure_guage",
                "br", "ry", "yb",
                "r", "y", "b"
            ];
            floatFields.forEach((f) => {
                if (f in payload) {
                    payload[f] = Number(payload[f]) || 0;
                }
            });

            // Child table numeric conversions
            if (Array.isArray(payload.temperature_readings)) {
                payload.temperature_readings = payload.temperature_readings.map((row: any) => ({
                    ...row,
                    temp_value: Number(row.temp_value) || 0,
                }));
            }

            // Set docstatus to 1 (submitted)
            payload.docstatus = 1;

            const response = await axios.put(
                `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${encodeURIComponent(docname)}`,
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
            const updatedData = response.data.data as LogSheetData;
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

    /* -------------------------------------------------
       7. CANCEL DOCUMENT
       ------------------------------------------------- */
    const handleCancelDocument = async () => {
        if (!record) return;

        if (!window.confirm("Are you sure you want to cancel this Log Sheet? This action cannot be undone.")) {
            return;
        }

        setIsSaving(true);

        try {
            const payload = {
                docstatus: 2,
                modified: record.modified
            };

            const resp = await axios.put(
                `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${encodeURIComponent(docname)}`,
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
            const updatedRecord = resp.data.data as LogSheetData;
            setRecord(updatedRecord);
            setActiveButton(null); // Remove cancel button after cancellation
        } catch (err: any) {
            console.error("Cancel error:", err);
            const messages = getApiMessages(null, err, "Document cancelled successfully!", "Cancel failed");
            toast.error(messages.message);
        } finally {
            setIsSaving(false);
        }
    };

    /* -------------------------------------------------
       8. UI STATES
       ------------------------------------------------- */
    if (loading) {
        return (
            <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
                <p>Loading Log Sheet details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="module active" style={{ padding: "2rem" }}>
                <p style={{ color: "var(--color-error)" }}>{error}</p>
                <button className="btn btn--primary" onClick={() => window.location.reload()}>
                    Retry
                </button>
            </div>
        );
    }

    if (!record) {
        return (
            <div className="module active" style={{ padding: "2rem" }}>
                <p>Log Sheet record not found.</p>
            </div>
        );
    }

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

    const isSubmitted = record.docstatus === 1;
    const isDraft = record.docstatus === 0;

    const formKey = `${record.name}-${record.docstatus}-${formVersion}`;

    /* -------------------------------------------------
       9. RENDER FORM
       ------------------------------------------------- */
    return (
        <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
            <DynamicForm
                key={formKey}
                tabs={formTabs}
                onSubmit={activeButton === "SAVE" ? handleSubmit : async () => { }}
                onSubmitDocument={activeButton === "SUBMIT" ? handleSubmitDocument : undefined}
                onCancelDocument={activeButton === "CANCEL" ? handleCancelDocument : undefined}
                onCancel={() => router.back()}
                title={`${doctypeName}: ${record.name}`}
                description={`Update details for record ID: ${docname}`}
                isSubmittable={activeButton === "SUBMIT"}
                docstatus={record.docstatus}
                initialStatus={isDraft ? "Draft" : isSubmitted ? "Submitted" : "Cancelled"}
                onFormInit={handleFormInit}
                submitLabel={getSubmitLabel()}
                deleteConfig={{
                    doctypeName: doctypeName,
                    docName: docname,
                    redirectUrl: "/operations/doctype/logsheet",
                }}
            />

            <div className="w-full px-4 md:px-8">
                <DocumentActivity
                    doctype={doctypeName}
                    docname={docname}
                    baseUrl={API_BASE_URL.replace("/api/resource", "")}
                    apiKey={apiKey || ""}
                    apiSecret={apiSecret || ""}
                    isInitialized={isInitialized}
                    currentUserEmail={record.owner}
                    modifiedStr={record.modified}
                    modifiedBy={record.modified_by}
                />
            </div>
        </div>
    );
}