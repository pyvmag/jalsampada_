"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DynamicForm, TabbedLayout, FormField } from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
const DOCTYPE = "Location";

export default function NewLocationPage() {
  const router = useRouter();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  const formTabs: TabbedLayout[] = [
    {
      name: "Details",
      fields: [
        {
          name: "location_name",
          label: "Location Name",
          type: "Data",
          required: true,
          placeholder: "e.g. Pune Area",
        },
        {
          name: "parent_location",
          label: "Parent Location",
          type: "Link",
          linkTarget: "Location",
          placeholder: "Select Parent Location",
        },
        {
          name: "is_container",
          label: "Is Container",
          type: "Check",
          defaultValue: 0,
        },
        {
          name: "is_group",
          label: "Is Group",
          type: "Check",
          defaultValue: 0,
        },
      ] as FormField[],
    },
    {
      name: "Location Details",
      fields: [
        {
          name: "latitude",
          label: "Latitude",
          type: "Float",
        },
        {
          name: "longitude",
          label: "Longitude",
          type: "Float",
        },
        {
          name: "location",
          label: "Location",
          type: "Geolocation",
        },
      ] as FormField[],
    }
  ];

  const handleSubmit = async (data: Record<string, any>) => {
    setIsSaving(true);
    try {
      const payload = {
        ...data,
        doctype: DOCTYPE,
        is_container: data.is_container ? 1 : 0,
        is_group: data.is_group ? 1 : 0,
        latitude: data.latitude ? Number(data.latitude) : null,
        longitude: data.longitude ? Number(data.longitude) : null,
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
        throw new Error(responseData.exception || "Failed to create location");
      }

      toast.success("Location created successfully!");
      router.push("/lis-management/doctype/location");
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err.message || "Error saving record", { duration: Infinity });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        title="Create New Location"
        description="Add a new Location record."
        submitLabel={isSaving ? "Saving..." : "Save Location"}
      />
    </div>
  );
}
