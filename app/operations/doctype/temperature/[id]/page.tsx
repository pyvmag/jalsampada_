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
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

/* -------------------------------------------------
   1. Temperature Readings type
   ------------------------------------------------- */
interface TemperatureReadingData {
    name: string;
    temperature?: string;           // Data type (as string)
    // System fields
    docstatus: 0 | 1 | 2;
    modified: string;
    owner?: string;
    modified_by?: string;
}

/* -------------------------------------------------
   2. Page component
   ------------------------------------------------- */
export default function TemperatureReadingDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const docname = params.id as string;
    const doctypeName = "Temperature Readings";

    const [record, setRecord] = React.useState<TemperatureReadingData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

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

                const resp = await axios.get(`${API_BASE_URL}/${doctypeName}/${docname}`, {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json",
                    },
                    withCredentials: true,
                });

                setRecord(resp.data.data);
            } catch (err: any) {
                console.error("API Error:", err);
                setError(
                    err.response?.status === 404
                        ? "Temperature Readings not found"
                        : err.response?.status === 403
                            ? "Unauthorized"
                            : "Failed to load record"
                );
            } finally {
                setLoading(false);
            }
        };

        fetchRecord();
    }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

    /* -------------------------------------------------
       4. Form structure – only one tab with one field
       ------------------------------------------------- */
    const formTabs: TabbedLayout[] = React.useMemo(() => {
        if (!record) return [];

        return [
            {
                name: "Details",
                fields: [
                    {
                        name: "temperature",
                        label: "Temperature",
                        type: "Data",
                        defaultValue: record.temperature || "",
                        placeholder: "Enter Temperature Readings",
                    },
                ],
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
            const payload = {
                temperature: data.temperature?.trim() || "",
                modified: record?.modified,
                docstatus: record?.docstatus,
            };

            console.log("Sending payload:", payload);

            const resp = await axios.put(
                `${API_BASE_URL}/${doctypeName}/${docname}`,
                payload,
                {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json",
                    },
                    withCredentials: true,
                }
            );

            toast.success("Temperature Readings updated successfully!");

            if (resp.data?.data) {
                setRecord(resp.data.data);
            }

            router.push(`/operations/doctype/temperature/${encodeURIComponent(docname)}`);

        } catch (err: any) {
            console.error("Save error:", err);
            toast.error("Failed to save", {
                description: err.response?.data?.message || err.message || "Unknown error",
                duration: Infinity
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => router.back();

    /* -------------------------------------------------
       6. UI STATES
       ------------------------------------------------- */
    if (loading) {
        return (
            <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
                <p>Loading Temperature Readings...</p>
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
                <p>Temperature Readings not found.</p>
            </div>
        );
    }

    /* -------------------------------------------------
       7. RENDER FORM
       ------------------------------------------------- */
    return (
        <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
            <DynamicForm
                tabs={formTabs}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                title={`${doctypeName}: ${record.name}`}
                description={`Record ID: ${docname}`}
                submitLabel={isSaving ? "Saving..." : "Save"}
                cancelLabel="Cancel"
                deleteConfig={{
                    doctypeName: doctypeName,
                    docName: docname,
                    redirectUrl: "/operations/doctype/temperature"
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