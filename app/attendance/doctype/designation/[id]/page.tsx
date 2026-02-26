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
import { renameDocument } from "@/lib/services";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/* ---------------------- TYPES ---------------------- */
interface DesignationData {
  name: string;
  designation_name?: string;
  description?: string;
  docstatus: 0 | 1 | 2;
  modified: string;
}

/* ---------------------- COMPONENT ---------------------- */
export default function DesignationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = decodeURIComponent(params.id as string);
  const doctypeName = "Designation";

  const [record, setRecord] = React.useState<DesignationData | null>(null);
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

        setRecord(resp?.data?.data as DesignationData);
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
          f.name in record ? record[f.name as keyof DesignationData] : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "designation_name",
            label: "Designation",
            type: "Text", // FIXED (was "Data")
            required: true,
          },
          {
            name: "description",
            label: "Description",
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
      let currentDocname = docname;

      /* ------------ RENAME ------------ */
      const newName = data.designation_name;

      if (
        newName &&
        newName !== record.designation_name &&
        newName !== record.name
      ) {
        await renameDocument(apiKey, apiSecret, doctypeName, record.name, newName);

        currentDocname = newName;

        setRecord((prev) =>
          prev ? { ...prev, name: newName, designation_name: newName } : null
        );

        router.replace(`/attendance/doctype/designation/${newName}`);
      }

      /* ------------ CLEAN PAYLOAD ------------ */
      const payload = JSON.parse(JSON.stringify(data));
      const finalPayload: Record<string, any> = {};

      Object.keys(payload).forEach((key) => {
        finalPayload[key] = payload[key];
      });

      finalPayload.modified = record.modified;
      finalPayload.docstatus = record.docstatus;

      /* ------------ UPDATE ------------ */
      const resp = await axios.put(
        `${API_BASE_URL}/${doctypeName}/${encodeURIComponent(currentDocname)}`,
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
      router.push(`/attendance/doctype/designation/${currentDocname}`);
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
  if (loading) return <div style={{ padding: "2rem" }}>Loading Designation...</div>;
  if (error) return <div style={{ padding: "2rem", color: "red" }}>{error}</div>;
  if (!record) return <div style={{ padding: "2rem" }}>Designation not found.</div>;

  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      title={`Designation: ${record.name}`}
      description="Update Designation"
      submitLabel={isSaving ? "Saving..." : "Save"}
      cancelLabel="Cancel"
      deleteConfig={{
        doctypeName: doctypeName,
        docName: docname,
        redirectUrl: "/attendance/doctype/designation",
      }}
    />
  );
}