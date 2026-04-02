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
import { UseFormReturn } from "react-hook-form";
import { getApiMessages } from "@/lib/utils";
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";
const API_METHOD_URL = "http://103.219.1.138:4412/api/method";

interface PrapanSuchi {
  name: string;
  fiscal_year?: string;
  lis_name?: string;
  type?: string; // Fund Head
  amount?: number;
  stage?: Array<{
    stage?: string;
    idx?: number;
  }>;
  work_name?: string;
  description?: string;
  docstatus: 0 | 1 | 2;
  modified: string;
  owner?: string;
  modified_by?: string;
}

export default function PrapanSuchiDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = params.id as string;
  const doctypeName = "Prapan Suchi";

  const [record, setRecord] = React.useState<PrapanSuchi | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // 🟢 Track which button to show (SAME AS ASSET DOCTYPE)
  const [activeButton, setActiveButton] = React.useState<"SAVE" | "SUBMIT" | "CANCEL" | null>(null);
  const [formDirty, setFormDirty] = React.useState(false);
  const [formMethods, setFormMethods] = React.useState<UseFormReturn<any> | null>(null);
  const isProgrammaticUpdate = React.useRef(false);
  const [formVersion, setFormVersion] = React.useState(0);

  // 🟢 STATUS BADGE helper function
  const getCurrentStatus = () => {
    if (!record) return "";
    if (record.docstatus === 2) return "Cancelled";
    if (record.docstatus === 1) return "Submitted";

    // Draft (docstatus === 0)
    if (record.docstatus === 0) {
      if (formDirty) {
        return "Not Saved";
      }
      return "Draft";
    }

    return "Draft";
  };

  // 🟢 SUBMIT DOCUMENT
  const handleSubmitDocument = async () => {
    if (!record) return;
    setIsSaving(true);

    try {
      // First, get the current form data if we have form methods
      let formData = record;
      if (formMethods) {
        formData = { ...formMethods.getValues(), modified: record.modified };
      }

      // Set docstatus to 1 (Submitted)
      const payload = {
        ...formData,
        docstatus: 1,
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

      const messages = getApiMessages(resp, null, "Document submitted successfully!", "Submit failed");

      if (messages.success) {
        toast.success(messages.message);
        const updatedData = resp.data.data as PrapanSuchi;
        setRecord(updatedData);

        // Update button to CANCEL after submission
        setActiveButton("CANCEL");
        setFormDirty(false);

        // Force form remount with new docstatus
        setFormVersion((v) => v + 1);
      } else {
        toast.error(messages.message);
      }
    } catch (err: any) {
      console.error("Submit error:", err);
      const messages = getApiMessages(null, err, "Document submitted successfully!", "Submit failed");
      toast.error(messages.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 🟢 CANCEL DOCUMENT
  const handleCancelDocument = async () => {
    if (!record) return;

    if (!window.confirm("Are you sure you want to cancel this document? This action cannot be undone.")) {
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

      const messages = getApiMessages(resp, null, "Document cancelled successfully!", "Cancel failed");

      if (messages.success) {
        toast.success(messages.message);
        setRecord(resp.data.data);
        setActiveButton(null); // Remove cancel button after cancellation
      } else {
        toast.error(messages.message);
      }
    } catch (err: any) {
      console.error("Cancel error:", err);
      const messages = getApiMessages(null, err, "Document cancelled successfully!", "Cancel failed");
      toast.error(messages.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 🟢 Watch for form changes (SAME AS ASSET DOCTYPE)
  React.useEffect(() => {
    if (!formMethods) return;

    const subscription = formMethods.watch((value: any, { name }: { name?: string }) => {
      // Watch for form changes to mark as dirty
      if (name && !isProgrammaticUpdate.current) {
        setFormDirty(true);
        // When form becomes dirty, show SAVE button
        if (record?.docstatus === 0) {
          setActiveButton("SAVE");
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [formMethods, record]);

  // Watch for lis_name changes
  React.useEffect(() => {
    if (!formMethods || !apiKey || !apiSecret) return;

    const { watch, setValue } = formMethods;

    const subscription = watch(async (value, { name, type }) => {
      if (name === "lis_name") {
        const lisName = value.lis_name;

        if (!lisName) {
          setValue("stage", [], { shouldDirty: true });
          return;
        }

        try {
          const resp = await axios.get(`${API_METHOD_URL}/quantlis_management.api.fetch_lis_name_stage`, {
            params: { lis_name: lisName },
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            withCredentials: true,
          });

          const rawList = resp.data.message || [];
          const formattedStages = rawList.map((item: any, idx: number) => ({
            doctype: "Stage Multiselect",
            stage: item.stage,
            idx: idx + 1
          }));

          isProgrammaticUpdate.current = true;
          setValue("stage", formattedStages, { shouldDirty: true });
          setTimeout(() => { isProgrammaticUpdate.current = false; }, 100);

        } catch (error: any) {
          console.error("Failed to fetch stages:", error);
          const messages = getApiMessages(
            null,
            error,
            "Stages fetched successfully",
            "Could not fetch stages for the selected LIS."
          );

          toast.error(messages.message, { description: messages.description, duration: Infinity });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [formMethods, apiKey, apiSecret]);

  // FETCH DOC
  React.useEffect(() => {
    const fetchDoc = async () => {
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
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          }
        );

        const data = resp.data.data as PrapanSuchi;
        setRecord(data);

        // Initialize button state based on document status (SAME AS ASSET DOCTYPE)
        if (data.docstatus === 0) {
          setActiveButton("SUBMIT");
        } else if (data.docstatus === 1) {
          setActiveButton("CANCEL");
        }

        setFormDirty(false);
      } catch (err: any) {
        const messages = getApiMessages(
          null,
          err,
          "Record loaded successfully",
          "Failed to load record",
          (error) => {
            if (error.response?.status === 404) return "Record not found";
            if (error.response?.status === 403) return "Unauthorized";
            return "Failed to load record";
          }
        );

        setError(messages.description || messages.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  // SAVE (UPDATE) DOCUMENT
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty && !formDirty) {
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

      const numericFields = ["amount"];
      numericFields.forEach((f) => {
        if (f in payload) {
          payload[f] = Number(payload[f]) || 0;
        }
      });

      // Process stage field
      if (payload.stage && Array.isArray(payload.stage)) {
        payload.stage = payload.stage.map((item, index) => {
          if (typeof item === 'string') {
            return {
              doctype: "Stage No",
              stage: item,
              idx: index + 1
            };
          }
          if (typeof item === 'object' && item !== null) {
            return {
              ...item,
              doctype: "Stage No",
              idx: item.idx || (index + 1)
            };
          }
          return {
            doctype: "Stage No",
            stage: String(item),
            idx: index + 1
          };
        });
      }

      payload.modified = record.modified;
      payload.docstatus = record.docstatus;

      const resp = await axios.put(
        `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${encodeURIComponent(docname)}`,
        payload,
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
      }

      if (resp.data && resp.data.data) {
        const updatedData = resp.data.data as PrapanSuchi;
        setRecord(updatedData);
        setFormDirty(false);

        // Update button state after save
        if (updatedData.docstatus === 0) {
          setActiveButton("SUBMIT");
        }

        // Force form remount
        setFormVersion((v) => v + 1);
      }

    } catch (err: any) {
      console.error("Save error:", err);
      const messages = getApiMessages(null, err, "Changes saved!", "Failed to save");
      toast.error(messages.message, { description: messages.description, duration: Infinity });
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        isProgrammaticUpdate.current = false;
      }, 100);
    }
  };

  // Determine submit label based on active button (SAME AS ASSET DOCTYPE)
  const getSubmitLabel = () => {
    if (isSaving) {
      switch (activeButton) {
        case "SAVE":
          return "Saving...";
        case "SUBMIT":
          return "Submitting...";
        case "CANCEL":
          return "Cancelling...";
        default:
          return "Processing...";
      }
    }

    switch (activeButton) {
      case "SAVE":
        return "Save";
      case "SUBMIT":
        return "Submit";
      case "CANCEL":
        return "Cancel";
      default:
        return undefined;
    }
  };

  // BUILD TABS
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!record) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue: f.name in record ? record[f.name as keyof PrapanSuchi] : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "fiscal_year",
            label: "Fiscal Year",
            type: "Link",
            linkTarget: "Fiscal Year",
            required: true,
          },
          {
            name: "lis_name",
            label: "LIS Name",
            type: "Link",
            linkTarget: "Lift Irrigation Scheme",
            required: true,
          },
          {
            name: "type",
            label: "Fund Head",
            type: "Link",
            linkTarget: "Fund Head",
            required: true,
          },
          {
            name: "stage",
            label: "Stage/Sub Scheme",
            type: "Table MultiSelect",
            linkTarget: "Stage No",
            filterMapping: [
              { sourceField: "lis_name", targetField: "lis_name" }
            ]
          },
          {
            name: "amount",
            label: "Amount",
            type: "Currency",
            required: true,
          },
          {
            name: "work_name",
            label: "Name of Work",
            type: "Text",
            required: true,
          },
          {
            name: "description",
            label: "Description",
            type: "Text",
          },
        ]),
      },
    ];
  }, [record]);

  // UI STATES
  if (loading) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading prapan suchi details...</p>
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

  const formKey = `${record.name}-${record.docstatus}-${formVersion}`;

  // RENDER FORM
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
        description={`Status: ${record?.docstatus === 1 ? 'Submitted' : record?.docstatus === 2 ? 'Cancelled' : 'Draft'}`}
        submitLabel={getSubmitLabel()}
        isSubmittable={activeButton === "SUBMIT" || record.docstatus === 1}
        docstatus={record.docstatus}
        initialStatus={getCurrentStatus()}
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/tender/doctype/prapan-suchi",
        }}
        onFormInit={(methods) => setFormMethods(methods)}
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