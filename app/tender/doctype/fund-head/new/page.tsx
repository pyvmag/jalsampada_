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
 1. Fund Head data interface
 ------------------------------------------------- */
interface FundHeadData {
  name?: string;
  procurement_type?: string;
  modified?: string;
  docstatus?: 0 | 1 | 2;
}

/* -------------------------------------------------
 2. Page component
 ------------------------------------------------- */
export default function NewFundHeadPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Fund Head";
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
            name: "procurement_type",
            label: "Procurement Type",
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
        procurement_type: data.procurement_type,
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

      toast.success("Fund Head created successfully!");

      // Navigate to the newly created record using procurement_type or name
      const procurementType = response.data.data.procurement_type;
      const docName = response.data.data.name;
      const navigationId = procurementType || docName;
      router.push(`/tender/doctype/fund-head/${encodeURIComponent(navigationId)}`);

    } catch (err: any) {
      console.error("Create error:", err);
      const serverData = err.response?.data;
      const serverMessage =
        serverData?.exception ||
        serverData?._server_messages ||
        err.message ||
        "Failed to create Fund Head. Check console for details.";

      toast.error("Failed to create Fund Head", {
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
      description="Create a new fund head"
      submitLabel={isSaving ? "Saving..." : "New Fund Head"}
      cancelLabel="Cancel"
    />
  );
}