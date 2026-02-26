"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DynamicForm, TabbedLayout } from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
const DOCTYPE = "WRD Village";

export default function NewVillagePage() {
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
          linkTarget: "WRD District",
          required: true,
          placeholder: "Select District",
        },
        {
          name: "taluka",
          label: "Taluka",
          type: "Link",
          linkTarget: "WRD Taluka",
          required: true,
          placeholder: "Select Taluka",
          // 🟢 Filter: Only show Talukas belonging to the selected District
          filterMapping: [
            { sourceField: "district", targetField: "district" }
          ]
        },
        {
          name: "village",
          label: "Village",
          type: "Data",
          required: true,
          placeholder: "e.g. Bedag",
        },
        // { name: "section_lis", label: "Village LIS Wise Details", type: "Section Break" },
        // 🟢 Child Table based on your CSV
        {
          name: "lis_wise_village_details",
          label: "Village LIS Wise Details",
          type: "Table",
          showDownloadUpload: true,

          columns: [
            {
              name: "lis_name",
              label: "LIS Name",
              type: "Link",
              linkTarget: "Lift Irrigation Scheme" // Assuming this doctype exists
            },
            {
              name: "no_of_beneficiaries",
              label: "No. Beneficiaries",
              type: "Int"
            },
            {
              name: "lis_status",
              label: "LIS Status",
              type: "Select",
              options: [
                { label: "Functional", value: "Functional" },
                { label: "Non-Functional", value: "Non-Functional" },
                { label: "Abandoned", value: "Abandoned" },
              ]
            },
            {
              name: "contemplated_ayacut_acres",
              label: "Ayacut (Acres)",
              type: "Float"
            },
            {
              name: "commissioned__new",
              label: "Commissioned / New",
              type: "Select",
              options: [
                { label: "Proposed", value: "Proposed" },
                { label: "Work in Progress", value: "Work in Progress" },
                { label: "Commissioned", value: "Commissioned" },
                { label: "Closed", value: "Closed" },

              ]
            },
            {
              name: "source_of_water",
              label: "Source of Water",
              type: "Data"
            },
          ],
        },
      ],
    }
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
        throw new Error(responseData.exception || "Failed to create village");
      }

      toast.success("Village created successfully!");
      router.push("/lis-management/doctype/wrd-village");
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
      title="Create New Village"
      description="Add a new Village and its LIS details."
      submitLabel={isSaving ? "Saving..." : "Save Village"}
    />
  );
}