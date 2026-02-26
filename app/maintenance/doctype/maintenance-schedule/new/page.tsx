"use client";

import * as React from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import {
    DynamicForm,
    TabbedLayout,
    FormField,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";

const API_BASE_URL = "http://103.219.3.169:2223//api/resource";

/* -------------------------------------------------
 1. Maintenance Schedule type – mirrors the API
 ------------------------------------------------- */
interface AssetCategoryData {
    name?: string;
    asset_category_name?: string;
    custom_specifications?: Array<{
        specification_type: string;
        details: string;
    }>;
}

const handleFormInit = (methods: any) => {
    const { watch, setValue } = methods;

    watch((formValues: any, { name }: any) => {
        if (!name) return;

        if (!name.startsWith("asset_maintenance_tasks")) return;

        const rows = formValues.asset_maintenance_tasks;
        if (!Array.isArray(rows)) return;

        rows.forEach((row: any, index: number) => {
            const { start_date, periodicity } = row;
            if (!start_date || !periodicity) return;

            const start = new Date(start_date);

            // Convert periodicity to days
            const map: Record<string, number> = {
                Daily: 1,
                Weekly: 7,
                Monthly: 30,
                Quarterly: 90,
                Yearly: 365,
            };

            const days = map[periodicity];
            if (!days) return;

            start.setDate(start.getDate() + days);
            const endDate = start.toISOString().split("T")[0];

            const path = `asset_maintenance_tasks.${index}.end_date`;

            if (row.end_date !== endDate) {
                setValue(path, endDate, { shouldDirty: true });
            }
        });
    });
};

/* -------------------------------------------------
 2. Page component
 ------------------------------------------------- */
export default function NewMaintenanceSchedulePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const doctypeName = "Asset Maintenance";
    const [isSaving, setIsSaving] = React.useState(false);

    // Parse duplicate data from URL parameters
    const duplicateData = React.useMemo(() => {
        const duplicateParam = searchParams.get('duplicate');
        if (!duplicateParam) return null;

        try {
            const decodedData = JSON.parse(atob(decodeURIComponent(duplicateParam)));
            console.log("Parsed duplicate data:", decodedData);
            return decodedData;
        } catch (error) {
            console.error("Error parsing duplicate data:", error);
            toast.error("Failed to parse duplicate data", { duration: Infinity });
            return null;
        }
    }, [searchParams]);

    // Show notification if we have duplicate data (only once)
    const notificationShown = React.useRef(false);
    React.useEffect(() => {
        if (duplicateData && !notificationShown.current) {
            toast.success("Form populated with duplicate data. Modify as needed and save.");
            notificationShown.current = true;
        }
    }, [duplicateData]);

    /* -------------------------------------------------
    3. Form tabs configuration with duplicate data support
    ------------------------------------------------- */
    const formTabs: TabbedLayout[] = React.useMemo(() => {
        // Helper function to get value from duplicate data or fallback to default
        const getValue = (fieldName: string, defaultValue: any = undefined) => {
            return duplicateData?.[fieldName] ?? defaultValue;
        };

        return [
            {
                name: "Details",
                fields: [
                    {
                        name: "custom_lis",
                        label: "LIS Name",
                        type: "Link",
                        linkTarget: "Lift Irrigation Scheme",
                        defaultValue: getValue("custom_lis"),
                    },

                    {
                        name: "custom_stage",
                        label: "Stage",
                        type: "Link",
                        linkTarget: "Stage No",
                        required: true,
                        defaultValue: getValue("custom_stage"),
                        filterMapping: [
                            {
                                sourceField: "custom_lis",

                                targetField: "lis_name"
                            }
                        ],
                    },

                    {
                        name: "asset_name", label: "Asset Name", type: "Link", linkTarget: "Asset",
                        customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
                        filters: (getValue) => ({
                            custom_stage_no: getValue("custom_stage"),
                            custom_lis_name: getValue("custom_lis")
                        }),
                        referenceDoctype: "Asset Maintenance",
                        doctype: "Asset",
                        defaultValue: getValue("asset"),
                    },

                    {
                        name: "asset_category", label: "Asset Category", type: "Read Only",
                        displayDependsOn: "asset_name",

                        fetchFrom: { sourceField: "asset_name", targetDoctype: "Asset", targetField: "asset_category" }
                    },

                    // { name: "company", label: "Company", type: "Link", linkTarget: "Company", },
                    {
                        name: "maintenance_team", label: "Maintenance Team", type: "Link",
                        linkTarget: "Asset Maintenance Team"
                    },

                    { name: "custom_contact_no", label: "Contact No", type: "Text", },

                    {
                        name: "asset_maintenance_tasks",
                        label: "Maintenance Tasks",
                        type: "Table",
                        columns: [
                            {
                                name: "maintenance_task",
                                label: "Maintenance Task",
                                type: "Text",
                                inListView: true,
                                required: true,
                            },
                            {
                                name: "maintenance_status",
                                label: "Maintenance Status",
                                type: "Select",
                                options: "Planned\nIn Progress\nOverdue\nCancelled",
                                inListView: true,
                                defaultValue: "Planned",
                                required: true,
                            },
                            {
                                name: "maintenance_type",
                                label: "Maintenance Type",
                                type: "Select",
                                options: "Preventive Maintenance\nCorrective Maintenance\nPredictive Maintenance",
                                inListView: true,
                            },
                            {
                                name: "start_date",
                                label: "Start Date",
                                type: "Date",
                                inListView: true,
                                required: true,
                            },
                            {
                                name: "periodicity",
                                label: "Periodicity",
                                type: "Select",
                                options: "Daily\nWeekly\nMonthly\nQuarterly\nYearly",
                                inListView: true,
                                required: true,
                            },
                            {
                                name: "end_date",
                                label: "End Date",
                                type: "Date",
                                readOnly: true,
                            },

                            // Certificate Required toggle
                            {
                                name: "certificate_required",
                                label: "Certificate Required",
                                type: "Check",
                                inListView: true,
                            },
                            {
                                name: "certificate_upload",
                                label: "Upload Certificate",
                                type: "Attach",
                                displayDependsOn: "certificate_required", // simpler dependency
                                requiredDependsOn: "certificate_required", // makes upload required if checked
                            },


                            {
                                name: "assign_to",
                                label: "Assign To",
                                type: "Link",
                                linkTarget: "User",
                                inListView: true,
                            },
                            {
                                name: "next_due_date",
                                label: "Next Due Date",
                                type: "Date",
                                inListView: true,
                            },
                            {
                                name: "last_completion_date",
                                label: "Last Completion Date",
                                type: "Date",
                                inListView: true,
                                readOnly: true,
                            },
                            {
                                name: "description",
                                label: "Description",
                                type: "Text", // simple text instead of rich text
                                inListView: false,
                            },
                        ],
                    }



                ],
            }
        ];
    }, [duplicateData]);

    /* -------------------------------------------------
    4. SUBMIT
    ------------------------------------------------- */
    const handleSubmit = async (data: Record<string, any>) => {
        if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
            toast.error("Authentication required. Please log in.", { duration: Infinity });
            return;
        }

        // Check if we have valid data to submit (either dirty changes or duplicate data)
        const hasValidData = (duplicateData && data.asset_category_name) || !duplicateData;

        if (!hasValidData) {
            toast.info("Please fill out the form.");
            return;
        }

        setIsSaving(true);
        try {
            const payload = { ...data };

            // Remove name if it's the placeholder
            // if (payload.name === "Will be auto-generated") {
            //     delete payload.name;
            // }

            const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, payload, {
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    "Content-Type": "application/json",
                },
                withCredentials: true,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            });

            const messages = getApiMessages(response, null, "Maintenance Schedule created successfully!", "Failed to create Maintenance Schedule");

            if (messages.success) {
                toast.success(messages.message, { description: messages.description });
            }


            const docName = response.data.data.name;
            if (docName) {
                router.push(`/maintenance/doctype/maintenance-schedule/${encodeURIComponent(docName)}`);
            } else {
                router.push(`/maintenance/doctype/maintenance-schedule`);
            }

        } catch (err: any) {
            console.error("Create error:", err);

            // Handle duplicate entry error specifically
            if (err.response?.data?.exc_type === "DuplicateEntryError") {
                const errorMessage = err.response?.data?._server_messages ||
                    "An maintenance schedule with this name already exists. Please use a different name.";
                toast.error("Duplicate Entry Error", {
                    description: "Maintenance Schedule with this name already exists. Please change the category name and try again.",
                    duration: Infinity
                });
            } else {
                const errorMessage = err.response?.data?.message ||
                    err.response?.data?.error ||
                    "Failed to create Maintenance Schedule. Check console for details.";
                toast.error(`Error: ${errorMessage}`, { duration: Infinity });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => router.back();

    /* -------------------------------------------------
    5. RENDER FORM
    ------------------------------------------------- */
    return (
        <DynamicForm
            tabs={formTabs}
            onFormInit={handleFormInit}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            title={`New ${doctypeName}`}
            description="Create a new maintenance schedule with specifications"
            submitLabel={isSaving ? "Saving..." : "New Maintenance Schedule"}
            cancelLabel="Cancel"
        />
    );
}