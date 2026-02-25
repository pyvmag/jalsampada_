"use client";



import * as React from "react";

import { useParams, useRouter } from "next/navigation";

import axios from "axios";

import {

  DynamicForm,

  TabbedLayout,

  FormField,

} from "@/components/DynamicFormComponent";

import { useAuth } from "@/context/AuthContext";

import { toast } from "sonner";

import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { getApiMessages } from "@/lib/utils";
import DocumentActivity from "@/components/DocumentActivity";



const API_BASE_URL = "http://103.219.1.138:4412/api/resource";



/* -------------------------------------------------

   1. Project/Tender data

------------------------------------------------- */



interface TenderProjectData {

  name: string;

  modified: string;

  docstatus: 0 | 1 | 2;



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
  owner?: string;
  modified_by?: string;
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



export default function RecordDetailPage() {

  const params = useParams();

  const router = useRouter();

  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();



  const docname = params.id as string;

  const doctypeName = "Project"; // Note: This doctype is named 'Project' in Frappe



  const [record, setRecord] = React.useState<TenderProjectData | null>(null);

  const [loading, setLoading] = React.useState(true);

  const [error, setError] = React.useState<string | null>(null);

  const [isSaving, setIsSaving] = React.useState(false);



  /* -------------------------------------------------

     4. FETCH (GET with token)

  ------------------------------------------------- */



  React.useEffect(() => {

    const fetchRecord = async () => {

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

            "Content-Type": "application/json",

          },

          withCredentials: true,

          maxBodyLength: Infinity,

          maxContentLength: Infinity,

        });



        setRecord(resp.data.data as TenderProjectData);

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



    fetchRecord();

  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);



  /* -------------------------------------------------

     5. EXTENSION CHECK (API Call)

  ------------------------------------------------- */



  const [extensionMessage, setExtensionMessage] = React.useState<string | null>(null);

  const [loadingExtension, setLoadingExtension] = React.useState(false);



  const checkProjectExtension = React.useCallback(async () => {

    if (!record || !record.name || !isAuthenticated || !apiKey || !apiSecret) {

      setExtensionMessage(null);

      return;

    }



    setLoadingExtension(true);

    try {

      const baseUrl = API_BASE_URL.replace("/api/resource", "");

      const response = await axios.post(

        `${baseUrl}/api/method/quantlis_management.quantlis_utils.check_project_extension`,

        { project_name: record.name },

        {

          headers: {

            Authorization: `token ${apiKey}:${apiSecret}`,

            "Content-Type": "application/json",

          },

          withCredentials: true,

        }

      );



      if (response.data && response.data.message) {

        // Handle both string and object responses

        const message = typeof response.data.message === 'string'

          ? response.data.message

          : response.data.message.message || 'Unknown status';

        setExtensionMessage(message);

      } else {

        setExtensionMessage(null);

      }

    } catch (err: any) {

      console.error("Extension check error:", err);

      setExtensionMessage(null);

    } finally {

      setLoadingExtension(false);

    }

  }, [record, isAuthenticated, apiKey, apiSecret]);



  React.useEffect(() => {

    checkProjectExtension();

  }, [checkProjectExtension]);



