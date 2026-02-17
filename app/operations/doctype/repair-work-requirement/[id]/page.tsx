"use client";

import * as React from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
  FormField,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

// Disable Expect header to prevent 417 errors (Global config)
axios.defaults.transformRequest = [(data, headers) => {
  delete headers['Expect'];
  if (data && typeof data === 'object') {
    return JSON.stringify(data);
  }
  return data;
}];

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/* -------------------------------------------------
   1. Repair Work Requirement interface
   ------------------------------------------------- */
interface RepairWorkRequirementData {
  name: string;
  lis_name?: string;
  work_requirement_number?: string;
  stage?: string;
  prepared_by?: string;
  date?: string;
  designation?: string;
  repair_work_details?: Array<{
    name?: string;
    sr_no?: string;
    asset_id?: string;
    asset_name?: string;
    equipement_model?: string;
    equipement_make?: string;
    equipement_capacity?: string;
    equipement_rating?: string;
    date_of_commissioning?: string;
    is_in_warranty_period?: "Yes" | "No";
    running_hours?: number;
    present_status?: "Working" | "UR" | "Abnormal";
    last_overhaul?: string;
    ur_date?: string;
  }>;
  nature_of_problem?: string;
  justification?: string;
  recommended_by?: string;
  approved_by?: string;
  verified_by?: string;
  docstatus: 0 | 1 | 2;
  modified: string;
}

/* -------------------------------------------------
   2. Page component
   ------------------------------------------------- */
