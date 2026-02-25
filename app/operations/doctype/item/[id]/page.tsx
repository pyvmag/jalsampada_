// app/operations/doctype/item/[id]/page.tsx
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

interface ItemData {
  name: string;
  item_code: string;
  item_name: string;
  item_group: string;
  stock_uom: string;
  is_stock_item?: 0 | 1;
  disabled?: 0 | 1;
  is_fixed_asset?: 0 | 1;

  // Meta fields (needed for update)
  docstatus: 0 | 1 | 2;
  modified: string;
  owner?: string;
  modified_by?: string;
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = params.id as string;
  const doctypeName = "Item";

  const [item, setItem] = React.useState<ItemData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // ── ALL HOOKS FIRST ───────────────────────────────────────────────────

  React.useEffect(() => {
    const fetchItem = async () => {
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

        setItem(resp.data.data);
      } catch (err: any) {
        console.error("API Error:", err);
        setError(
          err.response?.status === 404
            ? "Item not found"
            : err.response?.status === 403
              ? "Unauthorized"
              : "Failed to load item"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!item) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in item
            ? // @ts-ignore
            item[f.name as keyof ItemData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Basic Information",
        fields: fields([
          {
            name: "item_code",
            label: "Item Code",
            type: "Data",
            required: true,
          },
          {
            name: "item_name",
            label: "Item Name",
            type: "Data",
            required: true,
          },
          {
            name: "item_group",
            label: "Item Group",
            type: "Link",
            required: true,
            linkTarget: "Item Group",
          },
          {
            name: "stock_uom",
            label: "Default Unit of Measure",
            type: "Link",
            required: true,
            linkTarget: "UOM",
          },
          {
            name: "is_stock_item",
            label: "Maintain Stock",
            type: "Check",
          },
          {
            name: "disabled",
            label: "Disabled",
            type: "Check",
          },
          {
            name: "is_fixed_asset",
            label: "Is Fixed Asset",
            type: "Check",
          },
        ]),
      },
    ];
  }, [item]);

  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = { ...data };

      // Convert booleans to ERPNext format (0/1)
      const boolFields = ["is_stock_item", "disabled", "is_fixed_asset"];
      boolFields.forEach((f) => {
        if (f in payload) {
          payload[f] = payload[f] ? 1 : 0;
        }
      });

      // Required meta fields for update
      if (!item) throw new Error("Item data not loaded");
      payload.modified = item.modified;
      payload.docstatus = item.docstatus;

      // Skip naming_series if it exists (usually not editable after creation)
      delete payload.naming_series;

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

      toast.success("Item updated successfully!");

      if (resp.data?.data) {
        setItem(resp.data.data);
      }

      router.push(`/operations/doctype/item/${encodeURIComponent(docname)}`);
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Failed to save item", {
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
      <div className="module active p-8 text-center">Loading item details...</div>
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

  if (!item) {
    return <div className="module active p-8">Item not found.</div>;
  }

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={`${doctypeName}: ${item.item_code || item.name}`}
        description={`Update basic information for item ${item.item_code || docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/operations/doctype/item"
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
          currentUserEmail={item.owner}
          modifiedStr={item.modified}
          modifiedBy={item.modified_by}
        />
      </div>
    </div>
  );
}