"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormContext } from "react-hook-form";
import {
  DynamicForm,
  FormField,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { PumpHoursPivotTable, PumpHourRow } from "@/components/PumpHoursPivotTable";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
const DOCTYPE = "Schemewise Pump Hours";
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function PumpHoursMatrixField() {
  const { watch, setValue } = useFormContext();
  const lisName = watch("lis_name") || "";
  const stage = watch("stage") || "";
  const month = watch("month") || "";
  const year = watch("year") || "";

  return (
    <div className="form-panel" style={{ marginTop: "0.5rem" }}>
      <div
        className="form-panel__header"
        style={{
          padding: "0.9rem 1.2rem",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
          Pump Hours Matrix
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "0.8rem",
            color: "var(--color-text-secondary)",
          }}
        >
          Enter hours for each pump per date
        </p>
      </div>
      <div className="form-panel__body" style={{ padding: "1rem" }}>
        <PumpHoursPivotTable
          key={`${lisName}-${stage}-${month}-${year}`}
          lisName={lisName}
          stage={stage}
          month={month}
          year={year}
          onChange={(rows) => {
            setValue("pump_hours", rows, {
              shouldDirty: true,
              shouldTouch: true,
            });
          }}
        />
      </div>
    </div>
  );
}

export default function NewSchemewisePumpHoursPage() {
  const router = useRouter();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    const fields = (list: FormField[]): FormField[] => list;

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "lis_name",
            label: "LIS Name",
            type: "Link",
            linkTarget: "Lift Irrigation Scheme",
            required: true,
            description: "Select the lift irrigation scheme",
          },
          {
            name: "stage",
            label: "Stage",
            type: "Link",
            linkTarget: "Stage No",
            required: true,
            filterMapping: [{ sourceField: "lis_name", targetField: "lis_name" }],
            description: "Select the stage for the selected scheme",
          },
           {
            name: "month",
            label: "Month",
            type: "Select",
            required: true,
            options: MONTHS.map((month) => ({ label: month, value: month })),
            placeholder: "Select Month",
          },
          {
            name: "year",
            label: "Year",
            type: "Link",
            linkTarget: "Year",
            required: true,
          },
         
          {
            name: "pump_hours",
            label: "",
            type: "Custom",
            fieldColumns: 4,
            defaultValue: [],
            customElement: <PumpHoursMatrixField />,
          },
        ]),
      },
    ];
  }, []);

  const handleSubmit = async (data: Record<string, any>) => {
    setIsSaving(true);

    try {
      const payload = {
        doctype: DOCTYPE,
        lis_name: data.lis_name,
        stage: data.stage,
        year: data.year,
        month: data.month,
        pump_hours: (data.pump_hours || []).map((row: PumpHourRow) => ({
          pump: row.pump,
          reading_date: row.reading_date,
          hours: Number(row.hours) || 0,
        })),
      };

      const resp = await fetch(`${API_BASE_URL}/${DOCTYPE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `token ${apiKey}:${apiSecret}`,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const responseData = await resp.json();

      if (!resp.ok) {
        throw new Error(
          responseData.exception ||
          responseData._server_messages ||
          "Failed to create"
        );
      }

      toast.success("Schemewise Pump Hours created!");
      router.push(
        `/operations/doctype/schemewise_pump_hours/${encodeURIComponent(responseData.data.name)}`
      );
    } catch (err: any) {
      toast.error("Failed to create", {
        description: err.message,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
      title="New Schemewise Pump Hours"
      description="Create a new monthly pump hours record"
      submitLabel={isSaving ? "Saving..." : "Save"}
    />
  );
}
