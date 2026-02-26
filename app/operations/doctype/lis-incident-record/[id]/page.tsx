"use client";

import * as React from "react";
import axios from "axios";
import { useRouter, useParams } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { UseFormReturn } from "react-hook-form";
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
const DOCTYPE_NAME = "Issue";

/**
 * Uploads a single file to Frappe's 'upload_file' method
 */
async function uploadFile(
  file: File,
  apiKey: string,
  apiSecret: string,
  methodBaseUrl: string
): Promise<string> {
  console.log(`[Upload] Starting upload for: ${file.name} (${file.size} bytes)`);
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("is_private", "0");

  try {
    const resp = await axios.post(
      `${methodBaseUrl}/api/method/upload_file`,
      formData,
      {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
        timeout: 90000, // 90 second timeout
      }
    );

    console.log(`[Upload] Response for ${file.name}:`, resp.data);

    if (resp.data && resp.data.message && resp.data.message.file_url) {
      return resp.data.message.file_url;
    }
  } catch (error: any) {
    console.error(`[Upload] Failed for ${file.name}:`, error);
    if (error.code === 'ECONNABORTED') {
      throw new Error(`Upload timed out. The file "${file.name}" might be too large or the server is slow.`);
    }
    const serverMsg = error.response?.data?.message || error.response?.data?.exception || error.message;
    throw new Error(`Upload failed: ${serverMsg}`);
  }
  throw new Error("File upload failed - Server did not return a file URL");
}