  // Show toast when extension message is available
  React.useEffect(() => {
    if (extensionMessage && record) {
      // 0. Suppress if Completed or Cancelled
      if (record.custom_tender_status === "Completed" || record.custom_tender_status === "Cancelled") {
        return;
      }

      // 1. Calculate Effective Date (taking into account extensions)
      let effectiveDateStr = record.custom_expected_date;
      if (record.custom_tender_extension_history && record.custom_tender_extension_history.length > 0) {
        const lastExt = record.custom_tender_extension_history[record.custom_tender_extension_history.length - 1];
        if (lastExt.extension_upto) {
          effectiveDateStr = lastExt.extension_upto;
        }
      }

      if (!effectiveDateStr) return;

      // 2. Check if date is safely in the future (> 2 days)
      const effectiveDate = new Date(effectiveDateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      effectiveDate.setHours(0, 0, 0, 0);

      const diffInMs = effectiveDate.getTime() - today.getTime();
      const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

      if (diffInDays > 2) {
        return; // Suppress alert if new date provides enough time
      }

      // Helper to format date
      const formatDate = (dateString?: string) => {
        if (!dateString) return "";
        const d = new Date(dateString);
        return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
      };

      const scheduledDate = formatDate(effectiveDateStr);
      const tenderId = record.custom_tender_id || "";
      const contractorName = record.custom_contractor_name || ""; // Assuming name or ID is here

      // 1. Tender Extension Alert
      toast.error("Tender Extension Alert", {
        description: `Tender ${tenderId}, scheduled for ${scheduledDate}, requires an extension.`,
        duration: Infinity,
      });

      // 2. Contractor Alert Message
      // Use a slight delay or just another toast call. Sonner handles multiple toasts.
      setTimeout(() => {
        toast.error("Tender Status Alert", {
          description: `Contractor ${contractorName} is required to complete Tender ${tenderId} by ${scheduledDate}`,
          duration: Infinity,
        });
      }, 500);
    }
  }, [extensionMessage, record]);

  /* -------------------------------------------------
     6. Build tabs
  ------------------------------------------------- */

  const formTabs: TabbedLayout[] = React.useMemo(() => {

    if (!record) return [];



    const withDefaults = (list: FormField[]): FormField[] =>

      list.map((f) => ({

        ...f,

        defaultValue:

          f.name in record

            ? // @ts-ignore

            record[f.name as keyof TenderProjectData]

            : f.defaultValue,

      }));



    const detailsFields: FormField[] = withDefaults([

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

        displayDependsOn: (data: any) => {

          if (!data.custom_expected_date) return false;

          const completionDate = new Date(data.custom_expected_date);

          const today = new Date();

          today.setHours(0, 0, 0, 0);

          completionDate.setHours(0, 0, 0, 0);

          const diffInDays = (completionDate.getTime() - today.getTime()) / (1000 * 3600 * 24);

          return diffInDays <= 2;

        },

      },

      {

        name: "custom_tender_extension_history",

        label: "Tender Extension Details",

        type: "Table",

        options: "Extension Period Details",

        columns: [

          { name: "extension_count", label: "Extension Count", type: "Read Only" },

          { name: "extension_upto", label: "Extension Upto", type: "Date", },

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

        name: "section_break_contractor_details",

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

        label: "Contractor Company",

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

        label: "Mobile No.",

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

    ]);





    const documentsFields: FormField[] = withDefaults([

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

    ]);



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

  }, [record]);



  /* -------------------------------------------------

     7. Form Initialization & Watch Logic

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

     8. SUBMIT

  ------------------------------------------------- */



  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {

    if (!isDirty) {

      toast.info("NoChangesToSave.");

      return;

    }



    if (!record) {

      toast.error("CannotSave,DataNotLoaded.");

      return;

    }



    if (!apiKey || !apiSecret) {

      toast.error("MissingAPICredentials.", { duration: Infinity });

      return;

    }



    setIsSaving(true);

    try {

      const payload: any = JSON.parse(JSON.stringify(data));

      const baseUrl = API_BASE_URL.replace("/api/resource", "");



      // Handle file uploads

      if (payload.custom_work_order_document) {

        await Promise.all(

          payload.custom_work_order_document.map(async (row: any, index: number) => {

            const original = data.custom_work_order_document?.[index]?.attachment;

            if (original instanceof File) {

              row.attachment = await uploadFile(original, apiKey, apiSecret, baseUrl);

            }

          })

        );

      }



      if (payload.custom_related_documents) {

        await Promise.all(

          payload.custom_related_documents.map(async (row: any, index: number) => {

            const original = data.custom_related_documents?.[index]?.attachment;

            if (original instanceof File) {

              row.attachment = await uploadFile(original, apiKey, apiSecret, baseUrl);

            }

          })

        );

      }



      if (payload.custom_tender_extension_history) {

        await Promise.all(

          payload.custom_tender_extension_history.map(async (row: any, index: number) => {

            const original = data.custom_tender_extension_history?.[index]?.attach;

            if (original instanceof File) {

              row.attach = await uploadFile(original, apiKey, apiSecret, baseUrl);

            }

          })

        );

      }



      const nonDataFields = new Set<string>();

      formTabs.forEach((tab) => {

        tab.fields.forEach((field) => {

          if (["Section Break", "Column Break", "Button"].includes(field.type)) {

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



      finalPayload.modified = record.modified;

      finalPayload.docstatus = record.docstatus;



      const boolFields = ["custom_is_extension"];

      boolFields.forEach((f) => {

        if (f in finalPayload) finalPayload[f] = finalPayload[f] ? 1 : 0;

      });



      const resp = await axios.put(

        `${API_BASE_URL}/${doctypeName}/${docname}`,

        finalPayload,

        {

          headers: {

            Authorization: `token ${apiKey}:${apiSecret}`,

            "Content-Type": "application/json",

          },

          withCredentials: true,

          maxBodyLength: Infinity,

          maxContentLength: Infinity,

        }

      );



      const messages = getApiMessages(resp, null, "Changes saved!", "Failed to save");

      if (messages.success) {

        toast.success(messages.message, { description: messages.description });

      } else {

        toast.error(messages.message, { description: messages.description, duration: Infinity });

      }



      if (resp.data && resp.data.data) {

        setRecord(resp.data.data as TenderProjectData);

        // Refresh extension check after successful save

        checkProjectExtension();

      }



      // Return appropriate status based on docstatus

      const savedStatus = resp.data.data.docstatus === 0 ? "Draft" :

        resp.data.data.docstatus === 1 ? "Submitted" : "Cancelled";



      // Only navigate if the name changed (renamed doc)

      if (resp.data.data.name && resp.data.data.name !== docname) {
        router.push(`/tender/doctype/tender/${encodeURIComponent(resp.data.data.name)}`);
      }

      return { status: savedStatus };

    } catch (err: any) {

      console.error("Save error:", err);



      const messages = getApiMessages(

        null,

        err,

        "Changes saved!",

        "Failed to save",

        (error) => {

          // Custom handler for save errors

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

          return "Failed to save";

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

     9. UI states

  ------------------------------------------------- */



  if (loading) {

    return (

      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>

        <p>Loading Project details...</p>

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



  if (!record) {

    return (

      <div className="module active" style={{ padding: "2rem" }}>

        <p>{doctypeName} not found.</p>

      </div>

    );

  }



  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onFormInit={handleFormInit}
        doctype={doctypeName}
        title={`${doctypeName}: ${record.name}`}
        description={`Update details for record ID ${docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        initialStatus={record.docstatus === 0 ? "Draft" : record.docstatus === 1 ? "Submitted" : "Cancelled"}
        docstatus={record.docstatus}
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/tender/doctype/tender",
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
          currentUserEmail={record.owner}
          modifiedStr={record.modified}
          modifiedBy={record.modified_by}
        />
      </div>
    </div>
  );
}