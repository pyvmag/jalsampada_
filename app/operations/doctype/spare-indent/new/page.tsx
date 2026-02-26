"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { UseFormReturn } from "react-hook-form";
import axios from "axios";
import { fetchAssetsFromLisAndStage, fetchItemDetails } from "../services";

// 🟢 CONFIGURATION
const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
const DOCTYPE_NAME = "Material Request";

export default function NewSpareIndentPage() {
  const router = useRouter();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);
  const [formMethods, setFormMethods] = React.useState<UseFormReturn<any> | null>(null);
  const lastFetchedItemCodesRef = React.useRef<Record<number, string>>({});

  const formTabs: TabbedLayout[] = React.useMemo(() => {
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
            defaultValue: "Material Issue",
            required: true,
            inStandardFilter: true,
            layoutCols: 3,
          },
          {
            name: "transaction_date",
            label: "Date",
            type: "Date",
            required: true,
            bold: true,
            width: "100px",
            layoutCols: 3,
          },
          {
            name: "schedule_date",
            label: "Required By",
            type: "Date",
            required: true,
            layoutCols: 3,
          },
          {
            name: "custom_prepared_by",
            label: "Prepared By",
            type: "Link",
            searchField: "employee_name",
            linkTarget: "Employee",
            layoutCols: 3,
          },
          {
            name: "custom_designation",
            label: "Designation",
            type: "Data",
            fetchFrom: {
              sourceField: "custom_prepared_by",
              targetDoctype: "Employee",
              targetField: "designation"
            },
            readOnly: true,
            layoutCols: 3,
          },
          {
            name: "buying_price_list",
            label: "Price List",
            type: "Link",
            linkTarget: "Price List",
            layoutCols: 3,
          },
          { name: "custom_section_break_9pzmb", label: "LIS Details", type: "Section Break" },
          {
            name: "custom_lis_name",
            label: "LIS Name",
            type: "Link",
            linkTarget: "Lift Irrigation Scheme",
            filterMapping: [{ sourceField: "custom_lis_name", targetField: "lis_name" }]
          },
          {
            name: "custom_stage",
            label: "Stage",
            type: "Link",
            linkTarget: "Stage No",
            filterMapping: [{ sourceField: "custom_lis_name", targetField: "lis_name" }]
          },
          {
            name: "custom_asset_category",
            label: "Asset category",
            type: "Link",
            linkTarget: "Asset Category",
          },
          { name: "custom_section_break_9pzmb", label: "", type: "Section Break" },
          {
            name: "custom_assets",
            label: "Assets",
            type: "Table MultiSelect",
            linkTarget: "Asset",
            // 🟢 Filter mapping similar to Frappe backend query
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
          },
          {
            name: "set_warehouse",
            label: "Set Target Warehouse",
            type: "Link",
            linkTarget: "Warehouse"
          },
          {
            name: "set_from_warehouse",
            label: "Set Source Warehouse",
            type: "Link",
            linkTarget: "Warehouse",
            displayDependsOn: "material_request_type == 'Material Transfer'",
          },
          {
            name: "items",
            label: "Items",
            type: "Table",
            required: true,
            columns: [
              { name: "item_code", label: "Item Code", type: "Link", linkTarget: "Item", required: true },
              { name: "item_name", label: "Item Name", type: "Data", readOnly: true },
              { name: "schedule_date", label: "Required By", type: "Date", required: true },
              { name: "item_group", label: "Item Group", type: "Link", linkTarget: "Item Group" },
              { name: "description", label: "Description", type: "Text" },
              { name: "qty", label: "Quantity Required", type: "Float", required: true },
              { name: "uom", label: "UOM", type: "Link", linkTarget: "UOM" },
              { name: "warehouse", label: "Target Warehouse", type: "Link", linkTarget: "Warehouse" },
              { name: "conversion_factor", label: "Units Conversion Factor", type: "Float" },
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
          { name: "custom_approval_section", label: "Approval Section", type: "Section Break" },
          {
            name: "custom_recommended_by",
            label: "Recommended By (Incharge/JE)",
            type: "Link",
            searchField: "full_name",
            linkTarget: "User",
          },

          {
            name: "custom_verified_by",
            label: "Verified By (DE)",
            type: "Link",
            searchField: "employee_name",
            linkTarget: "Employee",
          },

           {
            name: "custom_approved_by",
            label: "Approved By (EE)",
            type: "Link",
            searchField: "employee_name",
            linkTarget: "Employee",
          },

          {
            name: "custom_name1",
            label: "Name (Incharge/JE)",
            type: "Data",
            fetchFrom: {
              sourceField: "custom_recommended_by",
              targetDoctype: "User",
              targetField: "full_name"
            },
            readOnly: true,
          },

          {
            name: "custom_name2",
            label: "Name (DE)",
            type: "Data",
            fetchFrom: {
              sourceField: "custom_verified_by",
              targetDoctype: "Employee",
              targetField: "employee_name"
            },
            readOnly: true,
          },

          {
            name: "custom_name3",
            label: "Name (EE)",
            type: "Data",
            fetchFrom: {
              sourceField: "custom_approved_by",
              targetDoctype: "Employee",
              targetField: "employee_name"
            },
            readOnly: true,
          },

          { name: "custom_date1", label: "Date (Incharge/JE)", type: "Date" },

          { name: "custom_date2", label: "Date (DE)", type: "Date" },
          
          { name: "custom_date3", label: "Date (EE)", type: "Date" },
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
          },
          {
            name: "terms",
            label: "Terms and Conditions Content",
            type: "Markdown Editor",
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
          },
          {
            name: "select_print_heading",
            label: "Print Heading",
            type: "Link",
            linkTarget: "Print Heading",
          },
        ],
      },
    ];
  }, []);

  const handleSubmit = async (data: Record<string, any>) => {
    if (!data.material_request_type) {
      toast.error("Purpose is required");
      return;
    }
    if (!data.items || data.items.length === 0) {
      toast.error("Please add at least one item.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, any> = { ...data, doctype: DOCTYPE_NAME };

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

      const response = await axios.post(`${API_BASE_URL}/${DOCTYPE_NAME}`, payload, {
        headers: { Authorization: `token ${apiKey}:${apiSecret}` }
      });

      toast.success("Spare Indent created successfully!");
      router.push(`/operations/doctype/spare-indent/${encodeURIComponent(response.data.data.name)}`);
    } catch (err: any) {
      console.error("Save Error:", err);
      const errorMsg = err.response?.data?.exception || err.message || "Failed to save";
      toast.error(errorMsg, { duration: Infinity });
    } finally {
      setIsSaving(false);
    }
  };
  React.useEffect(() => {
    if (!formMethods) return;

    const subscription = formMethods.watch((values, { name }) => {
      // If the main Required By date changes, update all items
      if (name === "schedule_date") {
        const newParentDate = values.schedule_date;
        const currentItems = values.items || [];

        currentItems.forEach((_: any, index: number) => {
          formMethods.setValue(`items.${index}.schedule_date`, newParentDate, {
            shouldDirty: true,
          });
        });
      }

      // Sync for new rows: If items table changes, check if the new row needs the parent date
      if (name?.startsWith("items") && !name.includes("schedule_date")) {
        const parentDate = formMethods.getValues("schedule_date");
        const currentItems = values.items || [];

        currentItems.forEach((item: any, index: number) => {
          if (!item.schedule_date && parentDate) {
            formMethods.setValue(`items.${index}.schedule_date`, parentDate, {
              shouldDirty: true,
            });
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
          {
            custom_lis_name: customLisName,
            custom_stage: customStage,
            custom_asset_category: customAssetCategory,
          },
          apiKey,
          apiSecret
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

      const lastFetchedCodes = lastFetchedItemCodesRef.current;

      if (!itemCode) {
        delete lastFetchedCodes[rowIndex];
        return;
      }

      if (lastFetchedCodes[rowIndex] === itemCode) {
        return;
      }

      lastFetchedCodes[rowIndex] = itemCode;

      try {
        const message = await fetchItemDetails(
          {
            item_code: itemCode,
            material_request_type: values.material_request_type || "Material Issue"
          },
          apiKey,
          apiSecret
        );

        if (!message) return;

        const fieldUpdates: Record<string, any> = {
          item_name: message.item_name ?? "",
          description: message.description ?? "",
          item_group: message.item_group ?? "",
          qty: message.qty ?? 1,
          uom: message.uom ?? "",
          warehouse: message.warehouse ?? "",
          conversion_factor: message.conversion_factor ?? 1,
          rate: message.rate ?? 0,
          amount: message.amount ?? 0,
        };

        Object.entries(fieldUpdates).forEach(([fieldName, fieldValue]) => {
          formMethods.setValue(`items.${rowIndex}.${fieldName}`, fieldValue, { shouldDirty: true });
        });
      } catch (error: any) {
        console.error("Failed to fetch item details", error);
        toast.error(error.response?.data?.message || "Failed to fetch item details", { duration: 5000 });
        delete lastFetchedCodes[rowIndex];
      }
    });

    return () => subscription.unsubscribe();
  }, [apiKey, apiSecret, formMethods]);

  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      title="New Spare Indent"
      description="Create a new Spare Indent"
      submitLabel={isSaving ? "Saving..." : "Create"}
      onFormInit={setFormMethods}
    />
  );
}