export default function EditLisIncidentRecordPage() {
  const router = useRouter();
  const params = useParams();
  const docname = params.id as string;

  const { apiKey, apiSecret, currentUser } = useAuth();
  const [record, setRecord] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // 1. Fetch Existing Record
  const fetchRecord = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/${DOCTYPE_NAME}/${docname}`, {
        headers: {
          'Authorization': `token ${apiKey}:${apiSecret}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.exception || "Failed to fetch record");
      setRecord(data.data);
    } catch (error: any) {
      toast.error("Error loading record", { description: error.message, duration: Infinity });
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, apiSecret, docname]);

  React.useEffect(() => {
    if (apiKey && apiSecret && docname) {
      fetchRecord();
    }
  }, [fetchRecord]);

  // 2. Define Form Configuration (Mirrors new/page.tsx)
  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!record) return [];

    // Helper to get value from the fetched record
    const getValue = (fieldName: string, defaultValue: any = undefined) =>
      record?.[fieldName] ?? defaultValue;

    return [
      {
        name: "Incident Record",
        fields: [
          { name: "custom_incident_datetime", label: "Incident Date & Time", type: "DateTime", defaultValue: getValue("custom_incident_datetime"), required: true },

          { name: "custom_incident_details_header", label: "Incident Details", type: "Section Break" },

          // Row 1: LIS, Stage, Asset and Asset No.
          {
            name: "custom_lis",
            label: "Lift Irrigation Scheme",
            type: "Link",
            linkTarget: "Lift Irrigation Scheme",
            defaultValue: getValue("custom_lis"),
            required: true
          },
          {
            name: "custom_stage",
            label: "Stage / Sub Scheme",
            type: "Link",
            linkTarget: "Stage No",
            defaultValue: getValue("custom_stage"),
            // Filter: Must match LIS
            filters: (getFormValue) => ({
              lis_name: getFormValue("custom_lis")
            })
          },
          {
            name: "custom_asset",
            label: "Asset",
            type: "Link",
            linkTarget: "Asset",
            defaultValue: getValue("custom_asset"),
            // Filter: Must match LIS and Stage (SAME AS NEW PAGE)
            filters: (getFormValue) => ({
              custom_lis_name: getFormValue("custom_lis"),
              custom_stage_no: getFormValue("custom_stage"),
              custom_obsolete: 0
            })
          },
          { name: "custom_asset_no", label: "Asset No", type: "Data", defaultValue: getValue("custom_asset_no"), fetchFrom: { sourceField: "custom_asset", targetDoctype: "Asset", targetField: "custom_asset_no" }, readOnlyValue: getValue("custom_asset_no") },

          // Row 2: Issue type, Priority, Status and Reported by
          { name: "issue_type", label: "Issue Type", type: "Link", linkTarget: "Issue Type", defaultValue: getValue("issue_type") },
          { name: "priority", label: "Priority", type: "Link", linkTarget: "Issue Priority", defaultValue: getValue("priority") },
          { name: "status", label: "Status", type: "Select", options: "Open\nReplied\nOn Hold\nResolved\nClosed", defaultValue: getValue("status", "Open") },
          { name: "custom_reported_by", label: "Reported By", type: "Link", linkTarget: "Employee", searchField: "employee_name", defaultValue: getValue("custom_reported_by") },

          // Row 3: Designation
          {
            name: "custom_designation_",
            label: "Designation",
            type: "Data",
            defaultValue: getValue("custom_designation_"),
            fetchFrom: { sourceField: "custom_reported_by", targetDoctype: "Employee", targetField: "designation" }
          },

          /* -----------------------------------------------------------
             Section 2: Subject (Hidden standard subject, visible custom subject)
             ----------------------------------------------------------- */
          { name: "custom_subject_section", label: "Subject", type: "Section Break" },
          { name: "custom_incident_subject", label: "Incident Subject", type: "Data", fieldColumns: 1, required: true, defaultValue: getValue("custom_incident_subject") },
          { name: "description", label: "Description", type: "Small Text", fieldColumns: 3, defaultValue: getValue("description") },
          // Hidden field to satisfy backend requirement
          { name: "subject", label: "System Subject", type: "Data", displayDependsOn: "false", defaultValue: getValue("subject") },

          /* -----------------------------------------------------------
             Section 4: Failure Classification
             ----------------------------------------------------------- */
          { name: "custom_failure_classification", label: "Failure Classification", type: "Section Break" },
          { name: "custom_mechanical_failure", label: "Mechanical Failure", type: "Check", toggleVariant: "danger", defaultValue: getValue("custom_mechanical_failure") },
          { name: "custom_electrical_failure", label: "Electrical Failure", type: "Check", toggleVariant: "danger", defaultValue: getValue("custom_electrical_failure") },
          { name: "custom_flooding__waterlogging", label: "Flooding / Waterlogging", type: "Check", toggleVariant: "danger", defaultValue: getValue("custom_flooding__waterlogging") },
          { name: "custom_control_scada", label: "Control Panel / SCADA", type: "Check", toggleVariant: "danger", defaultValue: getValue("custom_control_scada") },
          { name: "custom_structural_damage", label: "Structural Damage", type: "Check", toggleVariant: "danger", defaultValue: getValue("custom_structural_damage") },
          { name: "custom_fire__short_circuit", label: "Fire / Short Circuit", type: "Check", toggleVariant: "danger", defaultValue: getValue("custom_fire__short_circuit") },
          { name: "custom_personnel_injury", label: "Personnel Injury", type: "Check", toggleVariant: "danger", defaultValue: getValue("custom_personnel_injury") },
          { name: "custom_other", label: "Other", type: "Check", toggleVariant: "danger", defaultValue: getValue("custom_other") },

          {
            name: "custom_specify",
            label: "Specify (Other)",
            type: "Small Text",
            defaultValue: getValue("custom_specify"),
            displayDependsOn: "custom_other == true"
          },

          /* -----------------------------------------------------------
             Section 5: Attachments & Evidence
             ----------------------------------------------------------- */
          { name: "custom_photos__attachments", label: "Photos / Attachments", type: "Section Break" },
          {
            name: "custom_attachments",
            label: "Incident Evidence",
            type: "Table",
            defaultValue: getValue("custom_attachments", []),
            allowPreview: true,
            columns: [
              { name: "attachement", label: "Description", type: "Data" },
              { name: "attach_ayav", label: "File", type: "Attach" },
            ],
          },
          { name: "custom_scada_log_file", label: "SCADA Log File", type: "Select", options: "Yes\nNo", defaultValue: getValue("custom_scada_log_file") },

          {
            name: "custom_scada_attach",
            label: "SCADA Attachment",
            type: "Attach",
            defaultValue: getValue("custom_scada_attach"),
            displayDependsOn: "custom_scada_log_file == 'Yes'",
            required: true,
            allowPreview: true
          },

          /* -----------------------------------------------------------
             Section 6: Components Affected
             ----------------------------------------------------------- */
          { name: "custom_components_section", label: "Components Affected", type: "Section Break" },
          {
            name: "custom_component_affected",
            label: "Components",
            type: "Table",
            defaultValue: getValue("custom_component_affected", []),
            columns: [
              { name: "component", label: "Asset Category", type: "Link", linkTarget: "Asset Category" },
              {
                name: "asset_id",
                label: "Asset",
                type: "Link",
                linkTarget: "Asset",
                // Filter based on main form + row component (Asset Category)
                filters: (getFormValue) => ({
                  custom_lis_name: getFormValue("custom_lis"),
                  custom_stage_no: getFormValue("custom_stage"),
                  asset_category: getFormValue("component"),
                  custom_obsolete: 0
                })
              },
              { name: "description_of_damage", label: "Damage Description", type: "Small Text" },
            ],
          },

          /* -----------------------------------------------------------
             Section 7: Response Timeline
             ----------------------------------------------------------- */
          { name: "custom_timeline_section", label: "Response Timeline", type: "Section Break" },
          { name: "first_responded_on", label: "First Responded On", type: "DateTime", defaultValue: getValue("first_responded_on") },

          /* -----------------------------------------------------------
             Section 8: Immediate Actions
             ----------------------------------------------------------- */
          { name: "custom_immediate_action_taken", label: "Immediate Actions", type: "Section Break" },
          {
            name: "custom_action_taken",
            label: "Action Log",
            type: "Table",
            defaultValue: getValue("custom_action_taken", []),
            columns: [
              { name: "action", label: "Action Taken", type: "Small Text" },
              { name: "taken_by", label: "Taken By", type: "Link", linkTarget: "User", searchField: "full_name" },
              { name: "time", label: "Time", type: "Time" },
              { name: "remarks", label: "Remarks", type: "Small Text" },
            ],
          },

          /* -----------------------------------------------------------
             Section 9: Opening Date
             ----------------------------------------------------------- */
          { name: "custom_opening_section", label: "Opening Info", type: "Section Break" },
          { name: "opening_date", label: "Opening Date", type: "Date", defaultValue: getValue("opening_date") },

          /* -----------------------------------------------------------
             Section 10: Resolution Status
             ----------------------------------------------------------- */
          { name: "custom_status_of_resolution", label: "Resolution Status", type: "Section Break" },
          {
            name: "custom_resolved_onsite",
            label: "Resolved On-site",
            type: "Check",
            defaultValue: getValue("custom_resolved_onsite"),
            readOnlyDependsOn: "custom_escalated_to_higher_authority || custom_intervention_required || custom_equipment_replacement_pending || custom_under_investigation"
          },
          {
            name: "custom_escalated_to_higher_authority",
            label: "Escalated",
            type: "Check",
            defaultValue: getValue("custom_escalated_to_higher_authority"),
            readOnlyDependsOn: "custom_resolved_onsite || custom_intervention_required || custom_equipment_replacement_pending || custom_under_investigation"
          },
          {
            name: "custom_intervention_required",
            label: "Intervention Required",
            type: "Check",
            defaultValue: getValue("custom_intervention_required"),
            readOnlyDependsOn: "custom_resolved_onsite || custom_escalated_to_higher_authority || custom_equipment_replacement_pending || custom_under_investigation"
          },
          { name: "custom_resolution_date", label: "Resolution Date", type: "Date", defaultValue: getValue("custom_resolution_date") },
          {
            name: "custom_equipment_replacement_pending",
            label: "Replacement Pending",
            type: "Check",
            defaultValue: getValue("custom_equipment_replacement_pending"),
            readOnlyDependsOn: "custom_resolved_onsite || custom_escalated_to_higher_authority || custom_intervention_required || custom_under_investigation"
          },
          {
            name: "custom_under_investigation",
            label: "Under Investigation",
            type: "Check",
            defaultValue: getValue("custom_under_investigation"),
            readOnlyDependsOn: "custom_resolved_onsite || custom_escalated_to_higher_authority || custom_intervention_required || custom_equipment_replacement_pending"
          },

          /* -----------------------------------------------------------
             Section 11: Recommendations
             ----------------------------------------------------------- */
          { name: "custom_preventive_action", label: "Preventive Action", type: "Section Break" },
          { name: "custom_recommendations", label: "Recommendations", type: "Text", defaultValue: getValue("custom_recommendations") },

          /* -----------------------------------------------------------
             Section 12: Reporting and Approval
             ----------------------------------------------------------- */
          { name: "custom_approval_section", label: "Reporting & Approval", type: "Section Break" },
          {
            name: "custom_reporting_and_approval",
            label: "Signatures",
            type: "Table",
            defaultValue: getValue("custom_reporting_and_approval", []),
            columns: [
              { name: "name1", label: "Employee", type: "Link", searchField: "employee_name", linkTarget: "Employee", readOnly: true },
              { name: "designation", label: "Designation", type: "Data", readOnly: true },
              { name: "signature", label: "Signature", type: "Attach" },
              { name: "date", label: "Date", type: "Date", readOnly: true },
            ],
          },
        ],
      },
    ];
  }, [record]);

  // 3. Form Initialization Hook (The Subject Hack)
  const handleFormInit = (methods: UseFormReturn<any>) => {
    const setInitialUser = async () => {
      if (!apiKey || !apiSecret) return;
      try {
        if (!methods.getValues("custom_reported_by")) {

          const infoResp = await fetch("http://103.219.1.138:4412/api/method/quantlis_management.api.get_current_user_info", {
            headers: { 'Authorization': `token ${apiKey}:${apiSecret}` }
          });
          const infoData = await infoResp.json();
          const empId = infoData.message?.employee || infoData.message?.employee_id;
          if (empId) {
            methods.setValue("custom_reported_by", empId, { shouldDirty: true });
          }
        }
      } catch (e) { console.error("Initial user fetch failed:", e); }
    };
    setInitialUser();

    // B. Watch 'custom_incident_subject' and copy it to 'subject'
    const subscription = methods.watch((value, { name, type }) => {
      if (name === "custom_incident_subject") {
        methods.setValue("subject", value.custom_incident_subject || record?.subject || "Incident");
      }
    });

    return () => subscription.unsubscribe();
  };

  // 4. Submit Handler (PUT instead of POST)
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    // Basic validation
    if (!data.custom_incident_subject) {
      toast.error("Incident Subject is required", { duration: Infinity });
      return;
    }

    setIsSaving(true);
    const methodBaseUrl = "http://103.219.1.138:4412";

    try {
      if (!apiKey || !apiSecret) {
        throw new Error("Authentication credentials missing. Please log in again.");
      }
      // --- START: AUTOMATIC SIGNATURE LOGIC ---
      let signatures = [...(data.custom_reporting_and_approval || [])];
      let activeUser = currentUser;

      // Fallback: If currentUser is null, try to get it from localStorage or API
      if (!activeUser) {
        activeUser = localStorage.getItem("currentUser");
        if (!activeUser) {
          try {
            const userResp = await fetch("http://103.219.1.138:4412/api/method/frappe.auth.get_logged_user", {
              headers: { 'Authorization': `token ${apiKey}:${apiSecret}` }
            });
            const userData = await userResp.json();
            activeUser = userData.message;
          } catch (e) { console.error("Manual user fetch failed:", e); }
        }
      }



      if (activeUser && activeUser !== "Guest") {
        try {
          let employee = null;

          // Phase 1: Identifying Logged-in User via system API (Highest Priority)
          try {

            const infoResp = await fetch("http://103.219.1.138:4412/api/method/quantlis_management.api.get_current_user_info", {
              headers: { 'Authorization': `token ${apiKey}:${apiSecret}` }
            });
            const infoData = await infoResp.json();
            const info = infoData.message;
            const empId = info?.employee || info?.employee_id || info?.custom_employee_id;
            if (empId) {
              const empResp = await fetch(`${API_BASE_URL}/Employee/${empId}?fields=${JSON.stringify(["name", "designation"])}`, {
                headers: { 'Authorization': `token ${apiKey}:${apiSecret}` }
              });
              const empData = await empResp.json();
              if (empData.data) employee = empData.data;
            }
          } catch (e) { console.error("Logged-in user discovery via API failed:", e); }

          // Phase 2: Standard Searches (Email match)
          if (!employee) {
            const searchFields = ["user_id", "company_email", "personal_email", "name"];
            for (const field of searchFields) {
              const empResp = await fetch(`${API_BASE_URL}/Employee?filters=${JSON.stringify([[field, "=", activeUser]])}&fields=${JSON.stringify(["name", "designation"])}`, {
                headers: { 'Authorization': `token ${apiKey}:${apiSecret}` }
              });
              const empData = await empResp.json();
              if (empData.data?.[0]) { employee = empData.data[0]; break; }
            }
          }

          // Phase 3: SUPER FUZZY (Contains first part of email/user name)
          if (!employee) {
            const prefix = activeUser.split(".")[0];

            const superFuzzyUrl = `${API_BASE_URL}/Employee?filters=${JSON.stringify([["employee_name", "like", `%${prefix}%`]])}&fields=${JSON.stringify(["name", "designation"])}`;
            const superFuzzyResp = await fetch(superFuzzyUrl, { headers: { 'Authorization': `token ${apiKey}:${apiSecret}` } });
            const superFuzzyData = await superFuzzyResp.json();
            if (superFuzzyData.data?.[0]) employee = superFuzzyData.data[0];
          }

          // Phase 4: Reported By field (Final Fallback)
          if (!employee && data.custom_reported_by) {

            const repResp = await fetch(`${API_BASE_URL}/Employee/${data.custom_reported_by}?fields=${JSON.stringify(["name", "designation"])}`, {
              headers: { 'Authorization': `token ${apiKey}:${apiSecret}` }
            });
            const repData = await repResp.json();
            if (repData.data) employee = repData.data;
          }

          if (employee) {
            const today = new Date().toISOString().split('T')[0];
            const alreadySignedToday = signatures.some(sig => sig.name1 === employee.name && sig.date === today);
            if (!alreadySignedToday) {
              signatures.push({
                name1: employee.name,
                designation: employee.designation,
                date: today
              });
            }
          } else {
            console.error("ULTIMATE FAIL: No employee found for signature discovery.");
          }
        } catch (e) { console.error("Signature discovery process failed:", e); }
      }

      // --- END: AUTOMATIC SIGNATURE LOGIC ---

      // 1. Handle main attachment uploads
      if (data.custom_scada_attach instanceof File) {
        toast.info("Uploading SCADA attachment...");
        data.custom_scada_attach = await uploadFile(data.custom_scada_attach, apiKey!, apiSecret!, methodBaseUrl);
      }

      // 2. Handle child table attachments (Incident Evidence)
      if (data.custom_attachments && Array.isArray(data.custom_attachments)) {
        for (let i = 0; i < data.custom_attachments.length; i++) {
          const row = data.custom_attachments[i];
          if (row.attach_ayav instanceof File) {
            toast.info(`Uploading evidence file ${i + 1}...`);
            row.attach_ayav = await uploadFile(row.attach_ayav, apiKey!, apiSecret!, methodBaseUrl);
          }
        }
      }

      // 3. Handle signatures (Reporting and Approval table)
      if (signatures && Array.isArray(signatures)) {
        for (let i = 0; i < signatures.length; i++) {
          const row = signatures[i];
          if (row.signature instanceof File) {
            toast.info(`Uploading signature for row ${i + 1}...`);
            row.signature = await uploadFile(row.signature, apiKey!, apiSecret!, methodBaseUrl);
          }
        }
      }

      const payload: Record<string, any> = { ...data, custom_reporting_and_approval: signatures };

      // Ensure hidden subject is populated if missed by watcher
      if (!payload.subject) {
        payload.subject = payload.custom_incident_subject;
      }

      // Clean up payload (remove breaks, convert checks, handle complex objects)
      const finalPayload: Record<string, any> = {};

      for (const key in payload) {
        // Skip UI-only fields
        if (payload[key] === undefined) continue;
        if (key.startsWith("custom_section") || key.startsWith("sb_") || key.startsWith("custom_subject_section")) continue;

        const value = payload[key];
        if (value && typeof value === 'object') {
          if (value instanceof Date) {
            finalPayload[key] = value.toISOString();
          }
          else if (Array.isArray(value)) {
            finalPayload[key] = value;
          }
          else {
            continue; // Skip unknown objects
          }
        } else {
          finalPayload[key] = value;
        }
      }

      // Convert booleans to 1/0 for Frappe
      const checkFields = [
        "custom_mechanical_failure", "custom_electrical_failure", "custom_flooding__waterlogging",
        "custom_control_scada", "custom_structural_damage", "custom_fire__short_circuit",
        "custom_personnel_injury", "custom_other", "custom_resolved_onsite",
        "custom_escalated_to_higher_authority", "custom_intervention_required",
        "custom_equipment_replacement_pending", "custom_under_investigation"
      ];

      checkFields.forEach(field => {
        if (typeof finalPayload[field] === 'boolean') {
          finalPayload[field] = finalPayload[field] ? 1 : 0;
        }
      });



      const resp = await axios.put(`${API_BASE_URL}/${DOCTYPE_NAME}/${docname}`, finalPayload, {
        headers: {
          'Authorization': `token ${apiKey}:${apiSecret}`,
          'Content-Type': 'application/json',
        },
        withCredentials: true,
      });

      if (resp.status !== 200 && resp.status !== 201) {
        throw new Error(resp.data.exception || resp.data._server_messages || "Failed to update");
      }

      toast.success("Incident Updated Successfully");
      setRecord(resp.data.data);
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 50);

      // Return status to update DynamicForm state
      return { status: "Saved", statusCode: 200 };

    } catch (err: any) {
      console.error("Save Error:", err);
      toast.error("Failed to save record", { description: err.message, duration: Infinity });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        tabs={formTabs}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        onFormInit={handleFormInit}
        title={`Edit LIS Incident: ${docname}`}
        description="Update operational issues and failures"
        submitLabel={isSaving ? "Saving..." : "Update Record"}
        cancelLabel="Cancel"
        doctype={DOCTYPE_NAME}
        deleteConfig={{
          doctypeName: DOCTYPE_NAME,
          docName: docname,
          redirectUrl: "/operations/doctype/lis-incident-record"
        }}
      />

      <div className="w-full px-4 md:px-8">
        <DocumentActivity
          doctype={DOCTYPE_NAME}
          docname={docname}
          baseUrl={API_BASE_URL.replace("/api/resource", "")}
          apiKey={apiKey || ""}
          apiSecret={apiSecret || ""}
          isInitialized={!!(apiKey && apiSecret)}
          currentUserEmail={record?.owner}
          modifiedStr={record?.modified}
          modifiedBy={record?.modified_by}
        />
      </div>
    </div>
  );
}