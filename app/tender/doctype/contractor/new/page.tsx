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

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/* -------------------------------------------------
 1. Contractor Data Interface
 ------------------------------------------------- */
interface ContractorData {
  name?: string;
  contractor_name?: string;
  supplier_group?: string;
  supplier_type?: string;
  address_title?: string;
  address?: string;
  address_type?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  email_address?: string;
  phone?: string;
  custom_contractor_company?: string;
  custom_gst?: string;
  custom_pan?: string;
  custom_aadhar_no?: string;
  modified?: string;
  docstatus?: 0 | 1 | 2;
}

/* -------------------------------------------------
 2. Page Component
 ------------------------------------------------- */
export default function NewContractorPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Contractor";
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
  3. Form Configuration
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    return [
      {
        name: "Details",
        fields: [
          // --- Main Section ---
          {
            name: "custom_contractor_company",
            label: "Firm/Company Name",
            type: "Data",
            required: true,
          },
          {
            name: "contractor_name",
            label: "Contractor Name",
            type: "Data",
            required: true,
          },
          {
            name: "supplier_group",
            label: "Contractor Group",
            type: "Link",
            linkTarget: "Supplier Group",
          },

          {
            name: "supplier_type",
            label: "Contractor Type",
            type: "Select",
            options: "Company\nIndividual\nPartnership",
            defaultValue: "Company",
          },

          // --- Address and Contact Section ---
          {
            name: "address_and_contact_section",
            label: "Address and Contact",
            type: "Section Break",
          },

          {
            name: "address_type",
            label: "Address Type",
            type: "Select",
            options: "Current\nPermanent",
          },
          {
            name: "city",
            label: "City",
            type: "Data",
          },
          {
            name: "country",
            label: "Country",
            type: "Link",
            linkTarget: "Country",
          },
          {
            name: "postal_code",
            label: "Postal Code",
            type: "Data",
          },

          {
            name: "email_address",
            label: "Email Address",
            type: "Data",
            required: true,
          },
          {
            name: "phone",
            label: "Phone",
            type: "Data",
            required: true,
          },
          {
            name: "custom_gst",
            label: "GST No.",
            type: "Data",
          },
          {
            name: "custom_pan",
            label: "PAN No.",
            type: "Data",
          },
          {
            name: "custom_aadhaar_no",
            label: "Aadhaar No.",
            type: "Data",
          },
          {
            name: "address",
            label: "Address",
            type: "Long Text",
            required: true,
          },
        ],
      },
    ];
  }, []);

  /* -------------------------------------------------
  4. Submit Handler
  ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
      toast.error("Authentication required. Please log in.", { duration: Infinity });
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = JSON.parse(JSON.stringify(data));

      // Clean payload: remove non-data fields (Section Break, Column Break, etc.)
      const nonDataFields = new Set<string>();
      formTabs.forEach((tab) => {
        tab.fields.forEach((field) => {
          if (
            field.type === "Section Break" ||
            field.type === "Column Break" ||
            field.type === "Button" ||
            field.type === "Read Only"
          ) {
            nonDataFields.add(field.name);
          }
        });
      });

      const finalPayload: Record<string, any> = {};
      for (const key in payload) {
        if (!nonDataFields.has(key)) {
          finalPayload[key] = payload[key];
        }
      }

      console.log("Sending Payload:", finalPayload);

      const response = await axios.post(
        `${API_BASE_URL}/${doctypeName}`,
        finalPayload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("Contractor created successfully!");

      // Navigate to the created record using contractor_name or name
      const contractorName = response.data.data.contractor_name;
      const docName = response.data.data.name;
      const navigationId = contractorName || docName;

      router.push(`/tender/doctype/contractor/${encodeURIComponent(navigationId)}`);
    } catch (err: any) {
      console.error("Create error:", err);
      const serverData = err.response?.data;
      const serverMessage =
        serverData?.exception ||
        serverData?._server_messages ||
        err.message ||
        "Failed to create Contractor";

      toast.error("Failed to create Contractor", {
        description: serverMessage,
        duration: Infinity
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
  5. Render Form
  ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title={`New ${doctypeName}`}
      description="Register a new contractor"
      submitLabel={isSaving ? "Saving..." : "Create Contractor"}
      cancelLabel="Cancel"
    />
  );
}