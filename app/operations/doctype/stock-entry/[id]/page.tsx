"use client";

import * as React from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import {
    DynamicForm,
    TabbedLayout,
    FormField,
} from "@/components/DynamicFormComponent";
import { getApiMessages } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

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
}

interface AdditionalCostRow {
    expense_account?: string;       // Link -> Account
    description?: string;           // Text
    amount?: number;                // Currency
}

interface StockEntryData {
    name: string;
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

    docstatus: 0 | 1 | 2 | number; // Draft, Submitted, Cancelled
    modified: string;
}

/* -------------------------------------------------
2. Page component
------------------------------------------------- */

export default function StockEntryDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const docname = params.id as string;
    const doctypeName = "Stock Entry";

    const [stockEntry, setStockEntry] = React.useState<StockEntryData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const isProgrammaticUpdate = React.useRef(false);
    const [formVersion, setFormVersion] = React.useState(0);
    const [formInstance, setFormInstance] = React.useState<any>(null);
    const [editDateTime, setEditDateTime] = React.useState<boolean>(false);

    // NEW: Track which button to show
    const [activeButton, setActiveButton] = React.useState<"SAVE" | "SUBMIT" | "CANCEL" | null>(null);
    const [formDirty, setFormDirty] = React.useState(false);

    /* -------------------------------------------------
    3. FETCH DOCUMENT
    ------------------------------------------------- */

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
                    `${API_BASE_URL}/${doctypeName}/${docname}`,
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

                const data = resp.data.data as StockEntryData;
                setStockEntry(data);
                setEditDateTime(data.set_posting_time === 1);

                // Initialize button state based on document status
                if (data.docstatus === 0) { // Draft
                    setActiveButton("SUBMIT");
                } else if (data.docstatus === 1) { // Submitted
                    setActiveButton("CANCEL");
                }

                setFormDirty(false);
            } catch (err: any) {
                console.error("API Error:", err);

                const messages = getApiMessages(
                    null,
                    err,
                    "Record loaded successfully",
                    "Failed to load record",
                    (error) => {
                        if (error.response?.status === 404) return "Record not found";
                        if (error.response?.status === 403) return "Unauthorized";
                        if (error.response?.status === 417) {
                            const serverMessages = error.response?.data?._server_messages;
                            if (serverMessages) {
                                try {
                                    const parsed = JSON.parse(serverMessages);
                                    if (Array.isArray(parsed) && parsed.length > 0) {
                                        const messageObj = typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0];
                                        return messageObj.message || error.response?.data?.exception || "Validation failed";
                                    }
                                } catch (e) {
                                    console.error("Failed to parse server messages:", e);
                                }
                            }
                            return error.response?.data?.exception || "Validation failed - Server cannot meet requirements";
                        }
                        return "Failed to load record";
                    }
                );

                setError(messages.description || messages.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDoc();
    }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

    React.useEffect(() => {
        if (!formInstance) return;

        const subscription = formInstance.watch((value: any, { name }: { name?: string }) => {
            // Watch for set_posting_time checkbox changes
            if (name === "set_posting_time" || name === undefined) {
                const isEditable = formInstance.getValues("set_posting_time");
                setEditDateTime(!!isEditable);
            }

            // Watch for form changes to mark as dirty
            if (name && !isProgrammaticUpdate.current) {
                setFormDirty(true);
                // When form becomes dirty, show SAVE button
                if (stockEntry?.docstatus === 0) {
                    setActiveButton("SAVE");
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [formInstance, stockEntry?.docstatus]);

    const handleFormInit = React.useCallback((form: any) => {
        setFormInstance(form);

        const fromWarehouse = form.getValues("from_warehouse");
        const toWarehouse = form.getValues("to_warehouse");
        const items = form.getValues("items") || [];

        if (!items.length) return;

        const updatedItems = items.map((row: any) => ({
            ...row,
            s_warehouse: row.s_warehouse || fromWarehouse || "",
            t_warehouse: row.t_warehouse || toWarehouse || "",
        }));

        form.setValue("items", updatedItems);
    }, []);

    /* -------------------------------------------------
    4. Build tabs once when data is ready
    ------------------------------------------------- */

    const formTabs: TabbedLayout[] = React.useMemo(() => {
        if (!stockEntry) return [];

        const fields = (list: FormField[]): FormField[] =>
            list.map((f) => ({
                ...f,
                defaultValue:
                    f.name in stockEntry
                        ? stockEntry[f.name as keyof StockEntryData]
                        : f.defaultValue,
            }));

        return [
            {
                name: "Details",
                fields: fields([
                    {
                        name: "posting_date",
                        label: "Posting Date",
                        type: "Date",
                        fieldColumns: 1,
                    },
                    {
                        name: "posting_date",
                        label: "Posting Date",
                        type: editDateTime ? "Date" : "Read Only",
                        fieldColumns: 1,
                        defaultValue: stockEntry.posting_date || new Date().toISOString().split("T")[0],
                    },
                    {
                        name: "posting_time",
                        label: "Posting Time",
                        type: editDateTime ? "Time" : "Read Only",
                        fieldColumns: 1,
                        defaultValue: stockEntry.posting_time || new Date().toISOString().split("T")[1].substring(0, 5),
                    },
                    {
                        name: "set_posting_time",
                        label: "Edit Posting Date and Time",
                        type: "Check",
                        fieldColumns: 1,
                    },
                    {
                        name: "stock_entry_type",
                        label: "Stock Entry Type",
                        type: "Link",
                        linkTarget: "Stock Entry Type",
                        required: true,
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
                        fieldColumns: 1,
                    },
                    {
                        name: "add_to_transit",
                        label: "Add To Transit",
                        type: "Check",
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
                        fieldColumns: 1,
                        customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
                        customSearchParams: {
                            filters: [["Warehouse", "company", "in", ["", "quantbit"]], ["Warehouse", "is_group", "=", 0]]
                        },
                        referenceDoctype: "Stock Entry",
                        doctype: "Warehouse",
                    },
                    {
                        name: "to_warehouse",
                        label: "Default Target Warehouse",
                        type: "Link",
                        linkTarget: "Warehouse",
                        fieldColumns: 1,
                        customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
                        customSearchParams: {
                            filters: [["Warehouse", "company", "in", ["", "quantbit"]], ["Warehouse", "is_group", "=", 0]]
                        },
                        referenceDoctype: "Stock Entry",
                        doctype: "Warehouse",
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
                        columns: [
                            {
                                name: "item_code",
                                label: "Item Code",
                                type: "Link",
                                linkTarget: "Item",
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
                                fetchFrom: {
                                    sourceField: "parent.from_warehouse",
                                    targetDoctype: "Warehouse",
                                    targetField: "name"
                                },
                                referenceDoctype: "Stock Entry Detail",
                                doctype: "Warehouse",
                            },
                            {
                                name: "t_warehouse",
                                label: "Target Warehouse",
                                type: "Link",
                                linkTarget: "Warehouse",
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
                                fetchFrom: {
                                    sourceField: "parent.to_warehouse",
                                    targetDoctype: "Warehouse",
                                    targetField: "name"
                                },
                                referenceDoctype: "Stock Entry Detail",
                                doctype: "Warehouse",
                            },

                            {
                                name: "qty",
                                label: "Qty",
                                type: "Float",
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
                ]),
            },
            {
                name: "Additional Costs",
                fields: fields([
                    {
                        name: "additional_costs",
                        label: "Additional Costs",
                        type: "Table",
                        showDownloadUpload: true,
                        columns: [
                            {
                                name: "expense_account",
                                label: "Expense Account",
                                type: "Link",
                                linkTarget: "Account",
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
                            },
                        ],
                    },
                ]),
            },
            {
                name: "Other Info",
                fields: fields([
                    {
                        name: "print_settings_section",
                        label: "Printing Settings",
                        type: "Section Break",
                    },
                    {
                        name: "print_heading",
                        label: "Print Heading",
                        type: "Link",
                        linkTarget: "Print Heading",
                    },
                    {
                        name: "letter_head",
                        label: "Letter Head",
                        type: "Link",
                        linkTarget: "Letter Head",
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
                        defaultValue: "No",
                    },
                    {
                        name: "remarks",
                        label: "Remarks",
                        type: "Text",
                    },
                ]),
            },
        ];
    }, [stockEntry, editDateTime]);

    /* -------------------------------------------------
    5. SUBMIT – Save functionality
    ------------------------------------------------- */
    const handleSubmit = async (
        data: Record<string, any>,
        isDirty: boolean
    ): Promise<{ status?: string } | void> => {
        if (!isDirty) {
            toast.info("No changes to save.");
            return;
        }

        // 🟢 CLIENT-SIDE VALIDATION LOGIC
        // Validate required fields
        if (!data.stock_entry_type) {
            toast.error("Validation Failed", {
                description: "Stock Entry Type is required.",
                duration: Infinity
            });
            return;
        }

        // Validate items table
        const items = data.items || [];
        if (items.length === 0) {
            toast.error("Validation Failed", {
                description: "At least one item is required in the Items table.",
                duration: Infinity
            });
            return;
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.item_code) {
                toast.error("Validation Failed", {
                    description: `Item Code is required for row ${i + 1}.`,
                    duration: Infinity
                });
                return;
            }

            if (item.qty === undefined || item.qty === null || item.qty <= 0) {
                toast.error("Validation Failed", {
                    description: `Quantity must be greater than 0 for row ${i + 1}.`,
                    duration: Infinity
                });
                return;
            }
        }

        // If validation passes, proceed to save
        setIsSaving(true);
        isProgrammaticUpdate.current = true;

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

            if (!stockEntry) {
                alert("Error: Record data not loaded. Cannot save.");
                setIsSaving(false);
                return;
            }

            finalPayload.modified = stockEntry.modified;
            finalPayload.docstatus = stockEntry.docstatus;

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
                finalPayload.items = finalPayload.items.map(
                    (row: any) => {
                        return {
                            ...row,
                            qty: Number(row.qty) || 0,
                            basic_rate: Number(row.basic_rate) || 0,
                            conversion_factor: Number(row.conversion_factor) || 1,
                            is_finished_item: row.is_finished_item ? 1 : 0,
                            is_scrap_item: row.is_scrap_item ? 1 : 0,
                        };
                    }
                );
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

            const resp = await axios.put(
                `${API_BASE_URL}/${doctypeName}/${docname}`,
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

            // Handle successful response
            const messages = getApiMessages(resp, null, "Changes saved!", "Failed to save");

            if (messages.success) {
                toast.success(messages.message, { description: messages.description });
            } else {
                toast.error(messages.message, { description: messages.description, duration: Infinity });
            }

            if (resp.data && resp.data.data) {
                // Update state with new data
                const updatedData = resp.data.data as StockEntryData;
                setStockEntry(updatedData);
                setEditDateTime(updatedData.set_posting_time === 1);
                setFormDirty(false);

                // Update button state after save
                if (updatedData.docstatus === 0) { // Still draft
                    setActiveButton("SUBMIT");
                }

                // Force DynamicForm remount
                setFormVersion((v) => v + 1);
            }

            // Return appropriate status based on docstatus
            const savedStatus = resp.data.data.docstatus === 0 ? "Draft" :
                resp.data.data.docstatus === 1 ? "Submitted" : "Cancelled";

            return { status: savedStatus };
        } catch (err: any) {
            console.error("Save error:", err);
            console.log("Full server error:", err.response?.data);

            const messages = getApiMessages(
                null,
                err,
                "Changes saved!",
                "Failed to save",
                (error) => {
                    if (error.response?.status === 404) return "Record not found";
                    if (error.response?.status === 403) return "Unauthorized";
                    if (error.response?.status === 417) {
                        const serverMessages = error.response?.data?._server_messages;
                        if (serverMessages) {
                            try {
                                const parsed = JSON.parse(serverMessages);
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                    const messageObj = typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0];
                                    return messageObj.message || error.response?.data?.exception || "Validation failed";
                                }
                            } catch (e) {
                                console.error("Failed to parse server messages:", e);
                            }
                        }
                        return error.response?.data?.exception || "Validation failed - Server cannot meet requirements";
                    }
                    return "Failed to save record";
                }
            );

            toast.error(messages.message, { description: messages.description, duration: Infinity });
        } finally {
            setIsSaving(false);
            isProgrammaticUpdate.current = false;
        }
    };

    /* -------------------------------------------------
    6. CANCEL DOCUMENT
    ------------------------------------------------- */
    const handleCancel = async () => {
        if (!apiKey || !apiSecret) {
            toast.error("Authentication required");
            return;
        }

        try {
            await axios.post(
                `http://103.219.3.169:2223/api/method/frappe.client.cancel`,
                {
                    doctype: "Stock Entry",
                    name: docname,
                },
                {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            toast.success("Document cancelled successfully");

            // Update local state without reload
            const updatedStockEntry = { ...stockEntry!, docstatus: 2 };
            setStockEntry(updatedStockEntry);
            setActiveButton(null); // Remove cancel button after cancellation
        } catch (err) {
            console.error(err);
            toast.error("Failed to cancel document");
        }
    };

    /* -------------------------------------------------
    7. SUBMIT DOCUMENT
    ------------------------------------------------- */
    const handleSubmitDocument = async () => {
        if (!formInstance) return;

        const formData = formInstance.getValues();

        // 🔴 BLOCK GROUP WAREHOUSE ON SUBMIT (EXACT FIX)

        // 1️⃣ Default source warehouse check
        if (formData.from_warehouse === "All Warehouses - Q") {
            toast.error(
                "Group warehouse is not allowed. Please select a child warehouse.",
                { duration: Infinity }
            );
            setIsSaving(false);
            return;
        }

        // 2️⃣ Items table validation
        const items = formData.items || [];

        for (let i = 0; i < items.length; i++) {
            const row = items[i];

            // Material Issue requires source warehouse
            if (!row.s_warehouse) {
                toast.error(`Source Warehouse is required in row ${i + 1}`, {
                    duration: Infinity,
                });
                setIsSaving(false);
                return;
            }

            // ❌ Block group warehouse
            if (row.s_warehouse === "All Warehouses - Q") {
                toast.error(
                    `Group warehouse is not allowed in row ${i + 1}. Please select a child warehouse.`,
                    { duration: Infinity }
                );
                setIsSaving(false);
                return;
            }
        }

        if (!apiKey || !apiSecret || !isInitialized || !isAuthenticated) {
            toast.error("Authentication required");
            return;
        }

        setIsSaving(true);

        try {
            // Prepare payload similar to handleSubmit
            const payload: Record<string, any> = JSON.parse(JSON.stringify(formData));

            // Convert numeric fields
            const numericFields = [
                "qty",
                "basic_rate",
                "conversion_factor",
                "amount",
            ];
            numericFields.forEach((f) => {
                if (f in payload) payload[f] = Number(payload[f]) || 0;
            });

            // Child table conversions
            if (Array.isArray(payload.items)) {
                payload.items = payload.items.map((row: any) => ({
                    ...row,
                    qty: Number(row.qty) || 0,
                    basic_rate: Number(row.basic_rate) || 0,
                    conversion_factor: Number(row.conversion_factor) || 1,
                    is_finished_item: row.is_finished_item ? 1 : 0,
                    is_scrap_item: row.is_scrap_item ? 1 : 0,
                }));
            }

            if (Array.isArray(payload.additional_costs)) {
                payload.additional_costs = payload.additional_costs.map((row: any) => ({
                    ...row,
                    amount: Number(row.amount) || 0,
                }));
            }

            // Set docstatus to 1 (submitted)
            payload.docstatus = 1;

            const response = await axios.put(
                `${API_BASE_URL}/${doctypeName}/${encodeURIComponent(docname)}`,
                payload,
                {
                    headers: { Authorization: `token ${apiKey}:${apiSecret}` },
                }
            );

            toast.success("Document submitted successfully!");

            // Update local state without reload
            const updatedData = response.data.data as StockEntryData;
            setStockEntry(updatedData);
            setEditDateTime(updatedData.set_posting_time === 1);
            setFormDirty(false);

            // Update button to CANCEL after submission
            setActiveButton("CANCEL");

            // Force form remount with new docstatus
            setFormVersion((v) => v + 1);
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to submit document");
        } finally {
            setIsSaving(false);
        }
    };

    /* -------------------------------------------------
    8. UI STATES
    ------------------------------------------------- */
    if (loading) {
        return <div>Loading stock entry details...</div>;
    }

    if (error) {
        return (
            <div className="flex flex-col gap-2">
                <div>{error}</div>
                <button
                    className="border px-3 py-1 rounded"
                    onClick={() => window.location.reload()}
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!stockEntry) {
        return <div>Stock Entry not found.</div>;
    }

    const isSubmitted = stockEntry.docstatus === 1;
    const isCancelled = stockEntry.docstatus === 2;
    const isDraft = stockEntry.docstatus === 0;

    // Determine submit label based on active button
    const getSubmitLabel = () => {
        if (isSaving) {
            switch (activeButton) {
                case "SAVE": return "Saving...";
                case "SUBMIT": return "Submitting...";
                case "CANCEL": return "Cancelling...";
                default: return "Processing...";
            }
        }

        switch (activeButton) {
            case "SAVE": return "Save";
            case "SUBMIT": return "Submit";
            case "CANCEL": return "Cancel";
            default: return undefined;
        }
    };

    const formKey = `${stockEntry.name}-${stockEntry.docstatus}-${formVersion}`;

    /* -------------------------------------------------
    9. RENDER FORM
    ------------------------------------------------- */
    return (
        <DynamicForm
            key={formKey}
            title={`Stock Entry ${stockEntry.name}`}
            tabs={formTabs}
            onSubmit={activeButton === "SAVE" ? handleSubmit : async () => { }}
            onSubmitDocument={activeButton === "SUBMIT" ? handleSubmitDocument : undefined}
            onCancelDocument={activeButton === "CANCEL" ? handleCancel : undefined}
            isSubmittable={activeButton === "SUBMIT"}
            docstatus={stockEntry.docstatus}
            initialStatus={
                isDraft ? "Draft" : isSubmitted ? "Submitted" : "Cancelled"
            }
            onFormInit={handleFormInit}
            doctype={doctypeName}
            submitLabel={getSubmitLabel()}
            deleteConfig={{
                doctypeName: doctypeName,
                docName: docname,
                redirectUrl: "/operations/doctype/stock-entry",
            }}
        />
    );
}