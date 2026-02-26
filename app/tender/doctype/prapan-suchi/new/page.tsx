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
import { UseFormReturn } from "react-hook-form";
import { getApiMessages } from "@/lib/utils";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
const API_METHOD_URL = "http://103.219.3.169:2223/api/method";

interface PrapanSuchi {
  name?: string;
  fiscal_year?: string;
  lis_name?: string;
  type?: string; // Fund Head
  amount?: number;
  stage?: Array<{
    stage?: string;
  }>;
  work_name?: string;
  description?: string;
  docstatus?: 0 | 1 | 2;
  modified?: string;
}

export default function NewPrapanSuchiPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Prapan Suchi";
  const [isSaving, setIsSaving] = React.useState(false);

  // 🟢 State to capture form methods (to use watch/setValue outside the form)
  const [formMethods, setFormMethods] = React.useState<UseFormReturn<any> | null>(null);
  React.useEffect(() => {
    if (!formMethods || !apiKey || !apiSecret) return;

    const { watch, setValue } = formMethods;

    // Watch for changes in "lis_name"
    const subscription = watch(async (value, { name, type }) => {
      if (name === "lis_name") {
        const lisName = value.lis_name;

        // 1. If LIS Name is cleared, clear the stages table
        if (!lisName) {
          setValue("stage", [], { shouldDirty: true });
          return;
        }

        // 2. Fetch Stages from Custom API
        try {
          const resp = await axios.get(`${API_METHOD_URL}/quantlis_management.api.fetch_lis_name_stage`, {
            params: { lis_name: lisName },
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            withCredentials: true,
          });

          const rawList = resp.data.message || [];

          // 3. Format for Child Table
          const formattedStages = rawList.map((item: any, idx: number) => ({
            doctype: "Stage Multiselect",
            stage: item.stage,
            idx: idx + 1
          }));

          // 4. Update the form field
          setValue("stage", formattedStages, { shouldDirty: true });

        } catch (error: any) {
          console.error("Failed to fetch stages:", error);
          const messages = getApiMessages(
            null,
            error,
            "Stages fetched successfully",
            "Could not fetch stages for the selected LIS."
          );

          toast.error(messages.message, { description: messages.description, duration: Infinity });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [formMethods, apiKey, apiSecret]);

  /* -------------------------------------------------
  3. Form tabs configuration
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    return [
      {
        name: "Details",
        fields: [
          {
            name: "fiscal_year",
            label: "Fiscal Year",
            type: "Link",
            linkTarget: "Fiscal Year",
            // required: true,

          },
          {
            name: "lis_name",
            label: "LIS Name",
            type: "Link",
            linkTarget: "Lift Irrigation Scheme",
            required: true,

          },
          {
            name: "type",
            label: "Fund Head",
            type: "Link",
            linkTarget: "Fund Head",
            required: true,

          },
          {
            name: "stage",
            label: "Stage/Sub Scheme",
            type: "Table MultiSelect",
            linkTarget: "Stage No",
            filterMapping: [
              { sourceField: "lis_name", targetField: "lis_name" }
            ]
          },
          {
            name: "amount",
            label: "Amount",
            type: "Currency",
            required: true,
          },
          {
            name: "work_name",
            label: "Name of Work",
            type: "Text",
            required: true,
          },
          {
            name: "description",
            label: "Description",
            type: "Long Text",
          },
        ],
      },
    ];
  }, []);

  // submit handler
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
      const payload: Record<string, any> = JSON.parse(JSON.stringify(data));

      // Clean payload: remove non-data fields
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

      // Numeric conversions
      const numericFields = ["amount"];
      numericFields.forEach((f) => {
        if (f in finalPayload) {
          finalPayload[f] = Number(finalPayload[f]) || 0;
        }
      });

      // 🟢 FORMAT CHILD TABLE (STAGE)
      // Ensure every item has the 'doctype' key required by Frappe
      if (finalPayload.stage && Array.isArray(finalPayload.stage)) {
        finalPayload.stage = finalPayload.stage.map((item: any, index: number) => {
          // Handle string items (manual selection might create these)
          if (typeof item === 'string') {
            return {
              doctype: "Stage Multiselect",
              stage: item,
              idx: index + 1
            };
          }
          // Handle object items (auto-populated items are already objects)
          return {
            ...item,
            doctype: "Stage Multiselect", // Force correct Doctype
            idx: index + 1
          };
        });
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

      // Handle successful response with ultra-simple handler
      const messages = getApiMessages(response, null, "Prapan Suchi created successfully!", "Failed to create Prapan Suchi");

      if (messages.success) {
        toast.success(messages.message, { description: messages.description });
      }

      const docName = response.data.data.name;
      if (docName) {
        router.push(`/tender/doctype/prapan-suchi/${encodeURIComponent(docName)}`);
      } else {
        router.push(`/tender/doctype/prapan-suchi`);
      }

    } catch (err: any) {
      console.error("Create error:", err);
      console.log("Full server error:", err.response?.data);

      const messages = getApiMessages(null, err, "Prapan Suchi created successfully!", "Failed to create Prapan Suchi");

      toast.error(messages.message, { description: messages.description, duration: Infinity });
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
      description="Create a new prapan suchi"
      submitLabel={isSaving ? "Saving..." : "New Prapan Suchi"}
      cancelLabel="Cancel"

      // 🟢 Capture form methods to enable the watcher logic
      onFormInit={(methods) => setFormMethods(methods)}
    />
  );
}