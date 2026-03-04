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
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

/* -------------------------------------------------
1. Stock Reconciliation type interfaces
------------------------------------------------- */

interface StockReconciliationItemRow {
  name?: string;
  item_code?: string; // Link -> Item
  warehouse?: string; // Link -> Store Location
  current_qty?: number; // Float
  qty?: number; // Float
  stock_uom?: string; // Data
  valuation_rate?: number; // Currency
  barcode?: string; // Data
  item_group?: string; // Data
  amount?: number; // Currency
  use_serial_batch_fields?: 0 | 1;
  reconcile_all_serial_batches?: 0 | 1;
  serial_batch_no_type?: string;
  // Add serial/batch fields if needed
  serial_no?: string;
  batch_no?: string;
}

interface StockReconciliationData {
  name: string;
  naming_series?: string;
  purpose?: "Opening Stock" | "Stock Reconciliation";
  posting_date?: string;
  posting_time?: string;
  set_posting_time?: 0 | 1;
  set_warehouse?: string;
  scan_barcode?: string;
  scan_mode?: 0 | 1;
  items?: StockReconciliationItemRow[];
  expense_account?: string;
  cost_center?: string;
  docstatus: 0 | 1 | 2 | number;
  modified: string;
  owner?: string;
  creation?: string;
  // Add other fields that might come from API
  company?: string;
  posting_datetime?: string;
  amended_from?: string;
}

/* -------------------------------------------------
2. Page component
------------------------------------------------- */

