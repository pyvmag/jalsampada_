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
import { renameDocument } from "@/lib/services";
import DocumentActivity from "@/components/DocumentActivity";

// API base URL
const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

// ----------------------
// 1. Types
// ----------------------
interface ParameterTypeData {
    name: string;
    parameter_type?: string;
    docstatus: 0 | 1 | 2;
    modified: string;
    owner?: string;
    modified_by?: string;
}

// ----------------------
// 2. Component
// ----------------------
export default function ParameterTypeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const docname = params.id as string;
    const doctypeName = "Parameter Type";

    const [record, setRecord] = React.useState<ParameterTypeData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    // ----------------------
    // Fetch record
    // ----------------------
    React.useEffect(() => {
        const fetchDoc = async () => {
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

                setRecord(resp.data.data as ParameterTypeData);
            } catch (err: any) {
                console.error("API Error:", err);
                setError(
                    err.response?.status === 404
                        ? `${doctypeName} not found`
                        : err.response?.status === 403
                            ? "Unauthorized"
                            : `Failed to load ${doctypeName}`
                );
            } finally {
                setLoading(false);
            }
        };

        fetchDoc();
    }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

    // ----------------------
    // Build form tabs
    // ----------------------
    const formTabs: TabbedLayout[] = React.useMemo(() => {
        if (!record) return [];

        const fields = (list: FormField[]): FormField[] =>
            list.map((f) => ({
                ...f,
                // @ts-ignore
                defaultValue: f.name in record ? record[f.name as keyof ParameterTypeData] : f.defaultValue,
            }));

        return [
            {
                name: "Details",
                fields: fields([
                    {
                        name: "parameter_type",
                        label: "Parameter Type",
                        type: "Data",
                        required: true,
                    },
                ]),
            },
        ];
    }, [record]);

    // ----------------------
    // Submit handler
    // ----------------------
    const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
        if (!isDirty) {
            toast.info("No changes to save.");
            return;
        }

        if (!record) {
            toast.error("Record not loaded. Cannot save.", { duration: Infinity });
            return;
        }

        if (!apiKey || !apiSecret) {
            toast.error("Missing API credentials.");
            return;
        }

        setIsSaving(true);

        try {
            let currentDocname = docname;
            const newParameterTypeName = data.parameter_type;

            /* ------------ RENAME ------------ */
            if (
                newParameterTypeName &&
                newParameterTypeName !== record.parameter_type &&
                newParameterTypeName !== record.name
            ) {
                try {
                    await renameDocument(
                        apiKey,
                        apiSecret,
                        doctypeName,
                        record.name,
                        newParameterTypeName
                    );

                    currentDocname = newParameterTypeName; // ✅ CRITICAL

                    setRecord((prev) =>
                        prev
                            ? {
                                ...prev,
                                name: newParameterTypeName,
                                parameter_type: newParameterTypeName,
                            }
                            : null
                    );

                    router.replace(
                        `/maintenance/doctype/parameter-type/${newParameterTypeName}`
                    );
                } catch (renameError: any) {
                    console.error("Rename error:", renameError);
                    toast.error("Failed to rename document", {
                        description:
                            renameError.response?.data?.message || renameError.message,
                    });
                    setIsSaving(false);
                    return;
                }
            }

            /* ------------ CLEAN PAYLOAD ------------ */
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

            /* ------------ UPDATE ------------ */
            const resp = await axios.put(
                `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${encodeURIComponent(currentDocname)}`, // ✅ FIXED
                finalPayload,
                {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json",
                    },
                    withCredentials: true,
                }
            );

            toast.success("Changes saved!");

            if (resp.data?.data) {
                setRecord(resp.data.data as ParameterTypeData);
            }

            router.push(`/maintenance/doctype/parameter-type/${currentDocname}`); // ✅ FIXED
        } catch (err: any) {
            console.error("Save error:", err);
            console.log("Full server error:", err.response?.data);
            toast.error("Failed to save", {
                description: err.response?.data?.message || err.message,
                duration: Infinity,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => router.back();

    // ----------------------
    // UI States
    // ----------------------
    if (loading) {
        return (
            <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
                <p>Loading {doctypeName} details...</p>
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
                <p>{doctypeName} not found.</p>
            </div>
        );
    }

    // ----------------------
    // Render form
    // ----------------------
    return (
        <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
            <DynamicForm
                tabs={formTabs}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                title={`${doctypeName}: ${record.name}`}
                description={`Update details for record ID: ${docname}`}
                submitLabel={isSaving ? "Saving..." : "Save"}
                cancelLabel="Cancel"
                deleteConfig={{
                    doctypeName: doctypeName,
                    docName: docname,
                    redirectUrl: "/maintenance/doctype/parameter-type",
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