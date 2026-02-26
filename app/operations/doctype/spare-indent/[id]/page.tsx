"use client";

import * as React from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import {
    DynamicForm,
    TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { UseFormReturn } from "react-hook-form";
import { fetchAssetsFromLisAndStage, fetchItemDetails } from "../services";
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
const DOCTYPE_NAME = "Material Request";

export default function SpareIndentDetailPage() {
    const params = useParams();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
    const docname = params.id as string;

    const [record, setRecord] = React.useState<any | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [formMethods, setFormMethods] = React.useState<UseFormReturn<any> | null>(null);
    const lastFetchedItemCodesRef = React.useRef<Record<number, string>>({});

    const fetchRecord = async () => {
        if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;
        try {
            setLoading(true);
            const resp = await axios.get(`${API_BASE_URL}/${DOCTYPE_NAME}/${docname}`, {
                headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            });
            setRecord(resp.data.data);
        } catch (err: any) {
            toast.error("Failed to load record.");
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => { fetchRecord(); }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

    // 🟢 HELPER: GET CURRENT STATUS
    const getCurrentStatus = () => {
        if (!record) return "";
        // Priority: DocStatus -> Workflow State -> Status field
        if (record.docstatus === 2) return "Cancelled";
        if (record.docstatus === 1) return record.status || "Submitted";
        // If Draft
        if (formMethods?.formState.isDirty) return "Not Saved";
        return record.workflow_state || record.status || "Draft";
    };

    const formTabs: TabbedLayout[] = React.useMemo(() => {
        if (!record) return [];
        const getVal = (key: string, def?: any) => record[key] ?? def;

        return [
            {
                name: "Details",
                fields: [
                    {
                        name: "material_request_type",
                        label: "Purpose",
                        type: "Select",
                        options: [
                            { label: "Material Issue", value: "Material Issue" },
                            { label: "Material Transfer", value: "Material Transfer" },
                        ],
                        defaultValue: getVal("material_request_type"),
                        required: true,
                        layoutCols: 3,
                    },
                    {
                        name: "transaction_date",
                        label: "Date",
                        type: "Date",
                        defaultValue: getVal("transaction_date"),
                        required: true,
                        layoutCols: 3,
                    },
                    {
                        name: "schedule_date",
                        label: "Required By",
                        type: "Date",
                        defaultValue: getVal("schedule_date"),
                        required: true,
                        layoutCols: 3,
                    },
                    {
                        name: "custom_prepared_by",
                        label: "Prepared By",
                        type: "Link",
                        linkTarget: "Employee",
                        searchField: "employee_name",
                        defaultValue: getVal("custom_prepared_by"),
                        layoutCols: 3,
                    },
                    {
                        name: "custom_designation",
                        label: "Designation",
                        type: "Data",
                        readOnly: true,
                        fetchFrom: {
                            sourceField: "custom_prepared_by",
                            targetDoctype: "Employee",
                            targetField: "designation"
                        },
                        defaultValue: getVal("custom_designation"),
                        layoutCols: 3,
                    },
                    {
                        name: "buying_price_list",
                        label: "Price List",
                        type: "Link",
                        linkTarget: "Price List",
                        defaultValue: getVal("buying_price_list"),
                        layoutCols: 3,
                    },
                    { name: "custom_section_break_9pzmb", label: "LIS Details", type: "Section Break" },
                    {
                        name: "custom_lis_name",
                        label: "LIS Name",
                        type: "Link",
                        linkTarget: "Lift Irrigation Scheme",
                        defaultValue: getVal("custom_lis_name"),
                    },
                    {
                        name: "custom_stage",
                        label: "Stage",
                        type: "Link",
                        linkTarget: "Stage No",
                        defaultValue: getVal("custom_stage"),
                        filterMapping: [{ sourceField: "custom_lis_name", targetField: "lis_name" }]
                    },
                    {
                        name: "custom_asset_category",
                        label: "Asset category",
                        type: "Link",
                        linkTarget: "Asset Category",
                        defaultValue: getVal("custom_asset_category"),
                    },

                    { name: "custom_section_break_9pzmb", label: "", type: "Section Break" },

                    {
                        name: "custom_assets",
                        label: "Assets",
                        type: "Table MultiSelect",
                        linkTarget: "Asset",
                        // FIX: Extract only the 'asset' string from the database object
                        defaultValue: getVal("custom_assets", []).map((row: any) =>
                            typeof row === 'object' ? row.asset : row
                        ),
                        filterMapping: [
                            { sourceField: "custom_asset_category", targetField: "asset_category" },
                            { sourceField: "custom_lis_name", targetField: "custom_lis_name" },
                            { sourceField: "custom_stage", targetField: "custom_stage_no" }
                        ],
                    },
                    { name: "warehouse_section", label: "Items", type: "Section Break" },
                    {
                        name: "scan_barcode",
                        label: "Scan Barcode",
                        type: "Data",
                        placeholder: "Barcode",
                        defaultValue: getVal("scan_barcode"),
                    },
                    {
                        name: "set_warehouse",
                        label: "Set Target Warehouse",
                        type: "Link",
                        linkTarget: "Warehouse",
                        defaultValue: getVal("set_warehouse"),
                    },
                    {
                        name: "set_from_warehouse",
                        label: "Set Source Warehouse",
                        type: "Link",
                        linkTarget: "Warehouse",
                        defaultValue: getVal("set_from_warehouse"),
                        displayDependsOn: "material_request_type == 'Material Transfer'",
                    },
                    {
                        name: "items",
                        label: "Items",
                        type: "Table",
                        required: true,
                        defaultValue: getVal("items", []),
                        columns: [
                            { name: "item_code", label: "Item Code", type: "Link", linkTarget: "Item", required: true },
                            { name: "item_name", label: "Item Name", type: "Data", readOnly: true },
                            { name: "schedule_date", label: "Required By", type: "Date", required: true },
                            { name: "description", label: "Description", type: "Text" },
                            { name: "qty", label: "Quantity", type: "Float", required: true, precision: 2 },
                            { name: "uom", label: "UOM", type: "Link", linkTarget: "UOM" },
                            { name: "warehouse", label: "Target Warehouse", type: "Link", linkTarget: "Warehouse" },
                            { name: "rate", label: "Rate", type: "Currency", precision: 2 },
                            { name: "amount", label: "Amount", type: "Currency", readOnly: true, precision: 2 },
                            {
                                name: "custom_purpose_of_use",
                                label: "Purpose of Use",
                                type: "Select",
                                options: [
                                    { label: "Repair", value: "Repair" },
                                    { label: "Overhaul", value: "Overhaul" },
                                    { label: "Consumable", value: "Consumable" },
                                ],
                                defaultValue: "Repair",
                            },
                            {
                                name: "custom_remarks",
                                label: "Remarks",
                                type: "Text",
                            },
                        ],
                    },
                    // ── Approval Section ────────────────────────────────────────────
                    { name: "custom_approval_section", label: "Approval Section", type: "Section Break" },
                    {
                        name: "custom_recommended_by",
                        label: "Recommended By (Incharge/JE)",
                        type: "Link",
                        linkTarget: "User",
                        searchField: "full_name",
                        defaultValue: getVal("custom_recommended_by"),
                    },

                    {
                        name: "custom_verified_by",
                        label: "Verified By (DE)",
                        type: "Link",
                        linkTarget: "Employee",
                        searchField: "employee_name",
                        defaultValue: getVal("custom_verified_by"),
                    },

                    {
                        name: "custom_approved_by",
                        label: "Approved By (EE)",
                        type: "Link",
                        linkTarget: "Employee",
                        searchField: "employee_name",
                        defaultValue: getVal("custom_approved_by"),
                    },

                    {
                        name: "custom_name1",
                        label: "Name (Incharge/JE)",
                        type: "Data",
                        readOnly: true,
                        fetchFrom: {
                            sourceField: "custom_recommended_by",
                            targetDoctype: "User",
                            targetField: "full_name"
                        },
                        defaultValue: getVal("custom_name1"),
                    },

                    {
                        name: "custom_name2",
                        label: "Name (DE)",
                        type: "Data",
                        readOnly: true,
                        fetchFrom: {
                            sourceField: "custom_verified_by",
                            targetDoctype: "Employee",
                            targetField: "employee_name"
                        },
                        defaultValue: getVal("custom_name2"),
                    },

                    {
                        name: "custom_name3",
                        label: "Name (EE)",
                        type: "Data",
                        readOnly: true,
                        fetchFrom: {
                            sourceField: "custom_approved_by",
                            targetDoctype: "Employee",
                            targetField: "employee_name"
                        },
                        defaultValue: getVal("custom_name3"),
                    },

                    { name: "custom_date1", label: "Date (Incharge/JE)", type: "Date", defaultValue: getVal("custom_date1") },
                    { name: "custom_date2", label: "Date (DE)", type: "Date", defaultValue: getVal("custom_date2") },
                    { name: "custom_date3", label: "Date (EE)", type: "Date", defaultValue: getVal("custom_date3") },
                ],
            },
            {
                name: "Terms",
                fields: [
                    {
                        name: "tc_name",
                        label: "Terms",
                        type: "Link",
                        linkTarget: "Terms and Conditions",
                        defaultValue: getVal("tc_name"),
                    },
                    {
                        name: "terms",
                        label: "Terms and Conditions Content",
                        type: "Markdown Editor",
                        defaultValue: getVal("terms"),
                    },
                ],
            },
            {
                name: "More Info",
                fields: [
                    {
                        name: "letter_head",
                        label: "Letter Head",
                        type: "Link",
                        linkTarget: "Letter Head",
                        defaultValue: getVal("letter_head"),
                    },
                    {
                        name: "select_print_heading",
                        label: "Print Heading",
                        type: "Link",
                        linkTarget: "Print Heading",
                        defaultValue: getVal("select_print_heading"),
                    }
                ],
            },
        ];
    }, [record]);
    const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
        if (!isDirty) { toast.info("No changes to save."); return; }
        setIsSaving(true);
        try {
            const payload: Record<string, any> = {
                ...data,
                modified: record?.modified,
                docstatus: record?.docstatus
            };

            // Sanitize and format 'custom_assets' Child Table
            if (Array.isArray(payload.custom_assets)) {
                payload.custom_assets = payload.custom_assets.map((assetItem: any, index: number) => {
                    // Create a clean object with only Frappe child table fields
                    const sanitized: any = {
                        docstatus: 0,
                        doctype: "Asset Table Multiselect", // Adjust doctype name based on your custom child table
                        __islocal: 1,
                        __unsaved: 1,
                        parentfield: "custom_assets",
                        parenttype: DOCTYPE_NAME,
                        idx: index + 1,
                    };

                    // Handle both string asset IDs and objects
                    if (typeof assetItem === 'string') {
                        sanitized.asset = assetItem;
                    } else if (assetItem && typeof assetItem === 'object') {
                        // If it has 'stage' field, use it as 'asset', otherwise use 'name' or 'asset' field
                        sanitized.asset = assetItem.asset || assetItem.stage || assetItem.name || assetItem;
                    }

                    return sanitized;
                });
            }

            // Sanitize 'items' Child Table
            if (Array.isArray(payload.items)) {
                payload.items = payload.items.map((item: any, index: number) => {
                    // Remove temporary UI fields
                    const { id, stage, name: tempName, ...rest } = item;

                    // Add proper child table fields
                    return {
                        ...rest,
                        docstatus: 0,
                        __islocal: 1,
                        __unsaved: 1,
                        parentfield: "items",
                        parenttype: DOCTYPE_NAME,
                        idx: index + 1,
                    };
                });
            }

            await axios.put(`${API_BASE_URL}/${DOCTYPE_NAME}/${docname}`, payload, {
                headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            });
            toast.success("Spare Indent updated successfully!");
            fetchRecord();
        } catch (err: any) {
            console.error("Save Error:", err);
            const errorMsg = err.response?.data?.exception || err.message || "Failed to update record";
            toast.error(errorMsg, { duration: Infinity });
        } finally {
            setIsSaving(false);
        }
    };

    // 🟢 SYNC Required By Date logic
    React.useEffect(() => {
        if (!formMethods) return;
        const subscription = formMethods.watch((values, { name }) => {
            if (name === "schedule_date") {
                const newParentDate = values.schedule_date;
                const currentItems = values.items || [];
                currentItems.forEach((_: any, index: number) => {
                    formMethods.setValue(`items.${index}.schedule_date`, newParentDate, { shouldDirty: true });
                });
            }
            if (name?.startsWith("items") && !name.includes("schedule_date")) {
                const parentDate = formMethods.getValues("schedule_date");
                const currentItems = values.items || [];
                currentItems.forEach((item: any, index: number) => {
                    if (!item.schedule_date && parentDate) {
                        formMethods.setValue(`items.${index}.schedule_date`, parentDate, { shouldDirty: true });
                    }
                });
            }
        });
        return () => subscription.unsubscribe();
    }, [formMethods]);

    React.useEffect(() => {
        if (!formMethods || !apiKey || !apiSecret) return;
        const subscription = formMethods.watch(async (values, { name }) => {
            if (name !== "custom_asset_category") return;
            const customLisName = values.custom_lis_name;
            const customStage = values.custom_stage;
            const customAssetCategory = values.custom_asset_category;
            if (!customLisName || !customStage || !customAssetCategory) return;
            try {
                const assets = await fetchAssetsFromLisAndStage(
                    { custom_lis_name: customLisName, custom_stage: customStage, custom_asset_category: customAssetCategory },
                    apiKey, apiSecret
                );
                formMethods.setValue("custom_assets", assets, { shouldDirty: true });
            } catch (error) {
                console.error("Failed to fetch assets:", error);
                toast.error("Failed to load assets", { duration: Infinity });
            }
        });
        return () => subscription.unsubscribe();
    }, [apiKey, apiSecret, formMethods]);

    React.useEffect(() => {
        if (!formMethods || !apiKey || !apiSecret) return;
        const subscription = formMethods.watch(async (values, { name }) => {
            if (!name || !name.startsWith("items") || !name.endsWith("item_code")) return;
            const match = name.match(/^items\.(\d+)\.item_code$/);
            if (!match) return;
            const rowIndex = Number(match[1]);
            const currentItems = values.items || [];
            const itemCode = currentItems[rowIndex]?.item_code?.trim();
            if (!itemCode || lastFetchedItemCodesRef.current[rowIndex] === itemCode) return;
            lastFetchedItemCodesRef.current[rowIndex] = itemCode;
            try {
                const message = await fetchItemDetails(
                    { item_code: itemCode, material_request_type: values.material_request_type || "Material Issue" },
                    apiKey, apiSecret
                );
                if (!message) return;
                const fieldUpdates: Record<string, any> = {
                    item_name: message.item_name ?? "",
                    description: message.description ?? "",
                    uom: message.uom ?? "",
                    warehouse: message.warehouse ?? "",
                    rate: message.rate ?? 0,
                    amount: message.amount ?? 0,
                };

                // Only set qty if API returns a value (don't overwrite user input with default)
                if (message.qty !== undefined && message.qty !== null) {
                    fieldUpdates.qty = message.qty;
                }

                Object.entries(fieldUpdates).forEach(([fieldName, fieldValue]) => {
                    formMethods.setValue(`items.${rowIndex}.${fieldName}`, fieldValue, { shouldDirty: true });
                });
            } catch (error: any) {
                console.error("Failed to fetch item details", error);
                toast.error(error.response?.data?.message || "Failed to fetch item details", { duration: 5000 });
            }
        });
        return () => subscription.unsubscribe();
    }, [apiKey, apiSecret, formMethods]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Indent...</div>;
    if (!record) return <div className="p-8 text-center">Record not found.</div>;

    return (
        <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
            <DynamicForm
                tabs={formTabs}
                onSubmit={handleSubmit}
                title={`Spare Indent: ${record.name}`}
                submitLabel={isSaving ? "Saving..." : "Save Changes"}
                docstatus={record.docstatus}
                initialStatus={getCurrentStatus()}
                onFormInit={setFormMethods}
                deleteConfig={{
                    doctypeName: DOCTYPE_NAME,
                    docName: docname,
                    redirectUrl: "/operations/doctype/spare-indent"
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