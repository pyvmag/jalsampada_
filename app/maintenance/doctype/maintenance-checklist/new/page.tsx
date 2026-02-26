"use client";

import * as React from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import {
    DynamicForm,
    TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { MaintenanceChecklistMatrix } from "@/app/maintenance/doctype/maintenance-checklist/components/MaintenanceChecklistMatrix"; // Import the new component

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

export default function NewMaintenanceChecklistPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
    const doctypeName = "Maintenance Checklist";
    const [isSaving, setIsSaving] = React.useState(false);

    // Parse duplicate data
    const duplicateData = React.useMemo(() => {
        const duplicateParam = searchParams.get('duplicate');
        if (!duplicateParam) return null;
        try {
            return JSON.parse(atob(decodeURIComponent(duplicateParam)));
        } catch (error) {
            console.error("Error parsing duplicate data:", error);
            return null;
        }
    }, [searchParams]);

    React.useEffect(() => {
        if (duplicateData) {
            toast.success("Form populated with duplicate data.");
        }
    }, [duplicateData]);

    const formTabs: TabbedLayout[] = React.useMemo(() => {
        const getValue = (fieldName: string, defaultValue: any = undefined) => {
            return duplicateData?.[fieldName] ?? defaultValue;
        };

        return [
            {
                name: "Details",
                fields: [
                    { name: "posting_datetime", label: "Posting Datetime", type: "DateTime", defaultValue: getValue("posting_datetime") },
                    {
                        name: "lis_name",
                        label: "LIS Name",
                        type: "Link",
                        linkTarget: "Lift Irrigation Scheme",
                        required: true,
                        defaultValue: getValue("lis_name"),
                    },
                    {
                        name: "stage",
                        label: "Stage",
                        type: "Link",
                        linkTarget: "Stage No", // Or handle dynamic filtering via props if needed later
                        defaultValue: getValue("stage"),
                        // Note: You mentioned filtering stage by LIS. 
                        // The LinkField component handles basic filters if configured, 
                        // but for advanced dependency, we rely on the Matrix component to react to changes.
                        filters: (getValues) => {
                            const lis = getValues("lis_name");
                            return lis ? { "lis_name": lis } : {};
                        }
                    },
                    {
                        name: "asset_category",
                        label: "Asset Category",
                        type: "Link",
                        linkTarget: "Asset Category",
                        required: true,
                        defaultValue: getValue("asset_category"),
                    },
                    {
                        name: "monitoring_type",
                        label: "Monitoring Type",
                        type: "Select",
                        options: [
                            { label: "Daily", value: "Daily" },
                            { label: "Weekly", value: "Weekly" },
                            { label: "Monthly", value: "Monthly" },
                            { label: "Quarterly", value: "Quarterly" },
                            { label: "Half-Yearly", value: "Half-Yearly" },
                            { label: "Yearly", value: "Yearly" }
                        ],
                        required: true,
                        defaultValue: getValue("monitoring_type"),
                    },
                    // 🟢 HERE IS THE REPLACEMENT
                    {
                        name: "checklist_matrix_section",
                        label: "Checklist Matrix",
                        type: "Section Break",
                    },
                    {
                        name: "checklist_ui", // Dummy name for the custom field
                        label: "",
                        type: "Custom",
                        customElement: <MaintenanceChecklistMatrix />
                    },
                    // We also need a hidden field to actually hold the data if DynamicForm 
                    // doesn't automatically pick up values set via setValue that aren't in the fields list.
                    // However, DynamicFormComponent usually submits all data in `methods.getValues()`.
                    // The Matrix component calls setValue("checklist_data", ...).
                ],
            }
        ];
    }, [duplicateData]);

    const handleSubmit = async (data: Record<string, any>) => {
        if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
            toast.error("Authentication required.");
            return;
        }

        setIsSaving(true);
        try {
            // 1. Prepare Payload
            const payload = { ...data };

            // Remove the UI placeholder field
            delete payload.checklist_ui;
            delete payload.checklist_matrix_section;

            // Ensure checklist_data is present (it might be in 'data' because setValue was called)
            // If not, we might need to grab it from the form state manually, 
            // but `data` passed here usually contains all registered values.

            if (payload.name === "Will be auto-generated") delete payload.name;

            // 2. Submit
            const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, payload, {
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    "Content-Type": "application/json",
                },
                withCredentials: true,
            });

            toast.success("Maintenance Checklist created successfully!");
            const newName = response.data.data.name;
            router.push(`/maintenance/doctype/maintenance-checklist/${newName}`);

        } catch (err: any) {
            console.error("Create error:", err);
            const msg = err.response?.data?.message || err.message;
            toast.error(`Error: ${msg}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DynamicForm
            tabs={formTabs}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
            title="New Maintenance Checklist"
            description="Fill in details to generate the checklist matrix"
            submitLabel={isSaving ? "Saving..." : "Create"}
            cancelLabel="Cancel"
        />
    );
}