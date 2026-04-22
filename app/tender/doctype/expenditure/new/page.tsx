"use client";


import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import {
  DynamicForm,
  TabbedLayout,
  FormField,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  fetchWorkNameByTenderNumber,
  updateWorkNameInTableRows,
  clearWorkNameInTableRows,
  fetchPreviousBillDetails,
  checkBillNumberUniqueness
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
  name?: string;

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

  // 🟢 Corrected keys to match database & UI needs
  prev_page_no?: string;            // Data (Previous)
  prev_mb_no?: string;              // Data (Previous)
  page_no?: string;                 // Data (Current)
  mb_no?: string;                   // Data (Current)

  lift_irrigation_scheme?: string;  // Link -> Lift Irrigation Scheme
  stage?: string[];                 // Table MultiSelect -> Stage Multiselect
  expenditure_details?: ExpenditureDetailsRow[]; // Table -> Expenditure Details
  saved_amount?: number;            // Currency
  work_description?: string;        // Text

  docstatus?: 0 | 1 | 2;
  modified?: string;
}

/**
 * Uploads a single file to Frappe's 'upload_file' method
 * and returns the server URL.
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

export default function NewExpenditurePage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const doctypeName = "Expenditure";
  const [isSaving, setIsSaving] = React.useState(false);
  const [billType, setBillType] = React.useState<string>("Running");
  const [docName, setDocName] = React.useState<string | null>(null);
  const [docStatus, setDocStatus] = React.useState<0 | 1 | 2>(0);

  // State for work name default value
  const [workName, setWorkName] = React.useState<string>("");

  /* -------------------------------------------------
  3. Helper function to get allowed stages from parent stage field
  ------------------------------------------------- */

  const getAllowedStages = React.useCallback((formData: Record<string, any>): string[] => {
    const parentStage = formData.stage;
    if (!parentStage || !Array.isArray(parentStage)) return [];
    return parentStage.map((item: any) => item.stage).filter(Boolean);
  }, []);

  const [formInstance, setFormInstance] = React.useState<any>(null);
  const [prevCumulativeAmount, setPrevCumulativeAmount] = React.useState(0);


  React.useEffect(() => {
    if (!formInstance) return;

    console.log("Setting up watch subscription for tender_number");

    const subscription = formInstance.watch(async (value: any, { name }: { name?: string }) => {

      if (name === "tender_number" && value.tender_number) {

        if (!apiKey || !apiSecret) {
          console.error("API keys not available");
          return;
        }

        // 1. Fetch Work Name (Existing logic)
        const fetchWorkName = async () => {
          try {
            const fetchedWorkName = await fetchWorkNameByTenderNumber(
              value.tender_number,
              apiKey,
              apiSecret
            );

            if (fetchedWorkName) {
              updateWorkNameInTableRows(formInstance, fetchedWorkName);
              setWorkName(fetchedWorkName);
            } else {
              console.log("No work_name found in response");
              clearWorkNameInTableRows(formInstance);
              setWorkName("");
            }
          } catch (error) {
            console.error("Failed to fetch work_name:", error);
          }
        };

        // 2. Fetch Previous Bill Details (NEW LOGIC)
        const fetchPreviousBill = async () => {
          try {
            const prevDetails = await fetchPreviousBillDetails(
              value.tender_number,
              docName || null,
              apiKey,
              apiSecret
            );

            if (prevDetails) {
              // 🟢 Auto-populate the fields using the CORRECT variable names
              const lastBillNo = prevDetails.bill_number || "";
              formInstance.setValue("prev_bill_no", lastBillNo || 0);
              formInstance.setValue("prev_bill_amt", prevDetails.bill_amount || 0);

              // Map the API's 'mb_no' to our UI's 'previous_mb_no'
              formInstance.setValue("previous_mb_no", prevDetails.mb_no || 0);
              // Map the API's 'page_no' to our UI's 'previous_page_no'
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
              console.log("⚠️ No Previous Bill Details Found");
              // Reset if no previous record found
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
          } catch (err) {
            console.error("Error setting previous bill details", err);
          }
        };

        // Execute both fetch operations
        await Promise.all([fetchWorkName(), fetchPreviousBill()]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [formInstance, apiKey, apiSecret, docName]);

  // Calculate bill_upto and remaining_amount when relevant fields change
  React.useEffect(() => {
    if (!formInstance) return;

    const calculateTotals = (values?: any) => {
      const billAmount = values ? (Number(values.bill_amount) || 0) : (Number(formInstance.getValues("bill_amount")) || 0);
      const tenderAmount = values ? (Number(values.tender_amount) || 0) : (Number(formInstance.getValues("tender_amount")) || 0);

      // Calculate bill_upto = bill_amount + prevCumulativeAmount (O(1))
      const billUpto = billAmount + prevCumulativeAmount;
      if (Number(formInstance.getValues("bill_upto")) !== billUpto) {
        formInstance.setValue("bill_upto", Number(billUpto.toFixed(2)), { shouldDirty: true });
      }

      // Calculate remaining_amount = tender_amount - bill_upto
      const remainingAmount = tenderAmount - billUpto;
      if (Number(formInstance.getValues("remaining_amount")) !== remainingAmount) {
        formInstance.setValue("remaining_amount", Number(remainingAmount.toFixed(2)), { shouldDirty: true });
      }
    };

    // Run immediately when prevCumulativeAmount changes
    calculateTotals();

    const subscription = formInstance.watch((value: any, { name }: { name?: string }) => {
      // Recalculate when bill_amount or tender_amount changes
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

    // 1️⃣ Initialize previousBillType
    let previousBillType: string | undefined;

    const initialBillType = form.getValues('bill_type') || 'Running';
    const initialPrevBillNo = form.getValues('prev_bill_no');

    // Initialize billType state for buttons
    setBillType(initialBillType);

    if (initialBillType === 'Running' && initialPrevBillNo && /ra/i.test(initialPrevBillNo)) {
      previousBillType = 'Select Type';
    } else if (initialBillType && initialBillType !== 'Running') {
      previousBillType = initialBillType;
    } else {
      previousBillType = 'Select Type';
    }

    // 2️⃣ Watch prev_bill_no to auto-set Running if needed
    form.watch((value: any, { name }: { name?: string }) => {
      if (name === 'prev_bill_no' || name === undefined) {
        const prevBillNo = form.getValues('prev_bill_no');
        const currentBillType = form.getValues('bill_type');

        if (prevBillNo && /ra/i.test(prevBillNo)) {
          if (currentBillType !== 'Running') {
            if (currentBillType && currentBillType !== 'Running') previousBillType = currentBillType;
            form.setValue('bill_type', 'Running', { shouldDirty: true });
          }
        } else {
          // Restore previous type if prev_bill_no no longer contains 'ra'
          if (currentBillType === 'Running' && previousBillType) {
            form.setValue('bill_type', previousBillType, { shouldDirty: true });
          } else if (!prevBillNo && currentBillType === 'Running' && !previousBillType) {
            form.setValue('bill_type', 'Select Type', { shouldDirty: true });
          }
        }
      }
    });

    // 3️⃣ Watch bill_type to update buttons dynamically
    form.watch((value: any, { name }: { name?: string }) => {
      if (name === 'bill_type') {
        const currentType = form.getValues('bill_type');
        setBillType(currentType); // this controls DynamicForm buttons

        // 🟢 Update bill_number based on type (RA Xst vs Xst & Final)
        const currentBillNo = form.getValues('bill_number');
        if (currentBillNo) {
          const match = currentBillNo.match(/\d+/);
          if (match) {
            const num = parseInt(match[0]);
            form.setValue("bill_number", formatBillNumber(num, currentType), { shouldDirty: true });
          }
        }
      }
    });
  }, []);

  const formTabs: TabbedLayout[] = React.useMemo(() => {
    return [
      {
        name: "Details",
        fields: [
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
            defaultValue: 0,
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
            precision: 2,
            fieldColumns: 1,
            defaultValue: "0.00",
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
            precision: 2,
            required: true,
            defaultValue: "0.00",
            fieldColumns: 1,
          },
          {
            // 🟢 RENAMED: was "mb_no_new", now "mb_no" (The actual database field)
            name: "mb_no",
            label: "MB No",
            type: "Data",
            defaultValue: 0,
            fieldColumns: 1,
          },
          {
            // 🟢 RENAMED: was "page_no_new", now "page_no" (The actual database field)
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
            readOnly: true,
          },
          {
            name: "remaining_amount",
            label: "Bill Remaining Amount",
            type: "Read Only",
            precision: 2,
            defaultValue: "0.00",
            readOnly: true,
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
               
              // { name: "bill_amount", label: "Expenditure Amount", type: "Currency", precision: 2 },
              { name: "have_asset", label: "Have Asset", type: "Check", displayDependsOn: "work_type==Miscellaneous" },
              {
                name: "asset",
                label: "Asset",
                type: "Link",
                linkTarget: "Asset",
                displayDependsOn: "work_type==Repair || work_type==Auxiliary || have_asset==1",
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
                displayDependsOn: "work_type==Repair || work_type==Auxiliary || have_asset==1",
                fetchFrom: { sourceField: "asset", targetDoctype: "Asset", targetField: "asset_name" }
              },
              {
                name: "asset_no",
                label: "Asset No",
                type: "Data",
                displayDependsOn: "work_type==Repair || work_type==Auxiliary || have_asset==1",
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
            required: true,
            displayDependsOn: { "bill_type": "Final" }
          },
          {
            name: "work_description",
            label: "Work Description",
            type: "Long Text",
          },
        ],
      },
    ];
  }, [workName, getAllowedStages]);


  /* -------------------------------------------------
  4. SUBMIT – with file uploading for child table
  ------------------------------------------------- */
  const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
    if (!isDirty) {
      toast.info("No changes to save.");
      return;
    }

    // Validation: Bill Amount Mismatch
    const billAmount = Number(data.bill_amount) || 0;
    const tenderAmount = Number(data.tender_amount) || 0;
    const savedAmount = Number(data.saved_amount) || 0;
    const details = data.expenditure_details || [];
    const totalChildBillAmt = details.reduce((sum: number, row: any) => sum + (Number(row.bill_amount) || 0), 0);
    // For Final bills, Saved Amount is the project total (Previous + This Bill).
    // For Running bills, Saved Amount is just the non-table part of THIS bill.
    // 🟢 MENTOR'S LOGIC VALIDATION
    // Formula: Tender Amount - Bill Remaining Amount = Saved Amount
    // This is mathematically equivalent to: bill_upto = saved_amount

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

    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
      toast.error("Authentication required. Please log in.", { duration: Infinity });
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = JSON.parse(JSON.stringify(data));

      // Handle file uploads in Expenditure Details child table
      if (payload.expenditure_details) {
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

      // Boolean conversions (include child-level have_asset if present)
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

      // Send payload
      console.log("Sending this PAYLOAD to Frappe:", finalPayload);

      const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, finalPayload, {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      toast.success("Expenditure created successfully!");

      // Navigate using the auto-generated naming series ID (EXP-####)
      const savedName = response.data.data.name;

      if (savedName) {
        setDocName(savedName);   // ⭐ tells UI document exists
        setDocStatus(0);         // ⭐ still draft
        router.push(`/tender/doctype/expenditure/${encodeURIComponent(savedName)}`);
      } else {
        router.push(`/tender/doctype/expenditure`);
      }

    } catch (err: any) {
      console.error("Create error:", err);
      console.log("Full server error:", err.response?.data);

      // Extract actual validation message from server response
      let errorMessage = (err as Error).message || "Check the browser console (F12) for the full server error.";

      if (err.response?.status === 417) {
        const serverMessages = err.response?.data?._server_messages;
        if (serverMessages) {
          try {
            const parsed = JSON.parse(serverMessages);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const messageObj = typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0];
              errorMessage = messageObj.message || err.response?.data?.exception || errorMessage;
            }
          } catch (e) {
            console.error("Failed to parse server messages:", e);
          }
        }
      }

      toast.error("Failed to create Expenditure", {
        description: errorMessage,
        duration: Infinity
      });
    } finally {
      setIsSaving(false);
    }
  };

  /* -------------------------------------------------
6. Conditional Submit Document feature
------------------------------------------------- */

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

      const payload: Record<string, any> = JSON.parse(JSON.stringify(formData));

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
        if (f in payload) payload[f] = Number(payload[f]) || 0;
      });

      // Child table conversions
      if (Array.isArray(payload.expenditure_details)) {
        payload.expenditure_details = payload.expenditure_details.map((row: any) => ({
          ...row,
          bill_amount: Number(row.bill_amount) || 0,
          have_asset: row.have_asset ? 1 : 0,
        }));
      }

      // 🟢 STEP 1 — SAVE DOCUMENT
      const createResp = await axios.post(
        `${API_BASE_URL}/${doctypeName}`,
        payload,
        {
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        }
      );

      const docName = createResp.data.data.name;

      if (!docName) throw new Error("Document created but name missing");

      toast.success("Saved successfully. Submitting...");

      // 🟢 STEP 2 — SUBMIT DOCUMENT
      await axios.put(
        `${API_BASE_URL}/${doctypeName}/${encodeURIComponent(docName)}`,
        { docstatus: 1 },
        {
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        }
      );

      toast.success("Document submitted successfully!");
      setDocStatus(1);

      router.push(`/tender/doctype/expenditure/${encodeURIComponent(docName)}`);

    } catch (err) {
      console.error(err);
      toast.error("Failed to save & submit document");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  const isFinalBill = billType === "Final";
  const isSaved = !!docName;
  const canSubmit = isFinalBill && isSaved && docStatus === 0;

  /* -------------------------------------------------
  5. RENDER FORM
  ------------------------------------------------- */
  return (
    <DynamicForm
      tabs={formTabs}
      onSubmit={handleSubmit}

      onSubmitDocument={canSubmit ? handleSubmitDocument : undefined}

      submitLabel={
        isSaving
          ? canSubmit
            ? "Submitting..."
            : "Saving..."
          : canSubmit
            ? "Submit"
            : "Save"
      }

      isSubmittable={canSubmit}
      onCancel={handleCancel}
      title={`New ${doctypeName}`}
      description="Create a new expenditure record"

      doctype={doctypeName}
      onFormInit={handleFormInit}
    />
  );
}