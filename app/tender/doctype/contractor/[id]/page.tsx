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
import { getApiMessages } from "@/lib/utils";
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

interface ContractorData {
  name: string;
  contractor_name: string;
  supplier_group: string;
  supplier_type: string;
  address_title: string;
  address: string;
  address_type: string;
  city: string;
  postal_code: string;
  country: string;
  email_address: string;
  phone: string;
  custom_contractor_company?: string;
  custom_gst?: string;
  custom_pan?: string;
  custom_aadhar_no?: string;
  docstatus: 0 | 1 | 2;
  owner?: string;
  modified?: string;
  modified_by?: string;
}

export default function ContractorDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const recordId = resolvedParams.id as string;

  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Contractor";

  const [data, setData] = React.useState<ContractorData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  /* -------------------------------------------------
   1. Fetch Data
  ------------------------------------------------- */
  const fetchData = React.useCallback(async () => {
    if (!isInitialized) return;
    if (!isAuthenticated || !apiKey || !apiSecret) {
      toast.error("Authentication required");
      router.push("/login");
      return;
    }

    try {
      setLoading(true);
      const url = `${API_BASE_URL}/${doctypeName}/${decodeURIComponent(recordId)}`;
      const response = await axios.get(url, {
        headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        withCredentials: true,
      });

      setData(response.data.data);
    } catch (err: any) {
      console.error("Fetch error:", err);
      toast.error("Failed to load Contractor details");
      router.push("/tender/doctype/contractor");
    } finally {
      setLoading(false);
    }
  }, [
    recordId,
    doctypeName,
    apiKey,
    apiSecret,
    isAuthenticated,
    isInitialized,
    router,
  ]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* -------------------------------------------------
   2. Form Configuration
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!data) return [];

    const withDefaults = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in data
            ? // @ts-ignore
            data[f.name as keyof ContractorData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: withDefaults([
          {
            name: "custom_contractor_company",
            label: "Firm/Company Name",
            type: "Data",
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
        ]),
      },
    ];
  }, [data]);

  /* -------------------------------------------------
   3. Update Handler
  ------------------------------------------------- */
  const handleUpdate = async (formData: Record<string, any>) => {
    if (!apiKey || !apiSecret) return;

    setIsSaving(true);
    try {
      const payload: Record<string, any> = JSON.parse(JSON.stringify(formData));
      const nonDataFields = new Set([
        "address_and_contact_section",
        "column_break_nkmc",
        "column_break_jfzy",
        "column_break_ohij",
      ]);

      const finalPayload: Record<string, any> = {};
      for (const key in payload) {
        if (!nonDataFields.has(key)) {
          finalPayload[key] = payload[key];
        }
      }

      const url = `${API_BASE_URL}/${doctypeName}/${decodeURIComponent(recordId)}`;
      const response = await axios.put(url, finalPayload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      });

      const messages = getApiMessages(response, null, "Contractor updated!", "Failed to update Contractor");
      if (messages.success) {
        toast.success(messages.message);
        fetchData();
      } else {
        toast.error(messages.message);
      }
    } catch (err: any) {
      toast.error("Failed to update Contractor");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (formData: Record<string, any>) => {
    await handleUpdate(formData);
  };

  const handleCancel = () => {
    router.push("/tender/doctype/contractor");
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this contractor?")) return;

    setIsDeleting(true);
    try {
      const url = `${API_BASE_URL}/${doctypeName}/${decodeURIComponent(recordId)}`;
      await axios.delete(url, {
        headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        withCredentials: true,
      });

      toast.success("Contractor deleted");
      router.push("/tender/doctype/contractor");
    } catch (err: any) {
      toast.error("Failed to delete Contractor");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading details...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Record not found</div>;

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onDelete={handleDelete}
        title={`${doctypeName}: ${data.name}`}
        description={`Update details for record ID ${recordId}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
      />

      <div className="w-full px-4 md:px-8">
        <DocumentActivity
          doctype={doctypeName}
          docname={recordId}
          baseUrl={API_BASE_URL}
          apiKey={apiKey || ""}
          apiSecret={apiSecret || ""}
          isInitialized={isInitialized}
          currentUserEmail={data.owner}
          modifiedStr={data.modified}
          modifiedBy={data.modified_by}
        />
      </div>
    </div>
  );
}