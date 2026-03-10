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

// API
const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

/* --------------------------------------------------
  TYPES
-------------------------------------------------- */
interface MaintenanceTaskRow {
  name?: string;
  maintenance_task?: string;
  maintenance_status?: string;
  periodicity?: string;
  assign_to?: string;
  next_due_date?: string;
  last_completion_date?: string;
  period_in_days?: string;
  description?: string;
}

interface AssetMaintenanceRecord {
  name: string;
  custom_lis?: string;
  custom_stage?: string;
  asset_name?: string;
  company?: string;
  custom_tender_no?: string;
  custom_firmcompany_name?: string;
  custom_contractor_name?: string;
  custom_email_id?: string;
  custom_contact_no?: string;
  maintenance_team?: string;
  asset_maintenance_tasks?: MaintenanceTaskRow[];
  maintenance_tasks?: MaintenanceTaskRow[]; // Backward compatibility
  docstatus: 0 | 1 | 2;
  modified: string;
  owner?: string;
  modified_by?: string;
}

const handleFormInit = (methods: any) => {
  const { watch, setValue } = methods;

  watch((formValues: any, { name }: any) => {
    if (!name) return;
    if (!name.startsWith("asset_maintenance_tasks")) return;

    const rows = formValues.asset_maintenance_tasks;
    if (!Array.isArray(rows)) return;

    rows.forEach((row: any, index: number) => {
      const { start_date, period_in_days } = row;
      if (!start_date || !period_in_days) return;

      const start = new Date(start_date);
      const days = parseInt(period_in_days);
      if (isNaN(days)) return;

      start.setDate(start.getDate() + days);
      const endDate = start.toISOString().split("T")[0];

      const path = `asset_maintenance_tasks.${index}.end_date`;

      if (row.end_date !== endDate) {
        setValue(path, endDate, { shouldDirty: true });
      }
    });
  });
};

