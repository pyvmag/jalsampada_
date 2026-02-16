"use client";
import { Controller, useWatch } from "react-hook-form";
import * as React from "react";
import Link from "next/link";
import {
  useForm,
  FormProvider,
  useFieldArray,
  FieldErrors,
  RegisterOptions,
  UseFormReturn,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Upload, X, MoreVertical, Copy, Trash2, ChevronLeft, ChevronRight, Printer, Eye } from "lucide-react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";


import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";


import { TableField } from "./TableField";
import { LinkField } from "./LinkField";
import { TableMultiSelect } from "./TableMultiSelect";
import { ToggleButton } from "./ToggleButton";
import { PumpStatusToggle } from "./PumpStatusToggle";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn, getApiMessages } from "@/lib/utils";

const DEFAULT_API_BASE_URL = "http://103.219.1.138:4412/api/resource";

// ─────────────────────────────────────────────────────────────────────────────
// Types (Unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export type FieldType =
  | "Data"
  | "Small Text"
  | "Text"
  | "Long Text"
  | "Code"
  | "Color"
  | "Currency"
  | "Float"
  | "Int"
  | "Date"
  | "DateTime"
  | "Time"
  | "Duration"
  | "Check"
  | "Radio"
  | "Pump Status"
  | "Select"
  | "Link"
  | "Table"
  | "Read Only"
  | "Password"
  | "Signature"
  | "Markdown Editor"
  | "Section Break"
  | "Column Break"
  | "Barcode"
  | "Button"
  | "Table MultiSelect"
  | "Percent"
  | "Rating"
  | "Attach"
  | "Custom";

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  linkTarget?: string;
  searchField?: string;
  customSearchUrl?: string;
  customSearchParams?: Record<string, any>;
  referenceDoctype?: string;
  doctype?: string;
  required?: boolean;
  fieldColumns?: number;
  layoutCols?: number;
  description?: string;
  placeholder?: string;
  options?: string | { label: string; value: string; className?: string }[];
  defaultValue?: any;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  showDownloadUpload?: boolean;
  columns?: {
    filterDeps?: string[];
    defaultValue?: any;
    name: string;
    label: string;
    type: FieldType;
    linkTarget?: string;
    searchField?: string;
    customSearchUrl?: string;
    customSearchParams?: Record<string, any>;
    referenceDoctype?: string;
    doctype?: string;
    options?: string | { label: string; value: string }[];
    precision?: number;
    filterMapping?: { sourceField: string; targetField: string }[];
    fetchFrom?: {
      sourceField: string;
      targetDoctype: string;
      targetField: string;
    };
    displayDependsOn?:
    | string
    | Record<string, any>
    | ((values: Record<string, any>) => boolean);
    filters?: (getValue: (name: string) => any) => Record<string, any>;
  }[];
  action?: () => void;
  buttonLabel?: string;
  readOnlyValue?: string;
  pattern?: RegExp | string;
  patternMessage?: string;
  filters?: (getValue: (name: string) => any) => Record<string, any>;
  filterMapping?: { sourceField: string; targetField: string }[];
  displayDependsOn?: string | Record<string, any> | ((values: Record<string, any>) => boolean);
  fetchFrom?: {
    sourceField: string;
    targetDoctype: string;
    targetField: string;
  };
  customElement?: React.ReactNode;
  precision?: number;
  disableAutoToday?: boolean;
  onChange?: (value: any, data: any, setFieldValue: any) => void;
  className?: string;
}

export interface TabbedLayout {
  name: string;
  fields: FormField[];
}

export interface DeleteConfig {
  doctypeName: string;
  docName: string;
  redirectUrl?: string;
  baseUrl?: string;
}

export interface DynamicFormProps {
  tabs: TabbedLayout[];
  onSubmit: (data: Record<string, any>, isDirty: boolean) => Promise<{ status?: string; statusCode?: number } | void>;
  onCancel?: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  initialStatus?: string;
  docstatus?: number;
  isSubmittable?: boolean;
  onSubmitDocument?: () => Promise<{ status?: string } | void>;
  onCancelDocument?: () => Promise<{ status?: string } | void>;
  onFormInit?: (form: UseFormReturn<any>) => void;
  onDelete?: () => Promise<void> | void;
  deleteConfig?: DeleteConfig;
  doctype?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (Unchanged)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFieldValue(
  sourceValue: string,
  targetDoctype: string,
  targetField: string,
  apiKey: string,
  apiSecret: string
): Promise<any> {
  try {
    const API_BASE_URL = "http://103.219.1.138:4412/api/resource";
    const url = `${API_BASE_URL}/${targetDoctype}/${sourceValue}`;

    const resp = await axios.get(url, {
      params: {
        fields: JSON.stringify([targetField]),
      },
      headers: {
        Authorization: `token ${apiKey}:${apiSecret}`,
        "Content-Type": "application/json",
      },
      withCredentials: true,
    });

    return resp.data.data?.[targetField] || null;
  } catch (e: any) {
    console.error(`Failed to fetch ${targetField} from ${targetDoctype}:`, e);
    return null;
  }
}

async function fetchMultipleFieldValues(
  sourceValue: string,
  targetDoctype: string,
  targetFields: string[],
  apiKey: string,
  apiSecret: string
): Promise<Record<string, any>> {
  try {
    const API_BASE_URL = "http://103.219.1.138:4412/api/resource";
    const url = `${API_BASE_URL}/${targetDoctype}/${sourceValue}`;

    const resp = await axios.get(url, {
      params: {
        fields: JSON.stringify(targetFields),
      },
      headers: {
        Authorization: `token ${apiKey}:${apiSecret}`,
        "Content-Type": "application/json",
      },
      withCredentials: true,
    });

    const result: Record<string, any> = {};
    targetFields.forEach(field => {
      result[field] = resp.data.data?.[field] || null;
    });

    return result;
  } catch (e: any) {
    console.error(`Failed to fetch multiple fields from ${targetDoctype}:`, e);
    const result: Record<string, any> = {};
    targetFields.forEach(field => {
      result[field] = null;
    });
    return result;
  }
}

function evaluateDisplayDependsOn(
  condition: string | Record<string, any> | ((values: Record<string, any>) => boolean),
  values: Record<string, any>
) {
  if (!condition) return true;

  if (typeof condition === "function") {
    try {
      return condition(values);
    } catch (err) {
      console.error("Error evaluating displayDependsOn function:", err);
      return true; // fallback to visible if error
    }
  }

  if (typeof condition === "string") {
    try {
      // Replace all identifiers with values['identifier']
      // Matches any variable-like string in the condition
      const conditionWithValues = condition.replace(
        /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
        (_, v) => {
          // Only replace if it exists in values
          return v in values ? `values["${v}"]` : v;
        }
      );
      return new Function("values", `return ${conditionWithValues}`)(values);
    } catch (err) {
      console.error("Error evaluating displayDependsOn:", condition, err);
      return true; // fallback to visible if error
    }
  }

  if (typeof condition === "object") {
    for (const key in condition) {
      const expected = condition[key];

      if (expected === true) {
        // Show field if value is truthy
        if (!values[key]) return false;
      } else if (expected === false) {
        // Show field if value is falsy
        if (values[key]) return false;
      } else {
        // Exact match
        if (values[key] !== expected) return false;
      }
    }
    return true;
  }

  return true;
}

function buildDynamicFilters(
  field: FormField,
  getValue: (name: string) => any
): Record<string, any> {
  const filters: Record<string, any> = {};
  if (field.filterMapping?.length) {
    field.filterMapping.forEach((mapping) => {
      const sourceValue = getValue(mapping.sourceField);
      if (sourceValue) {
        filters[mapping.targetField] = sourceValue;
      }
    });
  } else if (typeof field.filters === "function") {
    Object.assign(filters, field.filters(getValue));
  }
  return filters;
}

function buildDefaultValues(fields: FormField[]) {
  const dv: Record<string, any> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) {
      dv[f.name] = f.defaultValue;
    } else {
      if (f.type === "Check") dv[f.name] = false;
      if (f.type === "Duration")
        dv[f.name] = { hours: 0, minutes: 0, seconds: 0 };
      if (f.type === "Table") dv[f.name] = [];
      if (f.type === "Table MultiSelect") dv[f.name] = [];
      if (
        [
          "Data",
          "Small Text",
          "Text",
          "Long Text",
          "Select",
          "Link",
          "Attach",
          "Color",
          "Password",
          "Int",
          "Float",
          "Currency",
          "Percent",
          "Rating",
          "Barcode",
          "Markdown Editor",
          "Code",
          "Read Only",
        ].includes(f.type)
      ) {
        dv[f.name] = "";
      }

      if (["Date", "DateTime", "Time"].includes(f.type)) {
        dv[f.name] = null;
      }
    }

