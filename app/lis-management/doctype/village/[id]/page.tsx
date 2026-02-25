"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
  FormField,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import axios from "axios";
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";
const DOCTYPE = "WRD Village";

// Interface matching your child table
interface LISDetail {
  name: string;
  lis_name: string;
  no_of_beneficiaries: number;
  lis_status: string;
  contemplated_ayacut_acres: number;
  commissioned__new: string;
  source_of_water: string;
}

interface VillageData {
  name: string;
  village: string;
  taluka: string;
  district: string;
  lis_wise_village_details?: LISDetail[];
  modified: string;
  owner?: string;
  modified_by?: string;
  docstatus: 0 | 1 | 2;
}

export default function VillageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docname = params.id as string;
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const [village, setVillage] = React.useState<VillageData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // ── ALL HOOKS FIRST ───────────────────────────────────────────────────

  React.useEffect(() => {
    const fetchVillage = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const resp = await axios.get(`${API_BASE_URL}/${DOCTYPE}/${docname}`, {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
          },
          withCredentials: true,
        });

        setVillage(resp.data.data);
      } catch (err: any) {
        console.error("API Error:", err);
        setError(
          err.response?.status === 404
            ? "Village not found"
            : err.response?.status === 403
              ? "Unauthorized"
              : "Failed to load village"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchVillage();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!village) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in village
            ? // @ts-ignore
            village[f.name as keyof VillageData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "district",
            label: "District",
            type: "Link",
            linkTarget: "WRD District",
            required: true,
            placeholder: "Select District",
            description: "Select the district this village belongs to",
          },
          {
            name: "taluka",
            label: "Taluka",
            type: "Link",
            linkTarget: "WRD Taluka",
            required: true,
            placeholder: "Select Taluka",
            description: "Select the taluka this village belongs to",
            filterMapping: [
              { sourceField: "district", targetField: "district" }
            ]
          },
          {
            name: "village",
            label: "Village",
            type: "Data",
            required: true,
            placeholder: "e.g. Bedag",
            description: "Enter the official name of the village",
          },
          {
            name: "lis_wise_village_details",
            label: "Village LIS Wise Details",
            type: "Table",
            showDownloadUpload: true,
            columns: [
              {
                name: "lis_name",
                label: "LIS Name",
                type: "Link",
                linkTarget: "Lift Irrigation Scheme"
              },
              {
                name: "no_of_beneficiaries",
                label: "No. Beneficiaries",
                type: "Int"
              },
              {
                name: "lis_status",
                label: "LIS Status",
                type: "Select",
                options: [
                  { label: "Functional", value: "Functional" },
                  { label: "Non-Functional", value: "Non-Functional" },
                  { label: "Abandoned", value: "Abandoned" },
                ]
              },
              {
                name: "contemplated_ayacut_acres",
                label: "Ayacut (Acres)",
                type: "Float"
              },
              {
                name: "commissioned__new",
                label: "Commissioned / New",
                type: "Select",
                options: [
                  { label: "Proposed", value: "Proposed" },
                  { label: "Work in Progress", value: "Work in Progress" },
                  { label: "Commissioned", value: "Commissioned" },
                  { label: "Closed", value: "Closed" },
                ]
              },
              {
                name: "source_of_water",
                label: "Source of Water",
                type: "Data"
              },
            ],
          },
        ]),
      },
    ];
  }, [village]);

  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = { ...data };

      // Required meta fields for update
      if (!village) throw new Error("Village data not loaded");
      payload.modified = village.modified;
      payload.docstatus = village.docstatus;

      console.log("Sending payload:", payload);

      const resp = await axios.put(
        `${API_BASE_URL}/${DOCTYPE}/${docname}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("Village updated successfully!");

      if (resp.data?.data) {
        setVillage(resp.data.data);
      }

      router.push(`/lis-management/doctype/village/${docname}`);
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Failed to save village", {
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
      <div className="module active p-8 text-center">Loading village details...</div>
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

  if (!village) {
    return <div className="module active p-8">Village not found.</div>;
  }

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={`${DOCTYPE}: ${village.village || village.name}`}
        description={`Update village information for ${village.village || docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: DOCTYPE,
          docName: docname,
          redirectUrl: "/lis-management/doctype/village"
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
          currentUserEmail={village.owner}
          modifiedStr={village.modified}
          modifiedBy={village.modified_by}
        />
      </div>
    </div>
  );
}