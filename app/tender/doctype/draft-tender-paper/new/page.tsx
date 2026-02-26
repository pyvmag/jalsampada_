"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
  FormField,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/* -------------------------------------------------
   1. Draft Tender Paper data interface
------------------------------------------------- */

interface DraftTenderPaperData {
  name?: string;
  modified?: string;
  docstatus?: 0 | 1 | 2;

  // Main fields from your CSV
  tendor_name?: string;
  tendor_number?: string;
  fiscal_year?: string;     // Link
  lis_name?: string;        // Link
  stage?: string;           // Link
  description?: string;     // Text (long text)
}

/* -------------------------------------------------
   2. Page component
------------------------------------------------- */

export default function NewDraftTenderPaperPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Draft Tender Paper";
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
  3. Form tabs configuration
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    const mainFields: FormField[] = [
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
        filterMapping: [
          { sourceField: "lis_name", targetField: "lis_name" },
        ],
        required: true,
      },
      {
        name: "description",
        label: "Description",
        type: "Text",
        required: false, // not marked mandatory in CSV
      },
    ];

    return [
      {
        name: "Main",
        fields: mainFields,
      },
    ];
  }, []);

  /* -------------------------------------------------
  4. SUBMIT handler (POST)
  ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
      toast.error("Authentication required. Please log in.", { duration: Infinity });
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

      console.log("Sending this PAYLOAD to Frappe:", finalPayload);

      const response = await axios.post(`${API_BASE_URL}/${encodeURIComponent(doctypeName)}`, finalPayload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      toast.success("Draft Tender Paper created successfully!");

      // Navigate to the newly created record using name (TDP-.#### naming series)
      const docName = response.data.data.name;
      if (docName) {
        router.push(`/tender/doctype/draft-tender-paper/${encodeURIComponent(docName)}`);
      } else {
        router.push(`/tender/doctype/draft-tender-paper`);
      }

    } catch (err: any) {
      console.error("Create error:", err);
      const serverData = err.response?.data;
      const serverMessage =
        serverData?.exception ||
        serverData?._server_messages ||
        err.message ||
        "Check console for details.";

      toast.error("Failed to create Draft Tender Paper", {
        description: serverMessage,
        duration: Infinity
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
  5. RENDER FORM
  ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title={`New ${doctypeName}`}
      description="Create a new draft tender paper"
      submitLabel={isSaving ? "Saving..." : "New Draft Tender Paper"}
      cancelLabel="Cancel"
    />
  );
}