    // Apply precision formatting to Currency and Float fields during initialization
    if ((f.type === "Currency" || f.type === "Float") && f.precision && dv[f.name]) {
      const value = parseFloat(dv[f.name]);
      if (!isNaN(value)) {
        dv[f.name] = value.toFixed(f.precision);
      }
    }
  }

  if (typeof window !== "undefined") {
    const dupData = sessionStorage.getItem("duplicate_record_data");
    if (dupData) {
      try {
        const parsed = JSON.parse(dupData);
        sessionStorage.removeItem("duplicate_record_data");
        return { ...dv, ...parsed };
      } catch (e) {
        console.error("Failed to parse duplicate data", e);
      }
    }
  }
  return dv;
}

function rulesFor(
  field: FormField
): RegisterOptions<Record<string, any>, string> {
  const rules: RegisterOptions<Record<string, any>, string> = {};
  if (field.required) rules.required = `${field.label} is required`;
  if (field.min !== undefined)
    rules.min = {
      value: field.min,
      message: `${field.label} must be >= ${field.min}`,
    };
  if (field.max !== undefined)
    rules.max = {
      value: field.max,
      message: `${field.label} must be <= ${field.max}`,
    };

  if (field.type === "Percent") {
    if (rules.min === undefined)
      rules.min = { value: 0, message: "Percent must be between 0 and 100" };
    if (rules.max === undefined)
      rules.max = { value: 100, message: "Percent must be between 0 and 100" };
  }

  if (field.pattern) {
    const pattern =
      typeof field.pattern === "string"
        ? new RegExp(field.pattern)
        : field.pattern;
    rules.pattern = {
      value: pattern,
      message: field.patternMessage || `${field.label} format is invalid`,
    };
  }

  return rules;
}

function sanitizeForDuplication(data: any): any {
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForDuplication(item));
  } else if (typeof data === "object" && data !== null) {
    const newData: any = {};
    for (const key in data) {
      if (
        [
          "name",
          "creation",
          "modified",
          "modified_by",
          "owner",
          "docstatus",
          "idx",
          "parent",
          "parentfield",
          "parenttype",
        ].includes(key)
      ) {
        continue;
      }
      newData[key] = sanitizeForDuplication(data[key]);
    }
    return newData;
  }
  return data;
}

function FieldHelp({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div
      style={{
        marginTop: 6,
        fontSize: "0.85rem",
        color: "var(--color-text-muted, #6b7280)",
      }}
    >
      {text}
    </div>
  );
}

function FieldError({ error }: { error?: any }) {
  if (!error) return null;
  return (
    <div className="text-red-500 font-medium" style={{ marginTop: 6, fontSize: "0.85rem" }}>
      {String(error.message || error)}
    </div>
  );
}