export default function StockReconciliationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = params.id as string;
  const doctypeName = "Stock Reconciliation";

  const [stockReconciliation, setStockReconciliation] =
    React.useState<StockReconciliationData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const isProgrammaticUpdate = React.useRef(false);
  const [formVersion, setFormVersion] = React.useState(0);
  const [formInstance, setFormInstance] = React.useState<any>(null);
  const [editDateTime, setEditDateTime] = React.useState<boolean>(false);

  // Track which button to show
  const [activeButton, setActiveButton] = React.useState<
    "SAVE" | "SUBMIT" | "CANCEL" | null
  >(null);
  const [formDirty, setFormDirty] = React.useState(false);

  /* -------------------------------------------------
  3. FETCH DOCUMENT
  ------------------------------------------------- */

  React.useEffect(() => {
    const fetchDoc = async () => {
      if (
        !isInitialized ||
        !isAuthenticated ||
        !apiKey ||
        !apiSecret ||
        !docname
      ) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log("Fetching document:", docname);

        const resp = await axios.get(
          `${API_BASE_URL}/${doctypeName}/${encodeURIComponent(docname)}`,
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

        const data = resp.data.data as StockReconciliationData;
        console.log("Fetched Stock Reconciliation Data:", data);
        console.log("Items data:", data.items);
        console.log("Posting Date:", data.posting_date);
        console.log("Posting Time:", data.posting_time);

        // Parse posting_date and posting_time from posting_datetime if they're combined
        let postingDate = data.posting_date;
        let postingTime = data.posting_time;

        if (data.posting_datetime && !postingDate && !postingTime) {
          const datetime = new Date(data.posting_datetime);
          postingDate = datetime.toISOString().split("T")[0];
          postingTime = datetime.toTimeString().split(" ")[0];
        }

        // Create updated data with properly parsed dates
        const updatedData: StockReconciliationData = {
          ...data,
          posting_date: postingDate,
          posting_time: postingTime,
        };

        setStockReconciliation(updatedData);
        setEditDateTime(updatedData.set_posting_time === 1);

        // Initialize button state based on document status
        if (updatedData.docstatus === 0) {
          // Draft
          setActiveButton("SUBMIT");
        } else if (updatedData.docstatus === 1) {
          // Submitted
          setActiveButton("CANCEL");
        }

        setFormDirty(false);
      } catch (err: any) {
        console.error("API Error:", err);
        console.error("Error details:", err.response?.data);

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
                    const messageObj =
                      typeof parsed[0] === "string"
                        ? JSON.parse(parsed[0])
                        : parsed[0];
                    return (
                      messageObj.message ||
                      error.response?.data?.exception ||
                      "Validation failed"
                    );
                  }
                } catch (e) {
                  console.error("Failed to parse server messages:", e);
                }
              }
              return (
                error.response?.data?.exception ||
                "Validation failed - Server cannot meet requirements"
              );
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

  // Set form values when data is loaded
  React.useEffect(() => {
    if (!formInstance || !stockReconciliation) return;

    console.log("Setting form values from stockReconciliation data");

    isProgrammaticUpdate.current = true;

    // Prepare form values
    const formValues: any = {};

    // Set all simple fields
    Object.keys(stockReconciliation).forEach((key) => {
      if (
        key !== "items" &&
        key !== "modified" &&
        key !== "docstatus" &&
        key !== "creation" &&
        key !== "owner" &&
        key !== "__islocal" &&
        key !== "__unsaved"
      ) {
        formValues[key] = stockReconciliation[key as keyof StockReconciliationData];
      }
    });

    // Handle posting_date and posting_time
    if (stockReconciliation.posting_date) {
      // If posting_date contains time part, split it
      const dateStr = stockReconciliation.posting_date;
      if (dateStr.includes(" ")) {
        const [datePart, timePart] = dateStr.split(" ");
        formValues.posting_date = datePart;
        if (!formValues.posting_time && timePart) {
          formValues.posting_time = timePart.split(".")[0];
        }
      } else if (dateStr.includes("T")) {
        const [datePart, timePart] = dateStr.split("T");
        formValues.posting_date = datePart;
        if (!formValues.posting_time && timePart) {
          formValues.posting_time = timePart.split(".")[0];
        }
      } else {
        formValues.posting_date = dateStr;
      }
    }

    // Handle posting_time if it's separate
    if (stockReconciliation.posting_time && !formValues.posting_time) {
      const timeStr = stockReconciliation.posting_time;
      formValues.posting_time = timeStr.includes(" ")
        ? timeStr.split(" ")[1]?.split(".")[0]
        : timeStr.split(".")[0];
    }

    // Set items table
    formValues.items = stockReconciliation.items || [];

    // Convert boolean-like fields
    if (formValues.set_posting_time !== undefined) {
      formValues.set_posting_time = formValues.set_posting_time ? 1 : 0;
    }
    if (formValues.scan_mode !== undefined) {
      formValues.scan_mode = formValues.scan_mode ? 1 : 0;
    }
    // Reset form with values
    formInstance.reset(formValues);
    setFormDirty(false);

    // Reset the programmatic update flag after a short delay
    setTimeout(() => {
      isProgrammaticUpdate.current = false;
    }, 100);
  }, [stockReconciliation, formInstance]);

  // Watch for form changes
  React.useEffect(() => {
    if (!formInstance) return;

    const subscription = formInstance.watch(
      (value: any, { name }: { name?: string }) => {
        // Watch for set_posting_time checkbox changes
        if (name === "set_posting_time" || name === undefined) {
          const isEditable = formInstance.getValues("set_posting_time");
          setEditDateTime(!!isEditable);
        }

        // Watch for form changes to mark as dirty
        if (name && !isProgrammaticUpdate.current) {
          setFormDirty(true);
          // When form becomes dirty, show SAVE button
          if (stockReconciliation?.docstatus === 0) {
            setActiveButton("SAVE");
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [formInstance, stockReconciliation?.docstatus]);

  const handleFormInit = React.useCallback((form: any) => {
    setFormInstance(form);

    const subscription = form.watch(async (value: any, { name }: { name?: string }) => {
      // 🔹 Handle posting time toggle
      if (name === "set_posting_time" || name === undefined) {
        const isEditable = form.getValues("set_posting_time");
        setEditDateTime(!!isEditable);
      }

      const warehouse = form.getValues("set_warehouse");

      // ✅ AUTO FILL CHILD WAREHOUSE (Sync Default Warehouse to all items)
      if (name === "set_warehouse" || name === "items" || name === undefined) {
        if (warehouse) {
          const items = form.getValues("items") || [];
          let changed = false;

          const updatedItems = items.map((row: any) => {
            if (row.warehouse !== warehouse) {
              changed = true;
              return { ...row, warehouse: warehouse };
            }
            return row;
          });

          if (changed) {
            form.setValue("items", updatedItems, { shouldDirty: true });
          }
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

  /* -------------------------------------------------
  4. Build tabs
  ------------------------------------------------- */

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!stockReconciliation) return [];

    console.log("Building form tabs with data:", stockReconciliation);

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
            defaultValue: stockReconciliation.purpose || "Stock Reconciliation",
          },
          {
            name: "posting_date",
            label: "Posting Date",
            type: editDateTime ? "Date" : "Read Only",
            fieldColumns: 1,
            defaultValue: stockReconciliation.posting_date
              ? stockReconciliation.posting_date.split(" ")[0]?.split("T")[0]
              : new Date().toISOString().split("T")[0],
          },
          {
            name: "posting_time",
            label: "Posting Time",
            type: editDateTime ? "Time" : "Read Only",
            fieldColumns: 1,
            defaultValue: stockReconciliation.posting_time
              ? stockReconciliation.posting_time.split(" ")[1]?.split(".")[0] ||
              stockReconciliation.posting_time.split(".")[0]
              : "00:00:00",
          },
          {
            name: "set_posting_time",
            label: "Edit Posting Date and Time",
            type: "Check",
            fieldColumns: 1,
            defaultValue: stockReconciliation.set_posting_time || 0,
          },
          {
            name: "set_warehouse",
            label: "Default Warehouse",
            type: "Link",
            linkTarget: "Warehouse",
            fieldColumns: 1,
            defaultValue: stockReconciliation.set_warehouse || "",
            customSearchUrl: "http://103.219.1.138:4412/api/method/frappe.desk.search.search_link",
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
            defaultValue: stockReconciliation.items || [],
            columns: [
              {
                name: "item_code",
                label: "Item Code",
                type: "Link",
                linkTarget: "Item",
                required: true,
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
                    ["Warehouse", "company", "=", "quantbit"],
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
                readOnly: true,
              },
              {
                name: "qty",
                label: "Quantity",
                type: "Float",
                required: true,
                defaultValue: 0,
              },
              {
                name: "stock_uom",
                label: "Stock UOM",
                type: "Link",
                linkTarget: "UOM",
                fetchFrom: {
                  sourceField: "stock_uom",
                  targetDoctype: "Item",
                  targetField: "item_code",
                },
              },
              {
                name: "valuation_rate",
                label: "Valuation Rate",
                type: "Currency",
                precision: 2,
                defaultValue: "0.00",
                fetchFrom: {
                  sourceField: "valuation_rate",
                  targetDoctype: "Item",
                  targetField: "item_code",
                },
              },

              {
                name: "item_group",
                label: "Item Group",
                type: "Link",
                linkTarget: "Item Group",
                fetchFrom: {
                  sourceField: "item_group",
                  targetDoctype: "Item",
                  targetField: "item_code",
                },
              },
              {
                name: "amount",
                label: "Amount",
                type: "Currency",
                defaultValue: "0.00",
                precision: 2,
                formula: "qty * valuation_rate",
                readOnly: true,
              },
              {
                name: "use_serial_batch_fields",
                label: "Use Serial No/ Batch Fields",
                type: "Check",
                defaultValue: false,
              },
              {
                name: "reconcile_all_serial_batches",
                label: "Reconcile all serial Nos/Batches",
                type: "Check",
                displayDependsOn: "use_serial_batch_fields==false",
              },
            ],
          },
          {
            name: "expense_account",
            label: "Difference Account",
            type: "Link",
            linkTarget: "Account",
            defaultValue: stockReconciliation.expense_account || "",
          },
          {
            name: "cost_center",
            label: "Cost Center",
            type: "Link",
            linkTarget: "Cost Center",
            defaultValue: stockReconciliation.cost_center || "",
          },
        ],
      },
    ];
  }, [stockReconciliation, editDateTime]);

  /* -------------------------------------------------
  5. SAVE handler
  ------------------------------------------------- */

  const handleSubmit = async (
    data: Record<string, any>,
    isDirty: boolean
  ): Promise<{ status?: string } | void> => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    // 🟢 CLIENT-SIDE VALIDATION LOGIC 🟢
    // Validate required fields
    if (!data.naming_series) {
      toast.error("Validation Failed", {
        description: "Series is required.",
        duration: Infinity,
      });
      return;
    }

    if (!data.purpose) {
      toast.error("Validation Failed", {
        description: "Purpose is required.",
        duration: Infinity,
      });
      return;
    }

    // Validate posting date and time if editing is enabled
    if (data.set_posting_time) {
      if (!data.posting_date) {
        toast.error("Validation Failed", {
          description: "Posting Date is required when editing is enabled.",
          duration: Infinity,
        });
        return;
      }

      if (!data.posting_time) {
        toast.error("Validation Failed", {
          description: "Posting Time is required when editing is enabled.",
          duration: Infinity,
        });
        return;
      }
    }

    // Validate items table
    const items = data.items || [];
    if (items.length === 0) {
      toast.error("Validation Failed", {
        description: "At least one item is required in the Items table.",
        duration: Infinity,
      });
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.item_code) {
        toast.error("Validation Failed", {
          description: `Item Code is required for row ${i + 1}.`,
          duration: Infinity,
        });
        return;
      }

      if (item.qty === undefined || item.qty === null || item.qty <= 0) {
        toast.error("Validation Failed", {
          description: `Quantity must be greater than 0 for row ${i + 1}.`,
          duration: Infinity,
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

      if (!stockReconciliation) {
        toast.error("Error: Record data not loaded. Cannot save.");
        setIsSaving(false);
        return;
      }

      finalPayload.modified = stockReconciliation.modified;
      finalPayload.docstatus = stockReconciliation.docstatus;

      // Combine posting_date and posting_time if set_posting_time is enabled
      if (finalPayload.set_posting_time && finalPayload.posting_date && finalPayload.posting_time) {
        finalPayload.posting_date = `${finalPayload.posting_date} ${finalPayload.posting_time}`;
        delete finalPayload.posting_time;
      }

      // Boolean conversions
      const boolFields = ["set_posting_time", "scan_mode"];
      boolFields.forEach((f) => {
        if (f in finalPayload) {
          finalPayload[f] = finalPayload[f] ? 1 : 0;
        }
      });

      // Numeric conversions for child table
      if (Array.isArray(finalPayload.items)) {
        finalPayload.items = finalPayload.items.map((row: any) => {
          return {
            ...row,
            current_qty: Number(row.current_qty) || 0,
            qty: Number(row.qty) || 0,
            valuation_rate: Number(row.valuation_rate) || 0,
            amount: Number(row.amount) || 0,
            use_serial_batch_fields: row.use_serial_batch_fields ? 1 : 0,
            reconcile_all_serial_batches: row.reconcile_all_serial_batches ? 1 : 0,
          };
        });
      }

      // Send payload
      console.log("Sending this PAYLOAD to Frappe:", finalPayload);

      const resp = await axios.put(
        `${API_BASE_URL}/${doctypeName}/${encodeURIComponent(docname)}`,
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
      const messages = getApiMessages(
        resp,
        null,
        "Changes saved!",
        "Failed to save"
      );

      if (messages.success) {
        toast.success(messages.message, { description: messages.description });
      } else {
        toast.error(messages.message, {
          description: messages.description,
          duration: Infinity,
        });
      }

      if (resp.data && resp.data.data) {
        // Update state with new data
        const updatedData = resp.data.data as StockReconciliationData;
        setStockReconciliation(updatedData);
        setEditDateTime(updatedData.set_posting_time === 1);
        setFormDirty(false);

        // Update button state after save
        if (updatedData.docstatus === 0) {
          // Still draft
          setActiveButton("SUBMIT");
        }

        // Force DynamicForm remount
        setFormVersion((v) => v + 1);
      }

      // Return appropriate status based on docstatus
      const savedStatus = resp.data.data.docstatus === 0 ? "Draft" : "Submitted";

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
                  const messageObj =
                    typeof parsed[0] === "string"
                      ? JSON.parse(parsed[0])
                      : parsed[0];
                  return (
                    messageObj.message ||
                    error.response?.data?.exception ||
                    "Validation failed"
                  );
                }
              } catch (e) {
                console.error("Failed to parse server messages:", e);
              }
            }
            return (
              error.response?.data?.exception ||
              "Validation failed - Server cannot meet requirements"
            );
          }
          return "Failed to save record";
        }
      );

      toast.error(messages.message, {
        description: messages.description,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
      isProgrammaticUpdate.current = false;
    }
  };

  const handleCancel = async () => {
    if (!apiKey || !apiSecret) {
      toast.error("Authentication required");
      return;
    }

    try {
      await axios.post(
        `http://103.219.1.138:4412/api/method/frappe.client.cancel`,
        {
          doctype: "Stock Reconciliation",
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

      // Update local state
      if (stockReconciliation) {
        const updatedStockReconciliation = {
          ...stockReconciliation,
          docstatus: 2, // Cancelled
        };
        setStockReconciliation(updatedStockReconciliation);
        setActiveButton(null); // Remove cancel button after cancellation
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel document");
    }
  };

  /* -------------------------------------------------
  6. SUBMIT document handler
  ------------------------------------------------- */

  const handleSubmitDocument = async () => {
    if (!formInstance) return;

    const formData = formInstance.getValues();
    if (!apiKey || !apiSecret || !isInitialized || !isAuthenticated) {
      toast.error("Authentication required");
      return;
    }

    setIsSaving(true);

    try {
      // Prepare payload similar to handleSubmit
      const payload: Record<string, any> = JSON.parse(JSON.stringify(formData));

      // Clean non-data fields
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

      // Combine posting_date and posting_time if set_posting_time is enabled
      if (
        finalPayload.set_posting_time &&
        finalPayload.posting_date &&
        finalPayload.posting_time
      ) {
        finalPayload.posting_date = `${finalPayload.posting_date} ${finalPayload.posting_time}`;
        delete finalPayload.posting_time;
      }

      // Convert numeric fields
      const numericFields = ["current_qty", "qty", "valuation_rate", "amount"];
      numericFields.forEach((f) => {
        if (f in finalPayload) finalPayload[f] = Number(finalPayload[f]) || 0;
      });

      // Child table conversions
      if (Array.isArray(finalPayload.items)) {
        finalPayload.items = finalPayload.items.map((row: any) => ({
          ...row,
          current_qty: Number(row.current_qty) || 0,
          qty: Number(row.qty) || 0,
          valuation_rate: Number(row.valuation_rate) || 0,
          amount: Number(row.amount) || 0,
          use_serial_batch_fields: row.use_serial_batch_fields ? 1 : 0,
          reconcile_all_serial_batches: row.reconcile_all_serial_batches ? 1 : 0,
        }));
      }

      // Boolean conversions
      const boolFields = ["set_posting_time", "scan_mode"];
      boolFields.forEach((f) => {
        if (f in finalPayload) {
          finalPayload[f] = finalPayload[f] ? 1 : 0;
        }
      });

      // Set docstatus to 1 (submitted) and include modified timestamp
      finalPayload.docstatus = 1;
      finalPayload.modified = stockReconciliation?.modified;

      console.log("Submitting payload:", finalPayload);

      const response = await axios.put(
        `${API_BASE_URL}/Stock Reconciliation/${encodeURIComponent(docname)}`,
        finalPayload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("Document submitted successfully!");

      // Update local state
      const updatedData = response.data.data as StockReconciliationData;
      setStockReconciliation(updatedData);
      setEditDateTime(updatedData.set_posting_time === 1);
      setFormDirty(false);

      // Update button to CANCEL after submission
      setActiveButton("CANCEL");

      // Force form remount with new docstatus
      setFormVersion((v) => v + 1);
    } catch (err: any) {
      console.error("Submit error:", err);
      console.error("Error details:", err.response?.data);

      const messages = getApiMessages(
        null,
        err,
        "Document submitted successfully",
        "Failed to submit document",
        (error) => {
          if (error.response?.status === 417) {
            const serverMessages = error.response?.data?._server_messages;
            if (serverMessages) {
              try {
                const parsed = JSON.parse(serverMessages);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const messageObj =
                    typeof parsed[0] === "string"
                      ? JSON.parse(parsed[0])
                      : parsed[0];
                  return messageObj.message || "Validation failed";
                }
              } catch (e) {
                console.error("Failed to parse server messages:", e);
              }
            }
            return error.response?.data?.exception || "Validation failed";
          }
          return "Failed to submit document";
        }
      );

      toast.error(messages.message, {
        description: messages.description,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  /* -------------------------------------------------
  7. UI STATES
  ------------------------------------------------- */

  if (loading) {
    return <div className="p-4">Loading stock reconciliation details...</div>;
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col gap-2">
        <div className="text-red-600">{error}</div>
        <button
          className="border px-3 py-1 rounded hover:bg-gray-100"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stockReconciliation) {
    return <div className="p-4">Stock Reconciliation not found.</div>;
  }

  const isSubmitted = stockReconciliation.docstatus === 1;
  const isDraft = stockReconciliation.docstatus === 0;

  // Determine submit label based on active button
  const getSubmitLabel = () => {
    if (isSaving) {
      switch (activeButton) {
        case "SAVE":
          return "Saving...";
        case "SUBMIT":
          return "Submitting...";
        case "CANCEL":
          return "Cancelling...";
        default:
          return "Processing...";
      }
    }

    switch (activeButton) {
      case "SAVE":
        return "Save";
      case "SUBMIT":
        return "Submit";
      case "CANCEL":
        return "Cancel";
      default:
        return undefined;
    }
  };

  const formKey = `${stockReconciliation.name}-${stockReconciliation.docstatus}-${formVersion}`;

  /* -------------------------------------------------
  8. RENDER FORM
  ------------------------------------------------- */

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        key={formKey}
        title={`Stock Reconciliation ${stockReconciliation.name}`}
        tabs={formTabs}
        onSubmit={activeButton === "SAVE" ? handleSubmit : async () => { }}
        onSubmitDocument={
          activeButton === "SUBMIT" ? handleSubmitDocument : undefined
        }
        onCancelDocument={activeButton === "CANCEL" ? handleCancel : undefined}
        isSubmittable={activeButton === "SUBMIT"}
        docstatus={stockReconciliation.docstatus}
        initialStatus={isDraft ? "Draft" : "Submitted"}
        onFormInit={handleFormInit}
        doctype={doctypeName}
        submitLabel={getSubmitLabel()}
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/operations/doctype/stock-reconciliation",
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
          currentUserEmail={stockReconciliation.owner}
          modifiedStr={stockReconciliation.modified}
          modifiedBy={undefined}
        />
      </div>
    </div>
  );
}