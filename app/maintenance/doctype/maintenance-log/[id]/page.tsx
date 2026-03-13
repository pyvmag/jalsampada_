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
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/* --------------------------------------------------
  TYPES
-------------------------------------------------- */
interface MaintenanceLogData {
  name: string;
  naming_series?: string;
  task_name?: string;
  assign_to_name?: string;
  maintenance_type?: string;
  due_date?: string;
  periodicity?: string;
  description?: string;
  task?: string;
  item_code?: string;
  maintenance_status?: string;
  has_certificate?: number;
  completion_date?: string;
  log?: string;
  asset_maintenance?: string;
  asset_name?: string;
  lis?: string;
  lis_phase?: string;
  stage?: string;
  docstatus: 0 | 1 | 2;
  modified: string;
  owner?: string;
  modified_by?: string;
}

/* --------------------------------------------------
  COMPONENT
-------------------------------------------------- */
export default function MaintenanceLogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = decodeURIComponent(params.id as string);
  const doctypeName = "Asset Maintenance Log";

  const [record, setRecord] = React.useState<MaintenanceLogData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  /* --------------------------------------------------
    FETCH RECORD
  -------------------------------------------------- */
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
          `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${docname}`,
          {
            headers: {
              Authorization: `token ${apiKey}:${apiSecret}`,
              "Content-Type": "application/json",
            },
            withCredentials: true,
          }
        );

        console.log("Fetched Maintenance Log data:", resp.data.data);
        setRecord(resp.data.data as MaintenanceLogData);
      } catch (err: any) {
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

    fetchDoc();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  /* --------------------------------------------------
    BUILD FORM (FIELDS SAME AS NEW FORM)
  -------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!record) return [];

    const getValue = (fieldName: keyof MaintenanceLogData, defaultValue: any = undefined) =>
      record?.[fieldName] ?? defaultValue;

    return [
      {
        name: "Details",
        fields: [
          // Top identifiers row
          {
            name: "asset_maintenance",
            label: "Work Schedule",
            type: "Link",
            linkTarget: "Asset Maintenance",
            defaultValue: getValue("asset_maintenance"),
          },
          {
            name: "asset_name",
            label: "Asset",
            type: "Link",
            linkTarget: "Asset",
            filters: (getValue) => {
              const filters: Record<string, any> = {};
              const lisName = getValue("lis");
              const lisPhase = getValue("lis_phase");
              const stageNo = getValue("stage");

              if (lisName) filters["lis"] = lisName;
              if (lisPhase) filters["lis_phase"] = lisPhase;
              if (stageNo) filters["stage"] = stageNo;

              return filters;
            },
            defaultValue: getValue("asset_name"),
          },
          // {
          //   name: "naming_series",
          //   label: "Series",
          //   type: "Select",
          //   options: [{ label: "ACC-AML-.YYYY.-", value: "ACC-AML-.YYYY.-" }],
          //   defaultValue: getValue("naming_series"),
          // },

          // Conditional fields: only show when maintenance_schedule is filled
          {
            name: "item_code",
            label: "Item Code",
            type: "Read Only",
            // linkTarget: "Item",
            defaultValue: getValue("item_code"),
            displayDependsOn: { "asset_maintenance": true }, fetchFrom: { sourceField: "asset_maintenance", targetDoctype: "Asset Maintenance", targetField: "item_code" }
          },
          {
            name: "asset_maintenance",
            label: "Asset Name",
            type: "Read Only",
            linkTarget: "Asset",
            displayDependsOn: { "asset_maintenance": true },
            fetchFrom: { sourceField: "maintenance_schedule", targetDoctype: "Asset", targetField: "asset_name" }
          },

          { name: "section_break_lis", type: "Section Break", label: "LIS Information" },

          {
            name: "lis",
            label: "LIS",
            type: "Link",
            linkTarget: "Lift Irrigation Scheme",
            required: true,
            defaultValue: getValue("lis"),
          },

          {
            name: "stage",
            label: "Stage",
            type: "Link",
            linkTarget: "Stage No",
            required: true,
            defaultValue: getValue("stage"),
            filterMapping: [
              { sourceField: "lis", targetField: "lis_name" }
            ]
          },

          { name: "section_break_1", type: "Section Break", label: "Maintenance Details" },

          {
            name: "task",
            label: "Task",
            type: "Link",
            linkTarget: "Asset Maintenance Task",
            searchField: "maintenance_task",
            defaultValue: getValue("task"),
          },
          {
            name: "task_name",
            label: "Task Name",
            type: "Read Only",
            defaultValue: getValue("task_name"),
            displayDependsOn: { "task": true },

            fetchFrom: { sourceField: "task", targetDoctype: "Asset Maintenance Task", targetField: "maintenance_task" }
          },
          {
            name: "assign_to_name",
            label: "Assign To",
            type: "Read Only",
            defaultValue: getValue("assign_to_name"),
            displayDependsOn: { "task": true },

            fetchFrom: { sourceField: "task", targetDoctype: "Asset Maintenance Task", targetField: "assign_to_name" }
          },
          {
            name: "maintenance_type",
            label: "Maintenance Type",
            type: "Read Only",
            defaultValue: getValue("maintenance_type"),
            displayDependsOn: { "task": true },

            fetchFrom: { sourceField: "task", targetDoctype: "Asset Maintenance Task", targetField: "maintenance_type" }
          },
          {
            name: "due_date",
            label: "Due Date",
            type: "Read Only",
            defaultValue: getValue("due_date"),
            displayDependsOn: { "task": true },

            fetchFrom: { sourceField: "task", targetDoctype: "Asset Maintenance Task", targetField: "next_due_date" }
          },
          {
            name: "periodicity",
            label: "Periodicity",
            type: "Read Only",
            defaultValue: getValue("periodicity"),
            displayDependsOn: { "task": true },

            fetchFrom: { sourceField: "task", targetDoctype: "Asset Maintenance Task", targetField: "periodicity" }
          },
          {
            name: "description",
            label: "Description",
            type: "Small Text",
            defaultValue: getValue("description"),
            displayDependsOn: { "task": true },

            fetchFrom: { sourceField: "task", targetDoctype: "Asset Maintenance Task", targetField: "description" }

          },
          {
            name: "maintenance_status",
            label: "Status",
            type: "Select",
            options: [
              { label: "Planned", value: "Planned" },
              { label: "In Progress", value: "In Progress" },
              { label: "Cancelled", value: "Cancelled" },
              { label: "Overdue", value: "Overdue" },
              { label: "Completed", value: "Completed" },
            ],
            defaultValue: getValue("maintenance_status", "Planned"),
          },
          {
            name: "completion_date",
            label: "Completion Date",
            type: "Date",
            disableAutoToday: true,
            defaultValue: getValue("completion_date"),

          },

          { name: "section_break_2", type: "Section Break", label: "Certificate" },

          {
            name: "has_certificate",
            label: "Has Certificate?",
            type: "Check",
            defaultValue: getValue("has_certificate"),
          },
          {
            name: "resume",
            label: "Upload Certificate",
            type: "Attach",
            displayDependsOn: { "has_certificate": true },
            requiredDependsOn: "has_certificate",
          },

          { name: "section_break_3", type: "Section Break", label: "Log Notes" },

          {
            name: "log",
            label: "Log Notes",
            type: "Small Text",
            defaultValue: getValue("log"),
          },
        ],
      },
    ];
  }, [record]);

  /* --------------------------------------------------
    SAVE (UPDATE)
  -------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    if (!record || !apiKey || !apiSecret) {
      toast.error("Cannot save.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = JSON.parse(JSON.stringify(data));

      // console.log("Saving Maintenance Log with payload:", payload);
      // console.log("LIS fields in payload:", {
      //   lis: payload.lis,
      //   lis_phase: payload.lis_phase,
      //   stage: payload.stage
      // });
      // console.log("All payload keys:", Object.keys(payload));
      // console.log("Full payload structure:", JSON.stringify(payload, null, 2));

      const finalPayload: Record<string, any> = {
        ...payload,
        modified: record.modified,
        docstatus: record.docstatus,
      };

      const resp = await axios.put(
        `${API_BASE_URL}/${encodeURIComponent(doctypeName)}/${docname}`,
        finalPayload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      toast.success("Changes saved!");
      if (resp.data?.data) setRecord(resp.data.data);
      router.push(`/maintenance/doctype/maintenance-log/${encodeURIComponent(record.name)}`);
      return { statusCode: resp.status, status: resp.data?.data?.status };
    } catch (err: any) {
      toast.error("Failed to save", {
        description: err.response?.data?.message || err.message,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* --------------------------------------------------
    UI STATES
  -------------------------------------------------- */
  if (loading) return <div style={{ padding: "2rem" }}>Loading {doctypeName}...</div>;
  if (error) return <div style={{ padding: "2rem", color: "red" }}>{error}</div>;
  if (!record) return <div style={{ padding: "2rem" }}>{doctypeName} not found.</div>;

  /* --------------------------------------------------
    RENDER
  -------------------------------------------------- */
  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        title={`${doctypeName}: ${record.name}`}
        description="Update Maintenance Log"
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/maintenance/doctype/maintenance-log",
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