const formatSlug = (slug: string) => {
  if (!slug) return "";
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function DynamicForm({
  tabs,
  onSubmit,
  onCancel,
  title = "Form",
  description,
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  initialStatus = "Draft",
  docstatus = 0,
  isSubmittable = false,
  onSubmitDocument,
  onCancelDocument,
  onFormInit,
  onDelete,
  deleteConfig,
  doctype
}: DynamicFormProps) {
  const { apiKey, apiSecret } = useAuth();

  const isReadOnlyMode = isSubmittable && docstatus > 0;

  // ── HOOKS ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = React.useState(0);
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [currentStatus, setCurrentStatus] = React.useState(initialStatus);

  // 🟢 Navigation State
  const [prevRecord, setPrevRecord] = React.useState<string | null>(null);
  const [nextRecord, setNextRecord] = React.useState<string | null>(null);
  const [loadingNeighbors, setLoadingNeighbors] = React.useState(true);

  // ── ALL FIELDS (for defaultValues) ───────────────────────────────────────
  const allFields = React.useMemo(() => tabs.flatMap((t) => t.fields), [tabs]);
  const defaultValues = React.useMemo(
    () => buildDefaultValues(allFields),
    [allFields]
  );

  // ── RHF SETUP ─────────────────────────────────────────────────────────────
  const methods = useForm<Record<string, any>>({
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onSubmit",
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    control,
    setValue,
    watch,
    reset,
  } = methods;

  const allValues = useWatch({ control });

  React.useEffect(() => {
    if (onFormInit) {
      onFormInit(methods);
    }
  }, [methods, onFormInit]);

  // Find this useEffect in DynamicFormComponent.tsx (around line 348)
  React.useEffect(() => {
    // 🟢 CHANGE: Add { keepValues: true } to prevent clearing form when defaultValues update
    reset(defaultValues, { keepValues: true });
  }, [defaultValues, reset]);

  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>(
    {}
  );
  const activeTabFields = tabs[activeTab]?.fields || [];

  const reg = React.useCallback(
    (name: string, options?: any) => register(name, options),
    [register]
  );

  // 🟢 EFFICIENT NEIGHBOR FETCHING (Using Creation Date Logic)
  React.useEffect(() => {
    const fetchNeighbors = async () => {
      const segments = pathname.split("/").filter(Boolean);
      const doctypeIndex = segments.indexOf("doctype");

      // Stop if not a standard edit path
      if (doctypeIndex === -1 || segments.length <= doctypeIndex + 2) {
        setLoadingNeighbors(false);
        return;
      }

      const doctypeSlug = segments[doctypeIndex + 1];
      let currentDocName = segments[segments.length - 1];
      currentDocName = decodeURIComponent(currentDocName);

      if (currentDocName === "new") {
        setLoadingNeighbors(false);
        return;
      }

      setLoadingNeighbors(true);
      // Use the passed doctype prop if available, otherwise infer from URL
      const targetDoctype = doctype || formatSlug(doctypeSlug);

      try {
        // 1. Get current document creation time
        const currentDocRes = await axios.get(`${DEFAULT_API_BASE_URL}/${targetDoctype}/${currentDocName}`, {
          params: { fields: JSON.stringify(["creation"]) },
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
          withCredentials: true,
        });

        const currentCreation = currentDocRes.data.data?.creation;
        if (!currentCreation) {
          setLoadingNeighbors(false);
          return;
        }

        // 2. Fetch Neighbors relative to current Creation Date
        // Previous (Newer): Creation > Current (limit 1, Order Ascending)
        // Next (Older): Creation < Current (limit 1, Order Descending)

        const [prevRes, nextRes] = await Promise.all([
          axios.get(`${DEFAULT_API_BASE_URL}/${targetDoctype}`, {
            params: {
              fields: JSON.stringify(["name"]),
              filters: JSON.stringify([["creation", ">", currentCreation]]),
              order_by: "creation asc",
              limit_page_length: 1
            },
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            withCredentials: true,
          }),
          axios.get(`${DEFAULT_API_BASE_URL}/${targetDoctype}`, {
            params: {
              fields: JSON.stringify(["name"]),
              filters: JSON.stringify([["creation", "<", currentCreation]]),
              order_by: "creation desc",
              limit_page_length: 1
            },
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            withCredentials: true,
          })
        ]);

        setPrevRecord(prevRes.data.data?.[0]?.name || null);
        setNextRecord(nextRes.data.data?.[0]?.name || null);

      } catch (err) {
        console.error("Navigation fetch failed:", err);
      } finally {
        setLoadingNeighbors(false);
      }
    };

    if (apiKey && apiSecret) {
      fetchNeighbors();
    } else {
      setLoadingNeighbors(false);
    }
  }, [pathname, apiKey, apiSecret]);

  // Navigation Redirect
  const navigateToRecord = (recordName: string) => {
    const segments = pathname.split("/");
    segments[segments.length - 1] = encodeURIComponent(recordName);
    router.push(segments.join("/"));
  };

  const onFormSubmit = async (data: Record<string, any>) => {
    try {
      const result = await onSubmit(data, isDirty);
      if (result && result.status) {
        setCurrentStatus(result.status);
        // Reset form to clear dirty state after successful save
        reset(data, { keepValues: false });
      } else if (result?.statusCode === 200) {
        setCurrentStatus("Draft");
        reset(data, { keepValues: false });
      } else {
        setCurrentStatus("Not Saved");
      }
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleSubmitDocument = async () => {
    try {
      const result = await onSubmitDocument?.();
      if (result && result.status) {
        setCurrentStatus(result.status);
      }
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const handleCancelDocument = async () => {
    try {
      const result = await onCancelDocument?.();
      if (result && result.status) {
        setCurrentStatus(result.status);
      }
    } catch (error) {
      console.error('Cancel error:', error);
    }
  };

  const getErrorClass = (fieldName: string) => {
    return errors[fieldName]
      ? "!border-red-500 !focus:border-red-500 !focus:ring-red-500 !ring-1 !ring-red-500"
      : "";
  };

  const handleDuplicate = React.useCallback(() => {
    const currentData = methods.getValues();
    const cleanData = sanitizeForDuplication(currentData);
    sessionStorage.setItem("duplicate_record_data", JSON.stringify(cleanData));
    toast.info("Duplicating record...");

    const parts = pathname.split("/");
    const lastPart = parts[parts.length - 1];

    if (lastPart === "new") {
      toast.warning("Already on a new record.");
      return;
    }

    parts.pop();
    if (parts[parts.length - 1] === "edit") {
      parts.pop();
    }
    const newPath = `${parts.join("/")}/new`;
    router.push(newPath);
  }, [methods, pathname, router]);

  const handleDeleteAction = async () => {
    if (onDelete) {
      if (window.confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
        await onDelete();
      }
      return;
    }

    if (deleteConfig) {
      if (!apiKey || !apiSecret) {
        toast.error("Authentication required to delete.", { duration: Infinity });
        return;
      }

      const { doctypeName, docName, redirectUrl, baseUrl } = deleteConfig;

      if (window.confirm(`Are you sure you want to delete this ${doctypeName}? This action cannot be undone.`)) {
        try {
          const url = `${baseUrl || DEFAULT_API_BASE_URL}/${doctypeName}/${docName}`;

          const response = await axios.delete(url, {
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            withCredentials: true,
          });

          const messages = getApiMessages(response, null, `${doctypeName} deleted successfully`, "Failed to delete record");

          if (messages.success) {
            toast.success(messages.message, { description: messages.description });
          }

          if (redirectUrl) {
            router.push(redirectUrl);
          } else {
            router.back();
          }
        } catch (err: any) {
          console.error("Delete error:", err);
          const messages = getApiMessages(null, err, `${doctypeName} deleted successfully`, "Failed to delete record");
          toast.error(messages.message, { description: messages.description, duration: Infinity });
        }
      }
    }
  };

  const showDeleteOption = !!onDelete || !!deleteConfig;

  React.useEffect(() => {
    if (isDirty) {
      setCurrentStatus("Not Saved");
      console.log("Not Saved");
    } else {
      // Reset to initial status when form is no longer dirty
      setCurrentStatus(initialStatus);
    }
  }, [isDirty, initialStatus]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent save / duplicate when typing in inputs, textareas, etc.
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.tagName === "SELECT" ||
        (activeElement as HTMLElement)?.isContentEditable;

      if (isReadOnlyMode) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        const submitButton = formRef.current?.querySelector(
          'button[type="submit"]'
        ) as HTMLButtonElement | null;
        if (submitButton) {
          submitButton.click();
        }
      }

      // Shift + D → Duplicate (only when NOT focused in any input field)
      if (
        event.shiftKey &&
        (event.key === "D" || event.key === "d") && !isInputFocused
      ) {
        event.preventDefault();
        handleDuplicate();
      }

      // Keyboard Navigation
      if ((event.ctrlKey || event.metaKey) && event.key === "ArrowLeft" && prevRecord) {
        event.preventDefault();
        navigateToRecord(prevRecord);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "ArrowRight" && nextRecord) {
        event.preventDefault();
        navigateToRecord(nextRecord);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleDuplicate, prevRecord, nextRecord, isReadOnlyMode]);

  // ── FETCH FROM FUNCTIONALITY ─────────────────────────────────────────────
  React.useEffect(() => {
    if (!apiKey || !apiSecret) return;

    const fieldsWithFetchFrom = tabs
      .flatMap((tab) => tab.fields)
      .filter((field) => field.fetchFrom);

    const sourceFieldMap = new Map<string, FormField[]>();
    fieldsWithFetchFrom.forEach((field) => {
      if (field.fetchFrom) {
        const sourceField = field.fetchFrom.sourceField;
        if (!sourceFieldMap.has(sourceField)) {
          sourceFieldMap.set(sourceField, []);
        }
        sourceFieldMap.get(sourceField)?.push(field);
      }
    });

    const previousValues = new Map<string, any>();

    const handleFetchForSource = async (sourceFieldName: string) => {
      const sourceValue = watch(sourceFieldName);
      const previousValue = previousValues.get(sourceFieldName);

      if (sourceValue !== previousValue) {
        previousValues.set(sourceFieldName, sourceValue);

        const dependentFields = sourceFieldMap.get(sourceFieldName) || [];

        if (sourceValue) {
          // Group fields by target doctype to optimize API calls
          const fieldsByDoctype = new Map<string, FormField[]>();

          dependentFields.forEach((field) => {
            if (!field.fetchFrom) return;

            const targetDoctype = field.fetchFrom.targetDoctype;
            if (!fieldsByDoctype.has(targetDoctype)) {
              fieldsByDoctype.set(targetDoctype, []);
            }
            fieldsByDoctype.get(targetDoctype)?.push(field);
          });

          // Fetch data for each doctype in a single API call
          for (const [targetDoctype, fields] of fieldsByDoctype) {
            try {
              const targetFields = fields.map(f => f.fetchFrom!.targetField);
              const fetchedValues = await fetchMultipleFieldValues(
                sourceValue,
                targetDoctype,
                targetFields,
                apiKey,
                apiSecret
              );

              // Set values for each field
              fields.forEach((field) => {
                if (!field.fetchFrom) return;

                let fetchedValue = fetchedValues[field.fetchFrom.targetField];
                if (Array.isArray(fetchedValue)) {
                  fetchedValue = sanitizeForDuplication(fetchedValue);
                }
                if (fetchedValue !== null && fetchedValue !== undefined) {
                  setValue(field.name, fetchedValue, { shouldDirty: false });
                }
              });
            } catch (e) {
              console.error(`Failed to fetch fields from ${targetDoctype}:`, e);
              // Set empty values for all fields in this doctype on error
              fields.forEach((field) => {
                if (field.fetchFrom) {
                  setValue(field.name, "", { shouldDirty: false });
                }
              });
            }
          }
        } else {
          // Clear all dependent fields when source value is empty
          dependentFields.forEach((field) => {
            setValue(field.name, "", { shouldDirty: false });
          });
        }
      }
    };

    const sourceFields = Array.from(sourceFieldMap.keys());
    sourceFields.forEach((sourceField) => {
      previousValues.set(sourceField, watch(sourceField));
    });

    sourceFields.forEach(handleFetchForSource);

    const subscription = watch((value, { name, type }) => {
      if (name && sourceFieldMap.has(name)) {
        setTimeout(() => handleFetchForSource(name), 100);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [tabs, watch, setValue, apiKey, apiSecret]);

  const renderHeaderContent = () => {
    const segments = pathname.split("/").filter(Boolean);
    const doctypeIndex = segments.indexOf("doctype");

    if (doctypeIndex === -1 || doctypeIndex === 0) {
      return <h2 style={{ margin: 0 }}>{title}</h2>;
    }

    const moduleSlug = segments[doctypeIndex - 1];
    const doctypeSlug = segments[doctypeIndex + 1];

    const moduleName = formatSlug(moduleSlug);
    const doctypeName = formatSlug(doctypeSlug);

    const moduleUrl = `/${segments.slice(0, doctypeIndex).join("/")}`;
    const listUrl = `/${segments.slice(0, doctypeIndex + 2).join("/")}`;

    return (
      <div className="flex flex-wrap items-center gap-2 text-xl font-bold">
        <Link
          href={moduleUrl}
          className="text-muted-foreground hover:text-primary hover:underline transition-colors"
        >
          {moduleName}
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link
          href={listUrl}
          className="text-muted-foreground hover:text-primary hover:underline transition-colors"
        >
          {doctypeName}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground font-semibold text-primary">
          {title}
        </span>
      </div>
    );
  };

  const renderInput = (field: FormField, type: string = "text") => {
    const rules = rulesFor(field);
    const commonProps: any = {
      id: field.name,
      className: cn("form-control", getErrorClass(field.name)),
      placeholder: field.placeholder,
      ...(field.step ? { step: field.step } : {}),
      ...(field.min !== undefined ? { min: field.min } : {}),
      ...(field.max !== undefined ? { max: field.max } : {}),
      disabled: isReadOnlyMode,
    };

    const valueAsNumber = ["Int", "Float", "Currency", "Percent"].includes(
      field.type
    );

    if ((field.type === "Currency" || field.type === "Float") && field.precision) {
      commonProps.step = field.precision > 0 ? (0).toFixed(field.precision).substring(1) : "1";

      return (
        <Controller
          name={field.name}
          control={control}
          rules={rules}
          render={({ field: controllerField }) => (
            <div className="form-group">
              <label htmlFor={field.name} className="form-label">
                {field.label}{field.required ? " *" : ""}
              </label>

              <input
                type={type}
                value={controllerField.value ?? ""}
                onChange={(e) => {
                  controllerField.onChange(e.target.value);
                }}
                onBlur={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    controllerField.onChange(val.toFixed(field.precision));
                  }
                }}
                {...commonProps}
              />

              <FieldError
                error={(errors as FieldErrors<Record<string, any>>)[field.name]}
              />
              <FieldHelp text={field.description} />
            </div>
          )}
        />
      );
    }

    return (
      <div className="form-group">
        <label htmlFor={field.name} className="form-label">
          {field.label}
          {field.required ? " *" : ""}
        </label>
        <input
          type={type}
          {...reg(field.name, {
            ...rules,
            ...(valueAsNumber ? { valueAsNumber: true } : {}),
          })}
          {...commonProps}
        />
        <FieldError
          error={(errors as FieldErrors<Record<string, any>>)[field.name]}
        />
        <FieldHelp text={field.description} />
      </div>
    );
  };

  const renderTextarea = (field: FormField, rows = 4) => {
    const rules = rulesFor(field);
    return (
      <div className="form-group">
        <label htmlFor={field.name} className="form-label">
          {field.label}
          {field.required ? " *" : ""}
        </label>
        <textarea
          id={field.name}
          rows={field.rows ?? rows}
          className={cn("form-control", getErrorClass(field.name))}
          placeholder={field.placeholder}
          {...reg(field.name, rules)}
          disabled={isReadOnlyMode}
        />
        <FieldError
          error={(errors as FieldErrors<Record<string, any>>)[field.name]}
        />
        <FieldHelp text={field.description} />
      </div>
    );
  };

  const renderSelect = (field: FormField) => {
    const rules = rulesFor(field);

    const options =
      typeof field.options === "string"
        ? field.options.split("\n").map((o) => ({
          label: o,
          value: o,
        }))
        : field.options;

    return (
      <div className="form-group">
        <label htmlFor={field.name} className="form-label">
          {field.label}
          {field.required ? " *" : ""}
        </label>

        <select
          id={field.name}
          className={cn("form-control", getErrorClass(field.name))}
          {...reg(field.name, rules)}
          disabled={isReadOnlyMode}
        >
          <option value="">Select...</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <FieldError
          error={(errors as FieldErrors<Record<string, any>>)[field.name]}
        />
        <FieldHelp text={field.description} />
      </div>
    );
  };

  const renderCheckbox = (field: FormField) => {
    return (
      <Controller
        name={field.name}
        control={control}
        render={({ field: rhfField }) => (
          <div className="flex items-center gap-3 mb-4">
            <ToggleButton
              checked={!!rhfField.value}
              onChange={(val) => rhfField.onChange(val ? 1 : 0)}
              size="md"
              disabled={isReadOnlyMode}
            />
            <label
              htmlFor={field.name}
              className="text-sm font-medium leading-none cursor-pointer"
            >
              {field.label}
            </label>
            <FieldError error={(errors as any)[field.name]} />
            {field.description && (
              <div className="ml-2">
                <FieldHelp text={field.description} />
              </div>
            )}
          </div>
        )}
      />
    );
  };

  const renderRadio = (field: FormField) => {
    const options = field.options as { label: string; value: string; className?: string }[] || [];
    return (
      <Controller
        name={field.name}
        control={control}
        render={({ field: rhfField }) => (
          <div className="space-y-3">
            <RadioGroup
              value={rhfField.value}
              onValueChange={rhfField.onChange}
              className="flex flex-row gap-6"
              disabled={isReadOnlyMode}
            >
              {options.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={option.value}
                    id={`${field.name}-${option.value}`}
                    className={option.className || ''}
                  />
                  <label
                    htmlFor={`${field.name}-${option.value}`}
                    className={`text-sm font-medium leading-none cursor-pointer ${option.className || ''}`}
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </RadioGroup>
            <FieldError error={(errors as any)[field.name]} />
            {field.description && (
              <FieldHelp text={field.description} />
            )}
          </div>
        )}
      />
    );
  };

  const renderPumpStatus = (field: FormField) => {
    return (
      <Controller
        name={field.name}
        control={control}
        render={({ field: rhfField }) => (
          <div className="flex items-center gap-3">
            <PumpStatusToggle
              checked={!!rhfField.value}
              onChange={(val) => rhfField.onChange(val ? 1 : 0)}
              disabled={isReadOnlyMode}
            />
            <div className="flex flex-col">
              <label
                htmlFor={field.name}
                className="text-sm font-medium leading-none cursor-pointer"
              >
                {field.label}
              </label>
              <FieldError error={(errors as any)[field.name]} />
              {field.description && (
                <div className="mt-1">
                  <FieldHelp text={field.description} />
                </div>
              )}
            </div>
          </div>
        )}
      />
    );
  };

  const renderColor = (field: FormField) => {
    const rules = rulesFor(field);
    return (
      <div className="form-group">
        <label htmlFor={field.name} className="form-label">
          {field.label}
          {field.required ? " *" : ""}
        </label>
        <input
          id={field.name}
          type="color"
          className={cn("form-control h-10 p-1", getErrorClass(field.name))}
          {...reg(field.name, rules)}
          disabled={isReadOnlyMode}
        />
        <FieldError
          error={(errors as FieldErrors<Record<string, any>>)[field.name]}
        />
        <FieldHelp text={field.description} />
      </div>
    );
  };

  const renderDateLike = (
    field: FormField,
    type: "date" | "datetime-local" | "time"
  ) => {
    if (type === "date" || type === "datetime-local") {
      const rules = field.type === "DateTime" ? rulesFor(field) : rulesFor(field);

      return (
        <Controller
          name={field.name}
          control={control}
          rules={rules}
          render={({ field: controllerField, fieldState: { error } }) => {
            // Auto-set current date ONLY if allowed
            React.useEffect(() => {
              if (!controllerField.value && !field.disableAutoToday) {
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, "0");

                const yyyy = now.getFullYear();
                const MM = pad(now.getMonth() + 1);
                const dd = pad(now.getDate());
                const hh = pad(now.getHours());
                const mm = pad(now.getMinutes());
                const ss = pad(now.getSeconds());

                controllerField.onChange(
                  type === "datetime-local"
                    ? `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`
                    : `${yyyy}-${MM}-${dd}`
                );
              }
            }, [field.disableAutoToday]);

            // Decide what date picker should show
            let selectedDate: Date | null = null;

            if (controllerField.value) {
              const parsedDate = new Date(controllerField.value);
              if (!isNaN(parsedDate.getTime())) {
                selectedDate = parsedDate;
              }
            } else if (field.defaultValue) {
              const defaultDate = new Date(field.defaultValue);
              if (!isNaN(defaultDate.getTime())) {
                selectedDate = defaultDate;
              }
            }

            // Only show today if auto-today is enabled
            if (!selectedDate && !field.disableAutoToday) {
              selectedDate = new Date();
            }

            return (
              <div className="form-group">
                <label htmlFor={field.name} className="form-label">
                  {field.label}
                  {field.required ? " *" : ""}
                </label>

                <div className={error ? "input-error-wrapper" : ""}>
                  <DatePicker
                    selected={selectedDate ?? null}
                    onChange={(date: Date | null) => {
                      if (!date) {
                        controllerField.onChange("");
                        return;
                      }

                      const pad = (n: number) => (n < 10 ? "0" + n : n);
                      const yyyy = date.getFullYear();
                      const MM = pad(date.getMonth() + 1);
                      const dd = pad(date.getDate());

                      if (type === "datetime-local") {
                        const hh = pad(date.getHours());
                        const mm = pad(date.getMinutes());
                        const ss = pad(date.getSeconds());
                        controllerField.onChange(`${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`);
                      } else {
                        controllerField.onChange(`${yyyy}-${MM}-${dd}`);
                      }
                    }}
                    dateFormat={type === "datetime-local" ? "dd/MM/yyyy h:mm aa" : "dd/MM/yyyy"}
                    showTimeSelect={type === "datetime-local"}
                    timeIntervals={15}
                    timeCaption="Time"
                    placeholderText={type === "datetime-local" ? "DD/MM/YYYY HH:MM AM/PM" : "DD/MM/YYYY"}
                    className={cn("form-control w-full", getErrorClass(field.name))}
                    showYearDropdown
                    scrollableYearDropdown
                    yearDropdownItemNumber={100}
                    autoComplete="off"
                    withPortal
                    portalId="root-portal"
                    disabled={isReadOnlyMode}
                  />
                </div>

                {error && (
                  <span className="text-red-500 font-medium text-sm mt-1">
                    {error.message}
                  </span>
                )}
                <FieldHelp text={field.description} />
              </div>
            );
          }}
        />
      );
    }

    if (type === "time") {
      return (
        <Controller
          name={field.name}
          control={control}
          rules={rulesFor(field)}
          render={({ field: controllerField }) => {
            React.useEffect(() => {
              if (!controllerField.value) {
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, '0');
                controllerField.onChange(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
              }
            }, []);

            return (
              <div className="form-group">
                <label htmlFor={field.name} className="form-label">
                  {field.label}
                  {field.required ? " *" : ""}
                </label>
                <input
                  id={field.name}
                  type={type}
                  step="1"
                  className={cn("form-control", getErrorClass(field.name))}
                  {...reg(field.name, rulesFor(field))}
                  disabled={isReadOnlyMode}
                />
                <FieldError error={(errors as FieldErrors<Record<string, any>>)[field.name]} />
                <FieldHelp text={field.description} />
              </div>
            );
          }}
        />
      );
    }

    return (
      <div className="form-group">
        <label htmlFor={field.name} className="form-label">
          {field.label}
          {field.required ? " *" : ""}
        </label>
        <input
          id={field.name}
          type={type}
          step="1"
          className={cn("form-control", getErrorClass(field.name))}
          {...reg(field.name, rulesFor(field))}
          disabled={isReadOnlyMode}
        />
        <FieldError error={(errors as FieldErrors<Record<string, any>>)[field.name]} />
        <FieldHelp text={field.description} />
      </div>
    );
  };

  const renderDuration = (field: FormField) => {
    const base = field.name;
    return (
      <div className="form-group">
        <label className="form-label">
          {field.label}
          {field.required ? " *" : ""}
        </label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
          }}
        >
          <input
            type="number"
            min={0}
            className={cn("form-control", (errors as any)[`${base}.hours`] ? "!border-red-500" : "")}
            placeholder="Hours"
            {...reg(
              `${base}.hours`,
              rulesFor({ ...field, name: `${base}.hours`, label: "Hours" })
            )}
            disabled={isReadOnlyMode}
          />
          <input
            type="number"
            min={0}
            className={cn("form-control", (errors as any)[`${base}.minutes`] ? "!border-red-500" : "")}
            placeholder="Minutes"
            {...reg(
              `${base}.minutes`,
              rulesFor({ ...field, name: `${base}.minutes`, label: "Minutes" })
            )}
            disabled={isReadOnlyMode}
          />
          <input
            type="number"
            min={0}
            className={cn("form-control", (errors as any)[`${base}.seconds`] ? "!border-red-500" : "")}
            placeholder="Seconds"
            {...reg(
              `${base}.seconds`,
              rulesFor({ ...field, name: `${base}.seconds`, label: "Seconds" })
            )}
            disabled={isReadOnlyMode}
          />
        </div>
        <FieldHelp text={field.description} />
      </div>
    );
  };

  const renderRating = (field: FormField) => {
    const name = field.name;
    const current = watch(name) ?? 0;
    const set = (val: number) =>
      setValue(name, val, { shouldValidate: true, shouldDirty: true });

    return (
      <div className="form-group">
        <label className="form-label">
          {field.label}
          {field.required ? " *" : ""}
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set(n)}
              className={cn(
                "btn btn--outline btn--sm",
                (errors as any)[field.name] ? "!border-red-500 !text-red-500" : ""
              )}
              style={{
                borderColor: current >= n ? "var(--color-warning)" : undefined,
                color: current >= n ? "var(--color-warning)" : undefined,
              }}
              disabled={isReadOnlyMode}
            >
              Star
            </button>
          ))}
        </div>
        <FieldError
          error={(errors as FieldErrors<Record<string, any>>)[field.name]}
        />
        <FieldHelp text={field.description} />
      </div>
    );
  };

  const renderReadOnly = (field: FormField) => {
    const val = watch(field.name);
    let displayValue: any = field.readOnlyValue ?? val ?? "";
    // Auto-format date strings to DD/MM/YYYY
    if (
      typeof displayValue === "string" &&
      /^\d{4}-\d{2}-\d{2}/.test(displayValue) // detect date pattern
    ) {
      const date = new Date(displayValue);
      if (!isNaN(date.getTime())) {
        const pad = (n: number) => (n < 10 ? "0" + n : n);
        displayValue = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
      }
    }

    return (
      <div className="form-group">
        <label className="form-label">{field.label}</label>
        <input
          type="text"
          className={cn("form-control", getErrorClass(field.name))}
          value={displayValue}
          readOnly
          style={{
            background: "var(--color-surface-muted, transparent)",
            cursor: "default",
          }}
        />
        <FieldHelp text={field.description} />
      </div>
    );
  };

  const renderButton = (field: FormField) => (
    <div className="form-group">
      <button
        type="button"
        className="btn btn--outline btn--full-width"
        onClick={field.action}
      >
        {field.buttonLabel || field.label}
      </button>
      <FieldHelp text={field.description} />
    </div>
  );

  const renderAttachment = (field: FormField) => {
    const rules = rulesFor(field);
    const value = watch(field.name);

    if (!fileInputRefs.current[field.name]) {
      fileInputRefs.current[field.name] = null;
    }

    const registration = reg(field.name, rules) as any;
    const { ref: registerRef, ...registerRest } = registration || {};

    return (
      <div className="form-group flex flex-col gap-2">
        <label className="form-label font-medium">{field.label}</label>

        {/* Hidden file input */}
        <input
          type="file"
          className="hidden"
          {...registerRest}
          ref={(el: HTMLInputElement | null) => {
            fileInputRefs.current[field.name] = el;
            if (typeof registerRef === "function") {
              registerRef(el);
            } else if (registerRef) {
              (registerRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
            }
          }}
          onChange={(e) => {
            if (registration?.onChange) registration.onChange(e);
            const file = e.target.files?.[0];
            if (file) {
              setValue(field.name, file, { shouldDirty: true });
            }
          }}
          disabled={isReadOnlyMode}
        />

        {/* Upload Button */}
        {!value && (
          <Button
            type="button"
            variant="outline"
            className={cn("w-fit flex items-center gap-2", getErrorClass(field.name))}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              fileInputRefs.current[field.name]?.click();
            }}
            disabled={isReadOnlyMode}
          >
            <Upload size={16} />
            Upload File
          </Button>
        )}

        {/* File Selected View */}
        {value && (
          <div
            className={cn(
              "flex items-center gap-3 bg-muted/40 p-3 rounded-md border",
              getErrorClass(field.name)
            )}
          >
            <span className="text-sm flex-1">{value?.name}</span>

            {/* Preview */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                if (value?.file_url) {
                  window.open(value.file_url, "_blank");
                } else if (value instanceof File) {
                  const fileUrl = URL.createObjectURL(value);
                  window.open(fileUrl, "_blank");
                }
              }}
              disabled={isReadOnlyMode}
            >
              <Eye size={16} />
            </Button>

            {/* Replace */}
            <Button
              type="button"
              variant="outline"
              className="h-8 px-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRefs.current[field.name]?.click();
              }}
              disabled={isReadOnlyMode}
            >
              Replace
            </Button>

            {/* Remove */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setValue(field.name, null, { shouldDirty: true });
              }}
              disabled={isReadOnlyMode}
            >
              <X size={16} />
            </Button>
          </div>
        )}

        <FieldError error={errors[field.name]} />
      </div>
    );
  };

  const renderLink = (field: FormField) => {
    const getValue = (name: string) => watch(name);
    const filtersToPass = buildDynamicFilters(field, getValue);

    return (
      <LinkField
        key={field.name}
        field={field}
        control={control}
        error={(errors as FieldErrors<Record<string, any>>)[field.name]}
        filters={filtersToPass}
        className={getErrorClass(field.name) ? "!border-red-500 !focus:ring-red-500" : ""}
        disabled={isReadOnlyMode}
      />
    );
  };

  const renderTable = (field: FormField) => {
    return (
      <TableField
        key={field.name}
        field={field}
        control={control}
        register={reg}
        errors={errors}
        disabled={isReadOnlyMode}
      />
    );
  };

  const renderTableMultiSelect = (field: FormField) => {
    const getValue = (name: string) => watch(name);
    const filtersToPass = buildDynamicFilters(field, getValue);

    return (
      <TableMultiSelect
        key={field.name}
        field={field}
        control={control}
        error={(errors as FieldErrors<Record<string, any>>)[field.name]}
        filters={filtersToPass}
        className={getErrorClass(field.name) ? "!border-red-500 !focus:ring-red-500" : ""}
        disabled={isReadOnlyMode}
      />
    );
  };


  const renderField = (field: FormField, idx: number) => {
    // Check if field should be hidden
    const isHidden = field.displayDependsOn
      ? !evaluateDisplayDependsOn(field.displayDependsOn, allValues || {})
      : false;

    if (isHidden) return null; // Do not render hidden fields

    // Field content remains same
    const fieldContent = () => {
      switch (field.type) {
        case "Data":
        case "Text":
          return renderInput(field, "text");
        case "Small Text":
          return renderTextarea(field, field.rows ?? 3);
        case "Long Text":
        case "Markdown Editor":
          return renderTextarea(field, field.rows ?? 4);
        case "Code":
          return renderTextarea(field, field.rows ?? 6);
        case "Password":
          return renderInput(field, "password");
        case "Int":
          return renderInput(field, "number");
        case "Float":
        case "Currency":
        case "Percent":
          return renderInput(field, "number");
        case "Color":
          return renderColor(field);
        case "Date":
          return renderDateLike(field, "date");
        case "DateTime":
          return renderDateLike(field, "datetime-local");
        case "Time":
          return renderDateLike(field, "time");
        case "Duration":
          return renderDuration(field);
        case "Check":
          return renderCheckbox(field);
        case "Radio":
          return renderRadio(field);
        case "Pump Status":
          return renderPumpStatus(field);
        case "Select":
          return renderSelect(field);
        case "Link":
          return renderLink(field);
        case "Barcode":
          return renderInput(field, "text");
        case "Read Only":
          return renderReadOnly(field);
        case "Rating":
          return renderRating(field);
        case "Table":
          return renderTable(field);
        case "Table MultiSelect":
          return renderTableMultiSelect(field);
        case "Button":
          return renderButton(field);
        case "Attach":
          return renderAttachment(field);
        case "Custom":
          return (
            <div className="form-group">
              {field.label && <label className="form-label">{field.label}</label>}
              {field.customElement}
            </div>
          );
        case "Section Break":
          return (
            <div
              key={`${field.name}-${idx}`}
              style={{ gridColumn: "1 / -1", marginTop: 8 }}
            >
              <hr style={{ borderColor: "var(--color-border)" }} />
              <h3 style={{ marginTop: 12 }}>{field.label}</h3>
              <FieldHelp text={field.description} />
            </div>
          );
        case "Column Break":
          return <div key={idx} aria-hidden />;
        default:
          return null;
      }
    };

    return fieldContent();
  };

  const hasThreeColLayout = activeTabFields.some(
    (field) => field.layoutCols === 3
  );
  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <FormProvider {...methods}>
      <form
        ref={formRef}
        onSubmit={handleSubmit(onFormSubmit)}
        style={{ overflow: "visible" }}
      >
        <div className="card" style={{ padding: 16, overflow: "visible" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            {/* Title Section */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>

                {/* Render Breadcrumbs */}
                {renderHeaderContent()}

                <span
                  className={`status-badge text-xs whitespace-nowrap ${currentStatus === "Not Saved" ? "status-badge-danger" : "status-badge-draft"
                    }`}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: "500",
                    backgroundColor: currentStatus === "Not Saved" ? "#fee2e2" : "#dbeafe",
                    color: currentStatus === "Not Saved" ? "#dc2626" : "#2563eb",
                    border: `1px solid ${currentStatus === "Not Saved" ? "#fca5a5" : "#93c5fd"}`
                  }}
                >
                  {currentStatus}
                </span>
              </div>
              {description ? (
                <p
                  style={{
                    margin: "4px 0 0 0",
                    color: "var(--color-text-muted, #6b7280)",
                  }}
                >
                  {description}
                </p>
              ) : null}
            </div>

            {/* Actions Section */}
            <div className="flex items-center gap-2">
              {/* Show different buttons based on docstatus and isSubmittable */}
              {isSubmittable && docstatus === 0 && (
                <>

                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleSubmitDocument}
                  >
                    Submit
                  </button>
                </>
              )}
              {/* {isSubmittable && docstatus === 1 && ( */}
              {docstatus === 1 && onCancelDocument && (
                <>
                  {/* Submitted: Show Cancel button */}
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={handleCancelDocument}
                  >
                    Cancel
                  </button>
                </>
              )}
              {isSubmittable && docstatus === 2 && (
                <>
                  {/* Cancelled: No actions allowed */}
                  <span className="btn btn--danger">Cancelled</span>
                </>
              )}

              {/* Show Save button only for non-submittable documents (Running) */}
              {!isSubmittable && docstatus === 0 && isDirty && (
                <button
                  type="submit"
                  className="btn btn--primary"
                >
                  Save
                </button>
              )}

              {/* Previous/Next Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-r-none border-r-0 transition-all duration-200 hover:bg-blue-50 hover:border-blue-600 hover:text-blue-600 hover:shadow-md hover:-translate-y-0.5"
                  onClick={() => prevRecord && navigateToRecord(prevRecord)}
                  disabled={loadingNeighbors || !prevRecord}
                  title={loadingNeighbors ? "Loading..." : "Previous Record"}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-l-none transition-all duration-200 hover:bg-blue-50 hover:border-blue-600 hover:text-blue-600 hover:shadow-md hover:-translate-y-0.5"
                  onClick={() => nextRecord && navigateToRecord(nextRecord)}
                  disabled={loadingNeighbors || !nextRecord}
                  title={loadingNeighbors ? "Loading..." : "Next Record"}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Print Button */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 transition-all duration-200 hover:bg-grey-50 hover:border-grey-600 hover:text-purple-900 hover:shadow-md hover:-translate-y-0.5"
                title="Print"
              >
                <Printer className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border border-gray-200 rounded-md shadow-lg">
                  <DropdownMenuItem
                    onClick={handleDuplicate}
                    className="transition-all duration-200 hover:bg-gray-50 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    <span>Duplicate</span>
                    <span className="ml-auto text-xs tracking-widest opacity-60">
                      ⇧D
                    </span>
                  </DropdownMenuItem>

                  {/* Delete Action in Dropdown */}
                  {showDeleteOption && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleDeleteAction}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/10 cursor-pointer transition-all duration-200 hover:bg-red-50 hover:shadow-md hover:-translate-y-0.5"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Tab navigation */}
          <div
            className="form-tabs"
            style={{
              display: "flex",
              gap: "4px",
              borderBottom: "1px solid var(--color-border)",
              marginBottom: "16px",
            }}
          >
            {tabs.map((tab, i) => (
              <button
                key={tab.name}
                type="button"
                className={`btn btn--tab ${i === activeTab ? "btn--tab-active" : ""
                  }`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(i);
                }}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {/* Dynamic grid */}

          <div
            className={`grid grid-cols-1 ${hasThreeColLayout ? "md:grid-cols-3" : "md:grid-cols-4"
              } gap-x-6 gap-y-4`}
          >
            {activeTabFields.map((field, idx) => {
              const isHidden = field.displayDependsOn
                ? !evaluateDisplayDependsOn(field.displayDependsOn, allValues || {})
                : false;

              if (isHidden) return null;

              const isWideField = field.type === "Table" ||
                field.type === "Table MultiSelect" ||
                field.type === "Section Break" ||
                field.type === "Custom";

              // Determine column span based on field type
              let colSpanClass = "md:col-span-1"; // Default: 1 column (1/4 width)

              if (hasThreeColLayout) {
                if (isWideField) {
                  colSpanClass = "md:col-span-3";
                } else {
                  colSpanClass = "md:col-span-1"; // always equal width
                }
              } else {
                if (isWideField) {
                  colSpanClass = "md:col-span-4";
                } else if (field.fieldColumns === 2) {
                  colSpanClass = "md:col-span-2";
                } else if (field.fieldColumns === 3) {
                  colSpanClass = "md:col-span-3";
                } else if (field.fieldColumns === 4) {
                  colSpanClass = "md:col-span-4";
                }
              }

              return (
                <div
                  key={`${field.name}-${idx}`}
                  className={colSpanClass}
                  style={{ overflow: "visible" }}
                >
                  {renderField(field, idx)}
                </div>
              );
            })}
          </div>


          {/* Footer */}

          {/* Footer */}
          <hr
            style={{ borderColor: "var(--color-border)", margin: "16px 0" }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {/* Show different buttons based on docstatus and isSubmittable */}
            {isSubmittable && docstatus === 0 && (
              <>
                {/* When isSubmittable (Final bill type), only show Submit button */}
                <button
                  type="button"
                  onClick={handleSubmitDocument}
                >
                  Submit
                </button>
              </>
            )}
            {!isSubmittable && docstatus === 0 && isDirty && (
              <button
                type="submit"
                className="btn btn--primary"
              >
                Save
              </button>
            )}

            {isSubmittable && docstatus === 1 && (
              <>
                {/* Submitted: Show Cancel button */}
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={handleCancelDocument}
                >
                  Cancel
                </button>
              </>
            )}

            {isSubmittable && docstatus === 2 && (
              <>
                {/* Cancelled: No actions allowed */}
                <span className="text-sm text-gray-500 italic">Document is cancelled and cannot be modified</span>
              </>
            )}

            {/* Show regular cancel button for navigation */}
            {onCancel && (!isSubmittable || docstatus !== 2) && (
              <button
                type="button"
                className="btn btn--outline"
                onClick={onCancel}
              >
                Back
              </button>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

export default DynamicForm;