export default function RepairWorkRequirementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = params.id as string;
  const doctypeName = "Repair Work Requirement";

  const [record, setRecord] = React.useState<RepairWorkRequirementData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
     3. FETCH RECORD
     ------------------------------------------------- */
  React.useEffect(() => {
    const fetchRecord = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const resp = await axios.get(`${API_BASE_URL}/${doctypeName}/${docname}`, {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        });

        setRecord(resp.data.data);
      } catch (err: any) {
        console.error("API Error:", err);
        setError(
          err.response?.status === 404
            ? "Repair Work Requirement not found"
            : err.response?.status === 403
              ? "Unauthorized"
              : "Failed to load record"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  /* -------------------------------------------------
     4. Form structure
     ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!record) return [];

    // Helper function to map fields and inject values from the loaded record
    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in record
            ? // @ts-ignore - safe because we match the interface
            record[f.name as keyof RepairWorkRequirementData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          // Top row - LIS & Stage
          {
            name: "lis_name",
            label: "LIS Name",
            type: "Link",
            linkTarget: "Lift Irrigation Scheme",
            required: true,
          },
          {
            name: "stage",
            label: "Stage/ Sub Scheme",
            type: "Link",
            linkTarget: "Stage No",
            filterMapping: [
              { sourceField: "lis_name", targetField: "lis_name" }
            ],
            required: true,
          },

          // Work Requirement & Date
          {
            name: "work_requirement_number",
            label: "Work Requirement Number",
            type: "Data",
            required: true,
          },
          {
            name: "date",
            label: "Date",
            type: "Date",
            defaultValue: "Today",
            required: true,
          },
          {
            name: "prepared_by",
            label: "Prepared By",
            type: "Link",
            linkTarget: "Employee",
            searchField: "employee_name"
          },
          {
            name: "designation",
            label: "Designation",
            type: "Data",
            fetchFrom: {
              sourceField: "prepared_by",
              targetDoctype: "Employee",
              targetField: "designation"
            }
          },

          // Repair Work Details Table
          { name: "section_break_tfui", label: "Repair Work Details", type: "Section Break" },
          {
            name: "repair_work_details",
            label: "Repair Work Details",
            type: "Table",
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
          },
          {
            name: "justification",
            label: "Justification",
            type: "Small Text",
            required: true,
          },

          // Approval chain
          { name: "section_break_tmte", label: "", type: "Section Break" },
          {
            name: "recommended_by",
            label: "Recommended By (Incharge/JE)",
            type: "Link",
            linkTarget: "Employee",
            searchField: "employee_name"
          },
          {
            name: "approved_by",
            label: "Approved By (EE)",
            type: "Link",
            linkTarget: "Employee",
            searchField: "employee_name"
          },
          {
            name: "verified_by",
            label: "Verified By (DE)",
            type: "Link",
            linkTarget: "Employee",
            searchField: "employee_name"
          },
        ]),
      },
    ];
  }, [record]);

  /* -------------------------------------------------
     5. SUBMIT HANDLER
     ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    // If you always want to allow save on child table changes, 
    // you might need to relax this check or ensure isDirty tracks deep changes.
    // For now, we trust the component's dirty tracking.
    if (!isDirty && !data.repair_work_details) {
      toast.info("No changes to save.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = { ...data };

      // Remove layout/break fields
      const nonDataFields = new Set([
        "section_break_tfui",
        "section_break_fgra",
        "section_break_tmte",
      ]);

      const finalPayload: Record<string, any> = {};
      for (const key in payload) {
        if (!nonDataFields.has(key)) {
          finalPayload[key] = payload[key];
        }
      }

      // Preserve system fields
      if (record) {
        finalPayload.modified = record.modified;
        finalPayload.docstatus = record.docstatus;
      }

      // --- CHILD TABLE SANITIZATION ---
      if (finalPayload.repair_work_details) {
        finalPayload.repair_work_details = finalPayload.repair_work_details.map((row: any) => {
          const cleanRow = { ...row };

          // 1. Remove temporary IDs from new rows
          // If 'name' starts with 'new' or is very long (UUID-like) and it's not a standard 10-char hash,
          // assume it's a temp ID and remove it so Frappe inserts a new row.
          if (cleanRow.name && (cleanRow.name.toString().startsWith("new") || cleanRow.name.length > 15)) {
            delete cleanRow.name;
          }

          // 2. Ensure Numerics
          cleanRow.running_hours = Number(cleanRow.running_hours) || 0;

          // 3. Ensure Date fields are null if empty string
          if (cleanRow.date_of_commissioning === "") cleanRow.date_of_commissioning = null;
          if (cleanRow.ur_date === "") cleanRow.ur_date = null;

          return cleanRow;
        });
      }

      console.log("Sending payload to server:", finalPayload);

      const resp = await axios.put(
        `${API_BASE_URL}/${doctypeName}/${docname}`,
        finalPayload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("Repair Work Requirement updated successfully!");

      if (resp.data?.data) {
        setRecord(resp.data.data);
        router.push(`/operations/doctype/repair-work-requirement/${encodeURIComponent(docname)}`);
        return { statusCode: resp.status, status: resp.data?.data?.status };
      }

      // Optional: Redirect or refresh
      // router.push(`/operations/doctype/repair-work-requirement/${encodeURIComponent(docname)}`);

    } catch (err: any) {
      console.error("Save error:", err);

      // --- ENHANCED ERROR HANDLING ---
      // Check if we have server messages (Validation Errors from Frappe)
      if (err.response && err.response.data) {
        const data = err.response.data;

        // 1. Check for _server_messages (JSON string array)
        if (data._server_messages) {
          try {
            const messages = JSON.parse(data._server_messages);
            const messageText = messages
              .map((m: string) => JSON.parse(m).message)
              .join(", ");

            toast.error("Validation Error", {
              description: messageText,
              duration: 8000 // Show longer so user can read
            });
            return;
          } catch (e) {
            console.error("Failed to parse server messages", e);
          }
        }

        // 2. Check for exception message
        if (data.exception) {
          toast.error("Server Exception", {
            description: data.exception.split(":").pop(), // Try to get the last part of exception
            duration: Infinity
          });
          return;
        }
      }

      toast.error("Failed to Save", {
        description: err.response?.data?.message || err.message || "Unknown error",
        duration: Infinity
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
     6. UI STATES
     ------------------------------------------------- */
  if (loading) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        Loading Repair Work Requirement...
      </div>
    );
  }

  if (error) {
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        <p style={{ color: "var(--color-error)" }}>{error}</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        <p>Repair Work Requirement record not found.</p>
      </div>
    );
  }

  /* -------------------------------------------------
     7. RENDER
     ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title={`${doctypeName}: ${record.name}`}
      description={`Record ID: ${docname}`}
      submitLabel={isSaving ? "Saving..." : "Save"}
      cancelLabel="Cancel"
      deleteConfig={{
        doctypeName: doctypeName,
        docName: docname,
        redirectUrl: "/operations/doctype/repair-work-requirement"
      }}
    />
  );
}