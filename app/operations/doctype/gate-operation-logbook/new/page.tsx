"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
      DynamicForm,
      TabbedLayout,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

export default function NewGateOperationLogbookPage() {
      const router = useRouter();
      const searchParams = useSearchParams();
      const { apiKey, apiSecret } = useAuth();
      const [isSaving, setIsSaving] = React.useState(false);

      const doctypeName = "Gate Operation Logbook";

      // Parse duplicate data from URL parameters
      const duplicateData = React.useMemo(() => {
            const duplicateParam = searchParams.get('duplicate');
            if (!duplicateParam) return null;
            try {
                  const decodedData = JSON.parse(atob(decodeURIComponent(duplicateParam)));
                  console.log("Parsed duplicate data:", decodedData);
                  return decodedData;
            } catch (error) {
                  console.error("Error parsing duplicate data:", error);
                  toast.error("Failed to parse duplicate data", { duration: Infinity });
                  return null;
            }
      }, [searchParams]);

      // Show notification if we have duplicate data (only once)
      const notificationShown = React.useRef(false);
      React.useEffect(() => {
            if (duplicateData && !notificationShown.current) {
                  toast.success("Form populated with duplicate data. Modify as needed and save.");
                  notificationShown.current = true;
            }
      }, [duplicateData]);

      /* -------------------------------------------------
      1. Define the form structure
      ------------------------------------------------- */
      const formTabs: TabbedLayout[] = React.useMemo(() => {
            // Helper function to get value from duplicate data or fallback to default
            const getValue = (fieldName: string, defaultValue: any = undefined) => {
                  return duplicateData?.[fieldName] ?? defaultValue;
            };

            return [
                  {
                        name: "Details",
                        fields: [
                              // Main information row
                              {
                                    name: "lis_name",
                                    label: "LIS Name",
                                    type: "Link",
                                    linkTarget: "Lift Irrigation Scheme",
                                    required: true,
                                    defaultValue: getValue("lis_name"),
                              },

                              {
                                    name: "stage",
                                    label: "Stage/ Sub Scheme",
                                    type: "Link",
                                    linkTarget: "Stage No",
                                    required: true,
                                    defaultValue: getValue("stage"),
                                    filterMapping: [
                                          {
                                                sourceField: "lis_name",
                                                targetField: "lis_name"
                                          }
                                    ],
                              },
                              {
                                    name: "gate_no",
                                    label: "Gate No",
                                    type: "Link",
                                    linkTarget: "Gate",
                                    required: true,
                                    customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
                                    filters: (getValue) => {
                                          const filters: Record<string, any> = {};
                                          const stage = getValue("stage");
                                          const lisName = getValue("lis_name");
                                          if (stage) filters.stage = stage;
                                          if (lisName) filters.lis_name = lisName;
                                          return filters;
                                    },
                                    referenceDoctype: "Gate",
                                    doctype: "Gate",
                              },

                              // Gate Operations Section
                              {
                                    name: "gate_operations_section",
                                    label: "Gate Operations",
                                    type: "Section Break",
                              },
                              {
                                    name: "gate_operation",
                                    label: "Gate Operation",
                                    type: "Select",
                                    options: "Lift\nLowered",
                                    required: true,
                                    defaultValue: getValue("gate_operation"),
                              },

                              // Conditional Fields: Lift
                              {
                                    name: "lift_by",
                                    label: "Lift By (In Meters)",
                                    type: "Float",
                                    precision: 2,
                                    displayDependsOn: "gate_operation=='Lift'",
                                    defaultValue: getValue("lift_by"),
                              },
                              {
                                    name: "lift_date",
                                    label: "Lift Date",
                                    type: "DateTime",
                                    displayDependsOn: "gate_operation=='Lift'",
                                    defaultValue: getValue("lift_date"),
                              },

                              // Conditional Fields: Lowered
                              {
                                    name: "lowered_by",
                                    label: "Lowered By (In Meters)",
                                    type: "Float",
                                    precision: 2,
                                    displayDependsOn: "gate_operation=='Lowered'",
                                    defaultValue: getValue("lowered_by"),
                              },
                              {
                                    name: "lowered_date",
                                    label: "Lowered Date",
                                    type: "DateTime",
                                    displayDependsOn: "gate_operation=='Lowered'",
                                    defaultValue: getValue("lowered_date"),
                              },

                              // Final information
                              { name: "section_break_ttnk", label: "", type: "Section Break" },
                              {
                                    name: "instruction_reference",
                                    label: "Instruction Reference",
                                    type: "Small Text",
                                    defaultValue: getValue("instruction_reference"),
                              },
                              {
                                    name: "remark",
                                    label: "Remark",
                                    type: "Small Text",
                                    defaultValue: getValue("remark"),
                              },
                        ],
                  },
            ];
      }, [duplicateData]);

      /* -------------------------------------------------
      2. SUBMIT (Create)
      ------------------------------------------------- */
      const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
            // Check if we have valid data to submit
            const hasValidData = isDirty || (duplicateData && data.gate_no);
            if (!hasValidData) {
                  toast.info("Please fill out the form.");
                  return;
            }
            setIsSaving(true);
            try {
                  // Build the payload
                  const payload: Record<string, any> = {
                        doctype: doctypeName,
                        lis_name: data.lis_name,
                        lis_phase: data.lis_phase,
                        stage: data.stage,
                        gate_no: data.gate_no,
                        gate_operation: data.gate_operation,
                        instruction_reference: data.instruction_reference,
                        remark: data.remark,
                  };

                  // Handle conditional numeric fields based on operation type
                  if (data.gate_operation === "Lift") {
                        payload.lift_by = Number(data.lift_by) || 0;
                        payload.lift_date = data.lift_date;
                        // Optionally clear the other fields if they were filled
                        payload.lowered_by = 0;
                        payload.lowered_date = null;
                  } else if (data.gate_operation === "Lowered") {
                        payload.lowered_by = Number(data.lowered_by) || 0;
                        payload.lowered_date = data.lowered_date;
                        payload.lift_by = 0;
                        payload.lift_date = null;
                  }

                  console.log("Sending NEW Gate Operation Logbook payload:", payload);
                  const headers: HeadersInit = {
                        'Content-Type': 'application/json',
                        'Authorization': `token ${apiKey}:${apiSecret}`,
                  };

                  const storedCsrfToken = localStorage.getItem('csrfToken');
                  if (storedCsrfToken) {
                        headers['X-Frappe-CSRF-Token'] = storedCsrfToken;
                  }

                  const resp = await fetch(`${API_BASE_URL}/${doctypeName}`, {
                        method: 'POST',
                        headers: headers,
                        credentials: 'include',
                        body: JSON.stringify(payload),
                  });

                  const responseData = await resp.json();

                  if (!resp.ok) {
                        console.log("Full server error:", responseData);
                        throw new Error(responseData.exception || responseData._server_messages || "Failed to create document");
                  }
                  toast.success("Gate Operation Logbook created successfully!");
                  // Navigate to the list view
                  router.push(`/operations/doctype/gate-operation-logbook/${responseData.data.name}`);
                  return { statusCode: resp.status, status: responseData.data?.status };

            } catch (err: any) {
                  console.error("Save error:", err);
                  if (err.response?.data?.exc_type === "DuplicateEntryError") {
                        toast.error("Duplicate Entry Error", {
                              description: "This record may already exist.",
                              duration: Infinity
                        });
                  } else {
                        toast.error("Failed to create record", {
                              description: err.message || "Check console for details.",
                              duration: Infinity
                        });
                  }
            } finally {
                  setIsSaving(false);
            }
      };

      const handleCancel = () => router.back();

      /* -------------------------------------------------
      3. RENDER FORM
      ------------------------------------------------- */
      return (
            <DynamicForm
                  tabs={formTabs}
                  onSubmit={handleSubmit}
                  onCancel={handleCancel}
                  title="New Gate Operation Logbook"
                  description="Create a new log entry for gate operations"
                  submitLabel={isSaving ? "Saving..." : "Create"}
                  cancelLabel="Cancel"
            />
      );
}
