"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DynamicForm, TabbedLayout } from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
const DOCTYPE = "Year";

export default function NewYearPage() {
  const router = useRouter();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  const formTabs: TabbedLayout[] = [
    {
      name: "Details",
      fields: [
        {
          name: "year",
          label: "Year",
          type: "Data",
          required: true,
          placeholder: "e.g. 2026",
          description: "Enter the calendar year",
          pattern: "^\\d{4}$",
          patternMessage: "Year must be a 4-digit value",
        },
      ],
    },
  ];

  const handleSubmit = async (data: Record<string, any>) => {
    setIsSaving(true);

    try {
      const payload = {
        doctype: DOCTYPE,
        year: data.year?.trim(),
      };

      const resp = await fetch(`${API_BASE_URL}/${DOCTYPE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `token ${apiKey}:${apiSecret}`,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const responseData = await resp.json();

      if (!resp.ok) {
        throw new Error(
          responseData.exception ||
          responseData._server_messages ||
          "Failed to create year"
        );
      }

      toast.success("Year created successfully!");
      router.push(`/operations/doctype/year/${encodeURIComponent(responseData.data.name)}`);
    } catch (err: any) {
      toast.error("Failed to create year", {
        description: err.message,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
      title="New Year"
      description="Create a new year master record"
      submitLabel={isSaving ? "Saving..." : "Create"}
      cancelLabel="Cancel"
    />
  );
}
