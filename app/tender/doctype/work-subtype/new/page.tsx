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
 1. Work Subtype data interface
 ------------------------------------------------- */
interface WorkSubtypeData {
  name?: string;
  work_type?: string;        // Link to Work Type
  work_subtype?: string;     // Data field
  modified?: string;
  docstatus?: 0 | 1 | 2;
}

/* -------------------------------------------------
 2. Page component
 ------------------------------------------------- */
export default function NewWorkSubtypePage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Work Subtype";
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
            name: "work_type",
            label: "Work Type",
            type: "Link",
            required: true,
            linkTarget: "Work Type", // Important: tells DynamicForm which doctype to link to
            // You can also add if your DynamicForm supports it:
            // searchFields: ["work_type_name"],
            // displayField: "work_type_name"
          },
          {
            name: "work_subtype",
            label: "Work Subtype",
            type: "Data",
            required: true,
          },
        ],
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
      const payload = {
        work_type: data.work_type,
        work_subtype: data.work_subtype,
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

      toast.success("Work Subtype created successfully!");

      // Navigate to the newly created record using work_subtype or name
      const workSubtypeName = response.data.data.work_subtype;
      const docName = response.data.data.name;
      const navigationId = workSubtypeName || docName;
      router.push(`/tender/doctype/work-subtype/${encodeURIComponent(navigationId)}`);

    } catch (err: any) {
      console.error("Create error:", err);
      const serverData = err.response?.data;
      const serverMessage =
        serverData?.exception ||
        serverData?._server_messages ||
        err.message ||
        "Failed to create Work Subtype. Check console for details.";

      toast.error("Failed to create Work Subtype", {
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
      description="Create a new work subtype"
      submitLabel={isSaving ? "Saving..." : "New Work Subtype"}
      cancelLabel="Cancel"
    />
  );
}