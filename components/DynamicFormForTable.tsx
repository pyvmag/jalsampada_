"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { FormField, FieldType } from "./DynamicFormComponent";
import { Button } from "@/components/ui/button";
import { LinkInput } from "./LinkInput";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Checkbox } from "@/components/ui/checkbox";
import { useTableRowContext } from "./TableRowContext";
import { cn } from "@/lib/utils";
import { Upload, X, Eye } from "lucide-react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";

const API_BASE_URL = "http://103.219.1.138:4412/";

// Helper: Build dynamic filters for Link fields
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
// Helper: Evaluate displayDependsOn condition string
function evaluateDisplayDependsOn(
    condition: string | Record<string, any> | ((values: Record<string, any>) => boolean),
    getValue: (name: string) => any
): boolean {
    try {
        // 🟢 If condition is a function, call it with a values object
        if (typeof condition === "function") {
            // Build a temporary values object from getValue
            const valuesProxy = new Proxy(
                {},
                {
                    get: (_, prop: string) => getValue(prop),
                }
            );
            return condition(valuesProxy);
        }

        // 🟢 If condition is an object, check key-value rules
        if (typeof condition === "object") {
            for (const key in condition) {
                const expected = condition[key];
                const actual = getValue(key);

                if (expected === true && !actual) return false;
                if (expected === false && actual) return false;
                if (expected !== true && expected !== false && actual !== expected) return false;
            }
            return true;
        }

        // 🟢 If condition is a string, use existing string parsing logic
        if (typeof condition === "string") {
            const parts = condition
                .split(/(\&\&|\|\|)/)
                .map((c) => c.trim())
                .filter((c) => c);

            const conditions = parts.filter((p) => p !== "&&" && p !== "||");
            const operators = parts.filter((p) => p === "&&" || p === "||");

            const results = conditions.map((cond) => {
                const [field, op, valueStr] = cond.split(/([=!<>]=?)/);
                if (!field || !op || valueStr === undefined) return true;

                const fieldName = field.trim();
                const fieldValue = getValue(fieldName);

                let compareValue: any = valueStr.trim();

                // Smart type conversion
                if (compareValue === "true") compareValue = true;
                else if (compareValue === "false") compareValue = false;
                else if (/^\d+$/.test(compareValue)) compareValue = parseInt(compareValue, 10);
                else if (/^\d+\.\d+$/.test(compareValue)) compareValue = parseFloat(compareValue);
                else compareValue = compareValue.replace(/^['"]|['"]$/g, "");

                switch (op) {
                    case "==": return fieldValue == compareValue;
                    case "!=": return fieldValue != compareValue;
                    case ">": return (fieldValue ?? 0) > (compareValue ?? 0);
                    case "<": return (fieldValue ?? 0) < (compareValue ?? 0);
                    case ">=": return (fieldValue ?? 0) >= (compareValue ?? 0);
                    case "<=": return (fieldValue ?? 0) <= (compareValue ?? 0);
                    default: return true;
                }
            });

            if (results.length === 0) return true;

            return results.reduce((acc, result, i) => {
                const op = operators[i - 1];
                return op === "&&" ? acc && result : op === "||" ? acc || result : result;
            });
        }

        return true;
    } catch (e) {
        console.error("Error evaluating displayDependsOn:", condition, e);
        return true; // fail-safe: show field if condition can't be evaluated
    }
}

interface DynamicFormForTableProps {
    fields: FormField['columns'];
    data: Record<string, any>;
    onSubmit: (data: Record<string, any>) => void;
    onCancel: () => void;
    title?: string;
    disabled?: boolean;
}

// Local UI helper components
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
        <div className="text-error" style={{ marginTop: 6, fontSize: "0.85rem" }}>
            {String(error.message || error)}
        </div>
    );
}

