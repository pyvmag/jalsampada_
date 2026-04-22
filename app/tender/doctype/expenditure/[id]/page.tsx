"use client";


import * as React from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";

import {
  DynamicForm,
  TabbedLayout,
  FormField,
} from "@/components/DynamicFormComponent";
import { getApiMessages } from "@/lib/utils";
import DocumentActivity from "@/components/DocumentActivity";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  fetchWorkNameByTenderNumber,
  updateWorkNameInTableRows,
  clearWorkNameInTableRows,
  fetchPreviousBillDetails // 🟢 Added back
} from "../services";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

/* -------------------------------------------------
1. Expenditure type – mirrors the API exactly
------------------------------------------------- */

interface ExpenditureDetailsRow {
  name_of_work?: string;          // Small Text
  stage?: string;                 // Link -> Stage No
  work_type?: string;             // Link -> Work Type
  asset?: string;                 // Link -> Asset
  work_subtype?: string;          // Link -> Work Subtype
  asset_name?: string;            // Data
  bill_amount?: number;           // Currency (Expenditure Amount)
  have_asset?: 0 | 1;             // Check
  asset_no?: string;              // Data
  from_date?: string;             // Date
  attach?: string | File;         // Attach
  to_date?: string;               // Date
  invoice_number?: string;        // Data
  expenditure_date?: string;      // Date (Invoice Date)
  remarks?: string;               // Text (Work Details)
  custom_basic_amount?: number;   // Currency
  custom_insurance?: number;      // Currency
  custom_gst?: string;            // Data
}

interface ExpenditureData {
  name: string;

  fiscal_year?: string;             // Link -> Fiscal Year
  prev_bill_no?: string;            // Data
  bill_upto?: number;               // Currency
  tender_number?: string;           // Link -> Project
  bill_number?: string;             // Data
  remaining_amount?: number;        // Currency
  tender_amount?: number;           // Currency
  prev_bill_amt?: number;           // Currency
  bill_type?: string;               // Select
  posting_date?: string;            // Date
  bill_amount?: number;             // Currency

  // 🟢 Corrected Field Names (From our fix)
  previous_page_no?: string;        // Data (Previous)
  previous_mb_no?: string;          // Data (Previous)

  page_no?: string;                 // Data (Current)
  mb_no?: string;                   // Data (Current)

  lift_irrigation_scheme?: string;  // Link -> Lift Irrigation Scheme
  stage?: string[];                 // Table MultiSelect -> Stage Multiselect
  expenditure_details?: ExpenditureDetailsRow[]; // Table -> Expenditure Details
  saved_amount?: number;            // Currency
  work_description?: string;        // Text

  docstatus: 0 | 1 | 2 | number;
  modified: string;
  owner?: string;
  modified_by?: string;
}

/**
 * Uploads a single file to Frappe's 'upload_file' method
 */
async function uploadFile(
  file: File,
  apiKey: string,
  apiSecret: string,
  methodUrl: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("is_private", "0"); // 0 = Public, 1 = Private

  try {
    const resp = await axios.post(
      `${methodUrl.replace("/api/resource", "")}/api/method/upload_file`,
      formData,
      {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
        },
        withCredentials: true,
      }
    );

    if (resp.data && resp.data.message) {
      return resp.data.message.file_url;
    } else {
      throw new Error("Invalid response from file upload");
    }
  } catch (err) {
    console.error("File upload failed:", err);
    throw err;
  }
}

/* -------------------------------------------------
2. Helper functions for Bill Numbering
------------------------------------------------- */

const getOrdinalSuperscript = (n: number) => {
  const s = n % 100;
  let suffix = "ᵗʰ"; // Default "th"
  if (s < 11 || s > 13) {
    switch (n % 10) {
      case 1:
        suffix = "ˢᵗ";
        break;
      case 2:
        suffix = "ⁿᵈ";
        break;
      case 3:
        suffix = "ʳᵈ";
        break;
    }
  }
  return `${n}${suffix}`;
};

const formatBillNumber = (n: number, billType: string) => {
  const ordinalNum = getOrdinalSuperscript(n);
  if (billType === "Final") {
    return `${ordinalNum} & Final`;
  }
  return `RA ${ordinalNum}`;
};

