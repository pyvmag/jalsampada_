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

const API_BASE_URL = "http://103.219.3.169:2223//api/resource";

export default function NewRecordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  const doctypeName = "Asset";

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
     1. Define the form structure with duplicate data support
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

          { name: "asset_name", label: "Asset Name", type: "Text", required: true, defaultValue: getValue("asset_name") },
          { name: "asset_category", label: "Asset Category", type: "Link", linkTarget: "Asset Category", defaultValue: getValue("asset_category") },
          { name: "custom_asset_no", label: "Asset No", type: "Data", defaultValue: getValue("custom_asset_no") },
          { name: "custom_lis_name", label: "Lift Irrigation Scheme", required: true, type: "Link", linkTarget: "Lift Irrigation Scheme", defaultValue: getValue("custom_lis_name") },


          {
            name: "custom_stage_no", label: "Stage No.", type: "Link", required: true, linkTarget: "Stage No", defaultValue: getValue("custom_stage_no"),
            filterMapping: [
              { sourceField: "custom_lis_name", targetField: "lis_name" }
            ]
          },
          { name: "location", label: "Location", type: "Link", required: true, linkTarget: "Location", defaultValue: getValue("location") },
          { name: "custom_serial_number", label: "Serial Number", type: "Data", defaultValue: getValue("custom_serial_number") },

          {
            name: "is_existing_asset", label: "Is Existing Asset", type: "Check", defaultValue: getValue("is_existing_asset", false),
            displayDependsOn: "is_composite_asset==0 && is_composite_component==0 && custom_obsolete==0"
          },
          {
            name: "is_composite_asset", label: "Is Composite Asset", type: "Check", defaultValue: getValue("is_composite_asset", false),
            displayDependsOn: "is_existing_asset==0 && is_composite_component==0 && custom_obsolete==0"
          },
          {
            name: "is_composite_component", label: "Is Composite Component", type: "Check", defaultValue: getValue("is_composite_component", false),
            displayDependsOn: "is_composite_asset==0 && is_existing_asset==0 && custom_obsolete==0"
          },

          // 🟢 UPDATED: Using a Custom Field as a Vertical Spacer (h-2 = 0.5rem)

          {
            name: "custom_obsolete", label: "Is Obsolete", type: "Check", defaultValue: getValue("custom_obsolete", false),
            displayDependsOn: "is_composite_asset==0 && is_existing_asset==0 && is_composite_component==0"
          },
          {
            name: "spacer_obsolete",
            label: "",
            type: "Custom",
            customElement: <div className="h-2 w-full" aria-hidden="true" /> // Adds vertical gap
          },
          { name: "section_interchange", label: "Interchange Details", type: "Section Break" },
          {
            name: "custom_current_linked_asset",
            label: "Current Linked Motor/Pump",
            type: "Link",
            linkTarget: "Asset",
            customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
            filters: (getValue) => {
              const filters: Record<string, any> = {};
              const stageNo = getValue("custom_stage_no");
              const lisName = getValue("custom_lis_name");

              if (stageNo) filters.custom_stage_no = stageNo;
              if (lisName) filters.custom_lis_name = lisName;

              return filters;
            },
            referenceDoctype: "Asset",
            doctype: "Asset",
          },
          {
            name: "custom_linked_asset_no",
            label: "Linked Asset No",
            type: "Data",
            fetchFrom: { sourceField: "custom_current_linked_asset", targetDoctype: "Asset", targetField: "custom_asset_no" }
          },
          {
            name: "custom_interchange_date",
            label: "Interchange Date",
            type: "Date"
          },
          { name: "section_purchase", label: "Purchase Details", type: "Section Break" },

          // --- FIX #1: Make 'purchase_date' required ---
          // This is required by your "ACC-ASS-.YYYY.-" naming_series
          {
            name: "purchase_date", label: "Purchase Date", type: "Date", required: true, defaultValue: getValue("purchase_date"),
            displayDependsOn: "is_existing_asset==1 || is_composite_asset==1"
          },
          // ---------------------------------------------

          { name: "net_purchase_amount", label: "Net Purchase Amount", type: "Currency", required: true, defaultValue: getValue("gross_purchase_amount") },
          { name: "asset_quantity", label: "Asset Quantity", type: "Int", min: 1, defaultValue: getValue("asset_quantity", 1) },
          {
            name: "available_for_use_date", label: "Commisioning Date", type: "Date", defaultValue: getValue("available_for_use_date"),
            displayDependsOn: "is_existing_asset==1 || is_composite_asset==1"
          },
        ],
      },
      // ... other tabs ...
      {
        name: "Insurance",
        fields: [
          { name: "policy_number", label: "Policy number", type: "Data", defaultValue: getValue("policy_number") },
          { name: "insurance_start_date", label: "Insurance Start Date", type: "Date", defaultValue: getValue("insurance_start_date") },
          { name: "insurer", label: "Insurer", type: "Data", defaultValue: getValue("insurer") },
          { name: "insurance_end_date", label: "Insurance End Date", type: "Date", defaultValue: getValue("insurance_end_date") },
          { name: "insured_value", label: "Insured value", type: "Currency", defaultValue: getValue("insured_value") },
          { name: "comprehensive_insurance", label: "Comprehensive Insurance", type: "Data", defaultValue: getValue("comprehensive_insurance") },
        ],
      },
      {
        name: "Other Info",
        fields: [
          { name: "custodian", label: "Custodian", type: "Link", linkTarget: "Employee", defaultValue: getValue("custodian") },
          { name: "department", label: "Department", type: "Link", linkTarget: "Department", defaultValue: getValue("department") },
          { name: "installation_date", label: "Installation Date", type: "Date", defaultValue: getValue("installation_date") },
          { name: "custom_equipement_make", label: "Equipement Make", type: "Link", linkTarget: "Equipement Make", defaultValue: getValue("custom_equipement_make") },
          { name: "custom_equipement_model", label: "Equipement Model", type: "Link", linkTarget: "Equipement Model", defaultValue: getValue("custom_equipement_model") },
          { name: "last_repair_date", label: "Last Repair Date", type: "Date", defaultValue: getValue("last_repair_date") },
          { name: "custom_equipement_capacity", label: "Equipement Capacity", type: "Link", linkTarget: "Equipement Capacity", defaultValue: getValue("custom_equipement_capacity") },
          { name: "custom_equipement_rating", label: "Equipement Rating", type: "Link", linkTarget: "Rating", defaultValue: getValue("custom_equipement_rating") },

          {
            name: "custom_condition",
            label: "Condition",
            type: "Select",
            options: [{ label: "Working", value: "Working" }, { label: "Under Repair", value: "Under Repair", }],
            defaultValue: getValue("custom_condition"),

          },
          { name: "custom_previous_hours", label: "Previous Running Hours", type: "Float", defaultValue: getValue("custom_previous_hours") },
          { name: "custom_hours_before_system", label: "Hours Before System", type: "Float", defaultValue: getValue("custom_hours_before_system") },
          { name: "custom_cumulative_hours", label: "Cumulative Hours", type: "Float", defaultValue: getValue("custom_cumulative_hours") },
          { name: "maintenance_required", label: "Maintenance Required", type: "Check", defaultValue: getValue("maintenance_required", false) },
          {
            name: "custom_description", label: "Description", type: "Small Text", defaultValue: getValue("custom_description"),
            displayDependsOn: "custom_condition=='Under Repair'"

          },
          { name: "section_specifications", label: "Specification of Asset", type: "Section Break" },
          {
            name: "custom_asset_specifications",
            label: "Asset Specifications",
            type: "Table",
            columns: [
              { name: "specification_type", label: "Specification Type", type: "Text" },
              { name: "details", label: "Details", type: "Text" },
            ],
            defaultValue: getValue("custom_asset_specifications", []),
            fetchFrom: {
              sourceField: "asset_category",
              targetDoctype: "Asset Category",
              targetField: "custom_specifications"
            },
          },
        ],
      },
      {
        name: "Drawing Attachment",
        fields: [
          {
            name: "custom_drawing_attachment",
            label: "Drawing Attachment",
            type: "Table",
            columns: [
              { name: "name_of_document", label: "Name of Document", type: "Text" },
              { name: "attachment", label: "Attachment", type: "Attach" },
            ],
            defaultValue: getValue("custom_drawing_attachment", []),
          },
        ],
      },

    ];
  }, [duplicateData]);

  /* -------------------------------------------------
      2. SUBMIT (Create) - Removing 'frappe' object
      ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {

    // Check if we have valid data to submit (either dirty changes or duplicate data)
    const hasValidData = isDirty || (duplicateData && Object.keys(data).some(key => data[key] !== undefined && data[key] !== null));

    if (!hasValidData) {
      toast.info("Please fill out the form to create an asset.");
      return;
    }

    setIsSaving(true);

    let finalPayload: Record<string, any> = {};

    try {
      const allFields = formTabs.flatMap(tab => tab.fields);

      const nonDataFields = new Set<string>();
      allFields.forEach(field => {
        if (
          field.type === "Section Break" ||
          field.type === "Column Break" ||
          field.type === "Button" ||
          field.type === "Read Only" ||
          field.type === "Custom" // Ignore Custom fields in payload
        ) {
          nonDataFields.add(field.name);
        }
      });

      for (const key in data) {
        if (!nonDataFields.has(key)) {
          finalPayload[key] = data[key] === undefined ? null : data[key];
        }
      }

      finalPayload.doctype = doctypeName;
      finalPayload.naming_series = "ACC-ASS-.YYYY.-";

      const boolFields = [
        "is_existing_asset", "is_composite_asset", "is_composite_component",
        "calculate_depreciation", "is_fully_depreciated",
        "maintenance_required", "comprehensive_insurance",
      ];
      boolFields.forEach((f) => {
        if (f in finalPayload) finalPayload[f] = finalPayload[f] ? 1 : 0;
      });

      const numericFields = [
        "gross_purchase_amount", "additional_asset_cost",
        "asset_quantity", "opening_accumulated_depreciation",
        "opening_number_of_booked_depreciations",
        "custom_previous_hours", "insured_value"
      ];
      numericFields.forEach((f) => {
        finalPayload[f] = Number(finalPayload[f]) || 0;
      });

      const dateFields = [
        "purchase_date", "insurance_start_date", "insurance_end_date",
        "installation_date", "last_repair_date"
      ];
      dateFields.forEach((f) => {
        if (finalPayload[f] === "") {
          finalPayload[f] = null;
        }
      });

      const requiredNameFields = [
        "custom_lis_name",
        "custom_stage_no",
        "asset_category",
        "custom_asset_no",
      ];
      const missingNameFields = requiredNameFields.filter((field) => !finalPayload[field]);

      if (missingNameFields.length) {
        toast.error("Please fill LIS, Stage, Asset Category and Asset No before saving.", { duration: Infinity });
        return;
      }

      console.log("Sending this NEW DOC to Frappe:", finalPayload);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `token ${apiKey}:${apiSecret}`,
      };
      const storedCsrfToken = localStorage.getItem('csrfToken');
      if (storedCsrfToken) {
        headers['X-Frappe-CSRF-Token'] = storedCsrfToken;
      }

      const resp = await fetch(`${API_BASE_URL}/${doctypeName}`, {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(finalPayload),
      });

      const responseData = await resp.json();

      if (!resp.ok) {
        console.log("Full server error:", responseData);
        throw new Error(responseData.exception || responseData._server_messages || "Failed to create asset");
      }

      toast.success("Asset created successfully!");

      // Navigate to the newly created record using the document name
      const docName = responseData.data.name;
      router.push(`/lis-management/doctype/asset/edit/${encodeURIComponent(docName)}`);

    } catch (err: any) {
      console.error("Save error:", err);
      console.log("Full server error message:", err.message);

      // Handle duplicate entry error specifically
      if (err.response?.data?.exc_type === "DuplicateEntryError" || err.message?.includes("DuplicateEntryError")) {
        const duplicateMessage = `Asset with the same LIS, Stage, Asset Category and Asset No already exists`;
        toast.error("Duplicate Asset", {
          description: duplicateMessage,
          duration: Infinity
        });
      } else {
        toast.error("Failed to create Asset", {
          description: err.message || "Check the browser console for the full server error.",
          duration: Infinity
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.push('/lis-management/doctype/asset');

  /* -------------------------------------------------
     3. RENDER FORM
     ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title="Create New Asset"
      description="Fill out the details for the new asset"
      submitLabel={isSaving ? "Saving..." : "New Asset"}
      cancelLabel="Cancel"
    />
  );
}