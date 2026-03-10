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
            const { start_date, period_in_days } = row;
            if (!start_date || !period_in_days) return;

            const start = new Date(start_date);
            const days = parseInt(period_in_days);
            if (isNaN(days)) return;

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
    const { apiKey, apiSecret, isAuthenticated, isInitialized, currentUser, userId } = useAuth();

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
                                name: "custom_asset",
                                label: "Asset",
                                type: "Link",
                                linkTarget: "Asset",
                                inListView: true,
                                required: true,
                                customSearchUrl: "http://103.219.1.138:4412/api/method/frappe.desk.search.search_link",
                                filters: (getValue) => ({
                                    custom_stage_no: getValue("custom_stage"),
                                    custom_lis_name: getValue("custom_lis")
                                }),
                                referenceDoctype: "Asset Maintenance",
                                doctype: "Asset",
                            },
                            {
                                name: "asset_name",
                                label: "Asset Name",
                                type: "Data",
                                displayDependsOn: () => false,
                                fetchFrom: {
                                    sourceField: "custom_asset",
                                    targetDoctype: "Asset",
                                    targetField: "asset_name"
                                }
                            },
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
                                name: "period_in_days",
                                label: "Period (In Days)",
                                type: "Int",
                                inListView: true,
                                required: true,
                            },
                            {
                                name: "end_date",
                                label: "Expected End Date",
                                type: "Date",
                                readOnly: true,
                                inListView: true,
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
                    // Fields that should NEVER be sent to Frappe for these doctypes
                    const blacklistedFields = [
                        'modified', 'creation', 'owner', 'docstatus', 'idx',
                        'modified_by', 'parent', 'parentfield', 'parenttype',
                        '_user_tags', '_comments', '_assign', '_liked_by',
                        'parent_task',
                        'id'
                    ];
                    blacklistedFields.forEach(f => delete newObj[f]);

                    // If it's a child table row (Asset Maintenance Task)
                    if (newObj.maintenance_task || newObj.period_in_days || newObj.start_date) {
                        newObj.doctype = "Asset Maintenance Task";
                        newObj.periodicity = "Daily";
                        delete newObj.name; // Don't send name for child rows in insert

                        // Strict whitelist for child table rows
                        const allowedForTask = [
                            'maintenance_task', 'maintenance_status', 'maintenance_type',
                            'start_date', 'period_in_days', 'end_date', 'next_due_date',
                            'assign_to', 'assign_to_name', 'last_completion_date',
                            'description', 'certificate_required', 'certificate_upload',
                            'periodicity', 'doctype', 'name', 'custom_asset', 'asset_name'
                        ];

                        // Background requirement: set next_due_date to end_date
                        if (newObj.end_date) {
                            newObj.next_due_date = newObj.end_date;
                        }

                        // 🛡️ SMART ASSIGNMENT RESOLUTION
                        const safeUser = (userId && userId !== "admin@example.com" && userId !== "null")
                            ? userId
                            : "vikas.deshmukh@erpdata.in";

                        newObj.assign_to = safeUser;
                        newObj.assign_to_name = safeUser;

                        console.log(`DEBUG: [Smart Sync] Task "${newObj.maintenance_task}" assigned to:`, safeUser);

                        if ('id' in newObj) delete newObj.id;

                        if (!("last_completion_date" in newObj)) newObj.last_completion_date = null;

                        for (const key in newObj) {
                            if (!allowedForTask.includes(key)) {
                                delete newObj[key];
                            }
                        }
                    }

                    // Recursively clean
                    for (const key in newObj) {
                        if (typeof newObj[key] === 'object' && newObj[key] !== null) {
                            newObj[key] = cleanObj(newObj[key]);
                        } else if (newObj[key] === "" && key !== 'maintenance_task') {
                            // Generally remove empty strings for top-level keys to be safe
                            delete newObj[key];
                        }
                    }
                    return newObj;
                }
                return obj;
            };

            const cleaned = cleanObj(payload);

            // 🔄 BACKGROUND SYNC: Take asset from the first child row for the parent
            const firstTaskAsset = cleaned.asset_maintenance_tasks?.[0]?.custom_asset;
            if (firstTaskAsset) {
                cleaned.custom_asset = firstTaskAsset;
                cleaned.asset_name = firstTaskAsset;
            }

            const finalizedPayload: Record<string, any> = {
                ...cleaned,
                doctype: "Asset Maintenance", // Explicit main doctype
                maintenance_team: cleaned.maintenance_team || "Test",
            };

            // 🔍 DEBUG: Check what we are actually sending
            console.log("DEBUG: User Info from Auth:", { userId, currentUser });
            console.log("DEBUG: Finalized Payload for Frappe:", JSON.stringify(finalizedPayload, null, 2));
            if (finalizedPayload.asset_maintenance_tasks) {
                console.log("DEBUG: Maintenance Tasks rows:", finalizedPayload.asset_maintenance_tasks);
            }

            // 2.5 Validation: Ensure the table is not empty if the server is complaining
            if (!finalizedPayload.asset_maintenance_tasks || finalizedPayload.asset_maintenance_tasks.length === 0) {
                toast.error("Data missing", { description: "Please add at least one row to the Maintenance Tasks table." });
                setIsSaving(false);
                return;
            }

            // Ensure frontend name field doesn't block insert
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

            toast.success("Schedule created successfully!");

            const docName = response.data?.data?.name || response.data?.message?.name;
            if (docName) {
                router.push(`/maintenance/doctype/maintenance-schedule/${encodeURIComponent(docName)}`);
            } else {
                router.push(`/maintenance/doctype/maintenance-schedule`);
            }

        } catch (err: any) {
            console.error("FULL ERROR OBJECT:", err);
            // 🔍 EXTRA DEBUG: Try to find the server traceback
            if (err.response?.data?.exc) {
                try {
                    console.error("SERVER TRACEBACK:", JSON.parse(err.response.data.exc));
                } catch (e) {
                    console.error("SERVER TRACEBACK (Raw):", err.response.data.exc);
                }
            }
            if (err.response?.data?._server_messages) {
                try {
                    console.error("SERVER MESSAGES:", JSON.parse(err.response.data._server_messages));
                } catch (e) {
                    console.error("SERVER MESSAGES (Raw):", err.response.data._server_messages);
                }
            }

            toast.error("Failed to create", {
                description: err.response?.data?.message || err.message,
                duration: Infinity
            });
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