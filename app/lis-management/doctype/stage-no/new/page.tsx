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

const API_BASE_URL = "http://103.219.3.169:2223//api/resource";

/* -------------------------------------------------
 1. Stage No Data type
 ------------------------------------------------- */
interface StageNoData {
  name?: string;
  stage_no?: string;
  lis_name?: string;
}

/* -------------------------------------------------
 2. Page component
 ------------------------------------------------- */
export default function NewStageNoPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Stage No";
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
  3. Form tabs configuration
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    return [
      {
        name: "Details",
        fields: [
          {
            name: "lis_name",
            label: "Lift Irrigation Scheme",
            type: "Link", // Assuming this links to the LIS doctype
            required: true,
            linkTarget: "Lift Irrigation Scheme", // Specify the target doctype
            description: "Links to Lift Irrigation Scheme"
          },
          {
            name: "stage_no",
            label: "Stage No",
            type: "Data",
            required: true
          },
        ],
      },
    ];
  }, []);

  /* -------------------------------------------------
  4. SUBMIT
  ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>) => {
    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
      toast.error("Authentication required. Please log in.", { duration: Infinity });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        stage_no: data.stage_no,
        lis_name: data.lis_name,
        lis_phase: data.lis_phase || null,
      };

      const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, payload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      });

      toast.success("Stage No created successfully!");

      // Navigate to the newly created record using the document name
      const docName = response.data.data.name;
      router.push(`/lis-management/doctype/stage-no/${docName}`);

    } catch (err: any) {
      console.error("Create error:", err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Failed to create Stage No. Check console for details.";
      toast.error(`Error: ${errorMessage}`, { duration: Infinity });
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
      description="Create a new stage number for Lift Irrigation Scheme"
      submitLabel={isSaving ? "Saving..." : "New Stage No"}
      cancelLabel="Cancel"
    />
  );
}