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
import { renameDocument } from "@/lib/services";
import DocumentActivity from "@/components/DocumentActivity";

// API base URL
const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

// ----------------------
// 1. Types
// ----------------------
interface ParameterData {
  name: string;
  parameter?: string;
  monitoring_type?: "Daily" | "Weekly" | "Monthly";
  asset_category?: string;
  docstatus: 0 | 1 | 2;
  modified: string;
  owner?: string;
  modified_by?: string;
}

// ----------------------
// 2. Component
// ----------------------
export default function ParameterDataDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = decodeURIComponent(params.id as string);
  const doctypeName = "Parameter Checklist";

  const [record, setRecord] = React.useState<ParameterData | null>(null);
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
          `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${docname}`,
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

        setRecord(resp.data.data as ParameterData);
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

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        // @ts-ignore
        defaultValue: f.name in record ? record[f.name as keyof ParameterData] : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "parameter",
            label: "Parameter",
            type: "Text",
            required: true,
          },
          {
            name: "monitoring_type",
            label: "Monitoring Type",
            type: "Select",
            options: "Daily\nWeekly\nMonthly",
            required: true,
          },
          {
            name: "asset_category",
            label: "Asset Category",
            type: "Link",
            linkTarget: "Asset Category",
            required: true,
          },
        ]),
      },
    ];
  }, [record]);

  // ----------------------
  // Submit handler
  // ----------------------


  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    if (!record) {
      toast.error("Record not loaded. Cannot save.", { duration: Infinity });
      return;
    }

    if (!apiKey || !apiSecret) {
      toast.error("Missing API credentials.");
      return;
    }

    setIsSaving(true);

    try {
      let currentDocname = docname;

      /* -------------------------------------------
         🔁 RENAME LOGIC (ONLY IF NAME FIELD CHANGED)
         Replace `parameter_data` below IF your
         doctype uses another field as the name
      --------------------------------------------*/
      const newName = data.parameter; // primary field

      if (newName && newName !== record.name) {
        try {
          await renameDocument(
            apiKey,
            apiSecret,
            doctypeName,
            record.name,
            newName
          );

          currentDocname = newName;

          // Update local state
          setRecord(prev =>
            prev ? { ...prev, name: newName, parameter_data: newName } : null
          );

          // Update URL
          router.replace(`/maintenance/doctype/parameter-checklist/${newName}`);

        } catch (renameError: any) {
          console.error("Rename error:", renameError);
          toast.error("Failed to rename document", {
            description: renameError.response?.data?.message || renameError.message,
          });
          setIsSaving(false);
          return;
        }
      }

      /* -------------------------------------------
         🧹 CLEAN PAYLOAD
      --------------------------------------------*/
      const payload: Record<string, any> = JSON.parse(JSON.stringify(data));

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

      // Preserve metadata
      finalPayload.modified = record.modified;
      finalPayload.docstatus = record.docstatus;

      /* -------------------------------------------
         💾 UPDATE DOCUMENT
      --------------------------------------------*/
      const resp = await axios.put(
        `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${currentDocname}`,
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

      toast.success("Changes saved!");

      if (resp.data?.data) {
        setRecord(resp.data.data);
      }

      router.push(`/maintenance/doctype/parameter-checklist/${currentDocname}`);

    } catch (err: any) {
      console.error("Save error:", err);
      console.log("Full server error:", err.response?.data);
      toast.error("Failed to save", {
        description: err.response?.data?.message || err.message,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  // ----------------------
  // UI States
  // ----------------------
  if (loading) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading {doctypeName} details...</p>
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
        <p>{doctypeName} not found.</p>
      </div>
    );
  }

  // ----------------------
  // Render form
  // ----------------------
  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={`${doctypeName}: ${record.name}`}
        description={`Update details for record ID: ${docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/maintenance/doctype/parameter-checklist",
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