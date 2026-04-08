"use client";

import * as React from "react";
import axios from "axios";
import { useRouter, useParams } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
  FormField,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import DocumentActivity from "@/components/DocumentActivity";
import { DownloadTemplateModal } from "../DownloadTemplateModal";
import { Button } from "@/components/ui/button";
import { ImportPreview } from "../ImportPreview";
import { Loader2 } from "lucide-react";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

export default function DataImportDetailsPage() {
  const router = useRouter();
  const { id } = useParams();
  const recordId = id ? decodeURIComponent(id as string) : "";

  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Data Import";

  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isStartingImport, setIsStartingImport] = React.useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
  const [previewData, setPreviewData] = React.useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    if (!isInitialized) return;
    if (!isAuthenticated || !apiKey || !apiSecret) {
      toast.error("Authentication required");
      router.push("/login");
      return;
    }

    try {
      setLoading(true);
      const url = `${API_BASE_URL}/${doctypeName}/${recordId}`;
      const response = await axios.get(url, {
        headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        withCredentials: true,
      });

      setData(response.data.data);
      if (response.data.data.import_file || response.data.data.google_sheets_url) {
        fetchPreviewData();
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      toast.error("Failed to load Data Import details");
      router.push("/admin/doctype/data-import");
    } finally {
      setLoading(false);
    }
  }, [recordId, doctypeName, apiKey, apiSecret, isAuthenticated, isInitialized, router]);

  const fetchPreviewData = React.useCallback(async () => {
    if (!apiKey || !apiSecret || !recordId) return;

    try {
      setIsLoadingPreview(true);
      const url = `${API_BASE_URL.replace("/api/resource", "/api/method")}/frappe.core.doctype.data_import.data_import.get_preview_from_template`;
      const response = await axios.get(url, {
        params: { data_import: recordId },
        headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        withCredentials: true,
      });

      if (response.data.message) {
        setPreviewData(response.data.message);
      }
    } catch (err) {
      console.error("Preview data error:", err);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [recordId, apiKey, apiSecret]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!data) return [];

    const withDefaults = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue: f.name in data ? data[f.name] : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: withDefaults([
          {
            name: "reference_doctype",
            label: "Document Type",
            type: "Link",
            linkTarget: "DocType",
            required: true,
          },
          {
            name: "import_type",
            label: "Import Type",
            type: "Select",
            options: "Insert New Records\nUpdate Existing Records",
            required: true,
          },
          {
            name: "download_template",
            label: "Download Template",
            type: "Button",
            action: () => setIsTemplateModalOpen(true),
          },
          {
            name: "import_file",
            label: "Import File",
            type: "Attach",
          },
          {
            name: "google_sheets_url",
            label: "Import from Google Sheets",
            type: "Data",
            description: "Must be a publicly accessible Google Sheets URL",
          },
          {
            name: "status",
            label: "Status",
            type: "Select",
            options: "Pending\nSuccess\nPartial Success\nError\nTimed Out",
            readOnly: true,
          },
          {
            name: "column_break_5",
            label: "",
            type: "Column Break",
          },
          {
            name: "use_csv_sniffer",
            label: "Detect CSV type",
            type: "Check",
            description: "Use if the default settings don't seem to detect your data correctly",
          },
          {
            name: "custom_delimiters",
            label: "Custom Delimiters",
            type: "Check",
          },
          {
            name: "delimiter_options",
            label: "Delimiter Options",
            type: "Data",
            defaultValue: ",;\t|",
            description: "If your CSV uses a different delimiter...",
          },
          {
            name: "submit_after_import",
            label: "Submit After Import",
            type: "Check",
          },
          {
            name: "mute_emails",
            label: "Don't Send Emails",
            type: "Check",
          },
          {
            name: "payload_count",
            label: "Payload Count",
            type: "Int",
            readOnly: true,
          },
        ]),
      },
      {
        name: "Import Logs",
        fields: withDefaults([
          {
            name: "import_warnings_section",
            label: "Import File Errors and Warnings",
            type: "Section Break",
          },
          {
            name: "template_warnings",
            label: "Template Warnings",
            type: "Code",
            options: "JSON",
            readOnly: true,
          },
          {
            name: "import_warnings",
            label: "Import Warnings",
            type: "HTML",
          },
          {
            name: "section_import_preview",
            label: "Preview",
            type: "Section Break",
          },
          {
            name: "import_preview",
            label: "Import Preview",
            type: "HTML",
            customElement: isLoadingPreview ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-slate-50 rounded-xl border-2 border-dashed">
                <Loader2 className="h-10 w-10 mb-4 animate-spin text-blue-500" />
                <p>Loading preview data...</p>
              </div>
            ) : (
              <ImportPreview 
                doctype={data.reference_doctype} 
                previewData={previewData} 
                status={data.status}
                onRefresh={fetchPreviewData}
              />
            )
          },
          {
            name: "import_log_section",
            label: "Import Log",
            type: "Section Break",
          },
          {
            name: "show_failed_logs",
            label: "Show Only Failed Logs",
            type: "Check",
          },
          {
            name: "import_log_preview",
            label: "Import Log Preview",
            type: "HTML",
          },
        ]),
      },
    ];
  }, [data, previewData, fetchPreviewData]);

  const handleUpdate = async (formData: Record<string, any>) => {
    if (!apiKey || !apiSecret || !recordId) return;

    setIsSaving(true);
    try {
      const nonDataFields = new Set([
        "column_break_5",
        "section_import_preview",
        "import_log_section",
        "import_warnings_section",
        "download_template",
        "refresh_google_sheet",
        "template_warnings",
        "import_warnings",
        "import_preview",
        "import_log_preview",
        "status",
        "payload_count"
      ]);

      const finalPayload: Record<string, any> = {};
      for (const key in formData) {
        if (!nonDataFields.has(key)) {
          let val = formData[key];
          if (val instanceof File) {
            // Upload the file first to Frappe
            const fd = new FormData();
            fd.append("file", val, val.name);
            fd.append("is_private", "1");
            fd.append("doctype", "Data Import");
            fd.append("docname", recordId);

            try {
              const uploadResp = await axios.post(
                `${API_BASE_URL.replace("/api/resource", "/api/method")}/upload_file`,
                fd,
                {
                  headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    "Content-Type": "multipart/form-data"
                  },
                  withCredentials: true,
                }
              );
              val = uploadResp.data.message.file_url;
            } catch (err) {
              console.error("File upload failed", err);
              toast.error("Failed to upload the attached file.");
              throw err; 
            }
          } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
            val = JSON.stringify(val);
          }
          finalPayload[key] = val;
        }
      }

      const url = `${API_BASE_URL}/${doctypeName}/${recordId}`;
      const response = await axios.put(url, finalPayload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      });

      const messages = getApiMessages(response, null, "Data Import updated!", "Failed to update Data Import");
      if (messages.success) {
        toast.success(messages.message);
        fetchData();
      } else {
        toast.error(messages.message);
      }
    } catch (err: any) {
      console.error("Update error:", err);
      const serverData = err.response?.data;
      const serverMsg = serverData?._server_messages 
        ? JSON.parse(serverData._server_messages)[0] 
        : serverData?.exception || err.message || "Failed to update Data Import";
        
      toast.error("Failed to update Data Import", { description: typeof serverMsg === 'string' ? serverMsg : JSON.stringify(serverMsg) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartImport = async () => {
    if (!apiKey || !apiSecret || !recordId) return;

    setIsStartingImport(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL.replace("/api/resource", "/api/method")}/frappe.core.doctype.data_import.data_import.form_start_import`,
        { data_import: recordId },
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("Import started in background.");
      fetchData(); // Refresh to see progress/logs
    } catch (err: any) {
      console.error("Start import error:", err);
      toast.error("Failed to start import.");
    } finally {
      setIsStartingImport(false);
    }
  };

  const handleStopImport = async () => {
    if (!apiKey || !apiSecret || !recordId) return;

    try {
      await axios.post(
        `${API_BASE_URL.replace("/api/resource", "/api/method")}/frappe.core.doctype.data_import.data_import.stop_data_import`,
        { doc_name: recordId },
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );
      toast.success("Import job stopped.");
      fetchData();
    } catch (err) {
      toast.error("Failed to stop job.");
    }
  };

  const handleSubmit = async (formData: Record<string, any>) => {
    await handleUpdate(formData);
  };

  const handleCancel = () => router.push("/admin/doctype/data-import");

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this data import task?")) return;

    setIsDeleting(true);
    try {
      const url = `${API_BASE_URL}/${doctypeName}/${recordId}`;
      await axios.delete(url, {
        headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        withCredentials: true,
      });

      toast.success("Data Import deleted");
      router.push("/admin/doctype/data-import");
    } catch (err: any) {
      toast.error("Failed to delete Data Import");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading details...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Record not found</div>;

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <div className="px-4 md:px-8 pt-6 flex justify-end gap-2">
        {data.status === "Pending" && (
           <Button onClick={handleStartImport} disabled={isStartingImport}>
             {isStartingImport ? "Starting..." : "Start Import"}
           </Button>
        )}
        {(data.status === "Error" || data.status === "Partial Success") && (
           <Button onClick={handleStartImport} disabled={isStartingImport}>
             Retry Import
           </Button>
        )}
        {/* If background jobs were tracked, we'd show Stop here */}
      </div>

      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onDelete={handleDelete}
        title={`${doctypeName}: ${data.name}`}
        description={`Manage data import for ${data.reference_doctype}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
      />

      {data && (
        <DownloadTemplateModal
          isOpen={isTemplateModalOpen}
          onOpenChange={setIsTemplateModalOpen}
          referenceDoctype={data.reference_doctype}
          apiKey={apiKey || ""}
          apiSecret={apiSecret || ""}
        />
      )}

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
