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
import { toast } from "sonner";
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.3.169:2223//api/resource";

interface AssetCategoryData {
  name: string;
  asset_category_name?: string; // Frappe often has a 'asset_category_name' field
  custom_specifications?: Array<{ // The child table
    specification_type: string;
    details: string;
  }>;
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
  const doctypeName = "Asset Category"; // <-- CHANGED

  const [category, setCategory] = React.useState<AssetCategoryData | null>(null); // <-- CHANGED
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
  3. FETCH CATEGORY
  ------------------------------------------------- */
  React.useEffect(() => {
    const fetchCategory = async () => {
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

        setCategory(resp.data.data);
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

    fetchCategory();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  /* -------------------------------------------------
  4. Build tabs **once** when data is ready
  ------------------------------------------------- */
  // Updated tabs based on your fields
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!category) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in category
            ? // @ts-ignore
            category[f.name as keyof AssetCategoryData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          { name: "asset_category_name", label: "Category Name", type: "Data", required: true, defaultValue: category.name },
          {
            name: "custom_specifications", // This is the field name for the child table
            label: "Specifications",
            type: "Table",
            showDownloadUpload: true,
            columns: [
              { name: "specification_type", label: "Specification Type", type: "Link", linkTarget: "Specifications" },
              { name: "details", label: "Details", type: "Text" },
            ],
          },
          // { name: "name", label: "Category ID (Read Only)", type: "Read Only", readOnlyValue: category.name },
        ]),
      },
    ];
  }, [category]);

  /* -------------------------------------------------
  5. SUBMIT
  ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>) => {
    setIsSaving(true);
    try {
      const payload = { ...data };

      // Ensure 'name' isn't overwritten if it's not the editable field
      // If 'category_name' is your main field, 'name' might be read-only
      // This submit handler assumes the form data is correct

      await axios.put(`${API_BASE_URL}/${doctypeName}/${docname}`, payload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      });

      toast.success("Changes saved successfully!");
      const categoryName = category?.asset_category_name || category?.name;
      if (categoryName) {
        router.push(`/lis-management/doctype/asset-category/${categoryName}`);
      } else {
        router.push(`/lis-management/doctype/asset-category`);
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
  5. DUPLICATE FUNCTIONALITY (Shift+D)
  ------------------------------------------------- */
  const handleDuplicate = React.useCallback(() => {
    if (!category) {
      toast.error("Asset Category data not loaded. Cannot duplicate.", { duration: Infinity });
      return;
    }

    // Prepare data for duplication - exclude fields that should not be copied
    const duplicateData: Record<string, any> = {};

    // Fields to exclude from duplication
    const excludeFields = [
      'name', 'naming_series', 'docstatus', 'modified', 'creation',
      'owner', 'modified_by', 'idx'
    ];

    // Copy all other fields
    Object.keys(category).forEach(key => {
      if (!excludeFields.includes(key) && category[key as keyof AssetCategoryData] !== undefined) {
        duplicateData[key] = category[key as keyof AssetCategoryData];
      }
    });

    // Encode the data for URL transmission
    const encodedData = btoa(JSON.stringify(duplicateData));

    // Navigate to new page with duplicate data
    router.push(`/lis-management/doctype/asset-category/new?duplicate=${encodeURIComponent(encodedData)}`);

    toast.success("Asset Category data copied! Creating duplicate...");
  }, [category, router]);

  // Add keyboard event listener for Shift+D
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key === 'D') {
        event.preventDefault();
        handleDuplicate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDuplicate]);

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

  if (!category) {
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
        title={`${doctypeName}: ${category.name}`}
        description={`Update details for record ID: ${docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/lis-management/doctype/asset-category"
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
          currentUserEmail={category.owner}
          modifiedStr={category.modified}
          modifiedBy={category.modified_by}
        />
      </div>
    </div>
  );
}
