"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

export default function NewWarehousePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  const doctypeName = "Warehouse";

  // Parse duplicate data from URL parameters
  const duplicateData = React.useMemo(() => {
    const duplicateParam = searchParams.get('duplicate');
    if (!duplicateParam) return null;

    try {
      const decodedData = JSON.parse(atob(decodeURIComponent(duplicateParam)));
      console.log("Parsed duplicate data:", decodedData);
      return decodedData;
    } catch (error) {
      console.error("Error parsing duplicate data:", error);
      toast.error("Failed to parse duplicate data", { duration: Infinity });
      return null;
    }
  }, [searchParams]);

  // Show notification if we have duplicate data (only once)
  const notificationShown = React.useRef(false);
  React.useEffect(() => {
    if (duplicateData && !notificationShown.current) {
      toast.success("Form populated with duplicate data. Modify as needed and save.");
      notificationShown.current = true;
    }
  }, [duplicateData]);

  /* -------------------------------------------------
     1. Define the form structure (Reduced to 2 Tabs)
     ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    const getValue = (fieldName: string, defaultValue: any = undefined) => {
      return duplicateData?.[fieldName] ?? defaultValue;
    };

    return [
      // TAB 1: CORE DETAILS (Identity -> Operations -> Accounting)
      {
        name: "Core Details",
        fields: [
          // -- Section: Identity & Hierarchy --
          {
            name: "warehouse_name",
            label: "Store Location Name",
            type: "Data",
            required: true,
            defaultValue: getValue("warehouse_name"),
            description: "Name of the new warehouse/store location"
          },
          {
            name: "company",
            label: "Company",
            type: "Link",
            required: true,
            linkTarget: "Company",
            defaultValue: getValue("company"),
          },
          {
            name: "parent_warehouse",
            label: "Parent Warehouse",
            type: "Link",
            linkTarget: "Warehouse",
            defaultValue: getValue("parent_warehouse"),
          },
          {
            name: "is_group",
            label: "Is Group Warehouse",
            type: "Check",
            defaultValue: getValue("is_group", 0),
          },
          {
            name: "disabled",
            label: "Disabled",
            type: "Check",
            defaultValue: getValue("disabled", 0),
          },

          // -- Section: Operations & Transit --
          {
            name: "warehouse_type",
            label: "Warehouse Type",
            type: "Link",
            linkTarget: "Warehouse Type",
            defaultValue: getValue("warehouse_type"),
            description: "Used for transit operations (e.g., Transit, Sub-Contracted)."
          },
          {
            name: "default_in_transit_warehouse",
            label: "Default In-Transit Warehouse",
            type: "Link",
            linkTarget: "Warehouse",
            defaultValue: getValue("default_in_transit_warehouse"),
          },
          {
            name: "is_rejected_warehouse",
            label: "Is Rejected Warehouse",
            type: "Check",
            defaultValue: getValue("is_rejected_warehouse", 0),
            description: "Check if used exclusively for storing rejected materials"
          },

          // -- Section: Accounting --
          {
            name: "account",
            label: "Linked Account",
            type: "Link",
            linkTarget: "Account",
            defaultValue: getValue("account"),
            description: "Financial ledger account (Filtered by current Company)",
            // Advanced dynamic filtering based on selected company
            customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
            customSearchParams: {
              filters: {
                is_group: 0,
                account_type: "Stock"
              }
            },
            filters: (getValue) => {
              const company = getValue("company");
              const filters: Record<string, any> = {
                is_group: 0,
                account_type: "Stock"
              };
              if (company) {
                filters.company = company;
              }
              return filters;
            },
            referenceDoctype: "Warehouse",
            doctype: "Account",
          },
          {
            name: "customer",
            label: "Linked Customer",
            type: "Link",
            linkTarget: "Customer",
            defaultValue: getValue("customer"),
            description: "Only used for Subcontracting Inward."
          },
        ],
      },

      // TAB 2: ADDRESS & CONTACT (Location -> Reachability)
      {
        name: "Address & Contact",
        fields: [
          // -- Section: Address --
          { name: "address_line_1", label: "Address Line 1", type: "Data", defaultValue: getValue("address_line_1") },
          { name: "address_line_2", label: "Address Line 2", type: "Data", defaultValue: getValue("address_line_2") },
          { name: "city", label: "City", type: "Data", defaultValue: getValue("city") },
          { name: "state", label: "State/Province", type: "Data", defaultValue: getValue("state") },
          { name: "pin", label: "PIN", type: "Data", defaultValue: getValue("pin") },

          // -- Section: Contact --
          { name: "email_id", label: "Email Address", type: "Data", defaultValue: getValue("email_id") },
          { name: "phone_no", label: "Phone No", type: "Data", defaultValue: getValue("phone_no") },
          { name: "mobile_no", label: "Mobile No", type: "Data", defaultValue: getValue("mobile_no") },
        ],
      }
    ];
  }, [duplicateData]);

  /* -------------------------------------------------
     2. SUBMIT (Create)
     ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    // Check if we have valid data to submit
    const hasValidData = isDirty || (duplicateData && data.warehouse_name);

    if (!hasValidData) {
      toast.info("Please fill out the form.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = { ...data };
      payload.doctype = doctypeName;

      // Convert boolean to ERPNext format (0/1)
      if ("is_group" in payload) {
        payload.is_group = payload.is_group ? 1 : 0;
      }
      if ("disabled" in payload) {
        payload.disabled = payload.disabled ? 1 : 0;
      }
      if ("is_rejected_warehouse" in payload) {
        payload.is_rejected_warehouse = payload.is_rejected_warehouse ? 1 : 0;
      }

      console.log("Sending NEW Warehouse payload:", payload);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `token ${apiKey}:${apiSecret}`,
      };

      const storedCsrfToken = localStorage.getItem('csrfToken');
      if (storedCsrfToken) {
        headers['X-Frappe-CSRF-Token'] = storedCsrfToken;
      }

      const resp = await fetch(`${API_BASE_URL}/${doctypeName}`, {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const responseData = await resp.json();

      if (!resp.ok) {
        console.log("Full server error:", responseData);
        throw new Error(responseData.exception || responseData._server_messages || "Failed to create document");
      }

      toast.success("Warehouse created successfully!");

      router.push(`/operations/doctype/warehouse`);

    } catch (err: any) {
      console.error("Save error:", err);

      if (err.response?.data?.exc_type === "DuplicateEntryError") {
        toast.error("Duplicate Entry Error", {
          description: "A Warehouse with this name already exists.",
          duration: Infinity
        });
      } else {
        toast.error("Failed to create Warehouse", {
          description: err.message || "Check console for details.",
          duration: Infinity
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
     3. RENDER FORM
     ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title="New Warehouse"
      description="Create a new Warehouse record"
      submitLabel={isSaving ? "Saving..." : "Create"}
      cancelLabel="Cancel"
    />
  );
}