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

// 🟢 CONFIGURATION
const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
const API_METHOD_URL = "http://103.219.3.169:2223/api/method";
const DOCTYPE_NAME = "Logbook";

// 🟢 INTERFACES
interface LogbookData {
  name: string;
  entry_date?: string;
  lis_name?: string;
  stage?: string;
  status?: string; // Field that holds "Running" or "Stopped"
  start_pump?: 0 | 1;
  stop_pump?: 0 | 1;
  start_datetime?: string;
  operator_id?: string;
  operator_name?: string;
  stop_datetime?: string;
  operator_id_1?: string;
  operator_name_1?: string;
  pump_stop_reason?: string;
  specify?: string;
  primary_list?: Array<{
    pump?: string;
    pump_no?: number;
    motor?: string;
    motor_no?: string;
    check?: 0 | 1;
  }>;
  secondary_list?: Array<{
    pump?: string;
    pump_no?: number;
  }>;
  docstatus: 0 | 1 | 2;
  modified: string;
  owner?: string;
  modified_by?: string;
}

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const docname = params.id as string;

  const [logbook, setLogbook] = React.useState<LogbookData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [formMethods, setFormMethods] = React.useState<UseFormReturn<any> | null>(null);
  const isProgrammaticUpdate = React.useRef(false);
  const [formVersion, setFormVersion] = React.useState(0);
  const [formInstance, setFormInstance] = React.useState<any>(null);

  // State for dynamic table label
  const [primaryListLabel, setPrimaryListLabel] = React.useState("Available Pumps");

  // 🟢 Track which button to show (SAME AS LOGSHEET)
  const [activeButton, setActiveButton] = React.useState<"SAVE" | "SUBMIT" | "CANCEL" | null>(null);
  const [formDirty, setFormDirty] = React.useState(false);

  // 🟢 Badge Status Logic
  const getCurrentStatus = () => {
    if (!logbook) return "";

    // 1. If Cancelled
    if (logbook.docstatus === 2) return "Cancelled";

    // 2. If Submitted (Show Operational Status)
    if (logbook.docstatus === 1) {
      return logbook.status || "Submitted";
    }

    // 3. If Draft (docstatus === 0)
    if (logbook.docstatus === 0) {
      if (formDirty) {
        return "Not Saved";
      }
      return "Draft";
    }

    return "";
  };

  // 🟢 1. FETCH RECORD (UPDATED LIKE LOGSHEET)
  const fetchRecord = async () => {
    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;
    try {
      setLoading(true);
      setError(null);

      const resp = await axios.get(
        `${API_BASE_URL}/${DOCTYPE_NAME}/${encodeURIComponent(docname)}`,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      const data = resp.data.data as LogbookData;
      setLogbook(data);

      // Initialize button state based on document status (SAME AS LOGSHEET)
      if (data.docstatus === 0) {
        // Draft
        setActiveButton("SUBMIT");
      } else if (data.docstatus === 1) {
        // Submitted
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
          if (error.response?.status === 404) return "Logbook not found";
          if (error.response?.status === 403) return "Unauthorized";
          return "Failed to load record";
        }
      );

      setError(messages.description || messages.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchRecord();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  // 🟢 Watch for form changes (SAME AS LOGSHEET)
  React.useEffect(() => {
    if (!formInstance) return;

    const subscription = formInstance.watch((value: any, { name }: { name?: string }) => {
      // Watch for form changes to mark as dirty
      if (name && !isProgrammaticUpdate.current) {
        setFormDirty(true);
        // When form becomes dirty, show SAVE button
        if (logbook?.docstatus === 0) {
          setActiveButton("SAVE");
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [formInstance, logbook?.docstatus]);

  const handleFormInit = React.useCallback((form: any) => {
    setFormInstance(form);
  }, []);

  // 🟢 AUTOMATION LOGIC (UPDATED with isProgrammaticUpdate)
  React.useEffect(() => {
    if (!formMethods || !apiKey || !apiSecret || !logbook) return;

    const subscription = formMethods.watch(async (value, { name }) => {
      const form = formMethods;

      // Mark as programmatic update for automation
      isProgrammaticUpdate.current = true;

      // ➤ LOGIC A: Handle Radio Button Selection
      if (name === "pump_operation") {
        if (value.pump_operation === "start") {
          setPrimaryListLabel("Stopped Pumps (Select to Start)");
          fetchPumps("Stopped");
          // Set status to "Running" for start operation
          form.setValue("status", "Running");
        } else if (value.pump_operation === "stop") {
          setPrimaryListLabel("Running Pumps (Select to Stop)");
          fetchPumps("Running");
          // Set status to "Stopped" for stop operation
          form.setValue("status", "Stopped");
        }
      }

      // ➤ LOGIC B: Fetch Pumps on Context Change
      if (name === "lis_name" || name === "stage") {
        const operation = form.getValues("pump_operation");
        if (operation === "start") fetchPumps("Stopped");
        else if (operation === "stop") fetchPumps("Running");
      }

      if (name && name.startsWith("primary_list")) {
        syncPrimaryToSecondary();
      }

      // Reset programmatic update flag
      setTimeout(() => {
        isProgrammaticUpdate.current = false;
      }, 100);
    });

    const fetchPumps = async (status: "Running" | "Stopped") => {
      const values = formMethods.getValues();
      if (!values.lis_name || !values.stage) return;
      try {
        const resp = await axios.get(
          `${API_METHOD_URL}/quantlis_management.operations.doctype.logbook.logbook.get_primary_list_with_motor`,
          {
            params: { lis_name: values.lis_name, stage: values.stage, status: status },
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
          }
        );
        const tableData = (resp.data.message || []).map((p: any) => ({
          pump: p.pump,
          pump_no: p.pump_no,
          motor: p.motor,
          motor_no: p.motor_no,
          check: 0,
        }));
        formMethods.setValue("primary_list", tableData);
        formMethods.setValue("secondary_list", []);
      } catch (error) {
        toast.error("Failed to load pump list", { duration: Infinity });
      }
    };

    const syncPrimaryToSecondary = () => {
      const primaryList = formMethods.getValues("primary_list") || [];
      const newSecondaryList = primaryList
        .filter((row: any) => row.check === 1 || row.check === true)
        .map((row: any) => ({ pump: row.pump, pump_no: row.pump_no, motor: row.motor }));
      formMethods.setValue("secondary_list", newSecondaryList);
    };
    return () => subscription.unsubscribe();
  }, [formMethods, apiKey, apiSecret, logbook]);

  // 🟢 FORM DEFINITION
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!logbook) return [];

    const getVal = (key: string, def?: any) => {
      if (key === "pump_operation") {
        // Convert start_pump/stop_pump back to pump_operation for UI
        if (logbook.start_pump === 1) return "start";
        if (logbook.stop_pump === 1) return "stop";
        return "";
      }
      return logbook[key as keyof LogbookData] ?? def;
    };

    return [
      {
        name: "Details",
        fields: [
          {
            name: "pump_operation",
            label: "Operation",
            type: "Radio",
            options: [
              { label: "Start Pump", value: "start", className: "text-green-600" },
              { label: "Stop Pump", value: "stop", className: "text-red-600" },
            ],
            defaultValue: getVal("pump_operation", ""),
          },
          { name: "cb_mode", label: "", type: "Column Break" },
          { name: "sec_location", label: "Location & Date", type: "Section Break" },
          { name: "entry_date", label: "Entry Date", type: "Date", defaultValue: getVal("entry_date") },
          {
            name: "lis_name",
            label: "LIS Name",
            type: "Link",
            linkTarget: "Lift Irrigation Scheme",
            defaultValue: getVal("lis_name"),
            required: true,
          },
          {
            name: "stage",
            label: "Stage",
            type: "Link",
            linkTarget: "Stage No",
            defaultValue: getVal("stage"),
            required: true,
            filterMapping: [{ sourceField: "lis_name", targetField: "lis_name" }],
          },
          { name: "sec_details", label: "Operation Details", type: "Section Break" },
          {
            name: "start_datetime",
            label: "Start Datetime",
            type: "DateTime",
            defaultValue: getVal("start_datetime"),
            required: true,
            displayDependsOn: "pump_operation == 'start'",
          },
          {
            name: "operator_id",
            label: "Operator ID",
            type: "Read Only",
            linkTarget: "User",
            defaultValue: getVal("operator_id"),
            readOnly: true,
            displayDependsOn: "pump_operation == 'start'",
          },
          {
            name: "operator_name",
            label: "Operator Name",
            type: "Read Only",
            defaultValue: getVal("operator_name"),
            readOnly: true,
            displayDependsOn: "pump_operation == 'start'",
          },
          {
            name: "stop_datetime",
            label: "Stop Datetime",
            type: "DateTime",
            defaultValue: getVal("stop_datetime"),
            required: true,
            displayDependsOn: "pump_operation == 'stop'",
          },
          {
            name: "pump_stop_reason",
            label: "Pump Stop Reason",
            type: "Link",
            linkTarget: "Pump Stop Reasons",
            defaultValue: getVal("pump_stop_reason"),
            displayDependsOn: "pump_operation == 'stop'",
            required: true,
          },

          {
            name: "status",
            label: "Status",
            type: "Read Only",
            readOnly: true,
            defaultValue: getVal("status"),
            displayDependsOn: "pump_operation == 'start' || pump_operation == 'stop'",
          },
          {
            name: "operator_id_1",
            label: "Operator ID",
            type: "Read Only",
            linkTarget: "User",
            defaultValue: getVal("operator_id_1"),
            readOnly: true,
            displayDependsOn: "pump_operation == 'stop'",
          },
          {
            name: "operator_name_1",
            label: "Operator Name",
            type: "Read Only",
            defaultValue: getVal("operator_name_1"),
            readOnly: true,
            displayDependsOn: "pump_operation == 'stop'",
          },
          {
            name: "specify",
            label: "Specify (if Other)",
            type: "Small Text",
            defaultValue: getVal("specify"),
            displayDependsOn: "pump_stop_reason == 'Other'",
          },

          { name: "sec_assets", label: "Asset Selection", type: "Section Break" },
          {
            name: "primary_list",
            label: primaryListLabel,
            type: "Table",
            defaultValue: getVal("primary_list", []),
            columns: [
              { name: "pump", label: "Pump", type: "Link", linkTarget: "Asset" },
              { name: "motor", label: "Motor", type: "Link", linkTarget: "Asset" },
              { name: "pump_no", label: "Pump No", type: "Data" },
              { name: "motor_no", label: "Motor No", type: "Data" },
              { name: "check", label: "Select", type: "Check" },
            ],
          },
          {
            name: "secondary_list",
            label: "Selected for Update",
            type: "Table",
            defaultValue: getVal("secondary_list", []),
            columns: [
              { name: "pump", label: "Pump", type: "Link", linkTarget: "Asset" },
              { name: "pump_no", label: "Pump No", type: "Data" },
            ],
          },
        ],
      },
    ];
  }, [logbook, primaryListLabel]);

  // 🟢 SAVE (UPDATE) DOCUMENT (SAME AS LOGSHEET)
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    if (!logbook) {
      toast.error("Record not loaded. Cannot save.", { duration: Infinity });
      return;
    }

    setIsSaving(true);
    isProgrammaticUpdate.current = true;

    try {
      const payload: Record<string, any> = JSON.parse(JSON.stringify(data));

      const allFields = formTabs.flatMap((tab) => tab.fields);
      const nonDataFields = new Set<string>();
      allFields.forEach((field) => {
        if (
          field.type === "Section Break" ||
          field.type === "Column Break" ||
          field.type === "Read Only"
        ) {
          nonDataFields.add(field.name);
        }
      });

      const finalPayload: Record<string, any> = {};
      for (const key in payload) {
        if (!nonDataFields.has(key)) {
          finalPayload[key] = payload[key];
        }
      }

      finalPayload.modified = logbook.modified;
      finalPayload.docstatus = logbook.docstatus;

      // Transform radio value back to checkbox format for API
      if (data.pump_operation === "start") {
        finalPayload.start_pump = 1;
        finalPayload.stop_pump = 0;
        finalPayload.status = "Running";
        // Remove stop-related fields
        delete finalPayload.stop_datetime;
        delete finalPayload.pump_stop_reason;
        delete finalPayload.specify;
        delete finalPayload.operator_id_1;
        delete finalPayload.operator_name_1;
      } else if (data.pump_operation === "stop") {
        finalPayload.start_pump = 0;
        finalPayload.stop_pump = 1;
        finalPayload.status = "Stopped";
        // Remove start-related fields
        delete finalPayload.start_datetime;
        delete finalPayload.operator_id;
        delete finalPayload.operator_name;
      }

      // Remove the radio field as API doesn't expect it
      delete finalPayload.pump_operation;

      // Convert table check fields to 0/1
      if (Array.isArray(finalPayload.primary_list)) {
        finalPayload.primary_list = finalPayload.primary_list.map((row: any) => ({
          ...row,
          check: row.check ? 1 : 0,
        }));
      }

      const resp = await axios.put(
        `${API_BASE_URL}/${DOCTYPE_NAME}/${encodeURIComponent(docname)}`,
        finalPayload,
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
        // Update state with new data
        const updatedData = resp.data.data as LogbookData;
        setLogbook(updatedData);
        setFormDirty(false);

        // Update button state after save
        if (updatedData.docstatus === 0) {
          // Still draft
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
      isProgrammaticUpdate.current = false;
    }
  };

  // 🟢 SUBMIT DOCUMENT (SAME AS LOGSHEET)
  const handleSubmitDocument = async () => {
    if (!logbook) return;

    setIsSaving(true);

    try {
      // Prepare payload similar to handleSubmit
      const payload: Record<string, any> = { ...logbook };

      // Set docstatus to 1 (submitted)
      payload.docstatus = 1;

      const response = await axios.put(
        `${API_BASE_URL}/${DOCTYPE_NAME}/${encodeURIComponent(docname)}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
        }
      );

      toast.success("Document submitted successfully!");

      // Update local state without reload
      const updatedData = response.data.data as LogbookData;
      setLogbook(updatedData);
      setFormDirty(false);

      // Update button to CANCEL after submission
      setActiveButton("CANCEL");

      // Force form remount with new docstatus
      setFormVersion((v) => v + 1);
    } catch (err: any) {
      console.error("Submit error:", err);
      const messages = getApiMessages(
        null,
        err,
        "Document submitted successfully!",
        "Submit failed"
      );
      toast.error(messages.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 🟢 CANCEL DOCUMENT (SAME AS LOGSHEET)
  const handleCancelDocument = async () => {
    if (!logbook) return;

    if (!window.confirm("Are you sure you want to cancel this Logbook? This action cannot be undone.")) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        docstatus: 2,
        modified: logbook.modified,
      };

      const resp = await axios.put(
        `${API_BASE_URL}/${DOCTYPE_NAME}/${encodeURIComponent(docname)}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
        }
      );

      toast.success("Document cancelled successfully!");

      // Update local state without reload
      const updatedRecord = resp.data.data as LogbookData;
      setLogbook(updatedRecord);
      setActiveButton(null); // Remove cancel button after cancellation
    } catch (err: any) {
      console.error("Cancel error:", err);
      const messages = getApiMessages(
        null,
        err,
        "Document cancelled successfully!",
        "Cancel failed"
      );
      toast.error(messages.message);
    } finally {
      setIsSaving(false);
    }
  };

  /* -------------------------------------------------
       8. UI STATES
       ------------------------------------------------- */
  if (loading) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading Logbook details...</p>
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

  if (!logbook) {
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        <p>Logbook record not found.</p>
      </div>
    );
  }

  // Determine submit label based on active button (SAME AS LOGSHEET)
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

  const isSubmitted = logbook.docstatus === 1;
  const isDraft = logbook.docstatus === 0;

  const formKey = `${logbook.name}-${logbook.docstatus}-${formVersion}`;

  /* -------------------------------------------------
       9. RENDER FORM (SAME AS LOGSHEET)
       ------------------------------------------------- */
  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        key={formKey}
        tabs={formTabs}
        onSubmit={activeButton === "SAVE" ? handleSubmit : async () => { }}
        onSubmitDocument={activeButton === "SUBMIT" ? handleSubmitDocument : undefined}
        onCancelDocument={activeButton === "CANCEL" ? handleCancelDocument : undefined}
        onCancel={() => router.push("/operations/doctype/logbook")}
        title={`${DOCTYPE_NAME}: ${logbook.name}`}
        description={`Update details for record ID: ${docname}`}
        isSubmittable={activeButton === "SUBMIT"}
        docstatus={logbook.docstatus}
        initialStatus={isDraft ? "Draft" : isSubmitted ? "Submitted" : "Cancelled"}
        onFormInit={handleFormInit}
        submitLabel={getSubmitLabel()}
        deleteConfig={{
          doctypeName: DOCTYPE_NAME,
          docName: docname,
          redirectUrl: "/operations/doctype/logbook",
        }}
      />

      <div className="w-full px-4 md:px-8">
        <DocumentActivity
          doctype={DOCTYPE_NAME}
          docname={docname}
          baseUrl={API_BASE_URL.replace("/api/resource", "")}
          apiKey={apiKey || ""}
          apiSecret={apiSecret || ""}
          isInitialized={isInitialized}
          currentUserEmail={logbook.owner}
          modifiedStr={logbook.modified}
          modifiedBy={logbook.modified_by}
        />
      </div>
    </div>
  );
}