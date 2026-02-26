"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

export default function NewGatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  const doctypeName = "Gate";

  // Parse duplicate data from URL parameters
  const duplicateData = React.useMemo(() => {
    const duplicateParam = searchParams.get('duplicate');
    if (!duplicateParam) return null;

    try {
      const decodedData = JSON.parse(atob(decodeURIComponent(duplicateParam)));
      console.log("Parsed duplicate data:", decodedData);
      return decodedData;
    } catch (error) {
      console.error("Error parsing duplicate data:", error);
      toast.error("Failed to parse duplicate data", { duration: Infinity });
      return null;
    }
  }, [searchParams]);

  // Show notification if we have duplicate data (only once)
  const notificationShown = React.useRef(false);
  React.useEffect(() => {
    if (duplicateData && !notificationShown.current) {
      toast.success("Form populated with duplicate data. Modify as needed and save.");
      notificationShown.current = true;
    }
  }, [duplicateData]);

  /* -------------------------------------------------
     1. Define the form structure
     ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    // Helper function to get value from duplicate data or fallback to default
    const getValue = (fieldName: string, defaultValue: any = undefined) => {
      return duplicateData?.[fieldName] ?? defaultValue;
    };

    return [
      {
        name: "Details",
        fields: [
          {
            name: "gate",
            label: "Gate",
            type: "Int",
            required: true,
            placeholder: "Enter gate number",
            defaultValue: getValue("gate"),
          },
          {
            name: "lis_name",
            label: "LIS Name",
            type: "Link",
            linkTarget: "Lift Irrigation Scheme",
            required: true,
            defaultValue: getValue("lis_name"),
          },
          {
            name: "stage",
            label: "Stage",
            type: "Link",
            linkTarget: "Stage No",
            required: true,
            defaultValue: getValue("stage"),
            filterMapping: [
              {
                sourceField: "lis_name",

                targetField: "lis_name"
              }
            ],
          },
        ],
      },
    ];
  }, [duplicateData]);

  /* -------------------------------------------------
     2. SUBMIT (Create)
     ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    // Check if we have valid data to submit (either dirty changes or duplicate data)
    const hasValidData = isDirty || (duplicateData && data.gate);

    if (!hasValidData) {
      toast.info("Please fill out the form.");
      return;
    }

    setIsSaving(true);

    try {
      // Build the payload
      const finalPayload = {
        doctype: doctypeName,
        gate: Number(data.gate),
        lis_name: data.lis_name,
        stage: data.stage,
      };

      console.log("Sending NEW Gate payload:", finalPayload);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `token ${apiKey}:${apiSecret}`,
      };

      // Add the CSRF token if available
      const storedCsrfToken = localStorage.getItem('csrfToken');
      if (storedCsrfToken) {
        headers['X-Frappe-CSRF-Token'] = storedCsrfToken;
      }

      const resp = await fetch(`${API_BASE_URL}/${doctypeName}`, {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(finalPayload),
      });

      const responseData = await resp.json();

      if (!resp.ok) {
        console.log("Full server error:", responseData);
        throw new Error(responseData.exception || responseData._server_messages || "Failed to create document");
      }

      toast.success("Gate created successfully!");

      // Go to the main list page for this doctype
      router.push(`/operations/doctype/gate`);

    } catch (err: any) {
      console.error("Save error:", err);

      // Handle duplicate entry error specifically
      if (err.response?.data?.exc_type === "DuplicateEntryError") {
        toast.error("Duplicate Entry Error", {
          description: "A Gate record with these details may already exist.",
          duration: Infinity
        });
      } else {
        toast.error("Failed to create Gate", {
          description: err.message || "Check the browser console for details.",
          duration: Infinity
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
     3. RENDER FORM
     ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title="New Gate"
      description="Create a new Gate record"
      submitLabel={isSaving ? "Saving..." : "Create"}
      cancelLabel="Cancel"
    />
  );
}