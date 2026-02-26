"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
    DynamicForm,
    TabbedLayout,
    FormField,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { UseFormReturn } from "react-hook-form";
import { getApiMessages } from "@/lib/utils";
import axios from "axios";
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
const API_METHOD_URL = "http://103.219.3.169:2223/api/method";
const DOCTYPE_NAME = "Gate Operation Logbook";

/* -------------------------------------------------
   1. Gate Operation Logbook interface
   ------------------------------------------------- */
interface GateOperationLogbookData {
    name: string;
    lis_name?: string;              // Link to Lift Irrigation Scheme
    lis_phase?: string;             // Link to LIS Phases
    stage?: string;                 // Link to Stage No
    gate_no?: string;               // Link to Gate
    gate_operation?: "Lift" | "Lowered"; // Select
    lift_by?: number;               // Float - meters
    lowered_by?: number;            // Float - meters
    lift_date?: string;             // DateTime
    lowered_date?: string;          // DateTime
    instruction_reference?: string; // Small Text
    remark?: string;                // Text
    // System fields
    docstatus: 0 | 1 | 2;
    modified: string;
    owner?: string;
    modified_by?: string;
}

/* -------------------------------------------------
   2. Page component
   ------------------------------------------------- */
export default function GateOperationLogbookDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const docname = params.id as string;
    const doctypeName = "Gate Operation Logbook"; // ← Change if your actual DocType name is different

    const [record, setRecord] = React.useState<GateOperationLogbookData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [formInitialized, setFormInitialized] = React.useState(false);
    const [formMethods, setFormMethods] = React.useState<UseFormReturn<any> | null>(null);

    // 🟢 Badge Status Logic
    const getCurrentStatus = () => {
        if (!record) return "";

        // 1. If Cancelled
        if (record.docstatus === 2) return "Cancelled";

        // 2. If Submitted
        if (record.docstatus === 1) return "Submitted";

        // 3. If Draft (docstatus === 0)
        if (record.docstatus === 0) {
            // Check if form has unsaved changes
            if (formMethods?.formState.isDirty) {
                return "Not Saved";
            }
            return "Draft";
        }

        return "";
    };

    // Status mapping function (kept for backward compatibility)
    const getStatusDisplay = (docstatus: number | undefined) => {
        switch (docstatus) {
            case 0: return "Draft";
            case 1: return "Submitted";
            case 2: return "Cancelled";
            default: return "Draft";
        }
    };

    /* -------------------------------------------------
       3. FETCH RECORD
       ------------------------------------------------- */
    const fetchRecord = async () => {
        if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const resp = await axios.get(`${API_BASE_URL}/${DOCTYPE_NAME}/${docname}`, {
                headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            });
            setRecord(resp.data.data);
        } catch (err: any) {
            setError("Failed to load Gate Operation Logbook record.");
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => { fetchRecord(); }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

    // 🟢 SUBMIT DOCUMENT
    const handleSubmitDocument = async () => {
        setIsSaving(true);
        try {
            const resp = await axios.put(`${API_BASE_URL}/${DOCTYPE_NAME}/${docname}`, {
                docstatus: 1
            }, {
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    "Content-Type": "application/json",
                },
                withCredentials: true,
            });

            const messages = getApiMessages(resp, null, "Document submitted successfully!", "Failed to submit document");
            if (messages.success) {
                toast.success(messages.message);
                setRecord(resp.data.data);
            } else {
                toast.error(messages.message, { description: messages.description, duration: Infinity });
            }
        } catch (err: any) {
            const messages = getApiMessages(null, err, null, "Failed to submit document");
            toast.error(messages.message, { description: messages.description, duration: Infinity });
        } finally {
            setIsSaving(false);
        }
    };

    // 🟢 CANCEL DOCUMENT
    const handleCancelDocument = async () => {
        setIsSaving(true);
        try {
            const resp = await axios.put(`${API_BASE_URL}/${DOCTYPE_NAME}/${docname}`, {
                docstatus: 2
            }, {
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    "Content-Type": "application/json",
                },
                withCredentials: true,
            });

            const messages = getApiMessages(resp, null, "Document cancelled successfully!", "Failed to cancel document");
            if (messages.success) {
                toast.success(messages.message);
                setRecord(resp.data.data);
            } else {
                toast.error(messages.message, { description: messages.description, duration: Infinity });
            }
        } catch (err: any) {
            const messages = getApiMessages(null, err, null, "Failed to cancel document");
            toast.error(messages.message, { description: messages.description, duration: Infinity });
        } finally {
            setIsSaving(false);
        }
    };

    // Handle form initialization to set proper baseline values
    const handleFormInit = React.useCallback((methods: any) => {
        if (record && !formInitialized) {
            const formData = {
                lis_name: record.lis_name || "",
                lis_phase: record.lis_phase || "",
                stage: record.stage || "",
                gate_no: record.gate_no || "",
                gate_operation: record.gate_operation || "",
                lift_by: record.lift_by ?? "",
                lift_date: record.lift_date || "",
                lowered_by: record.lowered_by ?? "",
                lowered_date: record.lowered_date || "",
                instruction_reference: record.instruction_reference || "",
                remark: record.remark || "",
            };

            // Use setTimeout to ensure the form is fully initialized
            setTimeout(() => {
                methods.reset(formData);
                setFormInitialized(true);
            }, 100);
        }
        setFormMethods(methods);
    }, [record, formInitialized]);

    /* -------------------------------------------------
       4. Form structure
       ------------------------------------------------- */
    const formTabs: TabbedLayout[] = React.useMemo(() => {
        if (!record) return [];

        const fields = (list: FormField[]): FormField[] =>
            list.map((f) => ({
                ...f,
                defaultValue:
                    f.name in record
                        ? // @ts-ignore
                        record[f.name as keyof GateOperationLogbookData]
                        : f.defaultValue,
            }));

        return [
            {
                name: "Details",
                fields: fields([
                    // Main information row
                    {
                        name: "lis_name",
                        label: "LIS Name",
                        type: "Link",
                        linkTarget: "Lift Irrigation Scheme",
                        required: true,
                    },

                    {
                        name: "stage",
                        label: "Stage/ Sub Scheme",
                        type: "Link",
                        linkTarget: "Stage No",
                        required: true,
                        filterMapping: [
                            {
                                sourceField: "lis_name",

                                targetField: "lis_name"
                            }
                        ],
                    },


                    {
                        name: "gate_no",
                        label: "Gate No",
                        type: "Link",
                        linkTarget: "Gate",
                        required: true,
                        customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
                        filters: (getValue) => {
                            const filters: Record<string, any> = {};
                            const stage = getValue("stage");
                            const lisName = getValue("lis_name");
                            if (stage) filters.stage = stage;
                            if (lisName) filters.lis_name = lisName;
                            return filters;
                        },
                        referenceDoctype: "Gate",
                        doctype: "Gate",
                    },

                    // Gate Operations Section
                    {
                        name: "gate_operations_section",
                        label: "Gate Operations",
                        type: "Section Break",
                    },

                    {
                        name: "gate_operation",
                        label: "Gate Operation",
                        type: "Select",
                        options: "Lift\nLowered",
                        required: true,
                    },

                    // Conditional Fields: Lift
                    {
                        name: "lift_by",
                        label: "Lift By (In Meters)",
                        type: "Float",
                        precision: 2,
                        displayDependsOn: "gate_operation=='Lift'",
                    },
                    {
                        name: "lift_date",
                        label: "Lift Date",
                        type: "DateTime",
                        displayDependsOn: "gate_operation=='Lift'",
                    },

                    // Conditional Fields: Lowered
                    {
                        name: "lowered_by",
                        label: "Lowered By (In Meters)",
                        type: "Float",
                        precision: 2,
                        displayDependsOn: "gate_operation=='Lowered'",
                    },
                    {
                        name: "lowered_date",
                        label: "Lowered Date",
                        type: "DateTime",
                        displayDependsOn: "gate_operation=='Lowered'",
                    },

                    // Final information
                    { name: "section_break_ttnk", label: "", type: "Section Break" },

                    {
                        name: "instruction_reference",
                        label: "Instruction Reference",
                        type: "Small Text",
                    },

                    {
                        name: "remark",
                        label: "Remark",
                        type: "Small Text",
                    },
                ]),
            },
        ];
    }, [record]);

    /* -------------------------------------------------
       5. SUBMIT HANDLER
       ------------------------------------------------- */
    const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
        if (!isDirty) {
            toast.info("No changes to save.");
            return;
        }

        setIsSaving(true);

        try {
            const payload: Record<string, any> = {
                lis_name: data.lis_name?.trim() || "",
                lis_phase: data.lis_phase?.trim() || "",
                stage: data.stage?.trim() || "",
                gate_no: data.gate_no?.trim() || "",
                gate_operation: data.gate_operation || "",
                instruction_reference: data.instruction_reference?.trim() || "",
                remark: data.remark?.trim() || "",
                modified: record?.modified,
                docstatus: record?.docstatus,
            };

            // Include conditional fields only if relevant
            if (data.gate_operation === "Lift") {
                payload.lift_by = Number(data.lift_by) || 0;
                payload.lift_date = data.lift_date || "";
                payload.lowered_by = 0;
                payload.lowered_date = "";
            } else if (data.gate_operation === "Lowered") {
                payload.lowered_by = Number(data.lowered_by) || 0;
                payload.lowered_date = data.lowered_date || "";
                payload.lift_by = 0;
                payload.lift_date = "";
            }

            await axios.put(`${API_BASE_URL}/${DOCTYPE_NAME}/${docname}`, payload, {
                headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            });
            toast.success("Gate Operation Logbook updated successfully!");
            fetchRecord();

        } catch (err: any) {
            toast.error("Failed to update record", { duration: Infinity });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => router.push('/operations/doctype/gate-operation-logbook');

    /* -------------------------------------------------
       6. UI STATES
       ------------------------------------------------- */
    if (loading) return <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>Loading Gate Operation Logbook...</div>;

    if (error) return (
        <div className="module active" style={{ padding: "2rem" }}>
            <p style={{ color: "var(--color-error)" }}>{error}</p>
            <button className="btn btn--primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
    );

    if (!record) return <div className="module active" style={{ padding: "2rem" }}>Record not found.</div>;

    /* -------------------------------------------------
       7. RENDER
       ------------------------------------------------- */
    return (
        <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
            <DynamicForm
                tabs={formTabs}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                onSubmitDocument={handleSubmitDocument}
                onCancelDocument={handleCancelDocument}
                onFormInit={handleFormInit}
                title={`${DOCTYPE_NAME}: ${record.name}`}
                description={`Record ID: ${docname}`}
                initialStatus={getCurrentStatus()}
                docstatus={record.docstatus}
                submitLabel={isSaving ? "Saving..." : "Save Changes"}
                isSubmittable={true}
                deleteConfig={{
                    doctypeName: DOCTYPE_NAME,
                    docName: docname,
                    redirectUrl: "/operations/doctype/gate-operation-logbook"
                }}
            />

            <div className="w-full px-4 md:px-8">
                <DocumentActivity
                    doctype={DOCTYPE_NAME}
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