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
import { get } from "lodash";
import { useFormContext } from "react-hook-form";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/* -------------------------------------------------
1. Stock Entry type interfaces
------------------------------------------------- */

interface StockEntryItemRow {
    s_warehouse?: string;           // Link -> Source Warehouse
    t_warehouse?: string;           // Link -> Target Warehouse
    item_code?: string;             // Link -> Item
    qty?: number;                   // Float
    basic_rate?: number;            // Currency
    barcode?: string;               // Data
    is_finished_item?: 0 | 1;       // Check
    is_scrap_item?: 0 | 1;          // Check
    description?: string;           // Small Text
    item_group?: string;            // Data
    uom?: string;                   // Link -> UOM
    stock_uom?: string;             // Data
    conversion_factor?: number;     // Float
    serial_no?: string;             // Small Text
    batch_no?: string;              // Data
    expense_account?: string;       // Link -> Account
    cost_center?: string;           // Link -> Cost Center
    custom_tender?: string;                // Link -> Tender
    allow_zero_valuation_rate?: 0 | 1; // Check
}

interface AdditionalCostRow {
    expense_account?: string;       // Link -> Account
    description?: string;           // Text
    amount?: number;                // Currency
}

interface StockEntryData {
    name?: string;          // Select
    posting_date?: string;            // Date
    posting_time?: string;            // Time
    set_posting_time?: 0 | 1;         // Check
    inspection_required?: 0 | 1;      // Check
    stock_entry_type?: string;        // Link -> Stock Entry Type
    apply_putaway_rule?: 0 | 1;       // Check
    add_to_transit?: 0 | 1;           // Check
    custom_tender?: string;                  // Link -> Tender (Accounting Dimension)
    from_warehouse?: string;          // Link -> Warehouse (Default Source)
    to_warehouse?: string;            // Link -> Warehouse (Default Target)
    scan_barcode?: string;            // Data
    items?: StockEntryItemRow[];      // Table -> Items
    additional_costs?: AdditionalCostRow[]; // Table -> Additional Costs
    print_heading?: string;           // Link -> Print Heading
    letter_head?: string;             // Link -> Letter Head
    is_opening?: "Yes" | "No";        // Select
    remarks?: string;                 // Text

    docstatus?: 0 | 1;
    modified?: string;
}

/* -------------------------------------------------
2. Page component
------------------------------------------------- */

