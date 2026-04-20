"use client";

import * as React from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";

interface FieldDef {
  fieldname: string;
  label: string;
  fieldtype: string;
  reqd?: number;
  options?: string;
  parent?: string;
}

interface DoctypeDef {
  name: string;
  fields: FieldDef[];
}

interface DownloadTemplateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  referenceDoctype: string;
  apiKey: string;
  apiSecret: string;
}

export function DownloadTemplateModal({
  isOpen,
  onOpenChange,
  referenceDoctype,
  apiKey,
  apiSecret,
}: DownloadTemplateModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [doctypes, setDoctypes] = React.useState<Record<string, DoctypeDef>>({});
  const [childTableFields, setChildTableFields] = React.useState<FieldDef[]>([]);
  const [selectedFields, setSelectedFields] = React.useState<Record<string, string[]>>({});
  const [fileType, setFileType] = React.useState("CSV");
  const [exportType, setExportType] = React.useState("blank_template");

  const fetchDoctypeDetails = React.useCallback(async (dtName: string) => {
    try {
      // Use getdoctype which is the most comprehensive API for schema, used by Desk
      const url = `http://103.219.3.169:2223/api/method/frappe.desk.form.load.getdoctype`;
      const params = new URLSearchParams();
      params.append("doctype", dtName);

      const resp = await axios.post(url, params.toString(), {
        headers: {
          Authorization: `token ${apiKey}:${apiSecret}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        withCredentials: true
      });

      // getdoctype returns { docs: [ { name: ..., fields: [...] } ] }
      const docSchema = resp.data.docs ? resp.data.docs[0] : null;
      if (!docSchema || !docSchema.fields) {
        throw new Error("No fields found for " + dtName);
      }

      console.log(`Loaded ${docSchema.fields.length} fields for ${dtName}`);
      return {
        name: dtName,
        fields: docSchema.fields
      };
    } catch (e) {
      console.warn(`getdoctype failed for ${dtName}, falling back to get_docfields`, e);
      // Fallback 1: get_docfields
      try {
        const url = `http://103.219.3.169:2223/api/method/frappe.model.meta.get_docfields`;
        const params = new URLSearchParams();
        params.append("doctype", dtName);
        const resp2 = await axios.post(url, params.toString(), {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          withCredentials: true
        });
        return { name: dtName, fields: resp2.data.message || [] };
      } catch (e2) {
        // Fallback 2: resource API
        const resp3 = await axios.get(`http://103.219.3.169:2223/api/resource/DocType/${encodeURIComponent(dtName)}`, {
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
          withCredentials: true
        });
        return resp3.data.data;
      }
    }
  }, [apiKey, apiSecret]);

  const initModal = React.useCallback(async () => {
    if (!referenceDoctype || !isOpen) return;
    setLoading(true);
    try {
      // 1. Fetch Main DocType Schema (includes ALL fields: custom, core, etc.)
      const mainDt = await fetchDoctypeDetails(referenceDoctype);
      const newDoctypes: Record<string, DoctypeDef> = { [referenceDoctype]: mainDt };
      const initialSelected: Record<string, string[]> = {
        [referenceDoctype]: ["name"] // Always include ID
      };

      // 2. Identify and fetch Child Tables
      const tables = mainDt.fields.filter((f: any) => f.fieldtype === "Table");
      setChildTableFields(tables);

      for (const tableField of tables) {
        if (tableField.options) {
          try {
            const tableDt = await fetchDoctypeDetails(tableField.options);
            newDoctypes[tableField.options] = tableDt;
            initialSelected[tableField.fieldname] = ["name"];
          } catch (e) {
            console.error(`Failed to fetch child table schema for ${tableField.options}`, e);
          }
        }
      }

      // Add mandatory fields to selection by default
      Object.keys(newDoctypes).forEach(dtName => {
        const dt = newDoctypes[dtName];
        if (!dt || !dt.fields) return;

        const mandatory = dt.fields
          .filter(f => f.reqd && !["Section Break", "Column Break", "Table"].includes(f.fieldtype))
          .map(f => f.fieldname);

        // Find if this doctype is the main one or a child table field name
        const key = dtName === referenceDoctype
          ? referenceDoctype
          : tables.find((t: any) => t.options === dtName)?.fieldname;

        if (key) {
          initialSelected[key] = Array.from(new Set([...(initialSelected[key] || []), ...mandatory]));
        }
      });

      setDoctypes(newDoctypes);
      setSelectedFields(initialSelected);
    } catch (err) {
      console.error("Init Modal Error:", err);
      toast.error("Failed to load schema for " + referenceDoctype);
    } finally {
      setLoading(false);
    }
  }, [referenceDoctype, isOpen, fetchDoctypeDetails]);

  React.useEffect(() => {
    if (isOpen) {
      initModal();
    } else {
      setDoctypes({});
      setChildTableFields([]);
    }
  }, [isOpen, initModal]);

  const handleToggleField = (groupKey: string, fieldname: string) => {
    setSelectedFields((prev) => {
      const current = prev[groupKey] || [];
      if (current.includes(fieldname)) {
        return { ...prev, [groupKey]: current.filter((f) => f !== fieldname) };
      } else {
        return { ...prev, [groupKey]: [...current, fieldname] };
      }
    });
  };

  const selectAll = () => {
    const next: Record<string, string[]> = {};
    // Main DocType
    next[referenceDoctype] = ["name", ...doctypes[referenceDoctype].fields
      .filter(f => !["Section Break", "Column Break", "Table"].includes(f.fieldtype))
      .map(f => f.fieldname)];

    // Child Tables
    childTableFields.forEach(t => {
      const dt = doctypes[t.options!];
      if (dt) {
        next[t.fieldname] = ["name", ...dt.fields
          .filter(f => !["Section Break", "Column Break", "Table"].includes(f.fieldtype))
          .map(f => f.fieldname)];
      }
    });
    setSelectedFields(next);
  };

  const unselectAll = () => {
    const next: Record<string, string[]> = {};
    next[referenceDoctype] = ["name"];
    childTableFields.forEach(t => { next[t.fieldname] = ["name"]; });
    setSelectedFields(next);
  };

  const handleExport = async () => {
    if (!referenceDoctype) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("doctype", referenceDoctype);
      params.append("export_fields", JSON.stringify(selectedFields));
      params.append("export_records", exportType);
      params.append("file_type", fileType);

      const response = await axios.post(
        `http://103.219.3.169:2223/api/method/frappe.core.doctype.data_import.data_import.download_template`,
        params.toString(),
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          responseType: "blob",
          withCredentials: true,
        }
      );

      const blob = new Blob([response.data], {
        type: fileType === "CSV" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${referenceDoctype}_Template.${fileType === "CSV" ? "csv" : "xlsx"}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Template downloaded successfully!");
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to download template.");
    } finally {
      setLoading(false);
    }
  };

  const renderFieldGroup = (title: string, groupKey: string, fields: FieldDef[]) => (
    <div key={groupKey} className="space-y-3 border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b pb-2">
        <h4 className="font-bold text-slate-800 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          {title}
        </h4>
        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">
          {groupKey}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1">
        {[{ fieldname: "name", label: "ID", reqd: 1, fieldtype: "Data" }, ...fields]
          .filter(f => !["Section Break", "Column Break", "Table"].includes(f.fieldtype))
          .map(field => (
            <div key={field.fieldname} className="flex items-center space-x-3 group cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors"
              onClick={() => handleToggleField(groupKey, field.fieldname)}>
              <Checkbox
                id={`${groupKey}-${field.fieldname}`}
                checked={(selectedFields[groupKey] || []).includes(field.fieldname)}
                onCheckedChange={() => handleToggleField(groupKey, field.fieldname)}
              />
              <label
                htmlFor={`${groupKey}-${field.fieldname}`}
                className={`text-sm leading-none cursor-pointer flex-1 truncate ${field.reqd ? "text-orange-600 font-semibold" : "text-slate-600"}`}
              >
                {field.label} {field.reqd ? "*" : ""}
              </label>
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 border-b">
          <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Export Data Template
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              <p className="text-slate-500 font-medium">Loading Document Schema...</p>
            </div>
          ) : (
            <>
              {/* Configuration Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500 ml-1">File Type</label>
                  <Select value={fileType} onValueChange={setFileType}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select file type" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="Excel">Excel</SelectItem>
                      <SelectItem value="CSV">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500 ml-1">Export Type</label>
                  <Select value={exportType} onValueChange={setExportType}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select export type" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]" position="popper" sideOffset={4}>
                      <SelectItem value="all">All Records</SelectItem>
                      <SelectItem value="by_filter">Filtered Records</SelectItem>
                      <SelectItem value="5_records">5 Records</SelectItem>
                      <SelectItem value="blank_template">Blank Template</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Field Selection Section */}
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 bg-white py-2 z-10 border-b border-dashed">
                  <h3 className="text-lg font-bold text-slate-800">Field Selection</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll} className="text-xs">
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={unselectAll} className="text-xs">
                      Unselect All
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Main DocType Fields */}
                  {doctypes[referenceDoctype] && renderFieldGroup(
                    referenceDoctype,
                    referenceDoctype,
                    doctypes[referenceDoctype].fields
                  )}

                  {/* Child Table Fields */}
                  {childTableFields.map(tableField => {
                    const dt = doctypes[tableField.options!];
                    if (!dt) return null;
                    return renderFieldGroup(
                      `${tableField.label} (${tableField.options})`,
                      tableField.fieldname,
                      dt.fields
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-slate-50 rounded-b-lg">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={loading} className="px-8 bg-blue-600 hover:bg-blue-700">
            {loading ? "Preparing..." : "Download Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
