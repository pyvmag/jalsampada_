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

const API_BASE_URL = "http://103.219.3.169:2223//api/resource";

/* -------------------------------------------------
 1. Equipment Capacity Data type
 ------------------------------------------------- */
interface EquipementCapacityData {
  name?: string;
  equipement_capacity?: string;
}

/* -------------------------------------------------
 2. Page component
 ------------------------------------------------- */
export default function NewEquipmentCapacityPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Equipement Capacity";
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
  3. Form tabs configuration
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    return [
      {
        name: "Details",
        fields: [
          {
            name: "equipement_capacity",
            label: "Equipment Capacity",
            type: "Data",
            required: true
          },
        ],
      },
    ];
  }, []);

  /* -------------------------------------------------
  4. SUBMIT
  ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>) => {
    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
      toast.error("Authentication required. Please log in.", { duration: Infinity });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        equipement_capacity: data.equipement_capacity,
      };

      const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, payload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      });

      toast.success("Equipment Capacity created successfully!");

      // Navigate to the newly created record using equipement_capacity
      const newCapacityName = response.data.data.equipement_capacity || response.data.data.name;
      router.push(`/lis-management/doctype/equipement-capacity/${newCapacityName}`);

    } catch (err: any) {
      console.error("Create error:", err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Failed to create Equipment Capacity. Check console for details.";
      toast.error(`Error: ${errorMessage}`, { duration: Infinity });
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
      description="Create a new equipment capacity"
      submitLabel={isSaving ? "Saving..." : "New Equipment Capacity"}
      cancelLabel="Cancel"
    />
  );
}