"use client";

import * as React from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { useFormContext } from "react-hook-form";
import {
  DynamicForm,
  FormField,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { PumpHoursPivotTable, PumpHourRow } from "@/components/PumpHoursPivotTable";
import DocumentActivity from "@/components/DocumentActivity";
import { useAuth } from "@/context/AuthContext";
import { getApiMessages } from "@/lib/utils";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";
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

interface SchemewisePumpHoursRecord {
  name: string;
  lis_name?: string;
  stage?: string;
  year?: string;
  month?: string;
  pump_hours?: PumpHourRow[];
  docstatus: 0 | 1 | 2;
  modified: string;
  owner?: string;
  modified_by?: string;
}

function PumpHoursMatrixField({
  record,
  readOnly,
}: {
  record: SchemewisePumpHoursRecord;
  readOnly: boolean;
}) {
  const { watch, setValue } = useFormContext();
  const lisName = watch("lis_name") || record.lis_name || "";
  const stage = watch("stage") || record.stage || "";
  const month = watch("month") || record.month || "";
  const year = watch("year") || record.year || "";

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
          key={`${record.name}-${lisName}-${stage}-${month}-${year}`}
          lisName={lisName}
          stage={stage}
          month={month}
          year={year}
          existingData={record.pump_hours}
          onChange={(rows) => {
            setValue("pump_hours", rows, {
              shouldDirty: true,
              shouldTouch: true,
            });
          }}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

export default function SchemewisePumpHoursDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const docname = params.id as string;

  const [record, setRecord] = React.useState<SchemewisePumpHoursRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

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
          `${API_BASE_URL}/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(docname)}`,
          {
            headers: {
              Authorization: `token ${apiKey}:${apiSecret}`,
            },
            withCredentials: true,
          }
        );

        setRecord(resp.data.data);
      } catch (err: any) {
        const msg = getApiMessages(null, err, "", "Failed to load record");
        setError(msg.description || msg.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!record) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((field) => ({
        ...field,
        defaultValue:
          field.name in record
            ? record[field.name as keyof SchemewisePumpHoursRecord]
            : field.defaultValue,
      }));

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
            name: "year",
            label: "Year",
            type: "Link",
            linkTarget: "Year",
            required: true,
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
            name: "pump_hours",
            label: "",
            type: "Custom",
            fieldColumns: 4,
            defaultValue: record.pump_hours || [],
            customElement: (
              <PumpHoursMatrixField
                record={record}
                readOnly={record.docstatus !== 0}
              />
            ),
          },
        ]),
      },
    ];
  }, [record]);

  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!record) return;

    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        lis_name: data.lis_name,
        stage: data.stage,
        year: data.year,
        month: data.month,
        pump_hours: (data.pump_hours || []).map((row: PumpHourRow) => ({
          pump: row.pump,
          reading_date: row.reading_date,
          hours: Number(row.hours) || 0,
        })),
        modified: record.modified,
        docstatus: record.docstatus,
      };

      const resp = await axios.put(
        `${API_BASE_URL}/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(docname)}`,
        payload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      if (resp.data?.data) {
        setRecord(resp.data.data);
      }

      toast.success("Schemewise Pump Hours updated successfully!");
    } catch (err: any) {
      const msg = getApiMessages(null, err, "", "Failed to save");
      toast.error(msg.message, {
        description: msg.description,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelDocument = async () => {
    if (!record || !window.confirm("Cancel this document? This cannot be undone.")) {
      return;
    }

    setIsSaving(true);

    try {
      const resp = await axios.put(
        `${API_BASE_URL}/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(docname)}`,
        {
          docstatus: 2,
          modified: record.modified,
        },
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      if (resp.data?.data) {
        setRecord(resp.data.data);
      }

      toast.success("Document cancelled.");
    } catch (err: any) {
      const msg = getApiMessages(null, err, "", "Cancel failed");
      toast.error(msg.message, {
        description: msg.description,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="module active p-8 text-center">
        Loading schemewise pump hours...
      </div>
    );
  }

  if (error) {
    return (
      <div className="module active p-8">
        <p className="text-red-600">{error}</p>
        <button
          className="btn btn--primary mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!record) {
    return <div className="module active p-8">Record not found.</div>;
  }

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        title={`${DOCTYPE}: ${record.name}`}
        description={`Update pump hours for ${record.lis_name || docname}`}
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        docstatus={record.docstatus}
        onCancelDocument={handleCancelDocument}
        deleteConfig={{
          doctypeName: DOCTYPE,
          docName: docname,
          redirectUrl: "/lis-management/doctype/schemewise_pump_hours",
        }}
      />

      <div className="w-full px-4 md:px-8">
        <DocumentActivity
          doctype={DOCTYPE}
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
