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
 1. Equipment Model Data type
 ------------------------------------------------- */
interface EquipementModelData {
  name?: string;
  equipement_model?: string;
}

/* -------------------------------------------------
 2. Page component
 ------------------------------------------------- */
export default function NewEquipmentModelPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Equipement Model";
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
            name: "equipement_model",
            label: "Equipment Model",
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
        equipement_model: data.equipement_model,
      };

      const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, payload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      });

      toast.success("Equipment Model created successfully!");

      // Navigate to the newly created record using equipement_model
      const newModelName = response.data.data.equipement_model || response.data.data.name;
      router.push(`/lis-management/doctype/equipement-model/${newModelName}`);

    } catch (err: any) {
      console.error("Create error:", err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Failed to create Equipment Model. Check console for details.";
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
      description="Create a new equipment model"
      submitLabel={isSaving ? "Saving..." : "New Equipment Model"}
      cancelLabel="Cancel"
    />
  );
}