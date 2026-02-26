"use client";

import * as React from "react";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { getApiMessages } from "@/lib/utils";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

export default function ParameterChecklistPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Device Type";
  const [isSaving, setIsSaving] = React.useState(false);

  // (Optional) keep form methods if needed later
  const [formMethods, setFormMethods] =
    React.useState<UseFormReturn<any> | null>(null);

  /* -------------------------------------------------
     Form tabs configuration (UI only)
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    return [
      {
        name: "Details",
        fields: [
          {
            name: "device_type",
            label: "Device Type",
            type: "Text",
            required: true,
          },
        ],
      },
    ];
  }, []);

  /* -------------------------------------------------
     UI-only submit / cancel handlers
  ------------------------------------------------- */
  const handleSubmit = async (
    data: Record<string, any>,
    isDirty: boolean
  ) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
      toast.error("Authentication required. Please log in.");
      return;
    }

    setIsSaving(true);

    try {
      // Deep clone data
      const payload = JSON.parse(JSON.stringify(data));

      // Remove UI-only / non-data fields
      const allFields = formTabs.flatMap((tab) => tab.fields);
      const nonDataFields = new Set<string>();

      allFields.forEach((field) => {
        if (
          field.type === "Section Break" ||
          field.type === "Column Break" ||
          field.type === "Button" ||
          field.type === "Read Only"
        ) {
          nonDataFields.add(field.name);
        }
      });

      const finalPayload: Record<string, any> = {};
      for (const key in payload) {
        if (!nonDataFields.has(key)) {
          finalPayload[key] = payload[key];
        }
      }

      console.log("Sending PAYLOAD to Frappe:", finalPayload);

      const response = await axios.post(
        `${API_BASE_URL}/${doctypeName}`,
        finalPayload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      const messages = getApiMessages(
        response,
        null,
        "Device Type created successfully!",
        "Failed to create Device Type"
      );

      if (messages.success) {
        toast.success(messages.message, {
          description: messages.description,
        });
      }

      const docName = response.data?.data?.name;
      if (docName) {
        router.push(
          `/maintenance/doctype/device-type/${encodeURIComponent(docName)}`
        );
      } else {
        router.push(`/maintenance/doctype/device-type`);
      }

    } catch (err: any) {
      console.error("Create error:", err);
      console.log("Full server error:", err.response?.data);

      const messages = getApiMessages(
        null,
        err,
        "Device Type created successfully!",
        "Failed to create Device Type"
      );

      toast.error(messages.message, {
        description: messages.description,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    console.log("Form cancelled");
  };

  /* -------------------------------------------------
     RENDER UI
  ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title={`New ${doctypeName}`}
      description="Maintenance Device Type"
      submitLabel={isSaving ? "Saving..." : "Save"}
      cancelLabel="Cancel"
      onFormInit={(methods) => setFormMethods(methods)}
    />
  );
}