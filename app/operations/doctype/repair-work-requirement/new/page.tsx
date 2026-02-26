"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

export default function NewRepairWorkRequirementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  const doctypeName = "Repair Work Requirement";

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
     1. Define the form structure
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
          // Top row - LIS & Stage
          {
            name: "lis_name",
            label: "LIS Name",
            type: "Link",
            linkTarget: "Lift Irrigation Scheme",
            required: true,
            defaultValue: getValue("lis_name"),
          },
          {
            name: "stage",
            label: "Stage/ Sub Scheme",
            type: "Link",
            linkTarget: "Stage No",
            required: true,
            filterMapping: [
              { sourceField: "lis_name", targetField: "lis_name" }
            ],
            defaultValue: getValue("stage"),
          },

          // Work Requirement & Date
          {
            name: "work_requirement_number",
            label: "Work Requirement Number",
            type: "Data",
            defaultValue: getValue("work_requirement_number"),
          },
          {
            name: "date",
            label: "Date",
            type: "Date",
            // 🟢 FIXED: Use actual date string instead of "Today"
            defaultValue: getValue("date", new Date().toISOString().split('T')[0]),
            required: true,
          },
          {
            name: "prepared_by",
            label: "Prepared By",
            type: "Link",
            linkTarget: "Employee",
            searchField: "employee_name",
            defaultValue: getValue("prepared_by"),
          },
          {
            name: "designation",
            label: "Designation",
            type: "Data",
            fetchFrom: {
              sourceField: "prepared_by",
              targetDoctype: "Employee",
              targetField: "designation"
            },
            defaultValue: getValue("designation"),
          },

          // Repair Work Details Table
          { name: "section_break_tfui", label: "Repair Work Details", type: "Section Break" },
          {
            name: "repair_work_details",
            label: "Repair Work Details",
            type: "Table",
            defaultValue: getValue("repair_work_details", []),
            columns: [
              { name: "sr_no", label: "Sr. No.", type: "Data" },
              {
                name: "asset_id", label: "Asset ID", type: "Link", linkTarget: "Asset",
                filters: (getValues: (name: string) => any) => {
                  const parentLisName = getValues("parent.lis_name");
                  const parentStage = getValues("parent.stage");

                  const filters: any = {};
                  if (parentLisName) {
                    filters.custom_lis_name = parentLisName;
                  }
                  if (parentStage) {
                    filters.custom_stage_no = parentStage;
                  }

                  return filters;
                }
              },
              {
                name: "asset_name", label: "Asset Name", type: "Data",
                fetchFrom: { sourceField: "asset_id", targetDoctype: "Asset", targetField: "asset_name" }
              },
              {
                name: "equipement_model",
                label: "Equipement Model",
                type: "Data",
                fetchFrom: { sourceField: "asset_id", targetDoctype: "Asset", targetField: "custom_equipement_model" }
              },
              {
                name: "equipement_make",
                label: "Equipement Make",
                type: "Data",
                fetchFrom: { sourceField: "asset_id", targetDoctype: "Asset", targetField: "custom_equipement_make" }
              },
              {
                name: "equipement_capacity",
                label: "Equipement Capacity",
                type: "Data",
                fetchFrom: { sourceField: "asset_id", targetDoctype: "Asset", targetField: "custom_equipement_capacity" }
              },
              {
                name: "equipement_rating",
                label: "Equipement Rating",
                type: "Data",
                fetchFrom: { sourceField: "asset_id", targetDoctype: "Asset", targetField: "custom_equipement_rating" }
              },
              { name: "date_of_commissioning", label: "Date of Commissioning", type: "Date", fetchFrom: { sourceField: "asset_id", targetDoctype: "Asset", targetField: "available_for_use_date" } },
              {
                name: "is_in_warranty_period",
                label: "Is in Warranty period",
                type: "Select",
                options: "Yes\nNo",
              },
              { name: "running_hours", label: "Running Hours", type: "Float", fetchFrom: { sourceField: "asset_id", targetDoctype: "Asset", targetField: "custom_cumulative_hours" } },
              {
                name: "present_status",
                label: "Present Status",
                type: "Data",
                fetchFrom: { sourceField: "asset_id", targetDoctype: "Asset", targetField: "custom_condition" }
              },
              { name: "last_overhaul", label: "Last Overhaul/Repair Date", type: "Data", fetchFrom: { sourceField: "asset_id", targetDoctype: "Asset", targetField: "custom_last_repair_date" } },
              { name: "ur_date", label: "U/R Date", type: "Date" },
            ],
          },

          // Problem & Justification
          { name: "section_break_fgra", label: "", type: "Section Break" },
          {
            name: "nature_of_problem",
            label: "Nature of Problem/Defect Observed",
            type: "Small Text",
            required: true,
            defaultValue: getValue("nature_of_problem"),
          },
          {
            name: "justification",
            label: "Justification",
            type: "Small Text",
            required: true,
            defaultValue: getValue("justification"),
          },

          // Approval chain
          { name: "section_break_tmte", label: "", type: "Section Break" },
          {
            name: "recommended_by",
            label: "Recommended By (Incharge/JE)",
            type: "Link",
            linkTarget: "Employee",
            searchField: "employee_name",
            defaultValue: getValue("recommended_by"),
          },
          {
            name: "approved_by",
            label: "Approved By (EE)",
            type: "Link",
            linkTarget: "Employee",
            searchField: "employee_name",
            defaultValue: getValue("approved_by"),
          },
          {
            name: "verified_by",
            label: "Verified By (DE)",
            type: "Link",
            linkTarget: "Employee",
            searchField: "employee_name",
            defaultValue: getValue("verified_by"),
          },
        ],
      },
    ];
  }, [duplicateData]);

  /* -------------------------------------------------
     2. SUBMIT (Create)
     ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    // Check if we have valid data to submit
    const hasValidData = isDirty || (duplicateData && data.lis_name);

    if (!hasValidData) {
      toast.info("Please fill out the form.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = { ...data };

      // Remove layout/break fields
      const nonDataFields = new Set([
        "section_break_tfui",
        "section_break_fgra",
        "section_break_tmte",
      ]);

      const finalPayload: Record<string, any> = {
        doctype: doctypeName,
      };

      for (const key in payload) {
        if (!nonDataFields.has(key)) {
          finalPayload[key] = payload[key];
        }
      }

      // Ensure numeric values in child table
      if (finalPayload.repair_work_details) {
        finalPayload.repair_work_details = finalPayload.repair_work_details.map((row: any) => ({
          ...row,
          running_hours: Number(row.running_hours) || 0,
        }));
      }

      console.log("Sending NEW Repair Work Requirement payload:", finalPayload);

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
        throw new Error(responseData.exception || responseData._server_messages || "Failed to create document");
      }

      toast.success("Repair Work Requirement created successfully!");

      router.push(`/operations/doctype/repair-work-requirement`);

    } catch (err: any) {
      console.error("Save error:", err);

      if (err.response?.data?.exc_type === "DuplicateEntryError") {
        toast.error("Duplicate Entry Error", {
          description: "This record may already exist.",
          duration: Infinity
        });
      } else {
        toast.error("Failed to create record", {
          description: err.message || "Check console for details.",
          duration: Infinity
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
     3. RENDER FORM
     ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title="New Repair Work Requirement"
      description="Create a new repair work request"
      submitLabel={isSaving ? "Saving..." : "Create"}
      cancelLabel="Cancel"
    />
  );
}