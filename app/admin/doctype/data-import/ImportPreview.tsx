"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Map, Download, Info } from "lucide-react";
import { toast } from "sonner";

interface Column {
  header_title: string;
  df?: {
    label: string;
    fieldname: string;
  };
  skip_import?: boolean;
}

interface PreviewData {
  columns: Column[];
  data: any[][];
  warnings: string[];
  max_rows_exceeded?: boolean;
  total_number_of_rows?: number;
}

interface ImportPreviewProps {
  doctype: string;
  previewData: PreviewData;
  onRefresh: () => void;
  status: string;
}

export function ImportPreview({ doctype, previewData, onRefresh, status }: ImportPreviewProps) {
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [docFields, setDocFields] = useState<any[]>([]);

  // In a real app, you'd fetch docfields to allow re-mapping
  useEffect(() => {
    if (isMappingModalOpen) {
      // Mock fetching fields for mapping
      // In production, fetch via API: /api/method/frappe.model.meta.get_docfields
    }
  }, [isMappingModalOpen]);

  if (!previewData || !previewData.columns) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-slate-50 rounded-xl border-2 border-dashed">
        <Info className="h-10 w-10 mb-4 opacity-20" />
        <p>No preview data available. Upload a file to see the preview.</p>
      </div>
    );
  }

  const { columns, data, warnings } = previewData;

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">
            {previewData.total_number_of_rows || data.length} Records Found
          </Badge>
          {warnings && warnings.length > 0 && (
            <Badge variant="destructive" className="flex gap-1 items-center">
              <AlertCircle className="h-3 w-3" />
              {warnings.length} Warnings
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status !== "Success" && (
            <Button
              variant="outline"
              size="sm"
              className="flex gap-2"
              onClick={() => setIsMappingModalOpen(true)}
            >
              <Map className="h-4 w-4" />
              Map Columns
            </Button>
          )}
          {status === "Partial Success" && (
            <Button variant="outline" size="sm" className="flex gap-2">
              <Download className="h-4 w-4" />
              Export Errored Rows
            </Button>
          )}
        </div>
      </div>

      {/* Warnings Panel */}
      {warnings && warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 space-y-1">
          <p className="font-bold flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4" />
            Please resolve the following warnings:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview Table */}
      <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10">
              <TableRow>
                {columns.map((col, i) => (
                  <TableHead key={i} className="min-w-[150px] font-semibold text-slate-900 border-r last:border-r-0">
                    <div className="space-y-1 py-2">
                      <div className="flex items-center justify-between">
                        <span className="truncate" title={col.header_title}>
                          {col.header_title}
                        </span>
                        {col.skip_import ? (
                          <Badge variant="outline" className="text-[10px] bg-slate-100 uppercase">Skip</Badge>
                        ) : (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">
                        {col.df?.fieldname || "—"}
                      </div>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, rowIndex) => (
                <TableRow key={rowIndex} className="hover:bg-slate-50/50 transition-colors">
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex} className="text-xs border-r last:border-r-0 py-2">
                      {cell === null || cell === "" ? (
                        <span className="text-slate-300 italic">empty</span>
                      ) : (
                        cell.toString()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Column Mapping Modal (Stub) */}
      <Dialog open={isMappingModalOpen} onOpenChange={setIsMappingModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Map Columns</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-4 pr-2">
            <p className="text-sm text-muted-foreground">
              Map the columns from your file ({doctype}) to the fields in the system.
            </p>
            <div className="grid grid-cols-2 gap-4 font-semibold text-xs uppercase text-slate-500 px-2">
              <div>File Column</div>
              <div>System Field</div>
            </div>
            {columns.map((col, i) => (
              <div key={i} className="grid grid-cols-2 gap-4 items-center p-2 rounded-lg bg-slate-50 border group hover:border-blue-200 transition-colors">
                <div className="text-sm font-medium truncate" title={col.header_title}>
                  {col.header_title}
                </div>
                <Select defaultValue={col.df?.fieldname || "skip"}>
                  <SelectTrigger className="h-9 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Don't Import</SelectItem>
                    {col.df && (
                      <SelectItem value={col.df.fieldname}>{col.df.label}</SelectItem>
                    )}
                    {/* Map additional docfields here */}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsMappingModalOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              toast.success("Mappings updated. Refreshing preview...");
              setIsMappingModalOpen(false);
              onRefresh();
            }}>Save Mappings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
