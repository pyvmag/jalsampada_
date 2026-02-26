
"use client";

import * as React from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/* -------------------------------------------------
 1. Maintenance Log type
 ------------------------------------------------- */
interface MaintenanceLogData {
  name?: string;
  naming_series?: string;
  task?: string;
  maintenance_status?: string;
  has_certificate?: number;
  completion_date?: string;
  log?: string;
  maintenance_schedule?: string;
  asset_name?: string;
  lis?: string;
  lis_phase?: string;
  stage?: string;
}

/* -------------------------------------------------
 2. Page component
 ------------------------------------------------- */
export default function NewMaintenanceLogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Asset Maintenance Log";
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
   Parse duplicate data from URL parameters
  ------------------------------------------------- */
  const duplicateData: MaintenanceLogData | null = React.useMemo(() => {
    const duplicateParam = searchParams.get("duplicate");
    if (!duplicateParam) return null;

    try {
      const decodedData = JSON.parse(atob(decodeURIComponent(duplicateParam)));
      console.log("Parsed duplicate data:", decodedData);
      return decodedData;
    } catch (error) {
      console.error("Error parsing duplicate data:", error);
      toast.error("Invalid duplicate data provided.");
      return null;
    }
  }, [searchParams]);

  // Show notification once if duplicate data exists
  const notificationShown = React.useRef(false);
  React.useEffect(() => {
    if (duplicateData && !notificationShown.current) {
      toast.success("Form pre-filled with duplicate data. Please review and save.");
      notificationShown.current = true;
    }
  }, [duplicateData]);

  /* -------------------------------------------------
   Form tabs configuration
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    const getValue = (fieldName: keyof MaintenanceLogData, defaultValue: any = undefined) =>
      duplicateData?.[fieldName] ?? defaultValue;

    return [
      {
        name: "Details",
        fields: [
          // Top identifiers row
          {
            name: "asset_maintenance",
            label: "Maintenance Schedule",
            type: "Link",
            linkTarget: "Asset Maintenance",
            // defaultValue: getValue("asset_maintenance"),
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
            linkTarget: "Item",
            displayDependsOn: { asset_maintenance: true }
            ,fetchFrom: { sourceField: "asset_maintenance", targetDoctype: "Asset Maintenance", targetField: "item_code" }
          },
          {
            name: "asset_maintenance",
            label: "Asset Name",
            type: "Read Only",
            linkTarget: "Asset",
            displayDependsOn: { asset_maintenance: true },
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
            defaultValue: getValue("task"),
            displayDependsOn: { task: true },

            fetchFrom: { sourceField: "task", targetDoctype: "Asset Maintenance Task", targetField: "maintenance_task" }
          },
          {
            name: "assign_to_name",
            label: "Assign To",
            type: "Read Only",
            defaultValue: getValue("task"),
            displayDependsOn: { task: true },

            fetchFrom: { sourceField: "task", targetDoctype: "Asset Maintenance Task", targetField: "assign_to_name" }
          },
          {
            name: "maintenance_type",
            label: "Maintenance Type",
            type: "Read Only",
            defaultValue: getValue("task"),
            displayDependsOn: { task: true },

            fetchFrom: { sourceField: "task", targetDoctype: "Asset Maintenance Task", targetField: "maintenance_type" }
          },
          {
            name: "due_date",
            label: "Due Date",
            type: "Read Only",
            defaultValue: getValue("task"),
            displayDependsOn: { task: true },

            fetchFrom: { sourceField: "task", targetDoctype: "Asset Maintenance Task", targetField: "next_due_date" }
          },
          {
            name: "periodicity",
            label: "Periodicity",
            type: "Read Only",
            defaultValue: getValue("task"),
           displayDependsOn: { task: true },

            fetchFrom: { sourceField: "task", targetDoctype: "Asset Maintenance Task", targetField: "periodicity" }
          },
          {
            name: "description",
            label: "Description",
            type: "Small Text",
            defaultValue: getValue("task"),
            displayDependsOn: { task: true },

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
            defaultValue: getValue("completion_date"),
            disableAutoToday: true,
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
            displayDependsOn: { has_certificate: true },
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
  }, [duplicateData]);



  /* -------------------------------------------------
   Submit handler
  ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>) => {
    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
      toast.error("Authentication required. Please log in.");
      return;
    }

    if (!data.task) {
      toast.info("Task field is required.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = { ...data };

      // Remove auto placeholder name
      if (payload.name === "Will be auto-generated") {
        delete payload.name;
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

      toast.success("Maintenance Log created successfully!");

      const newName = response.data?.data?.name;
      if (newName) {
        router.push(`/maintenance/doctype/maintenance-log/${newName}`);
      }
    } catch (err: any) {
      console.error("Create error:", err);

      const res = err.response?.data;

      // ⭐ 1. FRAPPE VALIDATION ERRORS (MOST IMPORTANT)
      if (res?._server_messages) {
        try {
          const messages = JSON.parse(res._server_messages); // array of strings

          const cleanMessage = messages
            .map((msg: string) => {
              const parsed = JSON.parse(msg);
              return parsed.message;
            })
            .join("\n");

          toast.error(cleanMessage);
          return;
        } catch (parseErr) {
          console.error("Server message parse error:", parseErr);
        }
      }

      if (res?.exc_type === "DuplicateEntryError") {
        toast.error("Duplicate Entry Error", {
          description: "A Maintenance Log with this series already exists.",
        });
        return;
      }

      const errorMessage =
        res?.message ||
        res?.exception ||
        res?.error ||
        "Failed to create Maintenance Log.";

      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
   Render form
  ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title={`New ${doctypeName}`}
      description="Fill out the details to create a new maintenance log entry."
      submitLabel={isSaving ? "Saving..." : "Save Log"}
      cancelLabel="Cancel"
    />
  );
}