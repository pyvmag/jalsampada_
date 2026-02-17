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

// API
const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/* --------------------------------------------------
  TYPES
-------------------------------------------------- */
interface MaintenanceTaskRow {
  name?: string;
  maintenance_task?: string;
  maintenance_status?: string;
  periodicity?: string;
  assign_to?: string;
  next_due_date?: string;
  last_completion_date?: string;
  description?: string;
}

interface AssetMaintenanceRecord {
  name: string;
  custom_lis?: string;
  custom_stage?: string;
  asset_name?: string;
  company?: string;
  maintenance_team?: string;
  custom_contact_no?: string;
  maintenance_tasks?: MaintenanceTaskRow[];
  docstatus: 0 | 1 | 2;
  modified: string;
}

/* --------------------------------------------------
  COMPONENT
-------------------------------------------------- */
export default function MaintenanceScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = decodeURIComponent(params.id as string);
  const doctypeName = "Asset Maintenance";

  const [record, setRecord] = React.useState<AssetMaintenanceRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  /* --------------------------------------------------
    FETCH RECORD
  -------------------------------------------------- */
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
          `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${docname}`,
          {
            headers: {
              Authorization: `token ${apiKey}:${apiSecret}`,
              "Content-Type": "application/json",
            },
            withCredentials: true,
          }
        );

        setRecord(resp.data.data as AssetMaintenanceRecord);
      } catch (err: any) {
        setError(
          err.response?.status === 404
            ? `${doctypeName} not found`
            : err.response?.status === 403
              ? "Unauthorized"
              : `Failed to load ${doctypeName}`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  /* --------------------------------------------------
    BUILD FORM
  -------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!record) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        // @ts-ignore
        defaultValue: f.name in record ? record[f.name as keyof AssetMaintenanceRecord] : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          { name: "custom_lis", label: "LIS Name", type: "Link", linkTarget: "Lift Irrigation Scheme", },
          {
            name: "custom_stage",
            label: "Stage",
            type: "Link",
            linkTarget: "Stage No",
            filterMapping: [
              { sourceField: "custom_lis", targetField: "lis_name" }
            ]
          },
          {
            name: "asset_name",
            label: "Asset Name",
            type: "Link",
            linkTarget: "Asset",
            customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
            filters: (getValue) => ({
              custom_stage_no: getValue("custom_stage"),
              custom_lis_name: getValue("custom_lis")
            }),
            referenceDoctype: "Asset Maintenance",
            doctype: "Asset"
          },
          // { name: "company", label: "Company", type: "Link", linkTarget: "Company" },
          { name: "maintenance_team", label: "Maintenance Team", type: "Link", linkTarget: "Asset Maintenance Team" },
          { name: "custom_contact_no", label: "Contact No", type: "Text" },

          {
            name: "asset_maintenance_tasks",
            label: "Maintenance Tasks",
            type: "Table",
            defaultValue: record.maintenance_tasks || [],
            columns: [
              { name: "maintenance_task", label: "Maintenance Task", type: "Text" },
              { name: "maintenance_status", label: "Maintenance Status", type: "Select", options: "Planned\nOverdue\nCancelled" },
              {
                name: "maintenance_type",
                label: "Maintenance Type",
                type: "Select",
                options: "Preventive Maintenance\nCorrective Maintenance\nPredictive Maintenance",
              },

              {
                name: "start_date",
                label: "Start Date",
                type: "Date",
              },
              {
                name: "end_date",
                label: "End Date",
                type: "Date",
              },
              { name: "periodicity", label: "Periodicity", type: "Select", options: "Daily\nWeekly\nMonthly\nQuarterly\nYearly" },
              {
                name: "certificate_required",
                label: "Certificate Required",
                type: "Check",
              },
              {
                name: "certificate_upload",
                label: "Upload Certificate",
                type: "Attach",
                displayDependsOn: "certificate_required", // simpler dependency
              },
              { name: "assign_to", label: "Assign To", type: "Link", linkTarget: "User" },
              { name: "next_due_date", label: "Next Due Date", type: "Date" },
              { name: "last_completion_date", label: "Last Completion Date", type: "Date" },
              { name: "description", label: "Description", type: "Text" },
            ],
          },
        ]),
      },
    ];
  }, [record]);

  /* --------------------------------------------------
    SAVE
  -------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    if (!record || !apiKey || !apiSecret) {
      toast.error("Cannot save.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = JSON.parse(JSON.stringify(data));

      const finalPayload: Record<string, any> = {
        ...payload,
        modified: record.modified,
        docstatus: record.docstatus,
      };

      const resp = await axios.put(
        `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${docname}`,
        finalPayload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("Changes saved!");
      if (resp.data?.data) setRecord(resp.data.data);

      return { status: "Saved", statusCode: 200 };
    } catch (err: any) {
      toast.error("Failed to save", {
        description: err.response?.data?.message || err.message,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* --------------------------------------------------
    UI STATES
  -------------------------------------------------- */
  if (loading) return <div style={{ padding: "2rem" }}>Loading {doctypeName}...</div>;
  if (error) return <div style={{ padding: "2rem", color: "red" }}>{error}</div>;
  if (!record) return <div style={{ padding: "2rem" }}>{doctypeName} not found.</div>;

  /* --------------------------------------------------
    RENDER
  -------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title={`${doctypeName}: ${record.name}`}
      description="Update Maintenance Schedule"
      submitLabel={isSaving ? "Saving..." : "Save"}
      cancelLabel="Cancel"
      deleteConfig={{
        doctypeName: doctypeName,
        docName: docname,
        redirectUrl: "/maintenance/doctype/maintenance-schedule",
      }}
      doctype={doctypeName}
    />
  );
}