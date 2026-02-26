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

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/* -------------------------------------------------
   1. Project/Tender data
------------------------------------------------- */

interface TenderProjectData {
  name?: string;
  modified?: string;
  docstatus?: 0 | 1 | 2;

  // Tender Details
  custom_fiscal_year?: string;
  custom_lis_name?: string;
  custom_prapan_suchi?: string;
  custom_tender_id?: string;
  custom_work_order?: string;
  custom_prapan_suchi_amount?: number | string;
  expected_start_date?: string;
  custom_tender_amount?: number | string;
  custom_tender_status?: string;
  custom_expected_date?: string;
  custom_is_extension?: 0 | 1;

  // Extension Child Table
  custom_tender_extension_history?: Array<{
    extension_count?: string;
    extension_upto?: string;
    sanction_letter?: string;
    attach?: string;
  }>;

  // Document tables
  custom_work_order_document?: Array<{
    name_of_document?: string;
    attachment?: string | File;
  }>;

  custom_related_documents?: Array<{
    name_of_document?: string;
    attachment?: string | File;
  }>;
  custom_contractor_name?: string;
  custom_aadhaar_no?: string;
}

interface FormData {
  [key: string]: any;
  custom_expected_date?: string;
}

/* -------------------------------------------------
   2. Helper: upload a file to Frappe
------------------------------------------------- */

async function uploadFile(
  file: File,
  apiKey: string,
  apiSecret: string,
  baseUrl: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("is_private", "0");

  const resp = await axios.post(`${baseUrl}/api/method/upload_file`, formData, {
    headers: {
      Authorization: `token ${apiKey}:${apiSecret}`,
    },
    withCredentials: true,
  });

  if (resp.data && resp.data.message && resp.data.message.file_url) {
    return resp.data.message.file_url;
  }
  throw new Error("Invalid response from file upload");
}

/* -------------------------------------------------
   3. Page component
------------------------------------------------- */

