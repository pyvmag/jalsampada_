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
 1. Attendance Sheet Type
------------------------------------------------- */
interface AttendanceSheetData {
  sr_no?: number;
  name_of_employee?: string;
  designation?: string;
  check_in?: string;
  check_out?: string;
  remarks?: string;
}

/* -------------------------------------------------
 2. Page Component
------------------------------------------------- */
export default function AttendanceSheetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Attendance Sheet";
  const [isSaving, setIsSaving] = React.useState(false);

  /* -------------------------------------------------
   Parse duplicate data from URL
  ------------------------------------------------- */
  const duplicateData: AttendanceSheetData | null = React.useMemo(() => {
    const duplicateParam = searchParams.get("duplicate");
    if (!duplicateParam) return null;

    try {
      const decoded = JSON.parse(atob(decodeURIComponent(duplicateParam)));
      return decoded;
    } catch (err) {
      console.error("Duplicate parse error:", err);
      toast.error("Invalid duplicate data.");
      return null;
    }
  }, [searchParams]);

  /* Show notification once */
  const shown = React.useRef(false);
  React.useEffect(() => {
    if (duplicateData && !shown.current) {
      toast.success("Form pre-filled with duplicate data. Review and save.");
      shown.current = true;
    }
  }, [duplicateData]);

  /* -------------------------------------------------
   Form Tabs
  ------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    const getValue = (field: keyof AttendanceSheetData, def: any = undefined) =>
      duplicateData?.[field] ?? def;

    return [
      {
        name: "Details",
        fields: [
          {
            name: "sr_no",
            label: "SR. No.",
            type: "Int",
            defaultValue: getValue("sr_no"),
          },
          {
            name: "name_of_employee",
            label: "Name of Employee",
            type: "Link",
            linkTarget: "Employee",
            required: true,
            defaultValue: getValue("name_of_employee"),
          },
          {
            name: "designation",
            label: "Designation",
            type: "Link",
            linkTarget: "Designation",
            required: true,
            defaultValue: getValue("designation"),
            fetchFrom: { sourceField: "name_of_employee", targetDoctype: "Employee", targetField: "designation" }
          },
          {
            name: "check_in",
            label: "Check In Date and Time",
            type: "DateTime",
            defaultValue: getValue("check_in"),
            disableAutoToday: true,
          },
          {
            name: "check_out_datetime",
            label: "Check Out Date and Time",
            type: "DateTime",
            defaultValue: getValue("check_out"),
            disableAutoToday: true,
          },
          {
            name: "remarks",
            label: "Remarks",
            type: "Small Text",
            defaultValue: getValue("remarks"),
          },
        ],
      },
    ];
  }, [duplicateData]);

  /* -------------------------------------------------
   Submit Handler
  ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>) => {
    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
      toast.error("Authentication required.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = { ...data };

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

      toast.success("Attendance Sheet created successfully!");

      const newName = response.data?.data?.name;
      if (newName) {
        router.push(`/attendance/doctype/attendance-sheet/${newName}`);
      }
    } catch (err: any) {
      console.error("Create error:", err);
      const res = err.response?.data;

      if (res?._server_messages) {
        try {
          const messages = JSON.parse(res._server_messages)
            .map((m: string) => JSON.parse(m).message)
            .join("\n");

          toast.error(messages);
          return;
        } catch { }
      }

      toast.error(res?.message || "Failed to create Attendance Sheet.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* -------------------------------------------------
   Render
  ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title={`New ${doctypeName}`}
      description="Employee Attendance Entry"
      submitLabel={isSaving ? "Saving..." : "Save"}
      cancelLabel="Cancel"
    />
  );
}