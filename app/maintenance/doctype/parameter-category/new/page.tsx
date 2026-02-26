"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { UseFormReturn } from "react-hook-form";
import { getApiMessages } from "@/lib/utils";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

export default function ParameterCategoryPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Parameter Category";
  const [isSaving, setIsSaving] = React.useState(false);

  // (Optional) capture form methods
  const [formMethods, setFormMethods] =
    React.useState<UseFormReturn<any> | null>(null);

  /* -------------------------------------------------
     FORM CONFIG
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    return [
      {
        name: "Details",
        fields: [
          {
            name: "parameter_category",
            label: "Parameter Category",
            type: "Text",
            required: true,
          },
        ],
      },
    ];
  }, []);

  /* -------------------------------------------------
     SUBMIT HANDLER
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
        "Parameter Category created successfully!",
        "Failed to create Parameter Category"
      );

      if (messages.success) {
        toast.success(messages.message, {
          description: messages.description,
        });
      }

      const docName = response.data?.data?.name;
      if (docName) {
        router.push(
          `/maintenance/doctype/parameter-category/${encodeURIComponent(docName)}`
        );
      } else {
        router.push(`/maintenance/doctype/parameter-category`);
      }

    } catch (err: any) {
      console.error("Create error:", err);
      console.log("Full server error:", err.response?.data);

      const messages = getApiMessages(
        null,
        err,
        "Parameter Category created successfully!",
        "Failed to create Parameter Category"
      );

      toast.error(messages.message, {
        description: messages.description,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
     RENDER
  ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title={`New ${doctypeName}`}
      description="Maintenance Parameter Category"
      submitLabel={isSaving ? "Saving..." : "Save"}
      cancelLabel="Cancel"
      onFormInit={(methods) => setFormMethods(methods)}
    />
  );
}