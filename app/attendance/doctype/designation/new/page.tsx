"use client";

import * as React from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/* -------------------------------------------------
 1. Designation Type
------------------------------------------------- */
interface DesignationData {
  designation_name?: string;
  description?: string;
}

/* -------------------------------------------------
 2. Page Component
------------------------------------------------- */
export default function DesignationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Designation";
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
   Duplicate Prefill Support
  ------------------------------------------------- */
  const duplicateData: DesignationData | null = React.useMemo(() => {
    const duplicateParam = searchParams.get("duplicate");
    if (!duplicateParam) return null;

    try {
      return JSON.parse(atob(decodeURIComponent(duplicateParam)));
    } catch (err) {
      console.error("Duplicate parse error:", err);
      toast.error("Invalid duplicate data.");
      return null;
    }
  }, [searchParams]);

  const notified = React.useRef(false);
  React.useEffect(() => {
    if (duplicateData && !notified.current) {
      toast.success("Form pre-filled with duplicate data. Review and save.");
      notified.current = true;
    }
  }, [duplicateData]);

  /* -------------------------------------------------
   Form Tabs
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    const getValue = (field: keyof DesignationData, def: any = undefined) =>
      duplicateData?.[field] ?? def;

    return [
      {
        name: "Details",
        fields: [
          {
            name: "designation_name",
            label: "Designation",
            type: "Data",
            required: true,
            defaultValue: getValue("designation_name"),
          },
          {
            name: "description",
            label: "Description",
            type: "Small Text",
            defaultValue: getValue("description"),
          },
        ],
      },
    ];
  }, [duplicateData]);

  /* -------------------------------------------------
   Submit Handler
  ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>) => {
    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
      toast.error("Authentication required.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = { ...data };

      if (payload.name === "Will be auto-generated") {
        delete payload.name;
      }

      const response = await axios.post(
        `${API_BASE_URL}/${doctypeName}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("Designation created successfully!");

      const newName = response.data?.data?.name;
      if (newName) {
        router.push(`/attendance/doctype/designation/${newName}`);
      } else {
        router.push(`/attendance/doctype/designation`);
      }
    } catch (err: any) {
      console.error("Create error:", err);
      const res = err.response?.data;

      if (res?._server_messages) {
        try {
          const messages = JSON.parse(res._server_messages)
            .map((m: string) => JSON.parse(m).message)
            .join("\n");
          toast.error(messages);
          return;
        } catch { }
      }

      toast.error(res?.message || "Failed to create Designation.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
   Render
  ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title={`New ${doctypeName}`}
      description="Designation"
      submitLabel={isSaving ? "Saving..." : "Save"}
      cancelLabel="Cancel"
    />
  );
}