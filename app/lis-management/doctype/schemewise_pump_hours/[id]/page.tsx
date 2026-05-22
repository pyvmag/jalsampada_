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
import { getApiMessages } from "@/lib/utils";
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

interface SchemewisePumpHoursData {
  name: string;
  lis_name?: string;
  stage?: string;
  year?: string;
  month?: string;
  pump_hours?: Array<{
    name?: string;
    pump?: string;
    reading_date?: string;
    hours?: number;
  }>;
  docstatus: 0 | 1 | 2;
  modified: string;
  owner?: string;
  modified_by?: string;
}

export default function SchemewisePumpHoursDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = params.id as string;
  const doctypeName = "Schemewise Pump Hours";

  const [record, setRecord] = React.useState<SchemewisePumpHoursData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const isProgrammaticUpdate = React.useRef(false);
  const [formVersion, setFormVersion] = React.useState(0);
  const [formInstance, setFormInstance] = React.useState<any>(null);

  const [activeButton, setActiveButton] = React.useState<"SAVE" | "SUBMIT" | "CANCEL" | null>(null);
  const [formDirty, setFormDirty] = React.useState(false);

  React.useEffect(() => {
    const fetchRecord = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const resp = await axios.get(
          `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${encodeURIComponent(docname)}`,
          {
            headers: {
              Authorization: `token ${apiKey}:${apiSecret}`,
              "Content-Type": "application/json",
            },
            withCredentials: true,
          }
        );

        const data = resp.data.data as SchemewisePumpHoursData;
        setRecord(data);

        if (data.docstatus === 0) {
          setActiveButton("SUBMIT");
        } else if (data.docstatus === 1) {
          setActiveButton("CANCEL");
        }

        setFormDirty(false);
      } catch (err: any) {
        console.error("API Error:", err);
        const messages = getApiMessages(
          null,
          err,
          "Record loaded successfully",
          "Failed to load record",
          (error) => {
            if (error.response?.status === 404) return "Schemewise Pump Hours not found";
            if (error.response?.status === 403) return "Unauthorized";
            return "Failed to load record";
          }
        );
        setError(messages.description || messages.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  React.useEffect(() => {
    if (!formInstance) return;

    const subscription = formInstance.watch((value: any, { name }: { name?: string }) => {
      if (name && !isProgrammaticUpdate.current) {
        setFormDirty(true);
        if (record?.docstatus === 0) {
          setActiveButton("SAVE");
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [formInstance, record?.docstatus]);

  const handleFormInit = React.useCallback((form: any) => {
    setFormInstance(form);
  }, []);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!record) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in record
            ? record[f.name as keyof SchemewisePumpHoursData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "lis_name",
            label: "LIS Name",
            type: "Link",
            required: true,
            linkTarget: "Lift Irrigation Scheme",
          },
          {
            name: "stage",
            label: "Stage",
            type: "Link",
            required: true,
            linkTarget: "Stage No",
            filterMapping: [
              { sourceField: "lis_name", targetField: "lis_name" }
            ]
          },
          {
            name: "year",
            label: "Year",
            type: "Link",
            required: true,
            linkTarget: "Year",
          },
          {
            name: "month",
            label: "Month",
            type: "Select",
            required: true,
            options: [
              { label: "January", value: "January" },
              { label: "February", value: "February" },
              { label: "March", value: "March" },
              { label: "April", value: "April" },
              { label: "May", value: "May" },
              { label: "June", value: "June" },
              { label: "July", value: "July" },
              { label: "August", value: "August" },
              { label: "September", value: "September" },
              { label: "October", value: "October" },
              { label: "November", value: "November" },
              { label: "December", value: "December" },
            ],
          },

          {
            name: "pump_hours",
            label: "Pump Hours",
            type: "Table",
            columns: [
              {
                name: "pump",
                label: "Pump",
                type: "Link",
                linkTarget: "Asset",
                filters: (getCompositeValue) => {
                  const filters: Record<string, any> = {};
                  const stage = getCompositeValue("parent.stage");
                  const lisName = getCompositeValue("parent.lis_name");
                  if (stage) filters.custom_stage_no = stage;
                  if (lisName) filters.custom_lis_name = lisName;
                  filters.asset_category = "Pump";
                  return filters;
                }
              },
              {
                name: "reading_date",
                label: "Reading Date",
                type: "Date",

              },
              {
                name: "hours",
                label: "Hours",
                type: "Float",

                precision: 2,
              }
            ],
          }
        ]),
      }
    ];
  }, [record]);

  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    if (!record) {
      toast.error("Record not loaded. Cannot save.", { duration: Infinity });
      return;
    }

    setIsSaving(true);
    isProgrammaticUpdate.current = true;

    try {
      const payload: Record<string, any> = JSON.parse(JSON.stringify(data));
      delete payload.section_break_ba5b;

      payload.modified = record.modified;
      payload.docstatus = record.docstatus;

      if (Array.isArray(payload.pump_hours)) {
        payload.pump_hours = payload.pump_hours.map((row: any) => ({
          ...row,
          hours: Number(row.hours) || 0,
        }));
      }

      const resp = await axios.put(
        `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${encodeURIComponent(docname)}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      const messages = getApiMessages(resp, null, "Changes saved!", "Failed to save");

      if (messages.success) {
        toast.success(messages.message, { description: messages.description });
      } else {
        toast.error(messages.message, { description: messages.description, duration: Infinity });
      }

      if (resp.data && resp.data.data) {
        const updatedData = resp.data.data as SchemewisePumpHoursData;
        setRecord(updatedData);
        setFormDirty(false);

        if (updatedData.docstatus === 0) {
          setActiveButton("SUBMIT");
        }
        setFormVersion((v) => v + 1);
      }
    } catch (err: any) {
      console.error("Save error:", err);
      const messages = getApiMessages(null, err, "Changes saved!", "Failed to save");
      toast.error(messages.message, { description: messages.description, duration: Infinity });
    } finally {
      setIsSaving(false);
      isProgrammaticUpdate.current = false;
    }
  };

  const handleSubmitDocument = async () => {
    if (!record) return;

    setIsSaving(true);

    try {
      const payload: Record<string, any> = { ...record };
      payload.docstatus = 1;

      if (Array.isArray(payload.pump_hours)) {
        payload.pump_hours = payload.pump_hours.map((row: any) => ({
          ...row,
          hours: Number(row.hours) || 0,
        }));
      }

      const response = await axios.put(
        `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${encodeURIComponent(docname)}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json"
          }
        }
      );

      toast.success("Document submitted successfully!");

      const updatedData = response.data.data as SchemewisePumpHoursData;
      setRecord(updatedData);
      setFormDirty(false);
      setActiveButton("CANCEL");
      setFormVersion((v) => v + 1);
    } catch (err: any) {
      console.error("Submit error:", err);
      const messages = getApiMessages(null, err, "Document submitted successfully!", "Submit failed");
      toast.error(messages.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelDocument = async () => {
    if (!record) return;

    if (!window.confirm("Are you sure you want to cancel this record? This action cannot be undone.")) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        docstatus: 2,
        modified: record.modified
      };

      const resp = await axios.put(
        `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${encodeURIComponent(docname)}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json"
          }
        }
      );

      toast.success("Document cancelled successfully!");

      const updatedRecord = resp.data.data as SchemewisePumpHoursData;
      setRecord(updatedRecord);
      setActiveButton(null);
    } catch (err: any) {
      console.error("Cancel error:", err);
      const messages = getApiMessages(null, err, "Document cancelled successfully!", "Cancel failed");
      toast.error(messages.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading details...</p>
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
        <p>Record not found.</p>
      </div>
    );
  }

  const getSubmitLabel = () => {
    if (isSaving) {
      switch (activeButton) {
        case "SAVE": return "Saving...";
        case "SUBMIT": return "Submitting...";
        case "CANCEL": return "Cancelling...";
        default: return "Processing...";
      }
    }

    switch (activeButton) {
      case "SAVE": return "Save";
      case "SUBMIT": return "Submit";
      case "CANCEL": return "Cancel";
      default: return undefined;
    }
  };

  const isSubmitted = record.docstatus === 1;
  const isDraft = record.docstatus === 0;

  const formKey = `${record.name}-${record.docstatus}-${formVersion}`;

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        key={formKey}
        tabs={formTabs}
        onSubmit={activeButton === "SAVE" ? handleSubmit : async () => { }}
        onSubmitDocument={activeButton === "SUBMIT" ? handleSubmitDocument : undefined}
        onCancelDocument={activeButton === "CANCEL" ? handleCancelDocument : undefined}
        onCancel={() => router.back()}
        title={`${doctypeName}: ${record.name}`}
        description={`Update details for record ID: ${docname}`}
        isSubmittable={activeButton === "SUBMIT"}
        docstatus={record.docstatus}
        initialStatus={isDraft ? "Draft" : isSubmitted ? "Submitted" : "Cancelled"}
        onFormInit={handleFormInit}
        submitLabel={getSubmitLabel()}
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/lis-management/doctype/schemewise_pump_hours",
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
