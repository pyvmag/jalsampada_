"use client";

import * as React from "react";
// import axios from "axios"; // No longer need axios
import { useParams, useRouter } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
  FormField,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import DocumentActivity from "@/components/DocumentActivity";
import { toast } from "sonner";

// --- FIX #1: Define the API_BASE_URL ---
const API_BASE_URL = "http://103.219.3.169:2223//api/resource";

/* -------------------------------------------------
 1. LIS Data type
 ------------------------------------------------- */
interface LisData {
  name: string;
  lis_name: string;
  modified: string;
  docstatus: 0 | 1 | 2;
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
  const doctypeName = "Lift Irrigation Scheme";

  const [scheme, setScheme] = React.useState<LisData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
  3. FETCH LIS (using fetch)
  ------------------------------------------------- */
  React.useEffect(() => {
    const fetchScheme = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // --- FIX #2: Use 'fetch' instead of 'axios' ---
        const headers: HeadersInit = {
          'Authorization': `token ${apiKey}:${apiSecret}`,
        };

        const resp = await fetch(`${API_BASE_URL}/${doctypeName}/${docname}`, {
          method: 'GET',
          headers: headers,
          credentials: 'include',
        });

        if (!resp.ok) {
          throw new Error(`Failed to load ${doctypeName}`);
        }

        const responseData = await resp.json();
        setScheme(responseData.data);
        // ------------------------------------------

      } catch (err: any) {
        console.error("API Error:", err);
        setError(
          err.status === 404
            ? `${doctypeName} not found`
            : err.status === 403
              ? "Unauthorized"
              : `Failed to load ${doctypeName}`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchScheme();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  /* -------------------------------------------------
  4. Build tabs
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!scheme) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in scheme
            ? // @ts-ignore
            scheme[f.name as keyof LisData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "lis_name",
            label: "Lift Irrigation Scheme Name",
            type: "Data",
            required: true
          },
        ]),
      },
    ];
  }, [scheme]);

  /* -------------------------------------------------
  5. SUBMIT (UPDATE - using fetch)
  ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {

    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    if (!scheme) {
      toast.error("Cannot save, data not loaded.", { duration: Infinity });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        lis_name: data.lis_name,
        modified: scheme.modified,
        docstatus: scheme.docstatus,
      };

      // --- FIX #3: Use 'fetch' with 'PUT' and CSRF Token ---
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `token ${apiKey}:${apiSecret}`,
      };

      const storedCsrfToken = localStorage.getItem('csrfToken');
      if (storedCsrfToken) {
        headers['X-Frappe-CSRF-Token'] = storedCsrfToken;
      }

      const resp = await fetch(`${API_BASE_URL}/${doctypeName}/${docname}`, {
        method: 'PUT',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const responseData = await resp.json();

      if (!resp.ok) {
        console.log("Full server error:", responseData);
        throw new Error(responseData.exception || responseData._server_messages || "Failed to save");
      }
      // -------------------------------------------------

      toast.success("Changes saved!");

      if (responseData && responseData.data) {
        setScheme(responseData.data);
      }

      router.push(`/lis-management/doctype/lift-irrigation-scheme/${docname}`);

    } catch (err: any) {
      console.error("Save error:", err);
      console.log("Full server error:", err.message);
      toast.error("Failed to save", {
        description: (err as Error).message || "Check console for details.",
        duration: Infinity
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
  6. DUPLICATE FUNCTIONALITY (Shift+D)
  ------------------------------------------------- */
  const handleDuplicate = React.useCallback(() => {
    if (!scheme) {
      toast.error("Lift Irrigation Scheme data not loaded. Cannot duplicate.", { duration: Infinity });
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
    Object.keys(scheme).forEach(key => {
      if (!excludeFields.includes(key) && scheme[key as keyof LisData] !== undefined) {
        duplicateData[key] = scheme[key as keyof LisData];
      }
    });

    // Encode the data for URL transmission
    const encodedData = btoa(JSON.stringify(duplicateData));

    // Navigate to new page with duplicate data
    router.push(`/lis-management/doctype/lift-irrigation-scheme/new?duplicate=${encodeURIComponent(encodedData)}`);

    toast.success("Lift Irrigation Scheme data copied! Creating duplicate...");
  }, [scheme, router]);

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

  if (!scheme) {
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
        title={` ${doctypeName}: ${scheme.lis_name}`}
        description={`Update details for record ID: ${docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/lis-management/doctype/lift-irrigation-scheme"
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
          currentUserEmail={scheme.owner}
          modifiedStr={scheme.modified}
          modifiedBy={scheme.modified_by}
        />
      </div>
    </div>
  );
}