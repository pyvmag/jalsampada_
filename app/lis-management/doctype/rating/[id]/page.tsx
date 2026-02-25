"use client";

import * as React from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
  FormField,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import DocumentActivity from "@/components/DocumentActivity";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.1.138:4412//api/resource";

/* -------------------------------------------------
 1. Rating data type
 ------------------------------------------------- */
interface RatingData {
  name: string;
  rating: number | string; // adjust type based on your DocType
  modified: string;
  owner?: string;
  modified_by?: string;
}

/* -------------------------------------------------
 2. Page component
 ------------------------------------------------- */
export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = params.id as string;
  const doctypeName = "Rating";

  const [ratingDoc, setRatingDoc] = React.useState<RatingData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
   3. FETCH Rating
   ------------------------------------------------- */
  React.useEffect(() => {
    const fetchRating = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const resp = await axios.get(`${API_BASE_URL}/${doctypeName}/${docname}`, {
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
          withCredentials: true,
        });

        setRatingDoc(resp.data.data as RatingData);
      } catch (err: any) {
        console.error("API Error:", err);
        setError(
          err.response?.status === 404
            ? `${doctypeName} not found`
            : err.response?.status === 403
              ? "Unauthorized"
              : `Failed to load ${doctypeName}`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRating();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  /* -------------------------------------------------
   4. Build tabs
   ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!ratingDoc) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in ratingDoc
            ? // @ts-ignore
            ratingDoc[f.name as keyof RatingData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "rating",
            label: "Rating",
            type: "Data", // or "Int"/"Float"/"Rating" depending on your DynamicFormComponent
            required: true,
          }
        ]),
      },
    ];
  }, [ratingDoc]);

  /* -------------------------------------------------
   5. SUBMIT
   ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>) => {
    setIsSaving(true);
    try {
      const payload = {
        rating: data.rating,
      };

      await axios.put(`${API_BASE_URL}/${doctypeName}/${docname}`, payload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      });

      toast.success("Changes saved successfully!");
      const ratingValue = ratingDoc?.rating;
      const docName = ratingDoc?.name;
      const navigationId = ratingValue ? String(ratingValue) : docName;
      if (navigationId) {
        router.push(`/lis-management/doctype/rating/${navigationId}`);
      } else {
        router.push(`/lis-management/doctype/rating`);
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save. Check console for details.", { duration: Infinity });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
   6. UI STATES
   ------------------------------------------------- */
  if (loading) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading {doctypeName} details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        <p style={{ color: "var(--color-error)" }}>{error}</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (!ratingDoc) {
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        <p>{doctypeName} not found.</p>
      </div>
    );
  }

  /* -------------------------------------------------
   7. RENDER FORM
   ------------------------------------------------- */
  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={` ${doctypeName}: ${ratingDoc.rating}`}
        description={`Update details for record ID: ${docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/lis-management/doctype/rating"
        }}
      />

      <div className="w-full px-4 md:px-8">
        <DocumentActivity
          doctype={doctypeName}
          docname={docname}
          baseUrl={API_BASE_URL.replace("/api/resource", "")}
          apiKey={apiKey || ""}
          apiSecret={apiSecret || ""}
          isInitialized={isInitialized}
          currentUserEmail={ratingDoc.owner}
          modifiedStr={ratingDoc.modified}
          modifiedBy={ratingDoc.modified_by}
        />
      </div>
    </div>
  );
}
