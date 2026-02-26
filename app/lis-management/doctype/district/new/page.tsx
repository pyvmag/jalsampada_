"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DynamicForm, TabbedLayout } from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
const DOCTYPE = "WRD District";

export default function NewDistrictPage() {
  const router = useRouter();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  // 🟢 1. Define Form Structure
  const formTabs: TabbedLayout[] = [
    {
      name: "Details",
      fields: [
        {
          name: "district", // The field API name
          label: "District Name",
          type: "Data",
          required: true,
          placeholder: "e.g. Sangli, Satara",
          description: "Enter the official name of the district"
        },
      ],
    },
  ];

  // 🟢 2. Handle Submit
  const handleSubmit = async (data: Record<string, any>) => {
    setIsSaving(true);
    try {
      const payload = {
        ...data,
        doctype: DOCTYPE,
      };

      const resp = await fetch(`${API_BASE_URL}/${DOCTYPE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `token ${apiKey}:${apiSecret}`,
        },
        body: JSON.stringify(payload),
      });

      const responseData = await resp.json();

      if (!resp.ok) {
        throw new Error(responseData.exception || "Failed to create district");
      }

      toast.success("District created successfully!");
      router.push("/lis-management/doctype/district");
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err.message || "Error saving record", { duration: Infinity });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
      title="Create New District"
      description="Add a new geographical district to the system."
      submitLabel={isSaving ? "Saving..." : "Save District"}
    />
  );
}