export default function NewTenderPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Project";
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
  4. Form tabs configuration
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    // Details tab (from Fields-1.csv) [file:6]
    const detailsFields: FormField[] = [
      {
        name: "custom_fiscal_year",
        label: "Fiscal Year",
        type: "Link",
        linkTarget: "Fiscal Year",
      },
      {
        name: "custom_lis_name",
        label: "LIS Name",
        type: "Link",
        linkTarget: "Lift Irrigation Scheme",
      },
      {
        name: "custom_prapan_suchi",
        label: "Name of Work",
        type: "Link",
        linkTarget: "Prapan Suchi",
        searchField: "work_name",
        filterMapping: [
          { sourceField: "custom_lis_name", targetField: "lis_name" },
          { sourceField: "custom_fiscal_year", targetField: "fiscal_year" },
        ]
      },
      {
        name: "custom_prapan_suchi_amount",
        label: "Prapan Suchi Amount",
        type: "Currency",
        fetchFrom: {
          sourceField: "custom_prapan_suchi",
          targetDoctype: "Prapan Suchi",
          targetField: "amount"
        }
      },
      {
        name: "custom_stage",
        label: "Stage/ Sub Scheme",
        type: "Table MultiSelect",
        linkTarget: "Stage No",
        filterMapping: [
          { sourceField: "lift_irrigation_scheme", targetField: "lis_name" }
        ],
        fetchFrom: {
          sourceField: "custom_prapan_suchi",
          targetDoctype: "Prapan Suchi",
          targetField: "stage"
        }
      },
      {
        name: "custom_tender_id",
        label: "Tender ID",
        type: "Data",
        required: true,
      },
      {
        name: "custom_tender_amount",
        label: "Tender Amount",
        type: "Currency",
        required: true,
      },

      {
        name: "custom_work_order",
        label: "Work Order",
        type: "Data",
      },
      {
        name: "expected_start_date",
        label: "Work Order Date",
        type: "Date",
      },
      {
        name: "custom_expected_date",
        label: "Scheduled Completion Date",
        type: "Date",
        required: true,
      },
      {
        name: "custom_tender_status",
        label: "Status",
        type: "Select",
        options: "Ongoing\nCompleted\nCancelled",
        defaultValue: "Ongoing",
      },
      {
        name: "custom_is_extension",
        label: "Is Extension",
        type: "Check",
        // This logic determines if field should be visible
        displayDependsOn: (data: FormData) => {
          if (!data.custom_expected_date) return false;

          const completionDate = new Date(data.custom_expected_date);
          const today = new Date();

          // Reset hours to compare purely by date
          today.setHours(0, 0, 0, 0);
          completionDate.setHours(0, 0, 0, 0);

          // Calculate difference in time and convert to days
          const diffInTime = completionDate.getTime() - today.getTime();
          const diffInDays = diffInTime / (1000 * 3600 * 24);

          // Visible only if date is within 2 days (today, tomorrow, or day after)
          // or if date has already passed.
          return diffInDays <= 2;
        },
        // Add onChange handler to auto-add first row when extension is toggled on
        onChange: (value: any, data: any, setFieldValue: any) => {
          if (value === 1 || value === true) {
            const currentRows = data.custom_tender_extension_history || [];
            // Only add if the table is currently empty to avoid overwriting user data
            if (currentRows.length === 0) {
              setFieldValue("custom_tender_extension_history", [
                {
                  extension_count: "01",
                  extension_upto: "",
                  sanction_letter: "",
                  attach: ""
                }
              ]);
            }
          } else {
            // Optional: Clear the table if they toggle extension OFF
            setFieldValue("custom_tender_extension_history", []);
          }
        }
      },
      {
        name: "custom_tender_extension_history",
        label: "Tender Extension Details",
        type: "Table",
        options: "Extension Period Details",
        columns: [
          { name: "extension_count", label: "Extension Count", type: "Read Only" },
          { name: "extension_upto", label: "Extension Upto", type: "Date" },
          { name: "sanction_letter", label: "Sanction Letter", type: "Data" },
          { name: "attach", label: "Attach", type: "Attach" },
        ],
        displayDependsOn: "custom_is_extension==1"
      },
      {
        name: "section_break0",
        label: "Tender Description",
        type: "Section Break",
      },
      {
        name: "notes",
        label: "Description",
        type: "Long Text",
      },
      {
        name: "section_break1",
        label: "Contractor Details",
        type: "Section Break",
      },
      {
        name: "custom_contractor_name",
        label: "Contractor Name",
        type: "Link",
        linkTarget: "Contractor",
      },
      {
        name: "custom_contractor_company",
        label: "Firm/Company Name",
        type: "Read Only",
        fetchFrom: {
          sourceField: "custom_contractor_name",
          targetDoctype: "Contractor",
          targetField: "custom_contractor_company"
        },
      },
      {
        name: "custom_supplier_address",
        label: "Contractor Address",
        type: "Read Only",
        fetchFrom: {
          sourceField: "custom_contractor_name",
          targetDoctype: "Contractor",
          targetField: "address"
        }
      },
      {
        name: "custom_mobile_no",
        label: "Mobile No",
        type: "Read Only",
        fetchFrom: {
          sourceField: "custom_contractor_name",
          targetDoctype: "Contractor",
          targetField: "phone"
        }
      },
      {
        name: "custom_email_id",
        label: "Email ID",
        type: "Read Only",
        fetchFrom: {
          sourceField: "custom_contractor_name",
          targetDoctype: "Contractor",
          targetField: "email_address"
        },
      },
      {
        name: "custom_gst",
        label: "GST No.",
        type: "Read Only",
        fetchFrom: {
          sourceField: "custom_contractor_name",
          targetDoctype: "Contractor",
          targetField: "custom_gst"
        },
      },
      {
        name: "custom_pan",
        label: "PAN No.",
        type: "Read Only",
        fetchFrom: {
          sourceField: "custom_contractor_name",
          targetDoctype: "Contractor",
          targetField: "custom_pan"
        },
      },
      {
        name: "custom_aadhaar_no",
        label: "Aadhaar No.",
        type: "Read Only",
        fetchFrom: {
          sourceField: "custom_contractor_name",
          targetDoctype: "Contractor",
          targetField: "custom_aadhaar_no"
        },
      },
    ];

    // Documents Attachment tab (from Fields-1.csv – Tab Break) [file:6]
    const documentsFields: FormField[] = [
      {
        name: "custom_work_order_document",
        label: "Work Order Documents",
        type: "Table",
        columns: [
          {
            name: "name_of_document",
            label: "Name of Document",
            type: "Text",
          },
          {
            name: "attachment",
            label: "Attachment",
            type: "Attach",
          },
        ],
      },
      {
        name: "custom_related_documents",
        label: "Related Documents",
        type: "Table",
        columns: [
          {
            name: "name_of_document",
            label: "Name of Document",
            type: "Text",
          },
          {
            name: "attachment",
            label: "Attachment",
            type: "Attach",
          },
        ],
      },
    ];

    return [
      {
        name: "Details",
        fields: detailsFields,
      },
      {
        name: "Documents Attachment",
        fields: documentsFields,
      },
    ];
  }, []);

  /* -------------------------------------------------
  5. Form Initialization & Watch Logic
  ------------------------------------------------- */
  const handleFormInit = React.useCallback((methods: any) => {
    const { watch, setValue, getValues } = methods;
    const tableName = 'custom_tender_extension_history';

    const subscription = watch((value: any, { name, type }: any) => {

      // 1. Toggle ON -> Add first row (01) if empty
      // We check if value exists because in some cases value might be partial
      if (name === 'custom_is_extension' && (value?.custom_is_extension === 1 || value?.custom_is_extension === true)) {
        const currentHistory = getValues(tableName) || [];

        if (currentHistory.length === 0) {
          setValue(tableName, [
            {
              extension_count: "01",
              extension_upto: "",
              sanction_letter: "",
              attach: ""
            }
          ], { shouldDirty: true });


          return;
        }
      }

      // 2. Auto-Indexing Strategy (Handles Add/Delete)
      // Checks table changes to enforce sequential indexing (01, 02, 03...)
      if (!name || name === tableName || name.startsWith(tableName)) {
        // slight delay to ensure getValues gets the *new* row added by the UI
        setTimeout(() => {
          const rows = getValues(tableName);

          if (Array.isArray(rows) && rows.length > 0) {
            let hasUpdated = false;
            rows.forEach((row: any, index: number) => {
              const expected = (index + 1).toString().padStart(2, '0');

              // Only update if strictly different to avoid render loops
              if (row.extension_count !== expected) {
                setValue(`${tableName}.${index}.extension_count`, expected, { shouldDirty: true });
                hasUpdated = true;
              }
            });
          }
        }, 50);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  /* -------------------------------------------------
  6. SUBMIT – with file upload for child tables
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
      // Deep copy form data to payload
      const payload: any = JSON.parse(JSON.stringify(data));
      const baseUrl = API_BASE_URL.replace("/api/resource", "");

      // Upload files for custom_work_order_document
      if (payload.custom_work_order_document) {
        toast.info("Uploading work order documents...");
        await Promise.all(
          payload.custom_work_order_document.map(
            async (row: any, index: number) => {
              const original =
                data.custom_work_order_document?.[index]?.attachment;
              if (original instanceof File) {
                const fileUrl = await uploadFile(
                  original,
                  apiKey,
                  apiSecret,
                  baseUrl
                );
                row.attachment = fileUrl;
              }
            }
          )
        );
      }

      // Upload files for custom_related_documents
      if (payload.custom_related_documents) {
        toast.info("Uploading related documents...");
        await Promise.all(
          payload.custom_related_documents.map(
            async (row: any, index: number) => {
              const original =
                data.custom_related_documents?.[index]?.attachment;
              if (original instanceof File) {
                const fileUrl = await uploadFile(
                  original,
                  apiKey,
                  apiSecret,
                  baseUrl
                );
                row.attachment = fileUrl;
              }
            }
          )
        );
      }

      // Upload files for custom_tender_extension_history
      if (payload.custom_tender_extension_history) {
        toast.info("Uploading extension documents...");
        await Promise.all(
          payload.custom_tender_extension_history.map(
            async (row: any, index: number) => {
              const original =
                data.custom_tender_extension_history?.[index]?.attach;
              if (original instanceof File) {
                const fileUrl = await uploadFile(
                  original,
                  apiKey,
                  apiSecret,
                  baseUrl
                );
                row.attach = fileUrl;
              }
            }
          )
        );
      }

      // Clean non-data fields (Section Break, Column Break, etc.)
      const nonDataFields = new Set<string>();
      formTabs.forEach((tab) => {
        tab.fields.forEach((field) => {
          if (
            field.type === "Section Break" ||
            field.type === "Column Break" ||
            field.type === "Button"
          ) {
            nonDataFields.add(field.name);
          }
          // Don't exclude contractor fields even if they are Read Only
          // because they need to be saved with the tender record
          if (field.type === "Read Only" && ![
            "custom_contractor_company",
            "custom_mobile_no",
            "custom_supplier_address",
            "custom_email_id",
            "custom_gst",
            "custom_pan",
            "custom_aadhaar_no"
          ].includes(field.name)) {
            nonDataFields.add(field.name);
          }
        });
      });

      const finalPayload: any = {};
      for (const key in payload) {
        if (!nonDataFields.has(key)) {
          finalPayload[key] = payload[key];
        }
      }

      // Convert checkboxes to 0/1
      const boolFields = ["custom_is_extension"];
      boolFields.forEach((f) => {
        if (f in finalPayload) {
          finalPayload[f] = finalPayload[f] ? 1 : 0;
        }
      });

      // Numeric conversions
      const numericFields = [
        "custom_prapan_suchi_amount",
        "custom_tender_amount"
      ];
      numericFields.forEach((f) => {
        if (f in finalPayload) {
          finalPayload[f] = Number(finalPayload[f]) || 0;
        }
      });

      console.log("Sending this PAYLOAD to Frappe:", finalPayload);

      // Send to Frappe
      const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, finalPayload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      const messages = getApiMessages(response, null, "Tender created successfully!", "Failed to create Tender");
      if (messages.success) {
        toast.success(messages.message, { description: messages.description });
      } else {
        toast.error(messages.message, { description: messages.description, duration: Infinity });
      }

      // Navigate to the newly created record using name
      const docName = response.data.data.name;
      if (docName) {
        router.push(`/tender/doctype/tender/${encodeURIComponent(docName)}`);
      } else {
        router.push(`/tender/doctype/tender`);
      }

    } catch (err: any) {
      console.error("Create error:", err);

      const serverData = err.response?.data;
      const serverMessage = serverData?.exception || serverData?.message || err.message || "Unknown error";

      const messages = getApiMessages(
        null,
        err,
        "Tender created successfully!",
        "Failed to create Tender",
        (error) => {
          // Custom handler for create errors
          if (error.response?.status === 404) return "Record not found";
          if (error.response?.status === 403) return "Unauthorized";
          if (error.response?.status === 417) {
            // Extract actual validation message from server response
            const serverMessages = error.response?.data?._server_messages;
            if (serverMessages) {
              try {
                const parsed = JSON.parse(serverMessages);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const messageObj = typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0];
                  return messageObj.message || error.response?.data?.exception || "Validation failed";
                }
              } catch (e) {
                console.error("Failed to parse server messages:", e);
              }
            }
            return error.response?.data?.exception || "Validation failed - Server cannot meet requirements";
          }
          return "Failed to create Tender";
        }
      );

      if (!messages.success) {
        toast.error(messages.message, { description: messages.description, duration: Infinity });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
  6. RENDER FORM
  ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      onFormInit={handleFormInit}
      title={`New ${doctypeName}`}
      description="Create a new tender/project"
      submitLabel={isSaving ? "Saving..." : "New Tender"}
      cancelLabel="Cancel"
      doctype={doctypeName}

    />
  );
}
