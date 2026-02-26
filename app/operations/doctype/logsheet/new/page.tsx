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
import {
  fetchCurrentUserInfo,
  fetchTemperatureNames,
  populateUserInfo,
  populateTemperatureReadings,
} from "../services";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

export default function NewLogSheetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);
  const doctypeName = "Log Sheet";

  // Store form methods
  const [formMethods, setFormMethods] = React.useState<UseFormReturn<any> | null>(null);

  const duplicateData = React.useMemo(() => {
    const duplicateParam = searchParams.get('duplicate');
    if (!duplicateParam) return null;
    try {
      const decodedData = JSON.parse(atob(decodeURIComponent(duplicateParam)));
      return decodedData;
    } catch (error) {
      toast.error("Failed to parse duplicate data", { duration: Infinity });
      return null;
    }
  }, [searchParams]);
  const notificationShown = React.useRef(false);
  React.useEffect(() => {
    if (duplicateData && !notificationShown.current) {
      toast.success("Form populated with duplicate data. Modify as needed and save.");
      notificationShown.current = true;
    }
  }, [duplicateData]);

  // Fetch current user info
  React.useEffect(() => {
    const fetchAndPopulateUserInfo = async () => {
      if (!apiKey || !apiSecret) return;

      const userInfo = await fetchCurrentUserInfo(apiKey, apiSecret);
      populateUserInfo(userInfo, formMethods);
    };

    fetchAndPopulateUserInfo();
  }, [apiKey, apiSecret, formMethods]);

  // Fetch temperature names and populate temperature_readings table
  React.useEffect(() => {
    const fetchAndPopulateTemperatureNames = async () => {
      if (!apiKey || !apiSecret || !formMethods) return;

      const temperatureRows = await fetchTemperatureNames(apiKey, apiSecret);
      populateTemperatureReadings(temperatureRows, formMethods);
    };

    fetchAndPopulateTemperatureNames();
  }, [apiKey, apiSecret, formMethods]);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    const getValue = (fieldName: string, defaultValue: any = undefined) => {
      return duplicateData?.[fieldName] ?? defaultValue;
    };

    return [
      {
        name: "Details",
        fields: [
          {
            name: "lis",
            label: "LIS",
            type: "Link",
            required: true,
            linkTarget: "Lift Irrigation Scheme",
            defaultValue: getValue("lis"),
          },
          {
            name: "stage",
            label: "Stage/ Sub Scheme",
            type: "Link",
            linkTarget: "Stage No",
            defaultValue: getValue("stage"),
            required: true,
            filterMapping: [
              { sourceField: "lis", targetField: "lis_name" }
            ]
          },
          {
            name: "date",
            label: "Date",
            type: "Date",
            required: true,
            defaultValue: getValue("date"),
          },
          {
            name: "time",
            label: "Time",
            type: "Time",
            required: true,
            defaultValue: getValue("time") || new Date().toTimeString().slice(0, 5),
          },
          {
            name: "asset",
            label: "Asset",
            type: "Link",
            required: true,
            linkTarget: "Asset",
            customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
            customSearchParams: {
              filters: {
                asset_category: "Pump",
                custom_pump_status: "Running"
              }
            },
            filters: (getValue) => ({
              custom_stage_no: getValue("stage"),
              custom_lis_name: getValue("lis")
            }),
            referenceDoctype: "Log Sheet",
            doctype: "Asset",
            defaultValue: getValue("asset"),
          },
          {
            name: "logbook",
            label: "Pump No",
            type: "Link",
            linkTarget: "Logbook Ledger",
            defaultValue: getValue("logbook"),
            fetchFrom: { sourceField: "asset", targetDoctype: "Asset", targetField: "custom_asset_no" }
          },
          {
            name: "operator_id",
            label: "Operator ID",
            type: "Read Only",
            defaultValue: getValue("operator_id"),
          },
          {
            name: "operator_name",
            label: "Operator Name",
            type: "Read Only",
            defaultValue: getValue("operator_name"),
          },
          { name: "section_break_mgrv", label: "", type: "Section Break" },
          {
            name: "water_level",
            label: "Water Level (In Meters)",
            type: "Float",
            defaultValue: getValue("water_level"),
            precision: 2,
          },
          {
            name: "pressure_guage",
            label: "Pressure Guage Reading (in Kg/cm2)",
            type: "Float",
            defaultValue: getValue("pressure_guage"),
            precision: 2,
          },
          { name: "voltage_section", label: "Voltage Reading (In Volt)", type: "Section Break" },
          { name: "br", label: "BR", type: "Float", defaultValue: getValue("br"), precision: 2 },
          { name: "ry", label: "RY", type: "Float", defaultValue: getValue("ry"), precision: 2 },
          { name: "yb", label: "YB", type: "Float", defaultValue: getValue("yb"), precision: 2 },
          { name: "current_reading_section", label: "Current Reading (In Ampere)", type: "Section Break" },
          { name: "r", label: "R", type: "Float", defaultValue: getValue("r"), precision: 2 },
          { name: "y", label: "Y", type: "Float", defaultValue: getValue("y"), precision: 2 },
          { name: "b", label: "B", type: "Float", defaultValue: getValue("b"), precision: 2 },
          { name: "section_break_qzro", label: "", type: "Section Break" },
          {
            name: "temperature_readings",
            label: "Temperature Readings (In °C)",
            className: "big-table-label",
            type: "Table",
            columns: [
              {
                name: "temperature",
                label: "Temperature",
                type: "Link",
                linkTarget: "Temperature Readings",
              },
              {
                name: "temp_value",
                label: "Temp Value",
                type: "Float",
                precision: 2,
              },
            ],
          },
          {
            name: "remark",
            label: "Remark",
            type: "Small Text",
            defaultValue: getValue("remark"),
          },
        ],
      }
    ];
  }, [duplicateData]);

  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    const hasValidData = isDirty || (duplicateData && data.date);

    if (!hasValidData) {
      toast.info("Please fill out the form.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = { ...data };
      delete payload.section_break_mgrv;
      delete payload.voltage_section;
      delete payload.current_reading_section;
      delete payload.section_break_qzro;
      payload.doctype = doctypeName;
      const floatFields = [
        "water_level", "pressure_guage",
        "br", "ry", "yb",
        "r", "y", "b"
      ];
      floatFields.forEach(field => {
        if (field in payload) {
          payload[field] = Number(payload[field]) || 0;
        }
      });
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `token ${apiKey}:${apiSecret}`,
      };
      const resp = await fetch(`${API_BASE_URL}/${doctypeName}`, {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const responseData = await resp.json();
      const docName = responseData.data.name;
      if (!resp.ok) {
        console.log("Full server error:", responseData);
        throw new Error(responseData.exception || responseData._server_messages || "Failed to create document");
      }
      toast.success("Log Sheet created successfully!");
      router.push(`/operations/doctype/logsheet/${encodeURIComponent(docName)}`);
    } catch (err: any) {
      console.error("Save error:", err);
      if (err.response?.data?.exc_type === "DuplicateEntryError") {
        toast.error("Duplicate Entry Error", {
          description: "This Log Sheet record may already exist.",
          duration: Infinity
        });
      } else {
        toast.error("Failed to create Log Sheet", {
          description: err.message || "Check console for details.",
          duration: Infinity
        });
      }
    } finally {
      setIsSaving(false);
    }
  };
  const handleCancel = () => router.back();
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title="New Log Sheet"
      description="Create a new Log Sheet record"
      submitLabel={isSaving ? "Saving..." : "Create"}
      cancelLabel="Cancel"
      onFormInit={setFormMethods}
    />
  );
}