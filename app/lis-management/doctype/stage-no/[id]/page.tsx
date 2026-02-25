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

const API_BASE_URL = "http://103.219.1.138:4412//api/resource";

/* -------------------------------------------------
 1. Stage No Data type
 ------------------------------------------------- */
interface StageNoData {
  name: string;
  stage_no: string;
  lis_name: string;
  modified: string;
  owner?: string;
  modified_by?: string;
}

/* -------------------------------------------------
 2. Page component
 ------------------------------------------------- */
export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = params.id as string;
  const doctypeName = "Stage No"; // <-- CHANGED

  const [stage, setStage] = React.useState<StageNoData | null>(null); // <-- CHANGED
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
  3. FETCH Stage
  ------------------------------------------------- */
  React.useEffect(() => {
    const fetchStage = async () => { // <-- CHANGED
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const resp = await axios.get(`${API_BASE_URL}/${doctypeName}/${docname}`, {
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
          withCredentials: true,
        });

        setStage(resp.data.data); // <-- CHANGED
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

    fetchStage(); // <-- CHANGED
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  /* -------------------------------------------------
  4. Build tabs
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!stage) return []; // <-- CHANGED

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in stage
            ? // @ts-ignore
            stage[f.name as keyof StageNoData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "lis_name",
            label: "Lift Irrigation Scheme",
            type: "Link", // Assuming this links to the LIS doctype
            required: true,
            // Add description if you want to specify the link target
            description: "Links to Lift Irrigation Scheme"
          },

          {
            name: "stage_no",
            label: "Stage No",
            type: "Data",
            required: true
          },
        ]),
      },
    ];
  }, [stage]); // <-- CHANGED

  /* -------------------------------------------------
  5. SUBMIT
  ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>) => {
    setIsSaving(true);
    try {
      // The payload only needs the fields that are being saved
      const payload = {
        stage_no: data.stage_no,
        lis_name: data.lis_name,
        lis_phase: data.lis_phase
      };

      await axios.put(`${API_BASE_URL}/${doctypeName}/${docname}`, payload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      });

      toast.success("Changes saved successfully!");
      router.push(`/lis-management/doctype/stage-no/${docname}`);
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save. Check console for details.", { duration: Infinity });
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

  if (!stage) { // <-- CHANGED
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        <p>{doctypeName} not found.</p>
      </div>
    );
  }

  /* -------------------------------------------------
  7. RENDER FORM
  ------------------------------------------------- */
  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={` ${doctypeName}: ${stage.stage_no}`}
        description={`Update details for record ID: ${docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/lis-management/doctype/stage-no"
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
          currentUserEmail={stage.owner}
          modifiedStr={stage.modified}
          modifiedBy={stage.modified_by}
        />
      </div>
    </div>
  );
}