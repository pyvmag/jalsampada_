"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import {
    DynamicForm,
    TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/* -------------------------------------------------
1. Stock Reconciliation type interfaces
------------------------------------------------- */

interface StockReconciliationItemRow {
    item_code?: string;          // Link -> Item
    warehouse?: string;          // Link -> Warehouse (Store Location)
    current_qty?: number;        // Float (Current stock in warehouse)
    qty?: number;           // Float (Reconciled qty)
    stock_uom?: string;          // Data
    valuation_rate?: number;     // Currency
    barcode?: string;           // Data
    item_group?: string;        // Data
    amount?: number;            // Currency
}

interface StockReconciliationData {
    name?: string;
    naming_series?: string;                      // Select
    purpose?: "Opening Stock" | "Stock Reconciliation"; // Select
    posting_date?: string;                // Date
    posting_time?: string;                // Time
    set_posting_time?: 0 | 1;       // Check
    set_warehouse?: string;           // Link -> Warehouse
    scan_barcode?: string;                // Data
    scan_mode?: 0 | 1;                    // Check
    items?: StockReconciliationItemRow[]; // Table -> Items
    expense_account?: string;          // Link -> Account
    cost_center?: string;                 // Link -> Cost Center

    docstatus?: 0 | 1;
    modified?: string;
}

/* -------------------------------------------------
2. Page component
------------------------------------------------- */

