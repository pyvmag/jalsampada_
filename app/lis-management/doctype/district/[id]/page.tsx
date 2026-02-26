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

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

interface DistrictData {
  name: string;
  district: string;
  owner: string;
  modified: string;
  modified_by?: string;
  docstatus: 0 | 1 | 2;
}

export default function DistrictDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = params.id as string;
  const doctypeName = "WRD District";

  const [district, setDistrict] = React.useState<DistrictData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // ── ALL HOOKS FIRST ───────────────────────────────────────────────────

  React.useEffect(() => {
    const fetchDistrict = async () => {
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
          },
          withCredentials: true,
        });

        setDistrict(resp.data.data);
      } catch (err: any) {
        console.error("API Error:", err);
        setError(
          err.response?.status === 404
            ? "District not found"
            : err.response?.status === 403
              ? "Unauthorized"
              : "Failed to load district"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDistrict();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!district) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in district
            ? // @ts-ignore
            district[f.name as keyof DistrictData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "district",
            label: "District Name",
            type: "Data",
            required: true,
            placeholder: "e.g. Sangli, Satara",
            description: "Enter the official name of the district"
          },
        ]),
      },
    ];
  }, [district]);

  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = { ...data };

      // Required meta fields for update
      if (!district) throw new Error("District data not loaded");
      payload.modified = district.modified;
      payload.docstatus = district.docstatus;

      console.log("Sending payload:", payload);

      const resp = await axios.put(
        `${API_BASE_URL}/${doctypeName}/${docname}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("District updated successfully!");

      if (resp.data?.data) {
        setDistrict(resp.data.data);
      }

      router.push(`/lis-management/doctype/district/${docname}`);
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Failed to save district", {
        description: err.message || "Check console for details",
        duration: Infinity
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  // ── RENDERING ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="module active p-8 text-center">Loading district details...</div>
    );
  }

  if (error) {
    return (
      <div className="module active p-8">
        <p className="text-red-600">{error}</p>
        <button
          className="btn btn--primary mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!district) {
    return <div className="module active p-8">District not found.</div>;
  }

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={`${doctypeName}: ${district.district || district.name}`}
        description={`Update district information for ${district.district || docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/lis-management/doctype/district"
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
          currentUserEmail={district.owner}
          modifiedStr={district.modified}
          modifiedBy={district.modified_by}
        />
      </div>
    </div>
  );
}