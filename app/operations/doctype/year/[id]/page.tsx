"use client";

import * as React from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import {
  DynamicForm,
  FormField,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import DocumentActivity from "@/components/DocumentActivity";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";
const DOCTYPE = "Year";

interface YearData {
  name: string;
  year: string;
  owner?: string;
  modified: string;
  modified_by?: string;
  docstatus: 0 | 1 | 2;
}

export default function YearDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const docname = params.id as string;

  const [record, setRecord] = React.useState<YearData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const fetchYear = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const resp = await axios.get(
          `${API_BASE_URL}/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(docname)}`,
          {
            headers: {
              Authorization: `token ${apiKey}:${apiSecret}`,
            },
            withCredentials: true,
          }
        );

        setRecord(resp.data.data);
      } catch (err: any) {
        console.error("Year API error:", err);
        setError(
          err.response?.status === 404
            ? "Year not found"
            : err.response?.status === 403
              ? "Unauthorized"
              : "Failed to load year"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchYear();
  }, [apiKey, apiSecret, docname, isAuthenticated, isInitialized]);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!record) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((field) => ({
        ...field,
        defaultValue:
          field.name in record ? record[field.name as keyof YearData] : field.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "year",
            label: "Year",
            type: "Data",
            required: true,
            placeholder: "e.g. 2026",
            description: "Enter the calendar year",
            pattern: "^\\d{4}$",
            patternMessage: "Year must be a 4-digit value",
          },
        ]),
      },
    ];
  }, [record]);

  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!record) return;

    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        year: data.year?.trim(),
        modified: record.modified,
        docstatus: record.docstatus,
      };

      const resp = await axios.put(
        `${API_BASE_URL}/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(docname)}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      if (resp.data?.data) {
        setRecord(resp.data.data);
      }

      toast.success("Year updated successfully!");
    } catch (err: any) {
      toast.error("Failed to save year", {
        description: err.response?.data?.message || err.message,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="module active p-8 text-center">Loading year...</div>;
  }

  if (error) {
    return (
      <div className="module active p-8">
        <p className="text-red-600">{error}</p>
        <button className="btn btn--primary mt-4" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (!record) {
    return <div className="module active p-8">Year not found.</div>;
  }

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        title={`${DOCTYPE}: ${record.year || record.name}`}
        description={`Update year master record ${record.year || docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: DOCTYPE,
          docName: docname,
          redirectUrl: "/operations/doctype/year",
        }}
      />

      <div className="w-full px-4 md:px-8">
        <DocumentActivity
          doctype={DOCTYPE}
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
