"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import {
  DynamicForm,
  TabbedLayout,
  FormField,
} from "@/components/DynamicFormComponent";
import DocumentActivity from "@/components/DocumentActivity";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

/* -------------------------------------------------
   1. Draft Tender Paper data interface
------------------------------------------------- */

interface DraftTenderPaperData {
  name: string;
  modified: string;
  docstatus: 0 | 1 | 2;

  // Main fields from your CSV
  tendor_name?: string;
  tendor_number?: string;
  fiscal_year?: string;     // Link
  lis_name?: string;        // Link
  stage?: string;           // Link
  description?: string;     // Text (long text)
  owner?: string;
  modified_by?: string;
}

/* -------------------------------------------------
   2. Page component
------------------------------------------------- */

export default function DraftTenderPaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = params.id as string;
  const doctypeName = "Draft Tender Paper";

  const [record, setRecord] = React.useState<DraftTenderPaperData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
     3. FETCH record
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
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });

        setRecord(resp.data.data as DraftTenderPaperData);
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

    fetchRecord();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  /* -------------------------------------------------
     4. Build form tabs & fields
  ------------------------------------------------- */

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!record) return [];

    const withDefaults = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in record
            ? // @ts-ignore
            record[f.name as keyof DraftTenderPaperData]
            : f.defaultValue,
      }));

    const mainFields: FormField[] = withDefaults([

      {
        name: "tendor_name",
        label: "Tender Name",
        type: "Data",
        required: true,
      },
      {
        name: "tendor_number",
        label: "Tender Number",
        type: "Data",
        required: true,
      },
      {
        name: "fiscal_year",
        label: "Fiscal Year",
        type: "Link",
        linkTarget: "Fiscal Year",
        required: true,
      },
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
      },
      {
        name: "description",
        label: "Description",
        type: "Text",
        required: false, // not marked mandatory in CSV
      },
    ]);

    return [
      {
        name: "Main",
        fields: mainFields,
      },
    ];
  }, [record]);

  /* -------------------------------------------------
     5. SUBMIT handler (PUT)
  ------------------------------------------------- */

  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    if (!record) {
      toast.error("Cannot save, data not loaded.");
      return;
    }

    if (!apiKey || !apiSecret) {
      toast.error("Missing API credentials.", { duration: Infinity });
      return;
    }

    setIsSaving(true);

    try {
      const payload = JSON.parse(JSON.stringify(data));

      // Filter out layout fields (Section Break, Column Break)
      const layoutFields = new Set(["tendor_details_section"]);

      const finalPayload: any = {};
      for (const key in payload) {
        if (!layoutFields.has(key)) {
          finalPayload[key] = payload[key];
        }
      }

      // Preserve Frappe metadata
      finalPayload.modified = record.modified;
      finalPayload.docstatus = record.docstatus;

      const resp = await axios.put(
        `${API_BASE_URL}/${doctypeName}/${docname}`,
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
        setRecord(resp.data.data as DraftTenderPaperData);
      }

      router.push(`/tender/doctype/draft-tender-paper/${docname}`);
    } catch (err: any) {
      console.error("Save error:", err);

      const serverData = err.response?.data;
      const serverMessage =
        serverData?.exception ||
        serverData?._server_messages ||
        err.message ||
        "Check console for details.";

      toast.error("Failed to save", {
        description: serverMessage,
        duration: Infinity
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
     6. UI states
  ------------------------------------------------- */

  if (loading) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading Draft Tender Paper details...</p>
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

  /* -------------------------------------------------
     7. Render form
  ------------------------------------------------- */

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={`${doctypeName}: ${record.name}`}
        description={`Update details for record ID ${docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/tender/doctype/draft-tender-paper",
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