export default function NewStockReconciliationPage() {
    const router = useRouter();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const doctypeName = "Stock Reconciliation";
    const [isSaving, setIsSaving] = React.useState(false);
    const [formInstance, setFormInstance] = React.useState<any>(null);
    const [editDateTime, setEditDateTime] = React.useState<boolean>(false);

    // Set current date and time for default values
    const getCurrentDate = () => {
        const now = new Date();
        return now.toISOString().split('T')[0];
    };

    const getCurrentTime = () => {
        const now = new Date();
        return now.toTimeString().split(' ')[0].substring(0, 5);
    };

    const handleFormInit = React.useCallback((form: any) => {
        setFormInstance(form);

        form.setValue("posting_date", getCurrentDate());
        form.setValue("posting_time", getCurrentTime());

        const subscription = form.watch(async (value: any, { name }: { name?: string }) => {
            if (name === "set_posting_time" || name === undefined) {
                const isEditable = form.getValues("set_posting_time");
                setEditDateTime(!!isEditable);
            }

            const warehouse = form.getValues("set_warehouse");

            // ✅ AUTO FILL CHILD WAREHOUSE (Sync Default Warehouse to all items)
            if (name === "set_warehouse" || name === "items" || name === undefined) {
                const items = form.getValues("items") || [];
                let changed = false;

                const updatedItems = items.map((row: any) => {
                    const rowWh = row.warehouse || "";
                    if (warehouse && rowWh !== warehouse) {
                        changed = true;
                        return { ...row, warehouse: warehouse };
                    }
                    return row;
                });

                if (changed) {
                    form.setValue("items", updatedItems, { shouldDirty: true });
                    // If warehouse changed, we might need to re-fetch all items' stock balance
                    // But usually, the user sets warehouse first.
                }
            }

            // ✅ AUTO FETCH ITEM DETAILS (When item_code changes)
            if (name && name.startsWith("items.") && name.endsWith(".item_code")) {
                const fieldPath = name.split(".");
                const rowIndex = parseInt(fieldPath[1]);
                const items = form.getValues("items");
                const row = items[rowIndex];
                const itemCode = row?.item_code;

                if (itemCode && warehouse && apiKey && apiSecret) {
                    try {
                        // 1. Fetch Item details
                        const itemResp = await axios.get(`${API_BASE_URL}/Item/${itemCode}`, {
                            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
                        });
                        const itemData = itemResp.data.data;

                        // 2. Fetch Bin details for current quantity and valuation rate
                        const binResp = await axios.get(`${API_BASE_URL.replace("/resource", "")}/resource/Bin`, {
                            params: {
                                filters: JSON.stringify([
                                    ["item_code", "=", itemCode],
                                    ["warehouse", "=", warehouse],
                                ]),
                                fields: JSON.stringify(["actual_qty", "valuation_rate"]),
                            },
                            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
                        });
                        const binData = binResp.data.data?.[0] || { actual_qty: 0, valuation_rate: 0 };

                        // 3. Update the specific row
                        const updatedItems = [...items];
                        updatedItems[rowIndex] = {
                            ...updatedItems[rowIndex],
                            item_group: itemData.item_group,
                            stock_uom: itemData.stock_uom,
                            current_qty: binData.actual_qty || 0,
                            valuation_rate: binData.valuation_rate || itemData.valuation_rate || 0,
                        };

                        // Recalculate amount if qty exists
                        if (updatedItems[rowIndex].qty) {
                            updatedItems[rowIndex].amount = updatedItems[rowIndex].qty * updatedItems[rowIndex].valuation_rate;
                        }

                        form.setValue("items", updatedItems, { shouldDirty: true });
                    } catch (err) {
                        console.error("Failed to fetch item details", err);
                    }
                }
            }

            // ✅ AUTO CALCULATE AMOUNT (When qty or valuation_rate changes)
            if (name && name.startsWith("items.") && (name.endsWith(".qty") || name.endsWith(".valuation_rate"))) {
                const fieldPath = name.split(".");
                const rowIndex = parseInt(fieldPath[1]);
                const items = form.getValues("items");
                const row = items[rowIndex];

                if (row) {
                    const qty = Number(row.qty) || 0;
                    const rate = Number(row.valuation_rate) || 0;
                    const amount = Number((qty * rate).toFixed(2));

                    if (row.amount !== amount) {
                        const updatedItems = [...items];
                        updatedItems[rowIndex] = { ...row, amount };
                        form.setValue("items", updatedItems, { shouldDirty: true });
                    }
                }
            }
        });

        return () => subscription.unsubscribe();
    }, [apiKey, apiSecret]);

    const formTabs: TabbedLayout[] = React.useMemo(() => {
        return [
            {
                name: "Details",
                fields: [
                    {
                        name: "purpose",
                        label: "Purpose",
                        type: "Select",
                        options: [
                            { label: "Opening Stock", value: "Opening Stock" },
                            { label: "Stock Reconciliation", value: "Stock Reconciliation" },
                        ],
                        required: true,
                        defaultValue: "Stock Reconciliation",
                    },

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
                        name: "set_warehouse",
                        label: "Default Warehouse",
                        type: "Link",
                        linkTarget: "Warehouse",
                        required: true,
                        fieldColumns: 1,
                        customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
                        customSearchParams: {
                            filters: [
                                ["Warehouse", "company", "=", "quantbit"],
                                ["Warehouse", "is_group", "=", 0]
                            ]
                        },
                        referenceDoctype: "Stock Reconciliation Item",
                        doctype: "Warehouse"
                    },

                    {
                        name: "items",
                        label: "Items",
                        type: "Table",
                        showDownloadUpload: true,
                        columns: [
                            {
                                name: "item_code",
                                label: "Item Code",
                                type: "Link",
                                linkTarget: "Item",
                                required: true
                            },
                            {
                                name: "warehouse",
                                label: "Store Location",
                                type: "Link",
                                linkTarget: "Warehouse",
                                readOnly: true,
                                customSearchUrl: "http://103.219.1.138:4412/api/method/frappe.desk.search.search_link",
                                customSearchParams: {
                                    filters: [
                                        ["Warehouse", "company", "in", ["", "quantbit"]],
                                        ["Warehouse", "is_group", "=", 0]
                                    ]
                                },
                                referenceDoctype: "Stock Reconciliation Item",
                                doctype: "Warehouse",
                                fetchFrom: {
                                    sourceField: "parent.set_warehouse",
                                    targetDoctype: "Warehouse",
                                    targetField: "name"
                                }
                            },
                            {
                                name: "current_qty",
                                label: "Current Qty",
                                type: "Float",
                                defaultValue: 0,
                                readOnly: true
                            },
                            {
                                name: "qty",
                                label: "Quantity",
                                type: "Float",
                                required: true,
                                defaultValue: 0
                            },
                            {
                                name: "stock_uom",
                                label: "Stock UOM",
                                type: "Link",
                                linkTarget: "UOM",
                                fetchFrom: { sourceField: "stock_uom", targetDoctype: "Item", targetField: "item_code" }
                            },
                            {
                                name: "valuation_rate",
                                label: "Valuation Rate",
                                type: "Currency",
                                precision: 2,
                                defaultValue: "0.00",
                                fetchFrom: { sourceField: "valuation_rate", targetDoctype: "Item", targetField: "item_code" }
                            },

                            {
                                name: "item_group",
                                label: "Item Group",
                                type: "Link",
                                linkTarget: "Item Group",
                                fetchFrom: { sourceField: "item_group", targetDoctype: "Item", targetField: "item_code" }
                            },
                            {
                                name: "amount",
                                label: "Amount",
                                type: "Currency",
                                defaultValue: "0.00",
                                precision: 2,
                                formula: "qty * valuation_rate",
                                readOnly: true
                            },
                            {
                                name: "use_serial_batch_fields",
                                label: "Use Serial No/ Batch Fields",
                                type: "Check",
                                defaultValue: false
                            },
                            {
                                name: "reconcile_all_serial_batches",
                                label: "Reconcile all serial Nos/Batches",
                                type: "Check",
                                displayDependsOn: "use_serial_batch_fields==false"
                            },

                        ],
                    },
                    {
                        name: "cb3",
                        label: "",
                        type: "Section Break",
                    },
                    {
                        name: "expense_account",
                        label: "Difference Account",
                        type: "Link",
                        linkTarget: "Account",
                        required: true,
                        filters: (getValue) => {
                            const company = getValue("company");
                            const filters: Record<string, any> = {
                                is_group: 0,
                            };
                            if (company) {
                                filters.company = company;
                            }
                            return filters;
                        },
                    },
                    {
                        name: "cost_center",
                        label: "Cost Center",
                        type: "Link",
                        linkTarget: "Cost Center",
                    },
                ],
            },
        ];
    }, [editDateTime]);

    /* -------------------------------------------------
    3. SUBMIT – without file uploads for this form
    ------------------------------------------------- */
    const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
        if (!isDirty) {
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

            // Boolean conversions
            const boolFields = [
                "set_posting_time",
                "scan_mode",
            ];
            boolFields.forEach((f) => {
                if (f in finalPayload) {
                    finalPayload[f] = finalPayload[f] ? 1 : 0;
                }
            });

            // Numeric conversions for main form
            const numericFields = [
                "qty",
                "valuation_rate",
                "amount",
            ];
            numericFields.forEach((f) => {
                if (f in finalPayload) {
                    finalPayload[f] = Number(finalPayload[f]) || 0;
                }
            });

            // Child table numeric conversions
            if (Array.isArray(finalPayload.items)) {
                finalPayload.items = finalPayload.items.map(
                    (row: any) => {
                        return {
                            ...row,
                            qty: Number(row.qty) || 0,
                            valuation_rate: Number(row.valuation_rate) || 0,
                            amount: Number(row.amount) || 0,
                        };
                    }
                );
            }

            // Send payload
            console.log("Sending this PAYLOAD to Frappe:", finalPayload);

            if (finalPayload.set_warehouse && Array.isArray(finalPayload.items)) {
                finalPayload.items = finalPayload.items.map((row: any) => ({
                    ...row,
                    warehouse: row.store_location || finalPayload.set_warehouse,
                }));
            }

            const response = await axios.post(
                `${API_BASE_URL}/${doctypeName}`,
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

            toast.success("Stock Reconciliation created successfully!");

            // Navigate using the auto-generated naming series ID
            const savedName = response.data.data.name;
            if (savedName) {
                router.push(`/operations/doctype/stock-reconciliation/${encodeURIComponent(savedName)}`);
            } else {
                router.push(`/operations/doctype/stock-reconciliation`);
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

            toast.error("Failed to create Stock Reconciliation", {
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
            title="New Stock Reconciliation"
            description="Create a new stock reconciliation record"
            doctype={doctypeName}
            onFormInit={handleFormInit}
        />
    );
}







