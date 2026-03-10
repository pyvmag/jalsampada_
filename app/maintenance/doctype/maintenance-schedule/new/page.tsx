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

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

/* -------------------------------------------------
 1. Work Schedule type – mirrors the API
 ------------------------------------------------- */
interface AssetCategoryData {
    name?: string;

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
                        customSearchUrl: "http://103.219.1.138:4412/api/method/frappe.desk.search.search_link",
                        filters: (getValue) => ({
                            custom_stage_no: getValue("custom_stage"),
                            custom_lis_name: getValue("custom_lis")
                        }),
                        referenceDoctype: "Asset Maintenance",
                        doctype: "Asset",
                        defaultValue: getValue("asset_name") || getValue("asset"),
                    },
                    {
                        name: "asset",
                        label: "Asset",
                        type: "Link",
                        linkTarget: "Asset",
                        displayDependsOn: () => false, // Hidden but used for payload
                        defaultValue: getValue("asset") || getValue("asset_name"),
                    },



                    {
                        name: "custom_tender_no",
                        label: "Tender No.",
                        type: "Link",
                        linkTarget: "Project",
                        defaultValue: getValue("custom_tender_no"),
                    },
                    {
                        name: "custom_firmcompany_name",
                        label: "Firm/Company Name",
                        type: "Read Only",
                        fetchFrom: {
                            sourceField: "custom_tender_no",
                            targetDoctype: "Project",
                            targetField: "custom_contractor_company"
                        },
                        defaultValue: getValue("custom_firmcompany_name"),
                    },
                    {
                        name: "custom_contractor_name",
                        label: "Contractor Name",
                        type: "Read Only",
                        fetchFrom: {
                            sourceField: "custom_tender_no",
                            targetDoctype: "Project",
                            targetField: "custom_contractor_name"
                        },
                        defaultValue: getValue("custom_contractor_name"),
                    },
                    {
                        name: "custom_email_id",
                        label: "Email ID",
                        type: "Read Only",
                        fetchFrom: {
                            sourceField: "custom_tender_no",
                            targetDoctype: "Project",
                            targetField: "custom_email_id"
                        },
                        defaultValue: getValue("custom_email_id"),
                    },
                    {
                        name: "custom_contact_no",
                        label: "Contact No.",
                        type: "Read Only",
                        fetchFrom: {
                            sourceField: "custom_tender_no",
                            targetDoctype: "Project",
                            targetField: "custom_mobile_no"
                        },
                        defaultValue: getValue("custom_contact_no"),
                    },
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
                        defaultValue: getValue("asset_maintenance_tasks") || getValue("maintenance_tasks") || [],
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
        const hasValidData = true;

        if (!hasValidData) {
            toast.info("Please fill out the form.");
            return;
        }

        setIsSaving(true);
        try {
            // 1. Prepare Payload
            const payload = { ...data };

            // 2. Clean Payload (System Fields)
            const cleanObj = (obj: any): any => {
                if (Array.isArray(obj)) return obj.map(cleanObj);
                if (obj !== null && typeof obj === 'object') {
                    const newObj = { ...obj };
                    // Remove Frappe system fields
                    const systemFields = [
                        'modified', 'creation', 'owner', 'docstatus', 'idx',
                        'modified_by', 'parent', 'parentfield', 'parenttype',
                        '_user_tags', '_comments', '_assign', '_liked_by'
                    ];
                    systemFields.forEach(field => delete newObj[field]);

                    // Specific to child table items: remove name and doctype if present
                    // asset_maintenance_tasks is the child table here
                    if (newObj.maintenance_task || newObj.periodicity || newObj.start_date) {
                        delete newObj.name;
                        delete newObj.id; // Remove React-specific ID
                        newObj.doctype = "Asset Maintenance Task"; // Explicit child doctype
                    }

                    // Recursively clean
                    for (const key in newObj) {
                        if (typeof newObj[key] === 'object' && newObj[key] !== null) {
                            newObj[key] = cleanObj(newObj[key]);
                        }
                    }
                    return newObj;
                }
                return obj;
            };

            const cleaned = cleanObj(payload);

            const finalizedPayload = {
                ...cleaned,
                doctype: "Asset Maintenance" // Explicit main doctype
            };


            // 2.5 Validation: Ensure the table is not empty if the server is complaining
            if (!finalizedPayload.asset_maintenance_tasks || finalizedPayload.asset_maintenance_tasks.length === 0) {
                toast.error("Data missing", { description: "Please add at least one row to the Maintenance Tasks table." });
                setIsSaving(false);
                return;
            }


            // 3. Manually add hidden mandatory field
            if (!finalizedPayload.maintenance_team) {
                finalizedPayload.maintenance_team = "Test";
            }

            // Log payload for debugging (visible in browser console)
            console.log("Submitting finalized payload:", finalizedPayload);

            if (finalizedPayload.name === "Will be auto-generated" || !finalizedPayload.name) delete finalizedPayload.name;

            const frappeClientUrl = `${API_BASE_URL.replace("/api/resource", "/api/method/frappe.client.insert")}`;
            const response = await axios.post(frappeClientUrl, {
                doc: finalizedPayload
            }, {
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    "Content-Type": "application/json",
                },
                withCredentials: true,
            });

            const messages = getApiMessages(response, null, "Work Schedule created successfully!", "Failed to create Work Schedule");

            if (messages.success) {
                toast.success(messages.message, { description: messages.description });
            }


            const docName = response.data?.data?.name || response.data?.message?.name;
            if (docName) {
                router.push(`/maintenance/doctype/maintenance-schedule/${encodeURIComponent(docName)}`);
            } else {
                router.push(`/maintenance/doctype/maintenance-schedule`);
            }

        } catch (err: any) {
            console.error("Full Create Error Object:", err);

            const apiResult = getApiMessages(null, err, null, "Failed to create Work Schedule");

            // Extract the most descriptive message possible
            const detailedDescription = apiResult.description ||
                err.response?.data?.message ||
                err.message;

            if (err.response?.data?.exc_type === "DuplicateEntryError") {
                toast.error("Duplicate Entry Error", {
                    description: "Work Schedule with this name already exists. Please change the data or category name and try again.",
                    duration: Infinity
                });
            } else {
                toast.error(`Submission Refused (417)`, {
                    description: detailedDescription,
                    duration: Infinity
                });
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
            title="New Work Schedule"
            description="Create a new work schedule with specifications"
            submitLabel={isSaving ? "Saving..." : "New Work Schedule"}
            cancelLabel="Cancel"
        />
    );
}