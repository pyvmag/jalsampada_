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
import { DownloadTemplateModal } from "../DownloadTemplateModal";
import { UseFormReturn } from "react-hook-form";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

const ALLOWED_DOCTYPES = [
  { label: "Asset", value: "Asset" },
  { label: "Asset Category", value: "Asset Category" },
  { label: "Lift Irrigation Scheme", value: "Lift Irrigation Scheme" },
  { label: "Stage No", value: "Stage No" },
  { label: "Equipement Make", value: "Equipement Make" },
  { label: "Equipement Model", value: "Equipement Model" },
  { label: "Equipement Capacity", value: "Equipement Capacity" },
  { label: "Rating", value: "Rating" },
  { label: "WRD District", value: "WRD District" },
  { label: "WRD Taluka", value: "WRD Taluka" },
  { label: "Location", value: "Location" },
  { label: "WRD Village", value: "WRD Village" },
  { label: "Temperature Readings", value: "Temperature Readings" },
  { label: "Gate", value: "Gate" },
  { label: "Item", value: "Item" },
  { label: "Warehouse", value: "Warehouse" },
  { label: "Logbook", value: "Logbook" },
  { label: "Log Sheet", value: "Log Sheet" },
  { label: "Gate Operation Logbook", value: "Gate Operation Logbook" },
  { label: "Repair Work Requirement", value: "Repair Work Requirement" },
  { label: "Issue", value: "Issue" },
  { label: "Material Request", value: "Material Request" },
  { label: "Stock Entry", value: "Stock Entry" },
  { label: "Stock Reconciliation", value: "Stock Reconciliation" },
  { label: "Maintenance Checklist", value: "Maintenance Checklist" },
  { label: "Asset Maintenance", value: "Asset Maintenance" },
  { label: "Asset Maintenance Log", value: "Asset Maintenance Log" },
  { label: "Employee", value: "Employee" },
  { label: "Designation", value: "Designation" },
  { label: "Attendance Sheet", value: "Attendance Sheet" },
  { label: "Contractor", value: "Contractor" },
  { label: "Work Type", value: "Work Type" },
  { label: "Work Subtype", value: "Work Subtype" },
  { label: "Fund Head", value: "Fund Head" },
  { label: "Prapan Suchi", value: "Prapan Suchi" },
  { label: "Tender", value: "Project" },
  { label: "Draft Tender Paper", value: "Draft Tender Paper" },
  { label: "Expenditure", value: "Expenditure" },
  { label: "User", value: "User" },
  { label: "Role", value: "Role" },
  { label: "Role Profile", value: "Role Profile" },
  { label: "Data Import", value: "Data Import" },
  { label: "Asset Interchange", value: "Asset Interchange" },
].sort((a, b) => a.label.localeCompare(b.label));

export default function NewDataImportPage() {
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const router = useRouter();

  const doctypeName = "Data Import";
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
  const [referenceDoctypeForModal, setReferenceDoctypeForModal] = React.useState<string | null>(null);
  const formRef = React.useRef<UseFormReturn<any> | null>(null);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    return [
      {
        name: "Details",
        fields: [
          {
            name: "reference_doctype",
            label: "Document Type",
            type: "Select",
            options: ALLOWED_DOCTYPES,
            required: true,
          },
          {
            name: "import_type",
            label: "Import Type",
            type: "Select",
            options: "Insert New Records\nUpdate Existing Records",
            defaultValue: "Insert New Records",
            required: true,
          },
          {
            name: "download_template",
            label: "Download Template",
            type: "Button",
            action: () => {
              const refDoc = formRef.current?.getValues("reference_doctype");
              if (!refDoc) {
                toast.error("Please select a Document Type first");
                return;
              }
              setReferenceDoctypeForModal(refDoc);
              setIsTemplateModalOpen(true);
            },
          },
          {
            name: "column_break_5",
            label: "",
            type: "Column Break",
          },
          {
            name: "mute_emails",
            label: "Don't Send Emails",
            type: "Check",
            defaultValue: 1,
          },
          {
            name: "submit_after_import",
            label: "Submit After Import",
            type: "Check",
          },
        ],
      },
    ];
  }, []);

  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
      toast.error("Authentication required. Please log in.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = {};
      const nonDataFields = new Set(["column_break_5", "section_import_preview", "import_log_section", "import_warnings_section"]);

      for (const key in data) {
        if (!nonDataFields.has(key)) {
          payload[key] = data[key];
        }
      }

      const response = await axios.post(
        `${API_BASE_URL}/${doctypeName}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("Data Import created successfully!");
      const docName = response.data.data.name;
      router.push(`/admin/doctype/data-import/${encodeURIComponent(docName)}`);
    } catch (err: any) {
      console.error("Create error:", err);
      const serverData = err.response?.data;
      const serverMessage = serverData?.exception || serverData?._server_messages || err.message || "Failed to create Data Import";
      toast.error("Failed to create Data Import", { description: serverMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.push("/admin/doctype/data-import");

  return (
    <>
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={`New ${doctypeName}`}
        description="Create a new data import task"
        submitLabel={isSaving ? "Saving..." : "Create Data Import"}
        cancelLabel="Cancel"
        onFormInit={(form) => {
          formRef.current = form;
        }}
      />

      <DownloadTemplateModal
        isOpen={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
        referenceDoctype={referenceDoctypeForModal || ""}
        apiKey={apiKey || ""}
        apiSecret={apiSecret || ""}
      />
    </>
  );
}
