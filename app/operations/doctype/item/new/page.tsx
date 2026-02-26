"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223"; // 🟢 Base URL (no /api/resource for uploads)

export default function NewItemPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  const doctypeName = "Item";

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
     1. Helper: Upload File
     ------------------------------------------------- */
  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("is_private", "0"); // Item images are usually public
      // formData.append("doctype", "Item"); // Optional: Link to doctype if needed

      const res = await fetch(`${API_BASE_URL}/api/method/upload_file`, {
        method: "POST",
        headers: {
          'Authorization': `token ${apiKey}:${apiSecret}`,
          // Note: Do NOT set Content-Type here; browser sets it for FormData
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "File upload failed");
      }

      // Frappe returns { message: { file_url: "..." } }
      return data.message?.file_url || null;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image. Item creation aborted.", { duration: Infinity });
      throw error;
    }
  };

  /* -------------------------------------------------
     2. Define the form structure
     ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    // Helper function to get value from duplicate data or fallback to default
    const getValue = (fieldName: string, defaultValue: any = undefined) => {
      return duplicateData?.[fieldName] ?? defaultValue;
    };

    return [
      {
        name: "Basic Information",
        fields: [
          {
            name: "item_code",
            label: "Item Code",
            type: "Data",
            required: true,
            defaultValue: getValue("item_code"),
          },
          {
            name: "item_name",
            label: "Item Name",
            type: "Data",
            required: true,
            defaultValue: getValue("item_name"),
          },
          {
            name: "item_group",
            label: "Item Group",
            type: "Link",
            required: true,
            linkTarget: "Item Group",
            defaultValue: getValue("item_group"),
          },
          {
            name: "stock_uom",
            label: "Default Unit of Measure",
            type: "Link",
            required: true,
            linkTarget: "UOM",
            defaultValue: getValue("stock_uom"),
          },
          // 🟢 Image Upload
          {
            name: "image",
            label: "Item Image",
            type: "Attach Image", // Use "Attach Image" now that it is supported
            description: "Upload an image for this item",
            defaultValue: getValue("image"),
          },
          {
            name: "is_stock_item",
            label: "Maintain Stock",
            type: "Check",
            defaultValue: getValue("is_stock_item", 1),
          },
          {
            name: "disabled",
            label: "Disabled",
            type: "Check",
            defaultValue: getValue("disabled", 0),
          },
          {
            name: "is_fixed_asset",
            label: "Is Fixed Asset",
            type: "Check",
            defaultValue: getValue("is_fixed_asset", 0),
          },
        ],
      },
    ];
  }, [duplicateData]);

  /* -------------------------------------------------
     3. SUBMIT (Create)
     ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    // Check if we have valid data to submit
    const hasValidData = isDirty || (duplicateData && data.item_code);

    if (!hasValidData) {
      toast.info("Please fill out the form.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = { ...data };

      // 🟢 Handle Image Upload Logic
      if (payload.image instanceof File) {
        toast.info("Uploading image...");
        const fileUrl = await uploadFile(payload.image);
        if (fileUrl) {
          payload.image = fileUrl; // Replace File object with URL string
        } else {
          // If upload returned null but no error thrown, remove field to avoid error
          delete payload.image;
        }
      } else if (typeof payload.image !== 'string') {
        // If it's some other object (or null), remove it to prevent "dict" error
        delete payload.image;
      }

      // Ensure DocType is set
      payload.doctype = doctypeName;

      // Convert booleans to ERPNext format (0/1)
      const boolFields = ["is_stock_item", "disabled", "is_fixed_asset"];
      boolFields.forEach((f) => {
        if (f in payload) {
          payload[f] = payload[f] ? 1 : 0;
        }
      });

      console.log("Sending NEW Item payload:", payload);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `token ${apiKey}:${apiSecret}`,
      };

      const storedCsrfToken = localStorage.getItem('csrfToken');
      if (storedCsrfToken) {
        headers['X-Frappe-CSRF-Token'] = storedCsrfToken;
      }

      const resp = await fetch(`${API_BASE_URL}/api/resource/${doctypeName}`, {
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

      toast.success("Item created successfully!");

      router.push(`/operations/doctype/item`);

    } catch (err: any) {
      console.error("Save error:", err);

      if (err.response?.data?.exc_type === "DuplicateEntryError") {
        toast.error("Duplicate Entry Error", {
          description: "An Item with this Item Code already exists.",
          duration: Infinity
        });
      } else {
        toast.error("Failed to create Item", {
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
     4. RENDER FORM
     ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title="New Item"
      description="Create a new Item record"
      submitLabel={isSaving ? "Saving..." : "Create"}
      cancelLabel="Cancel"
    />
  );
}