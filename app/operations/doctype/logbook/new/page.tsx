"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { UseFormReturn } from "react-hook-form";
import axios from "axios";

// Base URL for Resources
const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
// Base URL for RPC Methods (Custom Python logic)
const API_METHOD_URL = "http://103.219.3.169:2223/api/method";

export default function NewLogbookPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  // State for dynamic table label
  const [primaryListLabel, setPrimaryListLabel] = React.useState("Available Pumps");

  // Store form methods
  const [formMethods, setFormMethods] = React.useState<UseFormReturn<any> | null>(null);

  // State to track current operation for dynamic validation
  const [currentOperation, setCurrentOperation] = React.useState("");

  const doctypeName = "Logbook";

  // Fetch current user info
  React.useEffect(() => {
    const fetchCurrentUserInfo = async () => {
      if (!apiKey || !apiSecret) return;

      try {
        const response = await fetch(
          "http://103.219.3.169:2223/api/method/quantlis_management.api.get_current_user_info",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `token ${apiKey}:${apiSecret}`,
            },
          }
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const { user, full_name } = data.message || {};

        if (user && full_name && formMethods) {
          formMethods.setValue("operator_id", user);
          formMethods.setValue("operator_name", full_name);
          formMethods.setValue("operator_id_1", user);
          formMethods.setValue("operator_name_1", full_name);
        }
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    };

    fetchCurrentUserInfo();
  }, [apiKey, apiSecret, formMethods]);

  const duplicateData = React.useMemo(() => {
    const duplicateParam = searchParams.get('duplicate');
    if (!duplicateParam) return null;
    try {
      return JSON.parse(atob(decodeURIComponent(duplicateParam)));
    } catch (error) {
      return null;
    }
  }, [searchParams]);

  // Initialize state with initial pump operation value
  React.useEffect(() => {
    setCurrentOperation(duplicateData?.pump_operation || "");
  }, [duplicateData]);

  React.useEffect(() => {
    if (!formMethods || !apiKey || !apiSecret) return;

    const subscription = formMethods.watch(async (value, { name }) => {
      const form = formMethods;

      // ➤ LOGIC A: Handle Radio Button Selection
      if (name === "pump_operation") {
        // Update state to track current operation for dynamic required validation
        setCurrentOperation(value.pump_operation);

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

      // ➤ LOGIC C: Sync Lists
      if (name && name.startsWith("primary_list")) {
        syncPrimaryToSecondary();
      }
    });

    const fetchPumps = async (status: "Running" | "Stopped") => {
      const values = formMethods.getValues();
      if (!values.lis_name || !values.stage) return;

      try {
        const resp = await axios.get(`${API_METHOD_URL}/quantlis_management.operations.doctype.logbook.logbook.get_primary_list_with_motor`, {
          params: {
            lis_name: values.lis_name,
            stage: values.stage,
            status: status
          },
          headers: { Authorization: `token ${apiKey}:${apiSecret}` }
        });

        const pumps = resp.data.message || [];
        const tableData = pumps.map((p: any) => ({
          pump: p.pump,
          pump_no: p.pump_no,
          motor: p.motor,
          motor_no: p.motor_no,
          check: 0
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
        .map((row: any) => ({
          pump: row.pump,
          pump_no: row.pump_no,
          motor: row.motor
        }));

      const currentSec = formMethods.getValues("secondary_list");
      if (JSON.stringify(currentSec) !== JSON.stringify(newSecondaryList)) {
        formMethods.setValue("secondary_list", newSecondaryList);
      }
    };

    return () => subscription.unsubscribe();
  }, [formMethods, apiKey, apiSecret]);

  /* -------------------------------------------------
      3. FORM DEFINITION
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    const getValue = (field: string, def: any = undefined) => duplicateData?.[field] ?? def;

    // Variable for conditional required validation based on pump operation
    const isStopOperationRequired = currentOperation === "stop" || getValue("pump_operation") === "stop";

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
              { label: "Stop Pump", value: "stop", className: "text-red-600" }
            ],
            defaultValue: getValue("pump_operation", ""),
          },
          { name: "cb_mode", label: "", type: "Column Break" },
          { name: "sec_location", label: "Location & Date", type: "Section Break" },
          {
            name: "entry_date",
            label: "Entry Date",
            type: "Date",
            defaultValue: getValue("entry_date", new Date().toISOString().split('T')[0]),
          },
          {
            name: "lis_name",
            label: "LIS Name",
            type: "Link",
            linkTarget: "Lift Irrigation Scheme",
            defaultValue: getValue("lis_name"),
            required: true
          },
          {
            name: "stage",
            label: "Stage",
            type: "Link",
            linkTarget: "Stage No",
            defaultValue: getValue("stage"),
            required: true,
            filterMapping: [{ sourceField: "lis_name", targetField: "lis_name" }],
          },
          {
            name: "sec_details",
            label: "Operation Details",
            type: "Section Break",
            displayDependsOn: "pump_operation == 'start' || pump_operation == 'stop'"
          },
          {
            name: "start_datetime",
            label: "Start Datetime",
            type: "DateTime",
            defaultValue: getValue("start_datetime"),
            required: true,
            displayDependsOn: "pump_operation == 'start'"
          },
          {
            name: "operator_id",
            label: "Operator ID",
            type: "Read Only",
            linkTarget: "User",
            readOnly: true,
            displayDependsOn: "pump_operation == 'start'"
          },
          {
            name: "operator_name",
            label: "Operator Name",
            type: "Read Only",
            readOnly: true,
            displayDependsOn: "pump_operation == 'start'"
          },
          {
            name: "stop_datetime",
            label: "Stop Datetime",
            type: "DateTime",
            defaultValue: getValue("stop_datetime"),
            required: true,
            displayDependsOn: "pump_operation == 'stop'"
          },
          {
            name: "pump_stop_reason",
            label: "Pump Stop Reason",
            type: "Link",
            linkTarget: "Pump Stop Reasons",
            defaultValue: getValue("pump_stop_reason"),
            displayDependsOn: "pump_operation == 'stop'",
            required: isStopOperationRequired
          },

           {
            name: "status",
            label: "Status",
            type: "Read Only",
            readOnly: true,
            displayDependsOn: "pump_operation == 'start' || pump_operation == 'stop'"
          },
          
          {
            name: "operator_id_1",
            label: "Operator ID",
            type: "Read Only",
            linkTarget: "User",
            displayDependsOn: "pump_operation == 'stop'"
          },
          {
            name: "operator_name_1",
            label: "Operator Name",
            type: "Read Only",
            displayDependsOn: "pump_operation == 'stop'"
          },
          {
            name: "specify",
            label: "Specify Reason",
            type: "Text",
            defaultValue: getValue("specify"),
            displayDependsOn: "pump_stop_reason == 'Other'"
          },
         
          {
            name: "primary_list",
            label: primaryListLabel,
            type: "Table",
            displayDependsOn: "pump_operation == 'start' || pump_operation == 'stop'",
            defaultValue: getValue("primary_list", []),
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
            label: "Selected for Update (System Auto-Fill)",
            type: "Table",
            displayDependsOn: "pump_operation == 'start' || pump_operation == 'stop'",
            defaultValue: getValue("secondary_list", []),
            columns: [
              { name: "pump", label: "Pump", type: "Link", linkTarget: "Asset" },
              { name: "pump_no", label: "Pump No", type: "Data" },
            ],
          },
        ],
      },
    ];
  }, [duplicateData, primaryListLabel, currentOperation]);

  /* -------------------------------------------------
      4. SUBMIT
  ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!data.pump_operation) {
      toast.error("Please select either Start Pump or Stop Pump", { duration: Infinity });
      return;
    }

    // 2. BETTER: Conditional Validation Logic
    // Explicitly check for missing fields based on operation type
    if (data.pump_operation === 'start') {
      if (!data.start_datetime) {
        toast.error("Start Datetime is required", { duration: Infinity });
        return;
      }
    }

    if (data.pump_operation === 'stop') {
      if (!data.stop_datetime) {
        toast.error("Stop Datetime is required", { duration: Infinity });
        return;
      }
      // This fixes your specific issue:
      if (!data.pump_stop_reason) {
        toast.error("Pump Stop Reason is required", { duration: Infinity });
        return;
      }
    }
    if (!data.secondary_list || data.secondary_list.length === 0) {
      toast.error("Please select at least one pump", { duration: Infinity });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, any> = { ...data, doctype: doctypeName };

      // Transform radio value back to checkbox format for API
      if (data.pump_operation === "start") {
        payload.start_pump = 1;
        payload.stop_pump = 0;
        delete payload.stop_datetime;
        delete payload.pump_stop_reason;
        delete payload.specify;
        delete payload.operator_id_1;
        delete payload.operator_name_1;
      } else {
        payload.start_pump = 0;
        payload.stop_pump = 1;
        delete payload.start_datetime;
        delete payload.operator_id;
        delete payload.operator_name;
      }

      // Remove the radio field as API doesn't expect it
      delete payload.pump_operation;

      if (Array.isArray(payload.primary_list)) {
        payload.primary_list = payload.primary_list.map((row: any) => ({
          ...row,
          check: row.check ? 1 : 0,
        }));
      }

      const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, payload, {
        headers: { Authorization: `token ${apiKey}:${apiSecret}` }
      });

      toast.success("Logbook created successfully!");
      router.push(`/operations/doctype/logbook/${encodeURIComponent(response.data.data.name)}`);
    } catch (err: any) {
      toast.error(err.response?.data?.exception || "Failed to save", { duration: Infinity });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
      title="New Logbook"
      description="Record pump operations"
      submitLabel={isSaving ? "Saving..." : "Create"}
      onFormInit={setFormMethods}
    />
  );
}