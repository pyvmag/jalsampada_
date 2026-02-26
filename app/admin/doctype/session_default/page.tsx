"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
    DynamicForm,
    TabbedLayout,
    FormField,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { TimeAgo } from "@/components/TimeAgo";

const API_BASE_URL = "http://103.219.3.169:2223";

/* -------------------------------------------------
   1. Session Default data interface
------------------------------------------------- */

interface SessionDefaultData {
    company?: string;
    lift_irrigation_scheme?: string;
    stage_no?: string;
}

interface SessionDefaultField {
    fieldname: string;
    fieldtype: string;
    options?: string;
    label: string;
    default?: string;
}

/* -------------------------------------------------
   2. Page component
------------------------------------------------- */

export default function SessionDefaultPage() {
    const router = useRouter();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const [record, setRecord] = React.useState<SessionDefaultData | null>(null);
    const [fields, setFields] = React.useState<SessionDefaultField[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [lastModified, setLastModified] = React.useState<string | null>(null);

    /* -------------------------------------------------
       3. FETCH session default fields and values
    ------------------------------------------------- */

    React.useEffect(() => {
        const fetchSessionDefaults = async () => {
            if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                // Fetch the fields configuration
                const fieldsResp = await axios.get(
                    `${API_BASE_URL}/api/method/frappe.core.doctype.session_default_settings.session_default_settings.get_session_default_values`,
                    {
                        headers: {
                            Authorization: `token ${apiKey}:${apiSecret}`,
                            "Content-Type": "application/json",
                        },
                        withCredentials: true,
                    }
                );

                const fieldsData = JSON.parse(fieldsResp.data.message) as SessionDefaultField[];
                setFields(fieldsData);

                // Create default values object from fields
                const defaultValues: SessionDefaultData = {};
                fieldsData.forEach((field) => {
                    if (field.default) {
                        defaultValues[field.fieldname as keyof SessionDefaultData] = field.default;
                    }
                });

                setRecord(defaultValues);
                
                // Try to get the last modified time from the response headers or a separate API call
                // For now, we'll use the current time as a placeholder since the API doesn't return modification time
                setLastModified(new Date().toISOString());
            } catch (err: any) {
                console.error("API Error:", err);
                setError(
                    err.response?.status === 403
                        ? "Unauthorized"
                        : "Failed to load session default settings"
                );
            } finally {
                setLoading(false);
            }
        };

        fetchSessionDefaults();
    }, [apiKey, apiSecret, isAuthenticated, isInitialized]);

    /* -------------------------------------------------
       4. Build form fields
    ------------------------------------------------- */

    const formTabs: TabbedLayout[] = React.useMemo(() => {
        if (!fields.length) return [];

        const formFields: FormField[] = fields.map((field) => {
            const formField: FormField = {
                name: field.fieldname,
                label: field.label,
                type: field.fieldtype === "Link" ? "Link" :
                    field.fieldtype === "Data" ? "Data" :
                        "Text",
                defaultValue: field.default || "",
            };

            if (field.fieldtype === "Link" && field.options) {
                formField.linkTarget = field.options;
            }

            return formField;
        });

        return [
            {
                name: "Session Defaults",
                fields: formFields,
            },
        ];
    }, [fields]);

    /* -------------------------------------------------
       5. SUBMIT
    ------------------------------------------------- */

    const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
        if (!isDirty) {
            toast.info("No changes to save.");
            return;
        }

        if (!apiKey || !apiSecret) {
            toast.error("Missing API credentials.", { duration: Infinity });
            return;
        }

        setIsSaving(true);
        try {
            // Get current values to compare with new values
            const currentValues = record || {};

            // Prepare default_values payload
            const defaultValues: any = {};

            fields.forEach((field) => {
                const fieldName = field.fieldname;
                const newValue = data[fieldName];
                const currentValue = currentValues[fieldName as keyof SessionDefaultData];

                // Add to payload if value has changed or is set
                if (newValue !== undefined && newValue !== currentValue) {
                    defaultValues[fieldName] = newValue;
                } else if (newValue !== undefined) {
                    defaultValues[fieldName] = newValue;
                }
            });

            // Add empty fields that might be required by API
            if (Object.keys(defaultValues).length > 0) {
                defaultValues.__section_1 = "";
                defaultValues.settings = "";
            }

            if (Object.keys(defaultValues).length === 0) {
                toast.info("No changes to save.");
                setIsSaving(false);
                return;
            }

            // Save session default values using correct API
            const resp = await axios.post(
                `${API_BASE_URL}/api/method/frappe.core.doctype.session_default_settings.session_default_settings.set_session_default_values`,
                {
                    default_values: defaultValues
                },
                {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json",
                    },
                    withCredentials: true,
                }
            );

            toast.success("Session defaults saved successfully!");

            // Update local record with new values
            const updatedRecord: SessionDefaultData = {};
            fields.forEach((field) => {
                const fieldName = field.fieldname;
                if (data[fieldName] !== undefined) {
                    updatedRecord[fieldName as keyof SessionDefaultData] = data[fieldName];
                }
            });
            setRecord(updatedRecord);

        } catch (err: any) {
            console.error("Save error:", err);
            toast.error("Failed to save session defaults", {
                description: err.response?.data?.exception || err.message || "Unknown error",
                duration: Infinity
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => router.back();

    /* -------------------------------------------------
       6. UI states
    ------------------------------------------------- */

    if (loading) {
        return (
            <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
                <p>Loading session default settings...</p>
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

    if (!fields.length) {
        return (
            <div className="module active" style={{ padding: "2rem" }}>
                <p>No session default fields available.</p>
            </div>
        );
    }

    /* -------------------------------------------------
       7. Render form
    ------------------------------------------------- */

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-2xl font-semibold">Session Default Settings</h2>
                    <p className="text-gray-600 dark:text-gray-400">Configure default values for session</p>
                </div>
                {lastModified && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Last updated: <TimeAgo date={lastModified} />
                    </div>
                )}
            </div>
            <DynamicForm
                tabs={formTabs}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                title=""
                description=""
                submitLabel={isSaving ? "Saving..." : "Save"}
                cancelLabel="Cancel"
            />
        </div>
    );
}