/* -------------------------------------------------
3. Page component
------------------------------------------------- */

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = params.id as string;
  const doctypeName = "Expenditure";

  const [expenditure, setExpenditure] = React.useState<ExpenditureData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const isProgrammaticUpdate = React.useRef(false);
  const isInitialLoad = React.useRef(true);
  const [formVersion, setFormVersion] = React.useState(0);

  // State for work name default value
  const [workName, setWorkName] = React.useState<string>("");
  const [formInstance, setFormInstance] = React.useState<any>(null);
  const [billType, setBillType] = React.useState<string | undefined>("");
  const [prevCumulativeAmount, setPrevCumulativeAmount] = React.useState(0);

  // 🟢 Using formDirty instead of formSaveState
  const [formDirty, setFormDirty] = React.useState(false);
  const [activeButton, setActiveButton] = React.useState<"SAVE" | "SUBMIT" | "CANCEL" | null>(null);

  // Helper function to get allowed stages from parent stage field
  const getAllowedStages = React.useCallback((formData: Record<string, any>): string[] => {
    const parentStage = formData.stage;
    if (!parentStage || !Array.isArray(parentStage)) return [];
    return parentStage.map((item: any) => item.stage).filter(Boolean);
  }, []);

  /* -------------------------------------------------
  3. FETCH DOCUMENT
  ------------------------------------------------- */

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
          `${API_BASE_URL}/${doctypeName}/${docname}`,
          {
            headers: {
              Authorization: `token ${apiKey}:${apiSecret}`,
              "Content-Type": "application/json",
            },
            withCredentials: true,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          }
        );

        const data = resp.data.data as ExpenditureData;
        setExpenditure(data);
        setBillType(data.bill_type || "");

        // 🟢 Set initial active button based on docstatus and bill type
        if (data.docstatus === 0) { // Draft
          if (data.bill_type === "Final") {
            setActiveButton("SUBMIT");
          } else {
            setActiveButton(null);
          }
        } else if (data.docstatus === 1) { // Submitted
          if (data.bill_type === "Final") {
            setActiveButton("CANCEL");
          } else {
            setActiveButton(null);
          }
        }

        setFormDirty(false);
      } catch (err: any) {
        console.error("API Error:", err);
        // 🟢 IMPROVED ERROR HANDLING
        const messages = getApiMessages(
          null,
          err,
          "Record loaded successfully",
          "Failed to load record",
          (error) => {
            // Custom handler for load errors with status codes
            if (error.response?.status === 404) return "Record not found";
            if (error.response?.status === 403) return "Unauthorized";
            if (error.response?.status === 417) {
              // Extract actual validation message from server response
              const serverMessages = error.response?.data?._server_messages;
              if (serverMessages) {
                try {
                  const parsed = JSON.parse(serverMessages);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    const messageObj = typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0];
                    return messageObj.message || error.response?.data?.exception || "Validation failed";
                  }
                } catch (e) {
                  console.error("Failed to parse server messages:", e);
                }
              }
              return error.response?.data?.exception || "Validation failed - Server cannot meet requirements";
            }
            return "Failed to load record";
          }
        );

        setError(messages.description || messages.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  // 🟢 OUR FIX: INITIAL FETCH FOR PREVIOUS DETAILS (Always run to get cumulative amount)
  React.useEffect(() => {
    if (!formInstance || !expenditure?.tender_number) return;

    // Remove check for currentPrevMB so we always get the latest cumulative_amount
    const fetchInitialPrevDetails = async () => {
      if (!apiKey || !apiSecret) return;
      try {
        const prevDetails = await fetchPreviousBillDetails(
          expenditure.tender_number!,
          docname,
          apiKey,
          apiSecret
        );

        if (prevDetails) {
          isProgrammaticUpdate.current = true; // Don't mark as dirty for initial load

          formInstance.setValue("prev_bill_no", prevDetails.bill_number || 0);
          formInstance.setValue("prev_bill_amt", prevDetails.bill_amount || 0);
          // Map 'mb_no' from old record -> 'previous_mb_no'
          formInstance.setValue("previous_mb_no", prevDetails.mb_no || 0);
          // Map 'page_no' from old record -> 'previous_page_no'
          formInstance.setValue("previous_page_no", prevDetails.page_no || 0);

          setPrevCumulativeAmount(prevDetails.cumulative_amount || 0);

          setTimeout(() => { isProgrammaticUpdate.current = false; }, 1000); // 🟢 Increased timeout to prevent race condition
        }
      } catch (e) { console.error(e); }
    };

    fetchInitialPrevDetails();
  }, [formInstance, expenditure, docname, apiKey, apiSecret]);

  // 🟢 OUR FIX: WATCHER WITH FETCH LOGIC
  React.useEffect(() => {
    if (!formInstance) return;

    const subscription = formInstance.watch(async (value: any, { name }: { name?: string }) => {
      if (name === "tender_number" && value.tender_number) {
        if (!apiKey || !apiSecret) return;

        // 1. Fetch Work Name
        const fetchWorkName = async () => {
          try {
            const fetchedWorkName = await fetchWorkNameByTenderNumber(value.tender_number, apiKey, apiSecret);
            if (fetchedWorkName) {
              updateWorkNameInTableRows(formInstance, fetchedWorkName);
              setWorkName(fetchedWorkName);
            } else {
              clearWorkNameInTableRows(formInstance);
              setWorkName("");
            }
          } catch (error) { console.error("Failed to fetch work_name:", error); }
        };

        // 2. Fetch Previous Bill Details
        const fetchPreviousBill = async () => {
          try {
            const prevDetails = await fetchPreviousBillDetails(
              value.tender_number,
              docname || null,
              apiKey,
              apiSecret
            );

            if (prevDetails) {
              const lastBillNo = prevDetails.bill_number || "";
              formInstance.setValue("prev_bill_no", lastBillNo || 0);
              formInstance.setValue("prev_bill_amt", prevDetails.bill_amount || 0);
              // Correct Mapping
              formInstance.setValue("previous_mb_no", prevDetails.mb_no || 0);
              formInstance.setValue("previous_page_no", prevDetails.page_no || 0);

              setPrevCumulativeAmount(prevDetails.cumulative_amount || 0);

              // 🟢 Auto-fill Bill Number (RA sequence) - Instead of naming validations
              let nextNum = 1;
              if (lastBillNo) {
                const match = lastBillNo.match(/\d+/);
                if (match) {
                  nextNum = parseInt(match[0]) + 1;
                }
              }
              const currentBillType = formInstance.getValues("bill_type") || "Running";
              formInstance.setValue("bill_number", formatBillNumber(nextNum, currentBillType), { shouldDirty: true });
            } else {
              formInstance.setValue("prev_bill_no", 0);
              formInstance.setValue("prev_bill_amt", 0);
              formInstance.setValue("previous_mb_no", 0);
              formInstance.setValue("previous_page_no", 0);
              setPrevCumulativeAmount(0);

              // First bill for this tender
              const nextNum = 1;
              const currentBillType = formInstance.getValues("bill_type") || "Running";
              formInstance.setValue("bill_number", formatBillNumber(nextNum, currentBillType), { shouldDirty: true });
            }
          } catch (err) { console.error("Error setting previous bill details", err); }
        };

        await Promise.all([fetchWorkName(), fetchPreviousBill()]);
      }

      // 🟢 Watch for form changes to mark as dirty
      if (name && !isProgrammaticUpdate.current) {
        setFormDirty(true);
        // When form becomes dirty, show SAVE button if in draft
        if (expenditure?.docstatus === 0) {
          setActiveButton("SAVE");
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [formInstance, apiKey, apiSecret, docname, expenditure?.docstatus]);

  // Calculate bill_upto and remaining_amount when relevant fields change
  React.useEffect(() => {
    if (!formInstance) return;

    const calculateTotals = (values?: any) => {
      const currentValues = values || formInstance.getValues();
      const billAmount = Number(currentValues.bill_amount) || 0;
      const tenderAmount = Number(currentValues.tender_amount) || 0;

      // Calculate bill_upto = bill_amount + prevCumulativeAmount (O(1))
      const billUpto = billAmount + prevCumulativeAmount;
      const remainingAmount = tenderAmount - billUpto;

      // Check current values in form
      const currentBillUpto = Number(formInstance.getValues("bill_upto"));
      const currentRemaining = Number(formInstance.getValues("remaining_amount"));

      if (currentBillUpto !== billUpto || currentRemaining !== remainingAmount) {

        // 🟢 FIX: If this is the initial machine calculation (on load), 
        // use RESET to make these values the "default" (Clean State).
        // Otherwise (user typing), use SETVALUE (Dirty State).
        if (isInitialLoad.current && prevCumulativeAmount > 0) {
          console.log("🔄 Initial Calculation - Resetting form defaults with:", { billUpto, remainingAmount });

          // We reset with ALL current values + our updates to establish new baseline
          formInstance.reset({
            ...formInstance.getValues(),
            bill_upto: billUpto,
            remaining_amount: remainingAmount
          }, { keepDefaultValues: false, keepDirty: false }); // keepDirty: false ensures it's "Saved"

          isInitialLoad.current = false;
        } else {
          // Normal update (User typing or subsequent updates)
          formInstance.setValue("bill_upto", Number(billUpto.toFixed(2)), { shouldDirty: !isProgrammaticUpdate.current });
          formInstance.setValue("remaining_amount", Number(remainingAmount.toFixed(2)), { shouldDirty: !isProgrammaticUpdate.current });
        }
      }
    };

    // Run immediately when prevCumulativeAmount changes
    if (prevCumulativeAmount > 0) {
      calculateTotals();
    }

    const subscription = formInstance.watch((value: any, { name }: { name?: string }) => {
      // Once user starts typing, it's no longer initial load
      if (name) isInitialLoad.current = false;

      if (name === "bill_amount" || name === "tender_amount" || name === "expenditure_details" || name === undefined) {
        calculateTotals(value);
      }

      // 🟢 Add listener for child table fields to recalculate expenditure_details bill_amount and parent total
      if (
        name?.startsWith("expenditure_details.") &&
        (name.includes("custom_basic_amount") ||
         name.includes("custom_insurance") ||
         name.includes("custom_gst") ||
         name.includes("bill_amount"))
      ) {
        const match = name.match(/expenditure_details\.(\d+)\./);
        if (match) {
          const index = parseInt(match[1]);
          const details = formInstance.getValues("expenditure_details");
          if (details && details[index]) {
            const row = details[index];
            const basic = Number(row.custom_basic_amount) || 0;
            const ins = Number(row.custom_insurance) || 0;
            const gstStr = row.custom_gst
              ? row.custom_gst.toString().replace("%", "").trim()
              : "0";
            const gst = Number(gstStr) || 0;
            
            const totalBase = basic + ins;
            const calculatedRowAmt = Number((totalBase * (gst / 100)).toFixed(2));

            // Update row bill_amount if it changed
            if (Number(row.bill_amount) !== calculatedRowAmt) {
              formInstance.setValue(
                `expenditure_details.${index}.bill_amount`,
                calculatedRowAmt,
                { shouldDirty: true, shouldValidate: true }
              );
            }

            // Removed toast check as per request
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [formInstance, prevCumulativeAmount]);

  const handleFormInit = React.useCallback((form: any) => {
    setFormInstance(form);

    // Get initial bill type from form
    const initialBillType = form.getValues('bill_type');
    if (initialBillType) {
      setBillType(initialBillType);
    }

    // Watch for bill type changes
    form.watch((value: any, { name }: { name?: string }) => {
      if (name === "bill_type") {
        setBillType(value.bill_type);

        // 🟢 Update bill_number format
        const currentBillNo = form.getValues('bill_number');
        if (currentBillNo) {
          const match = currentBillNo.match(/\d+/);
          if (match) {
            const num = parseInt(match[0]);
            form.setValue("bill_number", formatBillNumber(num, value.bill_type), { shouldDirty: true });
          }
        }

        // When bill type changes, update button logic
        if (!formDirty && expenditure?.docstatus === 0) {
          if (value.bill_type === "Final") {
            setActiveButton("SUBMIT");
          } else {
            setActiveButton(null);
          }
        }
      }
    });
  }, [formDirty, expenditure?.docstatus]);

  /* -------------------------------------------------
    4. Build tabs once when data is ready
    ------------------------------------------------- */
  // ... (rest of the code remains the same)

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    if (!expenditure) return [];

    const fields = (list: FormField[]): FormField[] =>
      list.map((f) => ({
        ...f,
        defaultValue:
          f.name in expenditure
            ? // @ts-ignore
            expenditure[f.name as keyof ExpenditureData]
            : f.defaultValue,
      }));

    return [
      {
        name: "Details",
        fields: fields([
          {
            name: "fiscal_year",
            label: "Fiscal Year",
            type: "Link",
            linkTarget: "Fiscal Year",
            required: true,
          },
          { name: "cb1", label: "", type: "Section Break" },

          {
            name: "posting_date",
            label: "Bill Date",
            type: "Date",
            fieldColumns: 1,
          },

          {
            name: "tender_number",
            label: "Tender Number",
            type: "Link",
            required: true,
            linkTarget: "Project",
            fieldColumns: 1,
            filterMapping: [
              { sourceField: "custom_fiscal_year", targetField: "fiscal_year" }
            ]
          },
          {
            name: "tender_amount",
            label: "Tender Amount",
            type: "Read Only",
            fieldColumns: 1,
            precision: 2,
            fetchFrom: {
              sourceField: "tender_number",
              targetDoctype: "Project",
              targetField: "custom_tender_amount"
            }
          },

          {
            name: "lift_irrigation_scheme",
            label: "Lift Irrigation Scheme",
            type: "Read Only",
            linkTarget: "Lift Irrigation Scheme",
            required: true,
            fieldColumns: 1,
            fetchFrom: {
              sourceField: "tender_number",
              targetDoctype: "Project",
              targetField: "custom_lis_name"
            }
          },

          {
            name: "prev_bill_no",
            label: "Previous Bill Number",
            type: "Read Only",
            defaultValue: 0,
            fieldColumns: 1,
          },

          {
            name: "prev_bill_amt",
            label: "Previous Bill Amount",
            type: "Read Only",
            precision: 2,
            defaultValue: "0.00",
            fieldColumns: 1,
          },

          // 🟢 Corrected Field Names
          {
            name: "previous_mb_no",
            label: "Previous MB No",
            type: "Read Only",
            defaultValue: 0,
            fieldColumns: 1,
          },

          {
            name: "previous_page_no",
            label: "Previous Page No",
            type: "Read Only",
            defaultValue: 0,
            fieldColumns: 1,
          },

          {
            name: "bill_number",
            label: "Bill Number",
            type: "Data",
            fieldColumns: 1,
            readOnly: true,
          },

          {
            name: "bill_amount",
            label: "Bill Amount",
            type: "Currency",
            required: true,
            precision: 2,
            defaultValue: "0.00",
            fieldColumns: 1,
          },

          {
            name: "mb_no",
            label: "MB No",
            type: "Data",
            defaultValue: 0,
            fieldColumns: 1,
          },

          {
            name: "page_no",
            label: "Page No",
            type: "Data",
            defaultValue: 0,
            fieldColumns: 1,
          },

          {
            name: "bill_upto",
            label: "Bill Upto Amount",
            type: "Read Only",
            precision: 2,
            defaultValue: "0.00",
          },
          {
            name: "remaining_amount",
            label: "Bill Remaining Amount",
            type: "Read Only",
            precision: 2,
          },

          {
            name: "bill_type",
            label: "Bill Type",
            type: "Select",
            options: [
              { label: "Running", value: "Running" },
              { label: "Final", value: "Final" },
            ],
          },

          {
            name: "stage",
            label: "Stage/ Sub Scheme",
            type: "Table MultiSelect",
            linkTarget: "Stage No",
            filterMapping: [
              { sourceField: "lift_irrigation_scheme", targetField: "lis_name" },
            ],
            fetchFrom: {
              sourceField: "tender_number",
              targetDoctype: "Project",
              targetField: "custom_stage"
            },
            readOnlyDependsOn: "tender_number"
          },

          {
            name: "expenditure_details",
            label: "Expenditure Details",
            type: "Table",
            showDownloadUpload: true,
            columns: [
              { name: "name_of_work", label: "Name of Work", type: "Read Only", defaultValue: workName },
              {
                name: "stage",
                label: "Stage",
                type: "Link",
                linkTarget: "Stage No",
                filters: (getValues: (name: string) => any) => {
                  const parentStage = getValues("parent.stage");
                  const allowedStages = getAllowedStages({ stage: parentStage });
                  if (!allowedStages || allowedStages.length === 0) return { name: ["in", []] };
                  return { name: ["in", allowedStages] };
                }
              },
              { name: "section_interchange", label: "", type: "Section Break" },
              { name: "work_type", label: "Work Type", type: "Link", linkTarget: "Work Type" },
              {
                name: "work_subtype",
                label: "Work Subtype",
                type: "Link",
                linkTarget: "Work Subtype",
                filterMapping: [{ sourceField: "work_type", targetField: "work_type" }]
              },
              { name: "remarks", label: "Work Details", type: "Text" },
              { name: "have_asset", label: "Have Asset", type: "Check", displayDependsOn: "work_type==Miscellaneous" },
              {
                name: "asset",
                label: "Asset",
                type: "Link",
                linkTarget: "Asset",
                displayDependsOn: "work_type==Repair || work_type==Auxilary || have_asset==1",
                filters: (getValues: (name: string) => any) => {
                  const rowStage = getValues("stage");
                  const lis = getValues("parent.lift_irrigation_scheme");

                  const filters: Record<string, any> = {};
                  if (lis) filters["custom_lis_name"] = lis;
                  if (rowStage) filters["custom_stage_no"] = rowStage;

                  return filters;
                },
              },
              {
                name: "asset_name",
                label: "Asset Name",
                type: "Data",
                displayDependsOn: "work_type==Repair || work_type==Auxilary || have_asset==1",
                fetchFrom: { sourceField: "asset", targetDoctype: "Asset", targetField: "asset_name" }
              },
              {
                name: "asset_no",
                label: "Asset No",
                type: "Data",
                displayDependsOn: "work_type==Repair || work_type==Auxilary || have_asset==1",
                fetchFrom: { sourceField: "asset", targetDoctype: "Asset", targetField: "custom_asset_no" }
              },
              { name: "from_date", label: "From Date", type: "Date", displayDependsOn: "work_type==Operation || work_type==Security" },
              { name: "to_date", label: "To Date", type: "Date", displayDependsOn: "work_type==Operation || work_type==Security" },
              { name: "invoice_number", label: "Invoice Number", type: "Data" },
              { name: "expenditure_date", label: "Invoice Date", type: "Date" },
              { name: "calculation_section", label: "", type: "Section Break" },
              { name: "custom_basic_amount", label: "Basic Amount", type: "Currency", precision: 2 },
              { name: "custom_insurance", label: "Insurance", type: "Currency", precision: 2 },
              { name: "custom_gst", label: "GST(%)", type: "Data" },
              { name: "bill_amount", label: "Expenditure Amount", type: "Currency", precision: 2, readOnly: true },
              { name: "attach", label: "Attach", type: "Attach" },
              { name: "cb", label: "Column Break", type: "Column Break" },
              { name: "job_carried_out", label: "Job Carried Out", type: "Long Text", displayDependsOn: "work_type==Repair" },
              { name: "spare_replaced", label: "Spare Replaced", type: "Long Text", displayDependsOn: "work_type==Repair" },
            ],
          },

          {
            name: "saved_amount",
            label: "Saved Amount",
            type: "Currency",
            precision: 2,
            displayDependsOn: { "bill_type": "Final" }
          },
          {
            name: "work_description",
            label: "Work Description",
            type: "Long Text",
          }
        ]),
      }
    ];
  }, [expenditure, workName]);

  /* -------------------------------------------------
  5. SUBMIT – with Validation & file uploading
  ------------------------------------------------- */

  const handleSubmit = async (
    data: Record<string, any>,
    isDirty: boolean
  ): Promise<{ status?: string } | void> => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    // 🟢 VALIDATION LOGIC
    const billAmount = Number(data.bill_amount) || 0;
    const tenderAmount = Number(data.tender_amount) || 0;
    const savedAmount = Number(data.saved_amount) || 0;
    const details = data.expenditure_details || [];
    const totalChildBillAmt = details.reduce((sum: number, row: any) => sum + (Number(row.bill_amount) || 0), 0);
    isProgrammaticUpdate.current = true;

    // Validation: Bill Remaining Amount
    const remainingAmount = Number(data.remaining_amount) || 0;

    // 1) Bill Remaining Amount should not be negative.
    if (remainingAmount < 0) {
      toast.error("Validation Failed", {
        description: "Bill Remaining Amount should not be negative.",
        duration: Infinity
      });
      return;
    }

    // 2) If Bill Remaining Amount is greater than Tender Amount then it will show error.
    if (remainingAmount > tenderAmount) {
      toast.error("Transaction cannot be processed", {
        description: "Tender amount is insufficient to cover the remaining bill amount.",
        duration: Infinity
      });
      return;
    }

    // Rule 1: Bill Amount cannot be > Tender Amount (Hard Limit)
    if (billAmount > tenderAmount) {
      toast.error("Validation Failed", {
        description: "The Bill Amount cannot be greater than the Tender Amount.",
        duration: Infinity
      });
      return;
    }

    if (data.bill_type === "Final") {
      // Rule 2: Mentor's Rule for Final Bills
      // bill_upto = bill_amount + prev_cumulative_amount
      const billUpto = billAmount + prevCumulativeAmount;
      const diff = Math.abs(billUpto - savedAmount);

      if (diff > 0.01) {
        toast.error("Saved Amount Mismatch", {
          description: `As per rule: Tender Amount (${tenderAmount.toLocaleString()}) - Remaining Amount must equal Saved Amount (${savedAmount.toLocaleString()}). Currently there is a difference of ${diff.toLocaleString()}.`,
          duration: Infinity,
        });
        return;
      }
    } else {
      // Rule 3: For Running Bills, ensure table matches Bill Amount
      if (Math.abs(billAmount - totalChildBillAmt) > 0.01) {
        const relation = billAmount > totalChildBillAmt ? "exceeds" : "is less than";
        toast.error("Amount Mismatch", {
          description: `Entered Bill Amount (${billAmount.toLocaleString()}) ${relation} the Invoice Amount (${totalChildBillAmt.toLocaleString()}). Please review and correct the amounts. Both amounts must be equal to proceed.`,
          duration: Infinity,
        });
        return;
      }
    }

    // If validation passes, proceed to save
    setIsSaving(true);

    try {
      const payload: Record<string, any> = JSON.parse(JSON.stringify(data));

      // Handle file uploads in Expenditure Details child table
      if (payload.expenditure_details && apiKey && apiSecret) {
        toast.info("Uploading attachments in expenditure details...");

        await Promise.all(
          payload.expenditure_details.map(
            async (row: any, index: number) => {
              const originalFile =
                data.expenditure_details?.[index]?.attach;

              if (originalFile instanceof File) {
                try {
                  const fileUrl = await uploadFile(
                    originalFile,
                    apiKey,
                    apiSecret,
                    API_BASE_URL.replace("/api/resource", "")
                  );
                  row.attach = fileUrl;
                } catch (err) {
                  throw new Error(
                    `Failed to upload file in row ${index + 1}`
                  );
                }
              }
            }
          )
        );
      }

      // Clean payload: remove non-data fields
      const allFields = formTabs.flatMap((tab) => tab.fields);
      const nonDataFields = new Set<string>();
      allFields.forEach((field) => {
        if (
          field.type === "Section Break" ||
          field.type === "Column Break" ||
          field.type === "Button" ||
          field.type === "Read Only"
        ) {
          nonDataFields.add(field.name);
        }
      });

      const finalPayload: Record<string, any> = {};
      for (const key in payload) {
        if (!nonDataFields.has(key)) {
          finalPayload[key] = payload[key];
        }
      }

      if (!expenditure) {
        alert("Error: Record data not loaded. Cannot save.");
        setIsSaving(false);
        return;
      }

      finalPayload.modified = expenditure.modified;
      finalPayload.docstatus = expenditure.docstatus;

      // Boolean conversions
      const boolFields = [
        "have_asset",
      ];
      boolFields.forEach((f) => {
        if (f in finalPayload) {
          finalPayload[f] = finalPayload[f] ? 1 : 0;
        }
      });

      // Numeric conversions
      const numericFields = [
        "bill_upto",
        "remaining_amount",
        "tender_amount",
        "prev_bill_amt",
        "bill_amount",
        "saved_amount",
      ];
      numericFields.forEach((f) => {
        if (f in finalPayload) {
          finalPayload[f] = Number(finalPayload[f]) || 0;
        }
      });

      // Child table numeric + boolean conversions
      if (Array.isArray(finalPayload.expenditure_details)) {
        finalPayload.expenditure_details = finalPayload.expenditure_details.map(
          (row: any) => {
            return {
              ...row,
              bill_amount: Number(row.bill_amount) || 0,
              have_asset: row.have_asset ? 1 : 0,
            };
          }
        );
      }

      // // Send payload
      // console.log("Sending this PAYLOAD to Frappe:", finalPayload);

      const resp = await axios.put(
        `${API_BASE_URL}/${doctypeName}/${docname}`,
        finalPayload,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      // Handle successful response
      const messages = getApiMessages(resp, null, "Changes saved!", "Failed to save");

      if (messages.success) {
        toast.success(messages.message, { description: messages.description });
      } else {
        toast.error(messages.message, { description: messages.description, duration: Infinity });
      }

      if (resp.data && resp.data.data) {
        isProgrammaticUpdate.current = true;

        // Update expenditure state with new data
        const updatedData = resp.data.data as ExpenditureData;
        setExpenditure(updatedData);
        setBillType(updatedData.bill_type);
        setFormDirty(false);

        // 🟢 CORRECTED: Update button state after save
        if (updatedData.docstatus === 0) { // Still draft
          if (updatedData.bill_type === "Final") {
            setActiveButton("SUBMIT");
          } else {
            setActiveButton(null); // No button for Running bills after save
          }
        }

        // FORCE DynamicForm REMOUNT with updated data
        setFormVersion((v) => v + 1);

        isInitialLoad.current = true; // 🟢 Reset initial load flag so new form instance starts clean

        isProgrammaticUpdate.current = false;
      }

      // Return appropriate status based on docstatus
      const savedStatus = resp.data.data.docstatus === 0 ? "Draft" :
        resp.data.data.docstatus === 1 ? "Submitted" : "Cancelled";

      return { status: savedStatus };
    } catch (err: any) {
      console.error("Save error:", err);
      console.log("Full server error:", err.response?.data);

      const messages = getApiMessages(
        null,
        err,
        "Changes saved!",
        "Failed to save",
        (error) => {
          // Custom handler for save errors with status codes
          if (error.response?.status === 404) return "Record not found";
          if (error.response?.status === 403) return "Unauthorized";
          if (error.response?.status === 417) {
            // Extract actual validation message from server response
            const serverMessages = error.response?.data?._server_messages;
            if (serverMessages) {
              try {
                const parsed = JSON.parse(serverMessages);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const messageObj = typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0];
                  return messageObj.message || error.response?.data?.exception || "Validation failed";
                }
              } catch (e) {
                console.error("Failed to parse server messages:", e);
              }
            }
            return error.response?.data?.exception || "Validation failed - Server cannot meet requirements";
          }
          return "Failed to save record";
        }
      );

      toast.error(messages.message, { description: messages.description, duration: Infinity });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!apiKey || !apiSecret) {
      toast.error("Authentication required");
      return;
    }

    try {
      await axios.post(
        `http://103.219.1.138:4412/api/method/frappe.client.cancel`,
        {
          doctype: "Expenditure",
          name: docname,
        },
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
        }
      );

      toast.success("Document cancelled successfully");

      // Update local state without reload
      const updatedExpenditure = { ...expenditure!, docstatus: 2 };
      setExpenditure(updatedExpenditure);
      setActiveButton(null); // Remove cancel button after cancellation
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel document");
    }
  };

  const handleSubmitDocument = async () => {
    if (!formInstance) return;

    const formData = formInstance.getValues();
    if (!apiKey || !apiSecret || !isInitialized || !isAuthenticated) {
      toast.error("Authentication required");
      return;
    }

    setIsSaving(true);

    try {
      // 🟢 VALIDATION LOGIC (Mirroring handleSubmit)
      const billAmount = Number(formData.bill_amount) || 0;
      const tenderAmount = Number(formData.tender_amount) || 0;
      const savedAmount = Number(formData.saved_amount) || 0;

      // Rule 1: Bill Amount cannot be > Tender Amount
      if (billAmount > tenderAmount) {
        toast.error("Validation Failed", {
          description: "The Bill Amount cannot be greater than the Tender Amount. Please verify the bill amount.",
          duration: Infinity
        });
        return;
      }

      // Rule 2: Balance Check
      const details = formData.expenditure_details || [];
      const totalChildBillAmt = details.reduce((sum: number, row: any) => sum + (Number(row.bill_amount) || 0), 0);

      const amtToBeMatched = formData.bill_type === "Final"
        ? (savedAmount - prevCumulativeAmount)
        : (totalChildBillAmt + savedAmount);

      if (Math.abs(billAmount - amtToBeMatched) > 0.01) {
        const relation = billAmount > amtToBeMatched ? "exceeds" : "is less than";
        toast.error("Amount Mismatch", {
          description: `Entered Bill Amount (${billAmount.toLocaleString()}) ${relation} the Invoice Amount (${amtToBeMatched.toLocaleString()}). Please review and correct the amounts. Both amounts must be equal to proceed.`,
          duration: Infinity
        });
        return;
      }

      // Rule 3: Saved Amount check (Only for Final bills)
      if (formData.bill_type === "Final") {
        const billUpto = billAmount + prevCumulativeAmount;
        const diff = Math.abs(billUpto - savedAmount);

        if (diff > 0.01) {
          toast.error("Saved Amount Validation Failed", {
            description: `Tender Amount (${tenderAmount.toLocaleString()}) - Bill Remaining Amount (${(Number(formData.remaining_amount) || 0).toLocaleString()}) must be equal to Saved Amount (${savedAmount.toLocaleString()}).`,
            duration: Infinity,
          });
          return;
        }
      }

      // Prepare payload similar to handleSubmit
      const payload: Record<string, any> = JSON.parse(JSON.stringify(formData));

      // Convert numeric fields
      const numericFields = [
        "bill_upto",
        "remaining_amount",
        "tender_amount",
        "prev_bill_amt",
        "bill_amount",
        "saved_amount",
      ];
      numericFields.forEach((f) => {
        if (f in payload) payload[f] = Number(payload[f]) || 0;
      });

      // Child table numeric + boolean conversions
      if (Array.isArray(payload.expenditure_details)) {
        payload.expenditure_details = payload.expenditure_details.map((row: any) => ({
          ...row,
          bill_amount: Number(row.bill_amount) || 0,
          have_asset: row.have_asset ? 1 : 0,
        }));
      }

      // Set docstatus to 1 (submitted)
      payload.docstatus = 1;

      const response = await axios.put(
        `${API_BASE_URL}/Expenditure/${encodeURIComponent(docname)}`,
        payload,
        {
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        }
      );

      toast.success("Document submitted successfully!");

      // Update local state without reload
      const updatedData = response.data.data as ExpenditureData;
      setExpenditure(updatedData);
      setBillType(updatedData.bill_type);
      setFormDirty(false);

      // 🟢 CORRECTED: Update button to CANCEL after submission
      if (updatedData.bill_type === "Final") {
        setActiveButton("CANCEL");
      } else {
        setActiveButton(null);
      }

      // Force form remount with new docstatus
      setFormVersion((v) => v + 1);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to submit document");
    } finally {
      setIsSaving(false);
    }
  };

  /* -------------------------------------------------
  6. UI STATES
  ------------------------------------------------- */

  if (loading) {
    return <div>Loading expenditure details...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <div>{error}</div>
        <button
          className="border px-3 py-1 rounded"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!expenditure) {
    return <div>Expenditure not found.</div>;
  }

  const isSubmitted = expenditure.docstatus === 1;
  const isCancelled = expenditure.docstatus === 2;
  const isDraft = expenditure.docstatus === 0;
  const isFinal = billType === "Final";

  // Determine submit label based on active button
  const getSubmitLabel = () => {
    if (isSaving) {
      switch (activeButton) {
        case "SAVE": return "Saving...";
        case "SUBMIT": return "Submitting...";
        case "CANCEL": return "Cancelling...";
        default: return "Processing...";
      }
    }

    switch (activeButton) {
      case "SAVE": return "Save";
      case "SUBMIT": return "Submit";
      case "CANCEL": return "Cancel";
      default: return undefined;
    }
  };

  const formKey = `${expenditure.name}-${expenditure.docstatus}-${formVersion}`;

  /* -------------------------------------------------
  7. RENDER FORM
  ------------------------------------------------- */

  return (
    <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
      <DynamicForm
        key={formKey}
        title={`Expenditure ${expenditure.name}`}
        tabs={formTabs}
        onSubmit={activeButton === "SAVE" ? handleSubmit : async () => { }}
        onSubmitDocument={activeButton === "SUBMIT" ? handleSubmitDocument : undefined}
        onCancelDocument={activeButton === "CANCEL" ? handleCancel : undefined}
        isSubmittable={activeButton === "SUBMIT"}
        docstatus={expenditure.docstatus}
        initialStatus={
          isDraft ? "Draft" : isSubmitted ? "Submitted" : "Cancelled"
        }
        onFormInit={handleFormInit}
        doctype={doctypeName}
        submitLabel={getSubmitLabel()}
        deleteConfig={{
          doctypeName: doctypeName,
          docName: docname,
          redirectUrl: "/tender/doctype/expenditure",
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
          currentUserEmail={expenditure.owner}
          modifiedStr={expenditure.modified}
          modifiedBy={expenditure.modified_by}
        />
      </div>
    </div>
  );
}