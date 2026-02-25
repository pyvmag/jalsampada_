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
import DocumentActivity from "@/components/DocumentActivity";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

interface TalukaData {
  name: string;
  taluka: string;
  district: string;
  modified: string;
  owner?: string;
  modified_by?: string;
}

export default function TalukaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = params.id as string;

  const doctypeName = "WRD Taluka"; // Actual Frappe Doctype

  const [talukaDoc, setTalukaDoc] = React.useState<TalukaData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  /* ---------------- FETCH ---------------- */
  React.useEffect(() => {
    const fetchTaluka = async () => {
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
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            withCredentials: true,
          }
        );

        setTalukaDoc(resp.data.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load Taluka");
      } finally {
        setLoading(false);
      }
    };

    fetchTaluka();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  /* ---------------- FORM TABS ---------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!talukaDoc) return [];

    const withDefaults = (fields: FormField[]): FormField[] =>
      fields.map((f) => ({
        ...f,
        defaultValue:
          f.name in talukaDoc
            ? talukaDoc[f.name as keyof TalukaData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: withDefaults([
          {
            name: "district",
            label: "District",
            type: "Link",
            linkTarget: "WRD District", // ← Should this be "linkTarget"?
            required: true,
          },
          {
            name: "taluka",
            label: "Taluka",
            type: "Data",
            required: true,
          },
        ]),
      },
    ];
  }, [talukaDoc]);

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async (data: Record<string, any>) => {
    setIsSaving(true);
    try {
      await axios.put(
        `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${docname}`,
        {
          taluka: data.taluka,
          district: data.district,
        },
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("Taluka updated successfully");
      router.push(`/lis-management/doctype/taluka/${docname}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save changes", { duration: Infinity });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* ---------------- UI STATES ---------------- */
  if (loading) {
    return (
      <div className="module active p-8 text-center">
        Loading Taluka...
      </div>
    );
  }

  if (error) {
    return (
      <div className="module active p-8">
        <p className="text-red-500">{error}</p>
        <button
          className="btn btn--primary mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!talukaDoc) {
    return (
      <div className="module active p-8">
        Taluka not found
      </div>
    );
  }

  /* ---------------- RENDER ---------------- */
  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={`Taluka: ${talukaDoc.taluka}`}
        description={`Update Taluka record (${docname})`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/lis-management/doctype/taluka",
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
          currentUserEmail={talukaDoc.owner}
          modifiedStr={talukaDoc.modified}
          modifiedBy={talukaDoc.modified_by}
        />
      </div>
    </div>
  );
}
