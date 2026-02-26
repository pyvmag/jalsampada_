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
 1. Work Type data
 ------------------------------------------------- */
interface WorkTypeData {
  name?: string;
  work_type_name?: string;
  modified?: string;
  docstatus?: 0 | 1 | 2;
}

/* -------------------------------------------------
 2. Page component
 ------------------------------------------------- */
export default function NewWorkTypePage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Work Type";
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
            name: "work_type_name",
            label: "Work Type Name",
            type: "Data",
            required: true,
          },
        ],
      },
    ];
  }, []);

  /* -------------------------------------------------
  4. SUBMIT
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
      const payload = {
        work_type_name: data.work_type_name,
      };

      const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, payload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      toast.success("Work Type created successfully!");

      // Navigate to the newly created record using work_type_name or name
      const workTypeName = response.data.data.work_type_name;
      const docName = response.data.data.name;
      const navigationId = workTypeName || docName;
      router.push(`/tender/doctype/work-type/${encodeURIComponent(navigationId)}`);

    } catch (err: any) {
      console.error("Create error:", err);
      const serverData = err.response?.data;
      const serverMessage =
        serverData?.exception ||
        serverData?._server_messages ||
        err.message ||
        "Failed to create Work Type. Check console for details.";

      toast.error("Failed to create Work Type", {
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
      description="Create a new work type"
      submitLabel={isSaving ? "Saving..." : "New Work Type"}
      cancelLabel="Cancel"
    />
  );
}