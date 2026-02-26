"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DynamicForm, TabbedLayout } from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
const DOCTYPE = "WRD Taluka";

export default function NewTalukaPage() {
  const router = useRouter();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  // 🟢 1. Define Form Structure
  const formTabs: TabbedLayout[] = [
    {
      name: "Details",
      fields: [
        {
          name: "district",
          label: "District",
          type: "Link",
          linkTarget: "WRD District", // Connects to the District doctype
          required: true,
          placeholder: "Select District",
          description: "Select the district this Taluka belongs to"
        },
        {
          name: "taluka",
          label: "Taluka",
          type: "Data",
          required: true,
          placeholder: "e.g. Miraj, Tasgaon",
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
        throw new Error(responseData.exception || "Failed to create taluka");
      }

      toast.success("Taluka created successfully!");
      router.push("/lis-management/doctype/taluka");
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
      title="Create New Taluka"
      description="Add a new Taluka under a District."
      submitLabel={isSaving ? "Saving..." : "Save Taluka"}
    />
  );
}