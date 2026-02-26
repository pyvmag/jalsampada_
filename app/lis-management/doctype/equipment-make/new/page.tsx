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
 1. Equipment Make Data type
 ------------------------------------------------- */
interface EquipementMakeData {
  name?: string;
  equipement_make?: string;
}

/* -------------------------------------------------
 2. Page component
 ------------------------------------------------- */
export default function NewEquipmentMakePage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Equipement Make";
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
            name: "equipement_make",
            label: "Equipment Make",
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
        equipement_make: data.equipement_make,
      };

      const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, payload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      });

      toast.success("Equipment Make created successfully!");

      // Navigate to the newly created record using equipement_make
      const newMakeName = response.data.data.equipement_make || response.data.data.name;
      router.push(`/lis-management/doctype/equipment-make/${newMakeName}`);

    } catch (err: any) {
      console.error("Create error:", err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Failed to create Equipment Make. Check console for details.";
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
      description="Create a new equipment make"
      submitLabel={isSaving ? "Saving..." : "New Equipment Make"}
      cancelLabel="Cancel"
    />
  );
}