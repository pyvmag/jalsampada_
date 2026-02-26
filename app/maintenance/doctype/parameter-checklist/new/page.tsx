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

export default function ParameterChecklistPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Parameter Checklist";
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

          toast.error(messages.message, { description: messages.description });
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
            name: "parameter",
            label: "Parameter",
            type: "Text",
            // linkTarget: "Fiscal Year",
            required: true,

          },
          {
            name: "monitoring_type",
            label: "Monitoring Type",
            type: "Select",
            options: [{ label: "Daily", value: "Daily" }, { label: "Weekly", value: "Weekly" }, { label: "Monthly", value: "Monthly" }, { label: 'Quarterly', value: "Quarterly" }, { label: 'Half-Yearly', value: 'Half-Yearly' }, { label: "Yearly", value: "Yearly" }],

          },
          {
            name: "asset_category",
            label: "Asset Category",
            type: "Link",
            linkTarget: "Asset Category",
          },
        ],
      },
    ];
  }, []);

  // submit handler
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    console.log('data', data)
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

      const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, finalPayload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      // Handle successful response with ultra-simple handler
      const messages = getApiMessages(response, null, "Parameter Checklist created successfully!", "Failed to create Parameter Checklist");

      if (messages.success) {
        toast.success(messages.message, { description: messages.description });
      }

      const docName = response.data.data.name;
      if (docName) {
        router.push(`/maintenance/doctype/parameter-checklist/${encodeURIComponent(docName)}`);
      } else {
        router.push(`/maintenance/doctype/parameter-checklist`);
      }

    } catch (err: any) {
      console.error("Create error:", err);
      console.log("Full server error:", err.response?.data);

      const messages = getApiMessages(null, err, "Parameter Checklist created successfully!", "Failed to create Parameter Checklist");

      toast.error(messages.message, { description: messages.description });
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
      description="Maintenance Parameter Checklist"
      submitLabel={isSaving ? "Saving..." : "New Parameter Checklist"}
      cancelLabel="Cancel"

      // 🟢 Capture form methods to enable the watcher logic
      onFormInit={(methods) => setFormMethods(methods)}
    />
  );
}




// "use client";

// import * as React from "react";
// import {
//   DynamicForm,
//   TabbedLayout,
// } from "@/components/DynamicFormComponent";
// import { UseFormReturn } from "react-hook-form";

// export default function ParameterChecklistPage() {
//   const doctypeName = "Parameter Checklist";
//   const [isSaving, setIsSaving] = React.useState(false);

//   // (Optional) keep form methods if needed later
//   const [formMethods, setFormMethods] =
//     React.useState<UseFormReturn<any> | null>(null);

//   /* -------------------------------------------------
//      Form tabs configuration (UI only)
//   ------------------------------------------------- */
//   const formTabs: TabbedLayout[] = React.useMemo(() => {
//     return [
//       {
//         name: "Details",
//         fields: [
//           {
//             name: "parameter",
//             label: "Parameter",
//             type: "Link",
//             required: true,
//           },
//            {
//             name: "custom_condition",
//             label: "Condition",
//             type: "Select",
//             options: [{ label: "Daily", value: "Daily" }, { label: "Weekly", value: "Weekly"},{label: "Monthly", value: "Monthly"}, {label: 'Quarterly', value: "Quarterly"}, {label: 'Half-Yearly', value: 'Half-Yearly'}, {label: "Yearly", value: "Yearly"}],

//           },
//           {
//             name: "asset_category",
//             label: "Asset Category",
//             type: "Link",
//             linkTarget: "Fund Head",
//           },
//         ],
//       },
//     ];
//   }, []);

//   /* -------------------------------------------------
//      UI-only submit / cancel handlers
//   ------------------------------------------------- */
//   const handleSubmit = async (
//     data: Record<string, any>,
//     isDirty: boolean
//   ) => {
//     if (!isDirty) {
//       console.log("No changes to submit");
//       return;
//     }

//     setIsSaving(true);

//     // UI-only: just log data
//     console.log("Form submitted with data:", data);

//     // Simulate save delay
//     setTimeout(() => {
//       setIsSaving(false);
//       console.log("Save complete (UI only)");
//     }, 500);
//   };

//   const handleCancel = () => {
//     console.log("Form cancelled");
//   };

//   /* -------------------------------------------------
//      RENDER UI
//   ------------------------------------------------- */
//   return (
//     <DynamicForm
//       tabs={formTabs}
//       onSubmit={handleSubmit}
//       onCancel={handleCancel}
//       title={`New ${doctypeName}`}
//       description="Maintenance Parameter Checklist"
//       submitLabel={isSaving ? "Saving..." : "Save"}
//       cancelLabel="Cancel"
//       onFormInit={(methods) => setFormMethods(methods)}
//     />
//   );
// }