/* --------------------------------------------------
  COMPONENT
-------------------------------------------------- */
export default function MaintenanceScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized, currentUser, userId } = useAuth();

  const docname = decodeURIComponent(params.id as string);
  const doctypeName = "Asset Maintenance";

  const [record, setRecord] = React.useState<AssetMaintenanceRecord | null>(null);
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

        setRecord(resp.data.data as AssetMaintenanceRecord);
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
    BUILD FORM
  -------------------------------------------------- */
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!record) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        // @ts-ignore
        defaultValue: f.name in record ? record[f.name as keyof AssetMaintenanceRecord] : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          { name: "custom_lis", label: "LIS Name", type: "Link", linkTarget: "Lift Irrigation Scheme", },
          {
            name: "custom_stage",
            label: "Stage",
            type: "Link",
            linkTarget: "Stage No",
            filterMapping: [
              { sourceField: "custom_lis", targetField: "lis_name" }
            ]
          },

          {
            name: "custom_tender_no",
            label: "Tender No.",
            type: "Link",
            linkTarget: "Project",
          },
          {
            name: "custom_firmcompany_name",
            label: "Firm/Company Name",
            type: "Read Only",
            fetchFrom: {
              sourceField: "custom_tender_no",
              targetDoctype: "Project",
              targetField: "custom_contractor_company"
            }
          },
          {
            name: "custom_contractor_name",
            label: "Contractor Name",
            type: "Read Only",
            fetchFrom: {
              sourceField: "custom_tender_no",
              targetDoctype: "Project",
              targetField: "custom_contractor_name"
            }
          },
          {
            name: "custom_email_id",
            label: "Email ID",
            type: "Read Only",
            fetchFrom: {
              sourceField: "custom_tender_no",
              targetDoctype: "Project",
              targetField: "custom_email_id"
            }
          },
          {
            name: "custom_contact_no",
            label: "Contact No.",
            type: "Read Only",
            fetchFrom: {
              sourceField: "custom_tender_no",
              targetDoctype: "Project",
              targetField: "custom_mobile_no"
            }
          },
          {
            name: "asset_maintenance_tasks",
            label: "Maintenance Tasks",
            type: "Table",
            defaultValue: record.asset_maintenance_tasks || record.maintenance_tasks || [],
            columns: [
              {
                name: "custom_asset",
                label: "Asset",
                type: "Link",
                linkTarget: "Asset",
                customSearchUrl: "http://103.219.1.138:4412/api/method/frappe.desk.search.search_link",
                filters: (getValue) => ({
                  custom_stage_no: getValue("custom_stage"),
                  custom_lis_name: getValue("custom_lis")
                }),
                referenceDoctype: "Asset Maintenance",
                doctype: "Asset",
              },
              {
                name: "asset_name",
                label: "Asset Name",
                type: "Data",
                displayDependsOn: () => false,
                fetchFrom: {
                  sourceField: "custom_asset",
                  targetDoctype: "Asset",
                  targetField: "asset_name"
                }
              },
              { name: "maintenance_task", label: "Maintenance Task", type: "Text" },
              { name: "maintenance_status", label: "Maintenance Status", type: "Select", options: "Planned\nOverdue\nCancelled" },
              {
                name: "maintenance_type",
                label: "Maintenance Type",
                type: "Select",
                options: "Preventive Maintenance\nCorrective Maintenance\nPredictive Maintenance",
              },

              {
                name: "start_date",
                label: "Start Date",
                type: "Date",
              },
              {
                name: "period_in_days",
                label: "Period (In Days)",
                type: "Int",
              },
              {
                name: "end_date",
                label: "Expected End Date",
                type: "Read Only",
              },

              {
                name: "certificate_required",
                label: "Certificate Required",
                type: "Check",
              },
              {
                name: "certificate_upload",
                label: "Upload Certificate",
                type: "Attach",
                displayDependsOn: "certificate_required", // simpler dependency
              },
              { name: "description", label: "Description", type: "Text" },
            ],
          },
        ]),
      },
    ];
  }, [record]);

  /* --------------------------------------------------
    SAVE
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

      // Clean Payload (System Fields and removed UI fields)
      const cleanObj = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(cleanObj);
        if (obj !== null && typeof obj === 'object') {
          const newObj = { ...obj };
          const fieldsToRemove = [
            'modified', 'creation', 'owner', 'docstatus', 'idx',
            'modified_by', 'parent', 'parentfield', 'parenttype',
            '_user_tags', '_comments', '_assign', '_liked_by',
            'parent_task',
            'id'
          ];
          fieldsToRemove.forEach(f => delete newObj[f]);

          // Force periodicity to Daily for tasks
          if (newObj.maintenance_task || newObj.period_in_days || newObj.start_date) {
            newObj.periodicity = "Daily";
            newObj.doctype = "Asset Maintenance Task";

            // Strict whitelist for child table rows to prevent AttributeErrors
            const allowedForTask = [
              'name', 'maintenance_task', 'maintenance_status', 'maintenance_type',
              'start_date', 'period_in_days', 'end_date', 'next_due_date',
              'assign_to', 'assign_to_name', 'last_completion_date',
              'description', 'certificate_required', 'certificate_upload',
              'periodicity', 'doctype', 'custom_asset', 'asset_name'
            ];

            // Background requirement: set next_due_date to end_date
            if (newObj.end_date) {
              newObj.next_due_date = newObj.end_date;
            }

            // 🛡️ SMART ASSIGNMENT RESOLUTION
            const safeUser = (userId && userId !== "admin@example.com" && userId !== "null")
              ? userId
              : "vikas.deshmukh@erpdata.in";

            newObj.assign_to = safeUser;
            newObj.assign_to_name = safeUser;

            console.log(`DEBUG [Smart Sync Edit]: Assigned to:`, safeUser);

            if ('id' in newObj) delete newObj.id;
            if (!("last_completion_date" in newObj)) newObj.last_completion_date = null;

            for (const key in newObj) {
              if (!allowedForTask.includes(key)) {
                delete newObj[key];
              }
            }
          }

          for (const key in newObj) {
            if (typeof newObj[key] === 'object' && newObj[key] !== null) {
              newObj[key] = cleanObj(newObj[key]);
            }
          }
          return newObj;
        }
        return obj;
      };

      const cleaned = cleanObj(payload);

      const finalPayload: Record<string, any> = {
        ...cleaned,
        maintenance_team: cleaned.maintenance_team || "Test",
        modified: record.modified,
        docstatus: record.docstatus,
      };

      // 🔄 BACKGROUND SYNC: Take asset from the first child row for the parent
      const firstTaskAsset = finalPayload.asset_maintenance_tasks?.[0]?.custom_asset;
      if (firstTaskAsset) {
        finalPayload.custom_asset = firstTaskAsset;
        finalPayload.asset_name = firstTaskAsset;
      }

      // 🔍 DEBUG: Exact payload being sent to Frappe
      console.log("DEBUG: User Info from Auth:", { userId, currentUser });
      console.log("DEBUG: Final Payload for Put:", JSON.stringify(finalPayload, null, 2));
      if (finalPayload.asset_maintenance_tasks) {
        console.table(finalPayload.asset_maintenance_tasks);
      }

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

      return { status: "Saved", statusCode: 200 };
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
        title={`Work Schedule: ${record.name}`}
        description="Update Work Schedule"
        submitLabel={isSaving ? "Saving..." : "Save"}
        cancelLabel="Cancel"
        onFormInit={handleFormInit}
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/maintenance/doctype/maintenance-schedule",
        }}
        doctype={doctypeName}
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