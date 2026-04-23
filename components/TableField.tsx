import * as React from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { FormField } from "./DynamicFormComponent";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleButton } from "./ToggleButton";
import { Upload, X, Eye, Edit, Download, Upload as UploadIcon } from "lucide-react";
import { TableLinkCell } from "./TableLinkCell";
import { Modal } from "./Modal";
import { DynamicFormForTable } from "./DynamicFormForTable";
import { TableRowProvider, useTableRowContext } from "./TableRowContext";
import DatePicker from "react-datepicker";
import { cn } from "@/lib/utils";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import "./TableField.css";
import "react-datepicker/dist/react-datepicker.css";
import { toast } from "sonner";

// 🔴 OLD: const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
// 🟢 NEW: Split into Server Root and API Path
const SERVER_URL = "http://103.219.1.138:4412";
const API_BASE_URL = `${SERVER_URL}/api/resource`;

/**
 * Safely parse date strings into Date objects, supporting multiple formats
 * like YYYY-MM-DD, DD-MM-YYYY, and DD/MM/YYYY.
 */
const parseSafeDate = (dateStr: any): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  if (typeof dateStr !== 'string') return null;
  
  // Try standard parsing first (works for YYYY-MM-DD)
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;

  // Try parsing DD-MM-YYYY or DD/MM/YYYY
  const parts = dateStr.split(/[-/]/).map(p => p.trim());
  if (parts.length === 3) {
    let d, m, y;
    // Check for DD-MM-YYYY
    if (parts[2].length === 4 && parts[0].length <= 2) {
      d = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      y = parseInt(parts[2], 10);
    } 
    // Check for YYYY-MM-DD (as fallback)
    else if (parts[0].length === 4) {
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      d = parseInt(parts[2], 10);
    }

    if (y !== undefined && m !== undefined && d !== undefined) {
      const newDate = new Date(y, m, d);
      if (!isNaN(newDate.getTime())) return newDate;
    }
  }
  
  return null;
};

interface Option {
  value: string;
  label: string;
}

interface TableFieldProps {
  field: FormField;
  control: any;
  register: any;
  errors: any;
  disabled?: boolean;
  onChange?: (value: any, data: any, setFieldValue: any) => void;
}

// ... [Keep renderTableInput, renderTableTextarea, etc. unchanged] ...
// (I will skip repeating the helper functions to save space, they are fine)

// Helper functions for table field rendering (Keep these exactly as they were)
const renderTableInput = (c: any, idx: number, rows: any[], handleTableInputChange: Function, disabled?: boolean) => (
  <input
    className="form-control-borderless"
    type="text"
    placeholder={c.label}
    value={(rows[idx] as any)?.[c.name] || ""}
    onChange={(e) => handleTableInputChange(idx, c.name, e.target.value)}
    disabled={!!disabled}
  />
);

const renderTableTextarea = (c: any, idx: number, rows: any[], handleTableInputChange: Function, disabled?: boolean) => (
  <textarea
    className="form-control-borderless"
    rows={3}
    placeholder={c.label}
    value={(rows[idx] as any)?.[c.name] || ""}
    onChange={(e) => handleTableInputChange(idx, c.name, e.target.value)}
    style={{ minHeight: '60px', resize: 'vertical' }}
    disabled={!!disabled}
  />
);

const renderTableNumber = (c: any, idx: number, rows: any[], handleTableInputChange: Function, disabled?: boolean) => (
  <input
    className="form-control-borderless"
    type="number"
    placeholder={c.label}
    value={(rows[idx] as any)?.[c.name] || ""}
    onChange={(e) => handleTableInputChange(idx, c.name, e.target.value)}
    step={c.type === "Float" || c.type === "Currency" || c.type === "Percent" ? "0.01" : "1"}
    disabled={!!disabled}
  />
);

const renderTableCheckbox = (c: any, idx: number, rows: any[], handleTableInputChange: Function, invertColors: boolean = false, disabled?: boolean) => (
  <ToggleButton
    checked={!!(rows[idx] as any)?.[c.name]}
    onChange={(checked) => handleTableInputChange(idx, c.name, checked ? 1 : 0)}
    size="sm"
    invertColors={invertColors}
    disabled={!!disabled}
  />
);