export default function NewStockEntryPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
    const [isSaving, setIsSaving] = React.useState(false);
    const [formInstance, setFormInstance] = React.useState<any>(null);
    const [editDateTime, setEditDateTime] = React.useState<boolean>(false);

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

    // Set current date and time for default values
    const getCurrentDate = () => {
        const now = new Date();
        return now.toISOString().split('T')[0];
    };

    const getCurrentTime = () => {
        const now = new Date();
        return now.toTimeString().split(' ')[0].substring(0, 5);
    };

    // Helper function to get value from duplicate data or fallback to default
    const getValue = React.useCallback((fieldName: string, defaultValue: any = undefined) => {
        return duplicateData?.[fieldName] ?? defaultValue;
    }, [duplicateData]);

    const handleFormInit = React.useCallback((form: any) => {
        setFormInstance(form);

        form.setValue("posting_date", getCurrentDate());
        form.setValue("posting_time", getCurrentTime());

        const subscription = form.watch((value: any, { name }: { name?: string }) => {

            // Handle posting time toggle
            if (name === "set_posting_time" || name === undefined) {
                const isEditable = form.getValues("set_posting_time");
                setEditDateTime(!!isEditable);
            }

            if (name === "from_warehouse") {
                const fromWh = form.getValues("from_warehouse");
                const items = form.getValues("items") || [];

                const updatedItems = items.map((row: any) => ({
                    ...row,
                    s_warehouse: fromWh
                }));

                form.setValue("items", updatedItems);
            }

            // 🔥 When Default Target Warehouse changes
            if (name === "to_warehouse") {
                const toWh = form.getValues("to_warehouse");
                const items = form.getValues("items") || [];

                const updatedItems = items.map((row: any) => ({
                    ...row,
                    t_warehouse: toWh
                }));

                form.setValue("items", updatedItems);
            }

        });

        return () => subscription.unsubscribe();
    }, []);

    const formTabs: TabbedLayout[] = React.useMemo(() => {
        return [
            {
                name: "Details",
                fields: [

                    {
                        name: "posting_date",
                        label: "Posting Date",
                        type: editDateTime ? "Date" : "Read Only",
                        fieldColumns: 1,
                        defaultValue: getCurrentDate(),
                    },
                    {
                        name: "posting_time",
                        label: "Posting Time",
                        type: editDateTime ? "Time" : "Read Only",
                        fieldColumns: 1,
                        defaultValue: getCurrentTime(),
                    },
                    {
                        name: "set_posting_time",
                        label: "Edit Posting Date and Time",
                        type: "Check",
                        fieldColumns: 1,
                    },
                    {
                        name: "inspection_required",
                        label: "Inspection Required",
                        type: "Check",
                        defaultValue: getValue("inspection_required", false),
                        fieldColumns: 1,
                    },
                    {
                        name: "stock_entry_type",
                        label: "Stock Entry Type",
                        type: "Link",
                        linkTarget: "Stock Entry Type",
                        required: true,
                        defaultValue: getValue("stock_entry_type"),
                        customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
                        customSearchParams: {
                            filters: {
                                purpose: ["not in", ["Receive from Customer", "Return Raw Material to Customer", "Subcontracting Delivery", "Subcontracting Return"]]
                            }
                        },
                        referenceDoctype: "Stock Entry",
                        doctype: "Stock Entry Type",
                        fieldColumns: 1,
                    },
                    {
                        name: "apply_putaway_rule",
                        label: "Apply Putaway Rule",
                        type: "Check",
                        defaultValue: getValue("apply_putaway_rule", false),
                        fieldColumns: 1,
                    },
                    {
                        name: "add_to_transit",
                        label: "Add To Transit",
                        type: "Check",
                        defaultValue: getValue("add_to_transit", false),
                        fieldColumns: 1,
                    },
                    {
                        name: "cb1",
                        label: "Accounting Dimension",
                        type: "Section Break",
                    },
                    {
                        name: "custom_tender",
                        label: "Tender",
                        type: "Link",
                        linkTarget: "Project",
                        defaultValue: getValue("custom_tender"),
                    },
                    {
                        name: "cb2",
                        label: "Default Warehouse",
                        type: "Section Break",
                    },
                    {
                        name: "from_warehouse",
                        label: "Default Source Warehouse",
                        type: "Link",
                        linkTarget: "Warehouse",
                        defaultValue: getValue("from_warehouse"),
                        customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
                        customSearchParams: {
                            filters: [
                                ["Warehouse", "company", "in", ["", "quantbit"]],
                                ["Warehouse", "is_group", "=", 0]
                            ]
                        },
                        referenceDoctype: "Stock Entry",
                        doctype: "Warehouse",
                        fieldColumns: 1,
                    },
                    {
                        name: "to_warehouse",
                        label: "Default Target Warehouse",
                        type: "Link",
                        linkTarget: "Warehouse",
                        defaultValue: getValue("to_warehouse"),
                        customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
                        customSearchParams: {
                            filters: [
                                ["Warehouse", "company", "in", ["", "quantbit"]],
                                ["Warehouse", "is_group", "=", 0]
                            ]
                        },
                        referenceDoctype: "Stock Entry",
                        doctype: "Warehouse",
                        fieldColumns: 1,
                    },

                    {
                        name: "cb4",
                        label: "Items",
                        type: "Section Break",
                    },
                    {
                        name: "items",
                        label: "Items",
                        type: "Table",
                        showDownloadUpload: true,
                        defaultValue: getValue("items", []),
                        columns: [
                            {
                                name: "item_code",
                                label: "Item Code",
                                type: "Link",
                                linkTarget: "Item",
                                required: true,
                            },
                            {
                                name: "item_group",
                                label: "Item Group",
                                type: "Data",
                                fetchFrom: {
                                    sourceField: "item_group",
                                    targetDoctype: "Item",
                                    targetField: "item_code"
                                }
                            },
                            {
                                name: "s_warehouse",
                                label: "Source Warehouse",
                                type: "Link",
                                linkTarget: "Warehouse",
                                fetchFrom: {
                                    sourceField: "parent.from_warehouse",
                                    targetDoctype: "Warehouse",
                                    targetField: "name"
                                }
                            },
                            {
                                name: "t_warehouse",
                                label: "Target Warehouse",
                                type: "Link",
                                linkTarget: "Warehouse",
                                fetchFrom: {
                                    sourceField: "parent.to_warehouse",
                                    targetDoctype: "Warehouse",
                                    targetField: "name"
                                }
                            },

                            {
                                name: "qty",
                                label: "Qty",
                                type: "Float",
                                required: true,
                                defaultValue: 0
                            },
                            {
                                name: "basic_rate",
                                label: "Basic Rate",
                                type: "Currency",
                                precision: 2,
                                defaultValue: "0.00"
                            },
                            {
                                name: "barcode",
                                label: "Barcode",
                                type: "Data",
                                defaultValue: ""
                            },
                            {
                                name: "is_finished_item",
                                label: "Is Finished Item",
                                type: "Check",
                                defaultValue: false
                            },
                            {
                                name: "is_scrap_item",
                                label: "Is Scrap Item",
                                type: "Check",
                                defaultValue: false
                            },
                            {
                                name: "description",
                                label: "Description",
                                type: "Small Text",
                                defaultValue: ""
                            },

                            {
                                name: "uom",
                                label: "UOM",
                                type: "Link",
                                linkTarget: "UOM",
                                fetchFrom: {
                                    sourceField: "item_code",
                                    targetDoctype: "Item",
                                    targetField: "stock_uom"
                                }
                            },
                            {
                                name: "stock_uom",
                                label: "Stock UOM",
                                type: "Data",
                            },
                            {
                                name: "conversion_factor",
                                label: "Conversion Factor",
                                type: "Float",
                                defaultValue: 1
                            },
                            {
                                name: "serial_no",
                                label: "Serial No.",
                                type: "Text",
                                defaultValue: ""
                            },
                            {
                                name: "batch_no",
                                label: "Batch No.",
                                type: "Link",
                                linkTarget: "Batch",
                                defaultValue: ""
                            },
                            {
                                name: "expense_account",
                                label: "Difference Account",
                                type: "Link",
                                linkTarget: "Account",
                                defaultValue: ""
                            },
                            {
                                name: "cost_center",
                                label: "Cost Center",
                                type: "Link",
                                linkTarget: "Cost Center",
                                defaultValue: ""
                            },
                            {
                                name: "custom_tender",
                                label: "Tender",
                                type: "Link",
                                linkTarget: "Project",
                                fetchFrom: {
                                    sourceField: "parent.custom_tender",
                                    targetDoctype: "Project", // Added targetDoctype
                                    targetField: "name"
                                },
                                defaultValue: ""
                            },
                        ],
                    },
                ],
            },
            {
                name: "Additional Costs",
                fields: [
                    {
                        name: "additional_costs",
                        label: "Additional Costs",
                        type: "Table",
                        showDownloadUpload: true,
                        defaultValue: getValue("additional_costs", []),
                        columns: [
                            {
                                name: "expense_account",
                                label: "Expense Account",
                                type: "Link",
                                linkTarget: "Account",
                                required: true
                            },
                            {
                                name: "description",
                                label: "Description",
                                type: "Text"
                            },
                            {
                                name: "amount",
                                label: "Amount",
                                type: "Currency",
                                precision: 2,
                                required: true
                            },
                        ],
                    },
                ],
            },
            {
                name: "Other Info",
                fields: [
                    {
                        name: "print_heading",
                        label: "Print Heading",
                        type: "Link",
                        linkTarget: "Print Heading",
                        defaultValue: getValue("print_heading"),
                    },
                    {
                        name: "letter_head",
                        label: "Letter Head",
                        type: "Link",
                        linkTarget: "Letter Head",
                        defaultValue: getValue("letter_head"),
                    },
                    {
                        name: "more_info_section",
                        label: "More Information",
                        type: "Section Break",
                    },
                    {
                        name: "is_opening",
                        label: "Is Opening",
                        type: "Select",
                        options: [
                            { label: "Yes", value: "Yes" },
                            { label: "No", value: "No" },
                        ],
                        defaultValue: getValue("is_opening", "No"),
                    },
                    {
                        name: "remarks",
                        label: "Remarks",
                        type: "Text",
                        defaultValue: getValue("remarks"),
                    },
                ],
            },
        ];
    }, [duplicateData, editDateTime, getValue]);

    /* -------------------------------------------------
    3. SUBMIT – without file uploads for this form
    ------------------------------------------------- */
    const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
        // Check if we have valid data to submit (either dirty changes or duplicate data)
        const hasValidData = isDirty || (duplicateData && Object.keys(data).some(key => data[key] !== undefined && data[key] !== null));

        if (!hasValidData) {
            toast.info("No changes to save.");
            return;
        }

        if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
            toast.error("Authentication required. Please log in.", { duration: Infinity });
            return;
        }

        setIsSaving(true);

        try {
            const payload: Record<string, any> = JSON.parse(JSON.stringify(data));

            // Clean payload: remove non-data fields
            const allFields = formTabs.flatMap((tab) => tab.fields);
            const nonDataFields = new Set<string>();
            allFields.forEach((field) => {
                if (
                    field.type === "Section Break" ||
                    field.type === "Column Break" ||
                    field.type === "Button" ||
                    field.type === "Read Only" ||
                    field.type === "Custom"
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

            // Boolean conversions for main form
            const boolFields = [
                "set_posting_time",
                "inspection_required",
                "apply_putaway_rule",
                "add_to_transit",
            ];
            boolFields.forEach((f) => {
                if (f in finalPayload) {
                    finalPayload[f] = finalPayload[f] ? 1 : 0;
                }
            });

            // Numeric conversions for main form
            const numericFields = [
                "qty",
                "basic_rate",
                "conversion_factor",
                "amount",
            ];
            numericFields.forEach((f) => {
                if (f in finalPayload) {
                    finalPayload[f] = Number(finalPayload[f]) || 0;
                }
            });

            // Child table conversions for items
            if (Array.isArray(finalPayload.items)) {
                finalPayload.items = finalPayload.items.map((row: any) => ({
                    ...row,

                    qty: Number(row.qty) || 0,
                    basic_rate: Number(row.basic_rate) || 0,
                    conversion_factor: Number(row.conversion_factor) || 1,

                    is_finished_item: row.is_finished_item ? 1 : 0,
                    is_scrap_item: row.is_scrap_item ? 1 : 0,

                    // ✅ THIS FIXES THE ERROR
                    allow_zero_valuation_rate: 1,

                    // ✅ REQUIRED FOR MATERIAL ISSUE
                    t_warehouse:
                        finalPayload.stock_entry_type === "Material Issue"
                            ? ""
                            : row.t_warehouse,
                }));
            }

            // Child table conversions for additional costs
            if (Array.isArray(finalPayload.additional_costs)) {
                finalPayload.additional_costs = finalPayload.additional_costs.map(
                    (row: any) => {
                        return {
                            ...row,
                            amount: Number(row.amount) || 0,
                        };
                    }
                );
            }

            // Send payload
            console.log("Sending this PAYLOAD to Frappe:", finalPayload);

            if (finalPayload.stock_entry_type === "Material Issue") {
                finalPayload.to_warehouse = "";
            }

            const response = await axios.post(
                `${API_BASE_URL}/Stock Entry`,
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

            toast.success("Stock Entry created successfully!");

            // Navigate using the auto-generated naming series ID
            const savedName = response.data.data.name;
            if (savedName) {
                router.push(`/operations/doctype/stock-entry/${encodeURIComponent(savedName)}`);
            } else {
                router.push(`/operations/doctype/stock-entry`);
            }

        } catch (err: any) {
            console.error("Create error:", err);
            console.log("Full server error:", err.response?.data);

            // Extract actual validation message from server response
            let errorMessage = (err as Error).message || "Check the browser console (F12) for the full server error.";

            if (err.response?.status === 417) {
                const serverMessages = err.response?.data?._server_messages;
                if (serverMessages) {
                    try {
                        const parsed = JSON.parse(serverMessages);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const messageObj = typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0];
                            errorMessage = messageObj.message || err.response?.data?.exception || errorMessage;
                        }
                    } catch (e) {
                        console.error("Failed to parse server messages:", e);
                    }
                }
            }

            toast.error("Failed to create Stock Entry", {
                description: errorMessage,
                duration: Infinity
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => router.back();

    /* -------------------------------------------------
    4. RENDER FORM
    ------------------------------------------------- */
    return (
        <DynamicForm
            tabs={formTabs}
            onSubmit={handleSubmit}
            submitLabel={isSaving ? "Saving..." : "Save"}
            onCancel={handleCancel}
            title="New Stock Entry"
            description="Create a new stock entry record"
            doctype="Stock Entry"
            onFormInit={handleFormInit}
        />
    );
}