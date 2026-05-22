"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

export default function NewSchemewisePumpHoursPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);
  const doctypeName = "Schemewise Pump Hours";

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

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    const getValue = (fieldName: string, defaultValue: any = undefined) => {
      return duplicateData?.[fieldName] ?? defaultValue;
    };

    return [
      {
        name: "Details",
        fields: [
          {
            name: "lis_name",
            label: "LIS Name",
            type: "Link",
            required: true,
            linkTarget: "Lift Irrigation Scheme",
            defaultValue: getValue("lis_name"),
          },
          {
            name: "stage",
            label: "Stage",
            type: "Link",
            required: true,
            linkTarget: "Stage No",
            defaultValue: getValue("stage"),
            filterMapping: [
              { sourceField: "lis_name", targetField: "lis_name" }
            ]
          },
          {
            name: "year",
            label: "Year",
            type: "Link",
            required: true,
            linkTarget: "Year",
            defaultValue: getValue("year"),
          },
          {
            name: "month",
            label: "Month",
            type: "Select",
            required: true,
            options: [
              { label: "January", value: "January" },
              { label: "February", value: "February" },
              { label: "March", value: "March" },
              { label: "April", value: "April" },
              { label: "May", value: "May" },
              { label: "June", value: "June" },
              { label: "July", value: "July" },
              { label: "August", value: "August" },
              { label: "September", value: "September" },
              { label: "October", value: "October" },
              { label: "November", value: "November" },
              { label: "December", value: "December" },
            ],
            defaultValue: getValue("month"),
          },

          {
            name: "pump_hours",
            label: "Pump Hours",
            type: "Table",
            columns: [
              {
                name: "pump",
                label: "Pump",
                type: "Link",
                linkTarget: "Asset",
                required: true,
                filters: (getCompositeValue) => {
                  const filters: Record<string, any> = {};
                  const stage = getCompositeValue("parent.stage");
                  const lisName = getCompositeValue("parent.lis_name");
                  if (stage) filters.custom_stage_no = stage;
                  if (lisName) filters.custom_lis_name = lisName;
                  filters.asset_category = "Pump";
                  return filters;
                }
              },
              {
                name: "reading_date",
                label: "Reading Date",
                type: "Date",
                required: true,
              },
              {
                name: "hours",
                label: "Hours",
                type: "Float",
                required: true,
                precision: 2,
              }
            ],
            defaultValue: getValue("pump_hours", []),
          }
        ],
      }
    ];
  }, [duplicateData]);

  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    const hasValidData = isDirty || (duplicateData && data.lis_name);

    if (!hasValidData) {
      toast.info("Please fill out the form.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = { ...data };
      delete payload.section_break_ba5b;
      payload.doctype = doctypeName;

      // Convert child table float values
      if (Array.isArray(payload.pump_hours)) {
        payload.pump_hours = payload.pump_hours.map((row: any) => ({
          ...row,
          hours: Number(row.hours) || 0,
        }));
      }

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
      if (!resp.ok) {
        console.error("Full server error:", responseData);
        throw new Error(responseData.exception || responseData._server_messages || "Failed to create document");
      }

      const docName = responseData.data.name;
      toast.success("Schemewise Pump Hours created successfully!");
      router.push(`/lis-management/doctype/schemewise_pump_hours/${encodeURIComponent(docName)}`);
    } catch (err: any) {
      console.error("Save error:", err);
      if (err.message?.includes("DuplicateEntryError")) {
        toast.error("Duplicate Entry Error", {
          description: "This Schemewise Pump Hours record may already exist.",
          duration: Infinity
        });
      } else {
        toast.error("Failed to create Schemewise Pump Hours", {
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
      title="New Schemewise Pump Hours"
      description="Create a new Schemewise Pump Hours record"
      submitLabel={isSaving ? "Saving..." : "Create"}
      cancelLabel="Cancel"
    />
  );
}
