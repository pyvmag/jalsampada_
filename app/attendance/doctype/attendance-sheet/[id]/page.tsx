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

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/* ---------------------- TYPES ---------------------- */
interface AttendanceSheetData {
  name: string;
  sr_no?: number;
  name_of_employee?: string;
  designation?: string;
  check_in?: string;
  check_out?: string;
  remarks?: string;
  docstatus: 0 | 1 | 2;
  modified: string;
}

/* ---------------------- COMPONENT ---------------------- */
export default function AttendanceSheetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = decodeURIComponent(params.id as string);
  const doctypeName = "Attendance Sheet";

  const [record, setRecord] = React.useState<AttendanceSheetData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  /* ---------------------- FETCH ---------------------- */
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
          }
        );

        setRecord(resp?.data?.data as AttendanceSheetData);
      } catch (err: any) {
        console.error("API Error:", err);
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

  /* ---------------------- FORM ---------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!record) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        // @ts-ignore
        defaultValue:
          f.name in record ? record[f.name as keyof AttendanceSheetData] : f.defaultValue,
      }));

    return [
      {
        name: "Attendance Details",
        fields: fields([
          {
            name: "sr_no",
            label: "SR No.",
            type: "Int",
            required: true,
          },
          {
            name: "name_of_employee",
            label: "Name of Employee",
            type: "Link",
            linkTarget: "Employee",
            required: true,
          },
          {
            name: "designation",
            label: "Designation",
            type: "Link",
            linkTarget: "Designation",
            required: true,
            fetchFrom: { sourceField: "name_of_employee", targetDoctype: "Employee", targetField: "designation" }
          },
          {
            name: "check_in",
            label: "Check In Date & Time",
            type: "DateTime",
            required: true,
            disableAutoToday: true,
          },
          {
            name: "check_out",
            label: "Check Out Date & Time",
            type: "DateTime",
            disableAutoToday: true,
          },
          {
            name: "remarks",
            label: "Remarks",
            type: "Small Text",
          },
        ]),
      },
    ];
  }, [record]);

  /* ---------------------- SUBMIT ---------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !record) {
      toast.error("Authentication required.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = JSON.parse(JSON.stringify(data));

      const finalPayload: Record<string, any> = {
        ...payload,
        modified: record.modified,
        docstatus: record.docstatus,
      };

      const resp = await axios.put(
        `${API_BASE_URL}/${doctypeName}/${encodeURIComponent(docname)}`,
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
      setRecord(resp.data?.data);
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Failed to save", {
        description: err.response?.data?.message || err.message,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  /* ---------------------- UI ---------------------- */
  if (loading) return <div style={{ padding: "2rem" }}>Loading Attendance Sheet...</div>;
  if (error) return <div style={{ padding: "2rem", color: "red" }}>{error}</div>;
  if (!record) return <div style={{ padding: "2rem" }}>Attendance Sheet not found.</div>;

  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title={`Attendance Sheet: ${record.name}`}
      description="Update Attendance Sheet"
      submitLabel={isSaving ? "Saving..." : "Save"}
      cancelLabel="Cancel"
      deleteConfig={{
        doctypeName: doctypeName,
        docName: docname,
        redirectUrl: "/attendance/doctype/attendance-sheet",
      }}
    />
  );
}