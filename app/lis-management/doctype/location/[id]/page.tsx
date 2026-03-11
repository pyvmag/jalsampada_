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
const DOCTYPE = "Location";

interface LocationData {
  name: string;
  location_name: string;
  parent_location?: string;
  is_container: number;
  is_group: number;
  latitude?: number;
  longitude?: number;
  modified: string;
  owner?: string;
  modified_by?: string;
  docstatus: 0 | 1 | 2;
}

export default function LocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docname = params.id as string;
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const [locationObj, setLocationObj] = React.useState<LocationData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const fetchLocation = async () => {
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

        setLocationObj(resp.data.data);
      } catch (err: any) {
        console.error("API Error:", err);
        setError(
          err.response?.status === 404
            ? "Location not found"
            : err.response?.status === 403
              ? "Unauthorized"
              : "Failed to load location"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!locationObj) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in locationObj
            ? // @ts-ignore
              locationObj[f.name as keyof LocationData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "location_name",
            label: "Location Name",
            type: "Data",
            required: true,
            placeholder: "e.g. Pune Area",
          },
          {
            name: "parent_location",
            label: "Parent Location",
            type: "Link",
            linkTarget: "Location",
            placeholder: "Select Parent Location",
          },
          {
            name: "is_container",
            label: "Is Container",
            type: "Check",
          },
          {
            name: "is_group",
            label: "Is Group",
            type: "Check",
          },
        ] as FormField[]),
      },
      {
        name: "Location Details",
        fields: fields([
          {
            name: "latitude",
            label: "Latitude",
            type: "Float",
          },
          {
            name: "longitude",
            label: "Longitude",
            type: "Float",
          },
        ] as FormField[]),
      }
    ];
  }, [locationObj]);

  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = {
        ...data,
        is_container: data.is_container ? 1 : 0,
        is_group: data.is_group ? 1 : 0,
      };

      if (!locationObj) throw new Error("Location data not loaded");
      payload.modified = locationObj.modified;
      payload.docstatus = locationObj.docstatus;

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

      toast.success("Location updated successfully!");

      if (resp.data?.data) {
        setLocationObj(resp.data.data);
      }

      router.push(`/lis-management/doctype/location/${docname}`);
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Failed to save location", {
        description: err.message || "Check console for details",
        duration: Infinity
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  if (loading) {
    return (
      <div className="module active p-8 text-center">Loading location details...</div>
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

  if (!locationObj) {
    return <div className="module active p-8">Location not found.</div>;
  }

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={`${DOCTYPE}: ${locationObj.location_name || locationObj.name}`}
        description={`Update location information for ${locationObj.location_name || docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: DOCTYPE,
          docName: docname,
          redirectUrl: "/lis-management/doctype/location"
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
          currentUserEmail={locationObj.owner}
          modifiedStr={locationObj.modified}
          modifiedBy={locationObj.modified_by}
        />
      </div>
    </div>
  );
}