export function DynamicFormForTable({
    fields,
    data,
    onSubmit,
    onCancel,
    title = "",
    disabled = false
}: DynamicFormForTableProps) {
    const { editingRowIndex, updateRow, getRowData } = useTableRowContext();
    const { apiKey, apiSecret } = useAuth();
    const parentGetValues = useFormContext(); // Access parent form context

    // Local form state for the modal
    const [formData, setFormData] = React.useState<Record<string, any>>({});

    // Initialize form data only when modal opens (editingRowIndex changes)
    React.useEffect(() => {
        const initialData = editingRowIndex !== null
            ? (data ?? getRowData(editingRowIndex))
            : (data || {});

        setFormData(initialData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingRowIndex]); // Only re-initialize when editing a different row

    // Debounced update to context - prevents excessive updates during typing
    const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const debouncedUpdateContext = React.useCallback((newData: Record<string, any>) => {
        if (editingRowIndex === null) return;

        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
            updateRow(editingRowIndex, newData);
        }, 300);
    }, [editingRowIndex, updateRow]);

    // Cleanup timeout on unmount
    React.useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, []);

    const handleInputChange = async (fieldName: string, value: any, _depth: number = 0) => {
        if (disabled) return;

        // Handle fetchFrom dependencies
        const dependentFields = (fields || []).filter(f => f.fetchFrom?.sourceField === fieldName);

        if (dependentFields.length > 0) {
            if (!value || value === "") {
                // Cancel any pending debounced update to prevent overwriting cleared values
                if (updateTimeoutRef.current) {
                    clearTimeout(updateTimeoutRef.current);
                    updateTimeoutRef.current = null;
                }

                // Build cleared data object
                const clearedData: Record<string, any> = { [fieldName]: "" };
                dependentFields.forEach((dep) => {
                    clearedData[dep.name] = "";
                });

                // Update local state with cleared values
                setFormData(current => {
                    const updatedData = { ...current, ...clearedData };

                    // Defer context update to avoid setState during render
                    if (editingRowIndex !== null) {
                        requestAnimationFrame(() => {
                            updateRow(editingRowIndex, updatedData);
                        });
                    }

                    return updatedData;
                });

                return;
            }
        }

        // Update local state immediately for responsive UI
        setFormData(current => {
            let newFormData = { ...current, [fieldName]: value };

            // Calculate amount if rate or quantity changes
            if (fieldName === 'rate' || fieldName === 'qty') {
                const rate = parseFloat(newFormData.rate) || 0;
                const qty = parseFloat(newFormData.qty) || 0;
                const amount = rate * qty;
                newFormData = { ...newFormData, amount: amount.toString() };
            }

            // Calculate end_date dynamically based on start_date and period_in_days
            if (fieldName === 'start_date' || fieldName === 'period_in_days') {
                const start_date = newFormData.start_date;
                const period_in_days = parseInt(newFormData.period_in_days);
                
                if (start_date && !isNaN(period_in_days)) {
                    const start = new Date(start_date);
                    start.setDate(start.getDate() + period_in_days);
                    newFormData = { ...newFormData, end_date: start.toISOString().split("T")[0] };
                } else if (!start_date || isNaN(period_in_days)) {
                     // Optionally clear the end_date if inputs are incomplete
                     newFormData = { ...newFormData, end_date: "" };
                }
            }

            // Debounced update to context (only for non-dependent fields)
            if (_depth === 0) {
                debouncedUpdateContext(newFormData);
            }

            return newFormData;
        });

        if (dependentFields.length === 0) return;

        // Prepare API request data
        const targetDoctype = dependentFields[0].fetchFrom!.targetDoctype;
        const targetFields = [...new Set(dependentFields.map(f => f.fetchFrom!.targetField))];

        try {
            const response = await axios.get(`${API_BASE_URL}api/method/frappe.client.validate_link`, {
                params: {
                    doctype: targetDoctype,
                    docname: value,
                    fields: JSON.stringify(targetFields),
                },
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                },
            });

            const responseData = response.data?.message || {};
            console.log("validate_link response:", responseData);

            // Batch update all dependent fields
            const fieldUpdates: Record<string, any> = {};

            dependentFields.forEach((dep) => {
                const targetField = dep.fetchFrom!.targetField;
                const newValue = responseData[targetField] ?? "";
                fieldUpdates[dep.name] = newValue;

                if (process.env.NODE_ENV === 'development') {
                    console.log(`Setting ${dep.name} ← ${targetField} = ${newValue}`);
                }
            });

            // Update local state with all dependent fields at once
            setFormData(current => {
                const updatedData = { ...current, ...fieldUpdates };

                // Cancel any pending debounced update to prevent overwriting fetched values
                if (updateTimeoutRef.current) {
                    clearTimeout(updateTimeoutRef.current);
                    updateTimeoutRef.current = null;
                }

                // Defer context update to avoid setState during render
                if (editingRowIndex !== null) {
                    requestAnimationFrame(() => {
                        updateRow(editingRowIndex, updatedData);
                    });
                }

                return updatedData;
            });

        } catch (error) {
            console.error("fetchFrom dependency update failed:", {
                fieldName,
                value,
                targetDoctype,
                error: error instanceof Error ? error.message : error
            });
        }
    };

    const handleSubmit = () => {
        if (disabled) return;
        console.log('DynamicFormForTable: Submitting form data:', formData);

        // Clear any pending debounced updates
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        // Final update to context
        if (editingRowIndex !== null) {
            updateRow(editingRowIndex, formData);
        }

        onSubmit(formData);
    };

    const renderLink = (field: FormField, isFieldDisabled: boolean) => {
        const value = formData[field.name] ?? "";

        // Build dynamic filters for Link fields with parent context support
        const getValue = (name: string) => {
            // Handle explicit parent access
            if (name.startsWith("parent.")) {
                return parentGetValues.getValues(name.replace("parent.", ""));
            }
            // Fallback to local form data
            const localValue = formData[name];
            if (localValue !== undefined && localValue !== "") {
               return localValue;
            }
            // Fallback to parent form data
            return parentGetValues.getValues(name);
        };
        const filtersToPass = buildDynamicFilters(field, getValue);
        const filterKey = `${field.name}-${JSON.stringify(filtersToPass)}`;

        return (
            <div className="form-group">
                <label className="form-label">
                    {field.label}
                    {field.required ? " *" : ""}
                </label>
                <LinkInput
                    key={filterKey}
                    value={value}
                    onChange={(val) => handleInputChange(field.name, val)}
                    placeholder={field.placeholder || `Select ${field.label}...`}
                    linkTarget={field.linkTarget}
                    className="w-full"
                    filters={filtersToPass}
                    disabled={isFieldDisabled}
                    customSearchUrl={field.customSearchUrl}
                    customSearchParams={field.customSearchParams}
                    referenceDoctype={field.referenceDoctype}
                    doctype={field.doctype}
                    searchField={field.searchField}
                    getValues={getValue}
                />
                <FieldError error={null} />
                <FieldHelp text={field.description} />
            </div>
        );
    };

    const renderInput = (field: FormField, type: string = "text", isFieldDisabled: boolean) => {
        const value = formData[field.name] ?? "";

        const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
            if ((field.type === "Currency" || field.type === "Float") && field.precision) {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                    handleInputChange(field.name, val.toFixed(field.precision));
                }
            }
        };

        return (
            <div className="form-group">
                <label htmlFor={field.name} className="form-label">
                    {field.label}
                    {field.required ? " *" : ""}
                </label>
                <input
                    id={field.name}
                    type={type}
                    className="form-control"
                    placeholder={field.placeholder}
                    value={value}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    onBlur={handleBlur}
                    {...(field.step ? { step: field.step } : {})}
                    {...(field.min !== undefined ? { min: field.min } : {})}
                    {...(field.max !== undefined ? { max: field.max } : {})}
                    disabled={isFieldDisabled}
                />

                <FieldError error={null} />
                <FieldHelp text={field.description} />
            </div>
        );
    };

    const renderTextarea = (field: FormField, rows = 4, isFieldDisabled: boolean) => {
        const value = formData[field.name] ?? "";

        return (
            <div className="form-group">
                <label htmlFor={field.name} className="form-label">
                    {field.label}
                    {field.required ? " *" : ""}
                </label>
                <textarea
                    id={field.name}
                    rows={field.rows ?? rows}
                    className="form-control"
                    placeholder={field.placeholder}
                    value={value}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    disabled={isFieldDisabled}
                />

                <FieldError error={null} />
                <FieldHelp text={field.description} />
            </div>
        );
    };

    const renderSelect = (field: FormField, isFieldDisabled: boolean) => {
        const value = formData[field.name] ?? "";
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
                    className="form-control"
                    value={value}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    disabled={isFieldDisabled}
                >
                    <option value="">Select...</option>
                    {options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>

                <FieldError error={null} />
                <FieldHelp text={field.description} />
            </div>
        );
    };

    const renderCheckbox = (field: FormField, isFieldDisabled: boolean) => {
        const checked = !!formData[field.name];

        return (
            <div className="flex items-center gap-2">
                <Checkbox
                    id={field.name}
                    checked={checked}
                    onCheckedChange={(val) => handleInputChange(field.name, val)}
                    className="rounded border border-gray-300 data-[state=checked]:bg-primary"
                    disabled={isFieldDisabled}
                />

                <label
                    htmlFor={field.name}
                    className="text-sm font-medium leading-none cursor-pointer"
                >
                    {field.label}
                </label>
                {field.description && (
                    <div className="ml-2">
                        <FieldHelp text={field.description} />
                    </div>
                )}
            </div>
        );
    };

    const renderDateLike = (
        field: FormField,
        type: "date" | "datetime-local" | "time",
        isFieldDisabled: boolean
    ) => {
        const value = formData[field.name] ?? "";

        if (type === "date") {
            return (
                <div className="form-group">
                    <label htmlFor={field.name} className="form-label">
                        {field.label}
                        {field.required ? " *" : ""}
                    </label>
                    <DatePicker
                        selected={value ? new Date(value) : null}
                        onChange={(date: Date | null) => {
                            handleInputChange(field.name, date ? date.toISOString().split('T')[0] : '');
                        }}
                        dateFormat="dd/MM/yyyy"
                        className="form-control"
                        placeholderText="DD/MM/YYYY"
                        showYearDropdown
                        scrollableYearDropdown
                        yearDropdownItemNumber={100}
                        disabled={isFieldDisabled}
                    />

                    <FieldError error={null} />
                    <FieldHelp text={field.description} />
                </div>
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
                    className="form-control"
                    value={value}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    disabled={isFieldDisabled}
                />

                <FieldError error={null} />
                <FieldHelp text={field.description} />
            </div>
        );
    };

    const renderColor = (field: FormField, isFieldDisabled: boolean) => {
        const value = formData[field.name] ?? "#000000";

        return (
            <div className="form-group">
                <label htmlFor={field.name} className="form-label">
                    {field.label}
                    {field.required ? " *" : ""}
                </label>
                <input
                    id={field.name}
                    type="color"
                    className={cn("form-control h-10 p-1")}
                    value={value}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    disabled={isFieldDisabled}
                />

                <FieldError error={null} />
                <FieldHelp text={field.description} />
            </div>
        );
    };

    const renderDuration = (field: FormField, isFieldDisabled: boolean) => {
        const value = formData[field.name] ?? {};

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
                        className="form-control"
                        placeholder="Hours"
                        value={value.hours || ""}
                        onChange={(e) => handleInputChange(field.name, { ...value, hours: e.target.value })}
                        disabled={isFieldDisabled}
                    />
                    <input
                        type="number"
                        min={0}
                        className="form-control"
                        placeholder="Minutes"
                        value={value.minutes || ""}
                        onChange={(e) => handleInputChange(field.name, { ...value, minutes: e.target.value })}
                        disabled={isFieldDisabled}
                    />
                    <input
                        type="number"
                        min={0}
                        className="form-control"
                        placeholder="Seconds"
                        value={value.seconds || ""}
                        onChange={(e) => handleInputChange(field.name, { ...value, seconds: e.target.value })}
                        disabled={isFieldDisabled}
                    />

                </div>
                <FieldHelp text={field.description} />
            </div>
        );
    };

    const renderRating = (field: FormField, isFieldDisabled: boolean) => {
        const value = formData[field.name] ?? 0;

        return (
            <div className="form-group">
                <label className="form-label">
                    {field.label}
                    {field.required ? " *" : ""}
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => handleInputChange(field.name, star)}
                            disabled={isFieldDisabled}
                            style={{
                                color: star <= value ? '#fbbf24' : '#d1d5db',
                                padding: '4px 8px',
                                fontSize: '16px'
                            }}
                        >
                            ★
                        </button>
                    ))}
                </div>
                <FieldHelp text={field.description} />
            </div>
        );
    };

    const renderReadOnly = (field: FormField) => {
        const value = formData[field.name];
        return (
            <div className="form-group">
                <label className="form-label">{field.label}</label>
                <div
                    style={{
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-base)",
                        padding: 12,
                        background: "var(--color-surface-muted, transparent)",
                    }}
                >
                    {field.readOnlyValue ?? value ?? "—"}
                </div>
                <FieldHelp text={field.description} />
            </div>
        );
    };

    const renderButton = (field: FormField, isFieldDisabled: boolean) => (
        <div className="form-group">
            <button
                type="button"
                className="btn btn--outline btn--full-width"
                onClick={() => field.action?.()}
                disabled={isFieldDisabled}
            >
                {field.buttonLabel || field.label}
            </button>
            <FieldHelp text={field.description} />
        </div>
    );

    const renderAttachment = (field: FormField, isFieldDisabled: boolean) => {
        const value = formData[field.name];
        const fileInputRef = React.useRef<HTMLInputElement | null>(null);

        const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

        React.useEffect(() => {
            let objectUrl: string | null = null;

            if (value instanceof File) {
                objectUrl = URL.createObjectURL(value);
                setPreviewUrl(objectUrl);
            } else if (typeof value === 'string' && (value.startsWith("/files/") || value.startsWith("/private/files/"))) {
                setPreviewUrl(API_BASE_URL + value);
            } else {
                setPreviewUrl(null);
            }

            return () => {
                if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                }
            };
        }, [value]);

        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (disabled) return;
            const file = e.target.files?.[0];
            if (file) {
                handleInputChange(field.name, file);
            }
        };

        const handleClear = () => {
            if (disabled) return;
            handleInputChange(field.name, null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        };

        return (
            <div className="form-group flex flex-col gap-2">
                <label className="form-label font-medium">{field.label}</label>

                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        disabled={disabled}
                    />

                    {!value ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="btn--sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={disabled}
                        >
                            <Upload size={14} className="mr-2" />
                            Attach
                        </Button>
                    ) : (
                        <>
                            <span className="text-sm truncate flex-1" title={typeof value === 'string' ? value : value.name}>
                                {typeof value === 'string' ? value.split('/').pop() : value.name}
                            </span>

                            {previewUrl && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    asChild
                                >
                                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" title="Preview">
                                        <Eye size={16} />
                                    </a>
                                </Button>
                            )}

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500"
                                onClick={handleClear}
                                title="Clear"
                                disabled={isFieldDisabled}
                            >
                                <X size={16} />
                            </Button>
                        </>
                    )}
                </div>

                <FieldHelp text={field.description} />
            </div>
        );
    };

    const renderField = (field: FormField) => {
        const isFieldDisabled = disabled || (field as any).readOnly || (field as any).disabled;

        // ── Layout fields ───────────────────────────────────────
        if (field.type === "Section Break") {
            return (
                <div className="col-span-full mt-6 mb-2">
                    {field.label && (
                        <h3 className="text-lg font-medium text-foreground border-b pb-2 mb-4">
                            {field.label}
                        </h3>
                    )}
                    {field.description && (
                        <p className="text-sm text-muted-foreground mb-4">
                            {field.description}
                        </p>
                    )}
                    <hr className="border-border" />
                </div>
            );
        }

        if (field.type === "Column Break") {
            return <div className="col-span-full h-0" aria-hidden="true" />; // just visual break
        }

        // ── Normal fields ───────────────────────────────────────
        switch (field.type) {
            case "Data":
            case "Small Text":
            case "Text":
                return renderInput(field, "text", isFieldDisabled);

            case "Long Text":
            case "Markdown Editor":
                return renderTextarea(field, field.rows ?? 4, isFieldDisabled);

            case "Code":
                return renderTextarea(field, field.rows ?? 6, isFieldDisabled);

            case "Password":
                return renderInput(field, "password", isFieldDisabled);

            case "Int":
                return renderInput(field, "number", isFieldDisabled);

            case "Float":
            case "Currency":
            case "Percent":
                return renderInput(field, "number", isFieldDisabled);

            case "Color":
                return renderColor(field, isFieldDisabled);

            case "Date":
                return renderDateLike(field, "date", isFieldDisabled);

            case "DateTime":
                return renderDateLike(field, "datetime-local", isFieldDisabled);

            case "Time":
                return renderDateLike(field, "time", isFieldDisabled);

            case "Duration":
                return renderDuration(field, isFieldDisabled);

            case "Check":
                return renderCheckbox(field, isFieldDisabled);

            case "Select":
                return renderSelect(field, isFieldDisabled);

            case "Link":
                return renderLink(field, isFieldDisabled);

            case "Barcode":
                return renderInput(field, "text", isFieldDisabled);

            case "Read Only":
                return renderReadOnly(field);

            case "Rating":
                return renderRating(field, isFieldDisabled);

            case "Button":
                return renderButton(field, isFieldDisabled);

            case "Attach":
                return renderAttachment(field, isFieldDisabled);

            // You can also support Custom type if you plan to use it
            case "Custom":
                return (
                    <div className="form-group">
                        {field.label && <label className="form-label">{field.label}</label>}
                        <div className={isFieldDisabled ? "opacity-60 pointer-events-none" : ""}>
                            {field.customElement}
                        </div>
                    </div>
                );

            default:
                return null; // ← better than fallback to text input
        }
    };
    return (
        <div className="space-y-4">
            {/* Optional title */}
            {title && (
                <h2 className="text-xl font-semibold">{title}</h2>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                {fields?.map((field) => {
                    // Evaluate visibility
                    const isVisible = field.displayDependsOn
                        ? evaluateDisplayDependsOn(field.displayDependsOn, (name) => {
                            if (name.startsWith("parent.")) {
                                return parentGetValues.getValues(name.replace("parent.", ""));
                            }
                            const localValue = formData[name];
                            if (localValue !== undefined && localValue !== "") return localValue;
                            return parentGetValues.getValues(name);
                        })
                        : true;

                    if (!isVisible) return null;

                    return (
                        <div
                            key={field.name}
                            className={
                                field.type === "Section Break" || field.type === "Column Break"
                                    ? "col-span-full"
                                    : ""
                            }
                        >
                            {renderField(field)}
                        </div>
                    );
                })}
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-8 pt-5 border-t">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button
                    type="button"
                    className="btn--primary"
                    onClick={handleSubmit}
                    disabled={disabled}
                >
                    Save
                </Button>
            </div>
        </div>
    );
}