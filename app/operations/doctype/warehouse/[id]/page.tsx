// app/operations/doctype/warehouse/[id]/page.tsx
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

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

interface WarehouseData {
  name: string;
  is_group?: 0 | 1;
  parent_warehouse?: string;
  company: string;
  warehouse_type?: string;
  account?: string;

  // Meta fields (needed for update)
  docstatus: 0 | 1 | 2;
  modified: string;
  owner?: string;
  modified_by?: string;
}

export default function WarehouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = params.id as string;
  const doctypeName = "Warehouse";

  const [warehouse, setWarehouse] = React.useState<WarehouseData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // ── ALL HOOKS FIRST ───────────────────────────────────────────────────

  React.useEffect(() => {
    const fetchWarehouse = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const resp = await axios.get(`${API_BASE_URL}/${doctypeName}/${docname}`, {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
          },
          withCredentials: true,
        });

        setWarehouse(resp.data.data);
      } catch (err: any) {
        console.error("API Error:", err);
        setError(
          err.response?.status === 404
            ? "Warehouse not found"
            : err.response?.status === 403
              ? "Unauthorized"
              : "Failed to load warehouse"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchWarehouse();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!warehouse) return [];

    // Helper to auto-populate existing data into the fields
    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in warehouse
            ? // @ts-ignore
            warehouse[f.name as keyof WarehouseData]
            : f.defaultValue,
      }));

    return [
      // TAB 1: CORE DETAILS (Combines General, Operations, and Accounting)
      {
        name: "Core Details",
        fields: fields([
          // -- Section: General Information --
          {
            name: "company",
            label: "Company",
            type: "Link",
            required: true,
            linkTarget: "Company",
          },
          {
            name: "parent_warehouse",
            label: "Parent Warehouse",
            type: "Link",
            linkTarget: "Warehouse",
          },
          {
            name: "is_group",
            label: "Is Group Warehouse",
            type: "Check",
          },
          {
            name: "disabled",
            label: "Disabled",
            type: "Check",
          },

          // -- Section: Operations & Transit --
          {
            name: "warehouse_type",
            label: "Warehouse Type",
            type: "Link",
            linkTarget: "Warehouse Type",
            description: "Used for transit operations (e.g., Transit, Sub-Contracted)."
          },
          {
            name: "default_in_transit_warehouse",
            label: "Default In-Transit Warehouse",
            type: "Link",
            linkTarget: "Warehouse",
          },
          {
            name: "is_rejected_warehouse",
            label: "Is Rejected Warehouse",
            type: "Check",
            description: "Check if used exclusively for storing rejected materials."
          },

          // -- Section: Accounting --
          // -- Section: Accounting --
          {
            name: "account",
            label: "Linked Account",
            type: "Link",
            linkTarget: "Account",
            // EXACT FRAPPE FILTER:
            filters: (getValue) => ({
              is_group: 0, // Must be a Ledger account, not a Group
              account_type: "Stock", // Must be a Stock account
              company: warehouse?.company // Must belong to the current company
            }),
            description: "Financial ledger account (Filtered by current Company)."
          },
          {
            name: "customer",
            label: "Linked Customer",
            type: "Link",
            linkTarget: "Customer",
            description: "Only used for Subcontracting Inward."
          },
        ]),
      },

      // TAB 2: ADDRESS & CONTACT (Combines Location and Reachability)
      {
        name: "Address & Contact",
        fields: fields([
          // -- Section: Address --
          {
            name: "address_line_1",
            label: "Address Line 1",
            type: "Data"
          },
          {
            name: "address_line_2",
            label: "Address Line 2",
            type: "Data"
          },
          {
            name: "city",
            label: "City",
            type: "Data"
          },
          {
            name: "state",
            label: "State/Province",
            type: "Data"
          },
          {
            name: "pin",
            label: "PIN",
            type: "Data"
          },

          // -- Section: Contact --
          {
            name: "email_id",
            label: "Email Address",
            type: "Data"
          },
          {
            name: "phone_no",
            label: "Phone No",
            type: "Data"
          },
          {
            name: "mobile_no",
            label: "Mobile No",
            type: "Data"
          },
        ]),
      }
    ];
  }, [warehouse]);

  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = { ...data };

      // Convert boolean to ERPNext format (0/1)
      if ("is_group" in payload) {
        payload.is_group = payload.is_group ? 1 : 0;
      }

      // Required meta fields for update
      if (!warehouse) throw new Error("Warehouse data not loaded");
      payload.modified = warehouse.modified;
      payload.docstatus = warehouse.docstatus;

      console.log("Sending payload:", payload);

      const resp = await axios.put(
        `${API_BASE_URL}/${doctypeName}/${docname}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("Warehouse updated successfully!");

      if (resp.data?.data) {
        setWarehouse(resp.data.data);
      }

      router.push(`/operations/doctype/warehouse/${encodeURIComponent(docname)}`);
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Failed to save warehouse", {
        description: err.message || "Check console for details",
        duration: Infinity
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  // ── RENDERING ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="module active p-8 text-center">Loading warehouse details...</div>
    );
  }

  if (error) {
    return (
      <div className="module active p-8">
        <p className="text-red-600">{error}</p>
        <button
          className="btn btn--primary mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!warehouse) {
    return <div className="module active p-8">Warehouse not found.</div>;
  }

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={`${doctypeName}: ${warehouse.name}`}
        description={`Update basic warehouse information`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/operations/doctype/warehouse"
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
          currentUserEmail={warehouse.owner}
          modifiedStr={warehouse.modified}
          modifiedBy={warehouse.modified_by}
        />
      </div>
    </div>
  );
}