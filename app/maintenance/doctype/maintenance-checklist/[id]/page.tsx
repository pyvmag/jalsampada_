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
import { MaintenanceChecklistMatrix } from "../components/MaintenanceChecklistMatrix";
import DocumentActivity from "@/components/DocumentActivity";

// API base URL
const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

// ----------------------
// 1. Types
// ----------------------
interface MaintenanceChecklist {
  name: string;
  lis_name?: string;
  stage?: string;
  monitoring_type?: "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Half-Yearly" | "Yearly";
  asset_category?: string;
  checklist_data?: any[]; // The Child Table Data
  docstatus: 0 | 1 | 2;
  modified: string;
  owner?: string;
  modified_by?: string;
}

// ----------------------
// 2. Component
// ----------------------
export default function MaintenanceChecklistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = decodeURIComponent(params.id as string);
  const doctypeName = "Maintenance Checklist";

  const [record, setRecord] = React.useState<MaintenanceChecklist | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // ----------------------
  // Fetch record
  // ----------------------
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
          `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${encodeURIComponent(docname)}`,
          {
            headers: {
              Authorization: `token ${apiKey}:${apiSecret}`,
              "Content-Type": "application/json",
            },
            withCredentials: true,
          }
        );

        setRecord(resp.data.data as MaintenanceChecklist);
      } catch (err: any) {
        console.error("API Error:", err);
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

  // ----------------------
  // Build form tabs
  // ----------------------
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!record) return [];

    // Helper to map record values to fields
    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        // @ts-ignore
        defaultValue: f.name in record ? record[f.name as keyof MaintenanceChecklist] : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          { name: "posting_datetime", label: "Posting Datetime", type: "DateTime" },
          {
            name: "lis_name",
            label: "LIS Name",
            type: "Link",
            linkTarget: "Lift Irrigation Scheme",
            required: true,
          },
          {
            name: "stage",
            label: "Stage",
            type: "Link",
            linkTarget: "Stage No",
            required: true,
            filters: (getValues) => {
              const lis = getValues("lis_name");
              return lis ? { "lis_name": lis } : {};
            }
          },
          {
            name: "asset_category",
            label: "Asset Category",
            type: "Link",
            linkTarget: "Asset Category",
            required: true,
          },
          {
            name: "monitoring_type",
            label: "Monitoring Type",
            type: "Select",
            options: [
              { label: "Daily", value: "Daily" },
              { label: "Weekly", value: "Weekly" },
              { label: "Monthly", value: "Monthly" },
              { label: "Quarterly", value: "Quarterly" },
              { label: "Half-Yearly", value: "Half-Yearly" },
              { label: "Yearly", value: "Yearly" }
            ],
            required: true,
          },

          // 🔴 CRITICAL FIX: Add the hidden field so React Hook Form loads the data!
          {
            name: "checklist_data",
            label: "Checklist Data",
            type: "Read Only",
            defaultValue: record.checklist_data || [],
            displayDependsOn: () => false
          },

          // 🟢 MATRIX UI SECTION
          {
            name: "checklist_matrix_section",
            label: "Checklist Matrix",
            type: "Section Break",
          },
          {
            name: "checklist_ui",
            label: "",
            type: "Custom",
            customElement: <MaintenanceChecklistMatrix />
          },
        ]),
      },
    ];
  }, [record]);

  // ----------------------
  // Submit handler
  // ----------------------
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!record) return;
    if (!apiKey || !apiSecret) {
      toast.error("Missing API credentials.");
      return;
    }

    setIsSaving(true);

    try {
      let currentDocname = record.name;

      /* 🧹 CLEAN PAYLOAD */
      const payload: Record<string, any> = { ...data };

      // Remove UI-only fields
      delete payload.checklist_ui;
      delete payload.checklist_matrix_section;

      delete payload.modified;
      delete payload.creation;
      delete payload.owner;
      delete payload.docstatus;
      delete payload.idx;

      /* 💾 UPDATE */
      const resp = await axios.put(
        `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${encodeURIComponent(currentDocname)}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("Checklist saved successfully!");

      if (resp.data?.data) {
        setRecord(resp.data.data);
      }
      router.push(`/maintenance/doctype/maintenance-checklist/${encodeURIComponent(record.name)}`);
      return { statusCode: resp.status, status: resp.data?.data?.status };

    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Failed to save", {
        description: err.response?.data?.message || err.message,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!record) return <div className="p-8">Document not found.</div>;

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={`${doctypeName}: ${record.name}`}
        description="Update checklist details and matrix"
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        initialStatus={record.docstatus === 1 ? "Submitted" : record.docstatus === 2 ? "Cancelled" : "Draft"}
        docstatus={record.docstatus}
        isSubmittable={false}
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/maintenance/doctype/maintenance-checklist",
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
          currentUserEmail={record.owner}
          modifiedStr={record.modified}
          modifiedBy={record.modified_by}
        />
      </div>
    </div>
  );
}