const renderTableSelect = (c: any, idx: number, rows: any[], handleTableInputChange: Function, disabled?: boolean) => {
  const options = typeof c.options === "string"
    ? c.options.split("\n").map((o: string) => ({ label: o, value: o }))
    : c.options;

  return (
    <select
      className="form-control-borderless"
      value={(rows[idx] as any)?.[c.name] || ""}
      onChange={(e) => handleTableInputChange(idx, c.name, e.target.value)}
      disabled={!!disabled}
    >
      <option value="">Select...</option>
      {options?.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

const renderTableColor = (c: any, idx: number, rows: any[], handleTableInputChange: Function, disabled?: boolean) => (
  <input
    className="form-control-borderless"
    type="color"
    value={(rows[idx] as any)?.[c.name] || "#000000"}
    onChange={(e) => handleTableInputChange(idx, c.name, e.target.value)}
    style={{ width: '100%', height: '32px' }}
    disabled={!!disabled}
  />
);

const renderTableDuration = (c: any, idx: number, rows: any[], handleTableInputChange: Function, disabled?: boolean) => {
  const value = (rows[idx] as any)?.[c.name] || {};
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <input
        className="form-control-borderless"
        type="number"
        placeholder="HH"
        value={value.hours || ""}
        onChange={(e) => handleTableInputChange(idx, c.name, { ...value, hours: e.target.value })}
        min={0}
        style={{ width: '50px' }}
        disabled={!!disabled}
      />
      <input
        className="form-control-borderless"
        type="number"
        placeholder="MM"
        value={value.minutes || ""}
        onChange={(e) => handleTableInputChange(idx, c.name, { ...value, minutes: e.target.value })}
        min={0}
        style={{ width: '50px' }}
        disabled={!!disabled}
      />
      <input
        className="form-control-borderless"
        type="number"
        placeholder="SS"
        value={value.seconds || ""}
        onChange={(e) => handleTableInputChange(idx, c.name, { ...value, seconds: e.target.value })}
        min={0}
        style={{ width: '50px' }}
        disabled={!!disabled}
      />
    </div>
  );
};

const renderTableRating = (c: any, idx: number, rows: any[], handleTableInputChange: Function, disabled?: boolean) => {
  const value = (rows[idx] as any)?.[c.name] || 0;
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => handleTableInputChange(idx, c.name, star)}
          disabled={!!disabled}
          style={{
            color: star <= value ? '#fbbf24' : '#d1d5db',
            padding: '2px 4px',
            fontSize: '14px'
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
};

const renderTableReadOnly = (c: any, idx: number, rows: any[]) => (
  <input
    type="text"
    className="form-control-borderless"
    value={(rows[idx] as any)?.[c.name] || ""}
    readOnly
  />
);

const renderTableButton = (c: any, idx: number, rows: any[]) => (
  <button
    type="button"
    className="btn btn--outline btn--sm"
    onClick={() => c.action?.(rows[idx], idx)}
  >
    {c.buttonLabel || c.label}
  </button>
);


// ─────────────────────────────────────────────────────────────────────────────
// 🟢 FIXED ATTACHMENT CELL
// ─────────────────────────────────────────────────────────────────────────────
function AttachmentCell({ fieldName, control, rowIndex, columnName, onValueChange, disabled }: {
  fieldName: string,
  control: any,
  rowIndex?: number,
  columnName?: string,
  onValueChange?: (value: any) => void,
  disabled?: boolean
}) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const { watch, setValue } = useFormContext();
  const value = watch(fieldName);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let objectUrl: string | null = null;

    if (value instanceof File) {
      objectUrl = URL.createObjectURL(value);
      setPreviewUrl(objectUrl);
    }
    // Check for string paths from Frappe (e.g., "/private/files/...")
    else if (typeof value === 'string' && (value.startsWith("/files/") || value.startsWith("/private/files/"))) {
      // 🟢 FIX: Use SERVER_URL instead of API_BASE_URL
      setPreviewUrl(SERVER_URL + value);
    }
    else {
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
      setValue(fieldName, file, { shouldDirty: true });
      if (onValueChange && rowIndex !== undefined && columnName !== undefined) {
        onValueChange(file);
      }
    }
  };

  const handleClear = () => {
    if (disabled) return;
    setValue(fieldName, null, { shouldDirty: true });
    if (onValueChange && rowIndex !== undefined && columnName !== undefined) {
      onValueChange(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
        disabled={!!disabled}
      />

      {!value ? (
        <Button
          type="button"
          variant="outline"
          className="btn--sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={!!disabled}
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
            disabled={!!disabled}
          >
            <X size={16} />
          </Button>
        </>
      )}
    </div>
  );
}

// ... [The rest of TableFieldContent and TableField component remains exactly the same] ...
function TableFieldContent({ field, control, register, errors, disabled = false }: TableFieldProps) {
  const { apiKey, apiSecret } = useAuth();
  const formMethods = useFormContext();

  const { fields, append, remove } = useFieldArray({
    control,
    name: field.name,
  });

  const watchedRows = useWatch({
    control,
    name: field.name,
  });

  const rows = watchedRows || [];

  const { openEditModal, closeEditModal, isEditModalOpen, editingRowIndex } = useTableRowContext();
  const [selectedIndices, setSelectedIndices] = React.useState<Set<number>>(new Set());

  const handleTableInputChange = React.useCallback(async (rowIndex: number, fieldName: string, value: any) => {
    if (disabled) return;

    formMethods.setValue(`${field.name}.${rowIndex}.${fieldName}`, value, { shouldDirty: true });

    // 🟢 Real-time calculation for Expenditure table in the grid
    if (field.name === "expenditure_details") {
      const currentRow = (formMethods.getValues(field.name) || [])[rowIndex] || {};
      const newRow = { ...currentRow, [fieldName]: value };

      if (fieldName === "custom_basic_amount" || fieldName === "custom_insurance" || fieldName === "custom_gst") {
        const basic = parseFloat(newRow.custom_basic_amount) || 0;
        const ins = parseFloat(newRow.custom_insurance) || 0;
        const gstStr = newRow.custom_gst ? newRow.custom_gst.toString().replace("%", "").trim() : "0";
        const gst = parseFloat(gstStr) || 0;

        const totalBase = basic + ins;
        const gstAmount = totalBase * (gst / 100);
        const rowTotal = Number((totalBase + gstAmount).toFixed(2));
        formMethods.setValue(`${field.name}.${rowIndex}.bill_amount`, rowTotal, { shouldDirty: true });

        // Check logic removed as per request
      }
    }

    const dependentColumns = field.columns?.filter(col =>
      col.fetchFrom && col.fetchFrom.sourceField === fieldName
    );

    if (dependentColumns && dependentColumns.length > 0) {
      if (!value || value === "") {
        dependentColumns.forEach(col => {
          formMethods.setValue(`${field.name}.${rowIndex}.${col.name}`, "", { shouldDirty: true });
        });
      } else {
        try {
          const targetDoctype = dependentColumns[0].fetchFrom!.targetDoctype;
          const response = await axios.get(
            `${API_BASE_URL}/${targetDoctype}/${value}`,
            {
              headers: { Authorization: `token ${apiKey}:${apiSecret}` },
              withCredentials: true,
            }
          );
          const fetchedDoc = response.data.data;
          if (fetchedDoc) {
            dependentColumns.forEach(col => {
              const targetField = col.fetchFrom!.targetField;
              const fetchedValue = fetchedDoc[targetField];
              formMethods.setValue(`${field.name}.${rowIndex}.${col.name}`, fetchedValue, { shouldDirty: true });
            });
          }
        } catch (err) {
          console.error("Fetch failed", err);
        }
      }
    }
  }, [field.name, field.columns, formMethods, apiKey, apiSecret, disabled]);

  const addRow = React.useCallback(() => {
    if (disabled) return;
    const row: any = { id: Date.now().toString() + Math.random() };
    (field.columns || []).forEach((c) => {
      row[c.name] = c.defaultValue !== undefined ? c.defaultValue : "";
    });
    append(row);
  }, [field.columns, append, disabled]);

  const toggleRow = (index: number) => {
    if (disabled) return;
    const newSel = new Set(selectedIndices);
    newSel.has(index) ? newSel.delete(index) : newSel.add(index);
    setSelectedIndices(newSel);
  };

  const toggleSelectAll = () => {
    if (disabled) return;
    setSelectedIndices(
      selectedIndices.size === fields.length
        ? new Set()
        : new Set(fields.map((_, i) => i))
    );
  };

  const deleteSelected = () => {
    if (disabled) return;
    const toRemove = Array.from(selectedIndices).sort((a, b) => b - a);
    remove(toRemove);
    setSelectedIndices(new Set());
  };

  const handleEdit = (index: number) => {
    openEditModal(index);
  };

  const handleEditSubmit = (data: Record<string, any>) => {
    if (editingRowIndex !== null) {
      Object.keys(data).forEach(key => {
        formMethods.setValue(`${field.name}.${editingRowIndex}.${key}`, data[key], { shouldDirty: true });
      });
    }
    closeEditModal();
  };

  const handleEditCancel = () => {
    closeEditModal();
  };

  const handleDownload = () => {
    const headers = (field.columns || []).map(c => {
      let label = c.label || '';
      if (label.includes(',') || label.includes('\n') || label.includes('"')) {
        label = `"${label.replace(/"/g, '""')}"`;
      }
      return label;
    }).join(',');

    const csvRows = rows.map((row: any) =>
      (field.columns || []).map(c => {
        let val = row[c.name] === null || row[c.name] === undefined ? "" : String(row[c.name]);
        if (val.includes(',') || val.includes('\n') || val.includes('"')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    );

    const csvContent = [headers, ...csvRows].join('\n');
    
    // Add UTF-8 BOM to ensure Excel opens Marathi characters correctly
    const BOM = '\ufeff';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${field.label || 'table_data'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      let text = e.target?.result as string;
      
      // Remove BOM if present
      if (text.startsWith('\ufeff')) {
        text = text.substring(1);
      }

      const lines = text.split(/\r?\n/).filter(line => line.trim());

      if (lines.length < 2) {
        alert('File must contain headers and at least one data row');
        return;
      }

      // Improved CSV parsing to handle quoted values with commas
      const parseCSVLine = (line: string) => {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const columnMap = new Map<string, number>();

      (field.columns || []).forEach(col => {
        const headerIndex = headers.findIndex(h =>
          h.toLowerCase() === col.label.toLowerCase()
        );
        if (headerIndex !== -1) {
          columnMap.set(col.name, headerIndex);
        }
      });

      const newRows = lines.slice(1).map((line) => {
        const values = parseCSVLine(line);
        const row: any = { id: Date.now().toString() + Math.random() };

        (field.columns || []).forEach(col => {
          const colIndex = columnMap.get(col.name);
          let val = (colIndex !== undefined && values[colIndex] !== undefined) ? values[colIndex] : '';
          
          // Normalize dates to YYYY-MM-DD if the column is a Date type
          if (col.type === "Date" && val) {
            const parsed = parseSafeDate(val);
            if (parsed) {
              val = parsed.toISOString().split('T')[0];
            }
          }
          
          row[col.name] = val;
        });

        return row;
      });

      // remove(); // Removed to allow appending rows instead of overriding
      newRows.forEach(row => append(row));
      alert(`Successfully imported ${newRows.length} rows`);
    };

    reader.readAsText(file);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  };

  const allSelected = fields.length > 0 && selectedIndices.size === fields.length;
  const someSelected = selectedIndices.size > 0 && selectedIndices.size < fields.length;

  const visibleColumns = (field.columns || []).filter(
    (c) => {
      if (c.type === "Column Break" || c.type === "Section Break") return false;
      if (typeof c.displayDependsOn === 'function') {
        const formValues = formMethods.getValues();
        return c.displayDependsOn(formValues);
      }
      return true;
    }
  );

  return (
    <>
      <div className="form-group" style={{ gridColumn: "1 / -1" }}>
        <label className={`form-label ${field.className || ""}`}>
          {field.label}
        </label>
        <div className="stock-table-container data-driven-table-wrapper">
          <table className="stock-table child-form-table auto-width-data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }} className="child-table-checkbox-cell">
                  <input
                    type="checkbox"
                    className="form-control"
                    style={{ width: 16, height: 16 }}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleSelectAll}
                    aria-label="Select all rows"
                    disabled={disabled}
                  />
                </th>

                {visibleColumns?.map((c) => (
                  <th key={c.name}>{c.label}</th>
                ))}
                <th style={{ width: 60, position: 'sticky', right: 0, zIndex: 10 }} className="child-table-edit-cell">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((fieldItem, idx) => {
                const currentRowData = rows[idx] || {};

                const isRowBaseDisabled = disabled || (field.name === 'custom_tender_extension_history' && idx < rows.length - 1);

                return (
                  <tr
                    key={fieldItem.id}
                    className={selectedIndices.has(idx) ? "row-selected" : ""}
                  >
                    <td className="child-table-checkbox-cell">
                      <input
                        type="checkbox"
                        className="form-control"
                        style={{ width: 16, height: 16 }}
                        checked={selectedIndices.has(idx)}
                        onChange={() => toggleRow(idx)}
                        aria-label={`Select row ${idx + 1}`}
                        disabled={disabled}
                      />
                    </td>

                    {visibleColumns?.map((c) => {
                      const isDisabled = isRowBaseDisabled || (c as any).readOnly || (c as any).disabled;
                      return (
                        <td key={c.name} className="child-table-input-cell">
                          {c.type === "Attach" ? (
                            <AttachmentCell
                              control={formMethods.control}
                              fieldName={`${field.name}.${idx}.${c.name}`}
                              rowIndex={idx}
                              columnName={c.name}
                              onValueChange={(value) => handleTableInputChange(idx, c.name, value)}
                              disabled={isDisabled}
                            />
                          ) : c.type === "Link" ? (
                            <TableLinkCell
                              control={formMethods.control}
                              fieldName={`${field.name}.${idx}.${c.name}`}
                              column={c}
                              onValueChange={(value) => handleTableInputChange(idx, c.name, value)}
                              disabled={isDisabled}
                            />
                          ) : c.type === "Date" ? (
                            <DatePicker
                              selected={parseSafeDate(currentRowData[c.name])}
                              onChange={(date: Date | null) => {
                                handleTableInputChange(idx, c.name, date ? date.toISOString().split('T')[0] : '');
                              }}
                              dateFormat="dd/MM/yyyy"
                              className={cn("form-control-borderless w-full")}
                              placeholderText="DD/MM/YYYY"
                              showYearDropdown
                              scrollableYearDropdown
                              yearDropdownItemNumber={100}
                              withPortal
                              portalId="root"
                              disabled={isDisabled}
                            />
                          ) : c.type === "Data" || c.type === "Small Text" || c.type === "Text" ? (
                            renderTableInput(c, idx, rows, handleTableInputChange, isDisabled)
                          ) : c.type === "Long Text" || c.type === "Markdown Editor" ? (
                            renderTableTextarea(c, idx, rows, handleTableInputChange, isDisabled)
                          ) : c.type === "Code" ? (
                            renderTableTextarea(c, idx, rows, handleTableInputChange, isDisabled)
                          ) : c.type === "Password" ? (
                            <input
                              className="form-control-borderless"
                              type="password"
                              placeholder={c.label}
                              value={currentRowData[c.name] || ""}
                              onChange={(e) => handleTableInputChange(idx, c.name, e.target.value)}
                              disabled={isDisabled}
                            />
                          ) : c.type === "Int" ? (
                            renderTableNumber(c, idx, rows, handleTableInputChange, isDisabled)
                          ) : c.type === "Float" || c.type === "Currency" || c.type === "Percent" ? (
                            renderTableNumber(c, idx, rows, handleTableInputChange, isDisabled)
                          ) : c.type === "Color" ? (
                            renderTableColor(c, idx, rows, handleTableInputChange, isDisabled)
                          ) : c.type === "DateTime" || c.type === "Time" ? (
                            <input
                              className="form-control-borderless"
                              type={c.type === "DateTime" ? "datetime-local" : "time"}
                              placeholder={c.label}
                              value={currentRowData[c.name] || ""}
                              onChange={(e) => handleTableInputChange(idx, c.name, e.target.value)}
                              disabled={isDisabled}
                            />
                          ) : c.type === "Duration" ? (
                            renderTableDuration(c, idx, rows, handleTableInputChange, isDisabled)
                          ) : c.type === "Check" ? (
                            renderTableCheckbox(c, idx, rows, handleTableInputChange, formMethods.getValues("pump_operation") === "stop", isDisabled)
                          ) : c.type === "Select" ? (
                            renderTableSelect(c, idx, rows, handleTableInputChange, isDisabled)
                          ) : c.type === "Barcode" ? (
                            renderTableInput(c, idx, rows, handleTableInputChange, isDisabled)
                          ) : c.type === "Read Only" ? (
                            renderTableReadOnly(c, idx, rows)
                          ) : c.type === "Rating" ? (
                            renderTableRating(c, idx, rows, handleTableInputChange, isDisabled)
                          ) : c.type === "Button" ? (
                            renderTableButton(c, idx, rows)
                          ) : (
                            renderTableInput(c, idx, rows, handleTableInputChange, isDisabled)
                          )}
                        </td>
                      );
                    })}

                    <td style={{ position: 'sticky', right: 0, backgroundColor: 'var(--color-surface, #fff)', zIndex: 10 }} className="child-table-edit-cell">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(idx)}
                        title="Edit row"
                        disabled={isRowBaseDisabled}
                      >
                        <Edit size={16} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" className="btn btn--secondary btn--sm" onClick={addRow}>
              <i className="fas fa-plus" style={{ marginRight: 4 }}></i>
              Add Row
            </button>

            {selectedIndices.size > 0 && (
              <button
                type="button"
                className="btn btn--outline btn--sm btn--destructive"
                onClick={deleteSelected}
                disabled={disabled}
              >
                <i className="fas fa-trash-alt" style={{ marginRight: 4 }}></i>
                Delete ({selectedIndices.size})
              </button>
            )}
          </div>

          {field.showDownloadUpload && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="file"
                ref={uploadInputRef}
                accept=".csv"
                onChange={handleUpload}
                style={{ display: 'none' }}
                disabled={disabled}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownload}
                title="Download as CSV"
                disabled={disabled}
              >
                <Download size={16} className="mr-2" />
                Download
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => uploadInputRef.current?.click()}
                title="Upload from CSV"
                disabled={disabled}
              >
                <UploadIcon size={16} className="mr-2" />
                Upload
              </Button>
            </div>
          )}
        </div>
      </div >

      {isEditModalOpen && editingRowIndex !== null && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={handleEditCancel}
          title={`Edit Row ${editingRowIndex + 1}`}
          size="lg"
        >
          <DynamicFormForTable
            fields={field.columns}
            data={rows[editingRowIndex] || {}}
            onSubmit={handleEditSubmit}
            onCancel={handleEditCancel}
            disabled={disabled}
          />
        </Modal>
      )
      }
    </>
  );
}

export function TableField({ field, control, register, errors, disabled = false }: TableFieldProps) {
  const formMethods = useFormContext();

  const rows = useWatch({
    control,
    name: field.name,
    defaultValue: []
  });

  const handleUpdateRow = React.useCallback((index: number, data: Record<string, any>) => {
    Object.keys(data).forEach(key => {
      formMethods.setValue(`${field.name}.${index}.${key}`, data[key], { shouldDirty: true });
    });
  }, [formMethods, field.name]);

  return (
    <TableRowProvider
      rows={rows || []}
      onUpdateRow={handleUpdateRow}
    >
      <TableFieldContent field={field} control={control} register={register} errors={errors} disabled={disabled} />
    </TableRowProvider>
  );
}