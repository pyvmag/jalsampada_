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
 1. Rating Data type
 ------------------------------------------------- */
interface RatingData {
  name?: string;
  rating?: number | string;
}

/* -------------------------------------------------
 2. Page component
 ------------------------------------------------- */
export default function NewRatingPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Rating";
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
            name: "rating",
            label: "Rating",
            type: "Data", // or "Int"/"Float"/"Rating" depending on your DynamicFormComponent
            required: true,
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
        rating: data.rating,
      };

      const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, payload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      });

      toast.success("Rating created successfully!");

      // Navigate to the newly created record using rating value or name
      const ratingValue = response.data.data.rating;
      const docName = response.data.data.name;
      const navigationId = ratingValue ? String(ratingValue) : docName;
      router.push(`/lis-management/doctype/rating/${navigationId}`);

    } catch (err: any) {
      console.error("Create error:", err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Failed to create Rating. Check console for details.";
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
      description="Create a new rating"
      submitLabel={isSaving ? "Saving..." : "New Rating"}
      cancelLabel="Cancel"
    />
  );
}