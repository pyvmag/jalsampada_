"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { LinkInput } from "@/components/LinkInput";
import { useAuth } from "@/context/AuthContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// --- API Configuration ---
const API_BASE_URL = "http://103.219.1.138:4412/";
const REPORT_API_PATH = "api/method/frappe.desk.query_report.run";
const REPORT_NAME = "Pump Hour Report";

// --- Type Definitions ---
type ReportField = {
  label: string;
  fieldname: string;
  fieldtype: string;
  options?: string;
  width?: number;
};

type ReportData = Record<string, any>;

type Filters = {
  from_date: string;
  to_date: string;
};

type ColumnConfig = {
  fieldname: string;
  label: string;
  width: string; // "150px"
  widthInt: number; // 150 (numeric for calculations)
  isHtml?: boolean;
  formatter?: (value: any, row?: ReportData) => string;
  // Sticky Logic
  isSticky?: boolean;
  stickyLeft?: number;
};

// --- CONFIG: Define Fixed Columns Order & Widths ---
// We keep 'asset' and 'asset_no' fixed for better usability
const FIXED_COLUMNS_ORDER = [
  { fieldname: "asset", label: "Asset", width: 200 },
  { fieldname: "asset_no", label: "Asset No", width: 120 }
];

// --- Helper Functions ---

const formatDateForAPI = (date: Date | null): string => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function PumpHourReportPage() {
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  // --- State ---
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [apiFields, setApiFields] = useState<ReportField[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState({
    isGrabbing: false,
    startX: 0,
    scrollLeft: 0,
  });

  // Default dates as requested: From 2026-01-01 to 2026-01-31
  const [filters, setFilters] = useState<Filters>({
    from_date: "2026-01-01",
    to_date: "2026-01-31",
  });

  // --- Dynamic Column Configuration ---
  const columnConfig = useMemo((): ColumnConfig[] => {
    // If we don't have fields from API yet, use default ones
    const fieldsToUse = apiFields.length > 0 ? apiFields : [
      { fieldname: "asset", label: "Asset", fieldtype: "Link", width: 200 },
      { fieldname: "asset_no", label: "Asset No", fieldtype: "Data", width: 120 },
      { fieldname: "running_hours_range", label: "Running Hours (Date Range)", fieldtype: "Data", width: 180 },
      { fieldname: "total_running_hours", label: "Total Running Hours (Lifetime)", fieldtype: "Data", width: 200 },
    ];

    let fixedCols: ColumnConfig[] = [];
    let scrollableCols: ColumnConfig[] = [];

    const apiFieldMap = new Map(fieldsToUse.map(f => [f.fieldname, f]));

    // Process Fixed Columns
    FIXED_COLUMNS_ORDER.forEach(fixedDef => {
      const apiField = apiFieldMap.get(fixedDef.fieldname);
      if (apiField) {
        fixedCols.push({
          fieldname: apiField.fieldname,
          label: apiField.label,
          width: `${fixedDef.width}px`,
          widthInt: fixedDef.width,
          isSticky: true,
          stickyLeft: 0
        });
        apiFieldMap.delete(fixedDef.fieldname);
      }
    });

    // Process remaining fields
    fieldsToUse.forEach(field => {
      if (apiFieldMap.has(field.fieldname)) {
        const width = field.width || 150;
        scrollableCols.push({
          fieldname: field.fieldname,
          label: field.label,
          width: `${width}px`,
          widthInt: width,
          isSticky: false
        });
      }
    });

    // Calculate sticky positions
    let currentLeftOffset = 0;
    fixedCols = fixedCols.map(col => {
      const updatedCol = { ...col, stickyLeft: currentLeftOffset };
      currentLeftOffset += col.widthInt;
      return updatedCol;
    });

    return [...fixedCols, ...scrollableCols];
  }, [apiFields]);

  // --- Actions ---
  const fetchReportData = useCallback(async (currentFilters: Filters) => {
    if (!isInitialized) return;
    if (!isAuthenticated || !apiKey || !apiSecret) {
      setError("Please log in to view this report.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cleanedFilters: Record<string, string> = {};
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value && value.trim() !== "") {
          cleanedFilters[key] = value;
        }
      });

      const params = new URLSearchParams({
        report_name: REPORT_NAME,
        filters: JSON.stringify(cleanedFilters)
      });

      const response = await fetch(
        `${API_BASE_URL}${REPORT_API_PATH}?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `token ${apiKey}:${apiSecret}`
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch data");

      const result = await response.json();

      if (result.message) {
        setApiFields(result.message.columns || []);
        // Handle result being either list of lists or list of dicts
        let formattedResult = result.message.result || [];
        if (formattedResult.length > 0 && Array.isArray(formattedResult[0])) {
          // Convert list of lists to list of dicts using columns
          const columnKeys = (result.message.columns || []).map((c: any) => c.fieldname);
          formattedResult = formattedResult.map((row: any[]) => {
            const obj: Record<string, any> = {};
            columnKeys.forEach((key: string, i: number) => {
              obj[key] = row[i];
            });
            return obj;
          });
        }
        setReportData(formattedResult);
      } else {
        setApiFields([]);
        setReportData([]);
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [apiKey, apiSecret, isAuthenticated, isInitialized]);

  // --- Effects ---
  useEffect(() => {
    if (!isInitialized) return;
    const timer = setTimeout(() => {
      fetchReportData(filters);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters, fetchReportData, isInitialized]);

  // --- Handlers ---
  const handleExportCSV = () => {
    if (reportData.length === 0) return;
    const headers = columnConfig.map(c => c.label).join(",");
    const rows = reportData.map(row => {
      return columnConfig.map(col => {
        let val = row[col.fieldname];
        val = val === null || val === undefined ? "" : String(val);
        if (val.includes(",") || val.includes("\n") || val.includes('"')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(",");
    }).join("\n");

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + headers + "\n" + rows);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = "pump_hour_report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const totalTableWidth = useMemo(() => {
    return columnConfig.reduce((total, col) => total + col.widthInt, 0);
  }, [columnConfig]);

  // --- Horizontal Scroll Drag Handlers ---
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tableRef.current) return;
    setDragState({
      isGrabbing: true,
      startX: e.pageX - tableRef.current.offsetLeft,
      scrollLeft: tableRef.current.scrollLeft,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState.isGrabbing || !tableRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableRef.current.offsetLeft;
    const walk = (x - dragState.startX) * 1.5;
    tableRef.current.scrollLeft = dragState.scrollLeft - walk;
  };

  const handleMouseUp = useCallback(() => {
    setDragState(prev => ({ ...prev, isGrabbing: false }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setDragState(prev => ({ ...prev, isGrabbing: false }));
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragState.isGrabbing) {
        setDragState(prev => ({ ...prev, isGrabbing: false }));
      }
    };
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragState.isGrabbing]);

  return (
    <>
      <div className="module active print:hidden">
        <div className="module-header">
          <div>
            <h2>Pump Hour Report</h2>
            <p>Report showing running hours for pumps within a period and lifetime.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn--primary" onClick={() => fetchReportData(filters)} disabled={loading}>
              <i className="fas fa-sync-alt"></i> {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button className="btn btn--outline" onClick={handleExportCSV}>
              <i className="fas fa-file-csv"></i> CSV
            </button>
            <button className="btn btn--outline" onClick={() => window.print()} disabled={reportData.length === 0 || loading}>
              <i className="fas fa-print"></i> Print
            </button>
          </div>
        </div>

        <div className="tab-content active relative">
          {error && <div className="alert alert--danger mb-5"><i className="fas fa-exclamation-triangle"></i> {error}</div>}
          
          <div className="filters-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 relative z-[60]">
            <div className="form-group z-[150]">
              <label className="text-sm font-medium mb-1 block">From Date</label>
              <DatePicker
                selected={filters.from_date ? new Date(filters.from_date) : null}
                onChange={(date: Date | null) => handleFilterChange("from_date", formatDateForAPI(date))}
                placeholderText="DD/MM/YYYY"
                dateFormat="dd/MM/yyyy"
                className="form-control w-full"
              />
            </div>
            <div className="form-group z-[150]">
              <label className="text-sm font-medium mb-1 block">To Date</label>
              <DatePicker
                selected={filters.to_date ? new Date(filters.to_date) : null}
                onChange={(date: Date | null) => handleFilterChange("to_date", formatDateForAPI(date))}
                placeholderText="DD/MM/YYYY"
                dateFormat="dd/MM/yyyy"
                className="form-control w-full"
              />
            </div>
          </div>

          <div
            ref={tableRef}
            className="stock-table-container border rounded-md relative z-10"
            style={{
              overflowX: "auto",
              overflowY: "auto",
              maxHeight: "70vh",
              cursor: dragState.isGrabbing ? "grabbing" : "grab",
              userSelect: dragState.isGrabbing ? "none" : "auto",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            <table className="stock-table sticky-header-table" style={{ minWidth: `${totalTableWidth}px`, borderCollapse: "separate", borderSpacing: 0 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 30 }}>
                <tr>
                  {columnConfig.map((column) => (
                    <th
                      key={column.fieldname}
                      style={{
                        width: column.width,
                        minWidth: column.width,
                        position: column.isSticky ? "sticky" : "relative",
                        left: column.isSticky ? `${column.stickyLeft}px` : "auto",
                        zIndex: column.isSticky ? 30 : 20,
                        backgroundColor: "#3683f6",
                        color: "white",
                        boxShadow: column.isSticky && column.fieldname === "asset_no" ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none"
                      }}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && reportData.length === 0 ? (
                  <tr><td colSpan={columnConfig.length} className="text-center p-10"><i className="fas fa-spinner fa-spin"></i> Loading...</td></tr>
                ) : reportData.length === 0 ? (
                  <tr><td colSpan={columnConfig.length} className="text-center p-10">No records found</td></tr>
                ) : (
                  reportData.map((row, index) => (
                    <tr key={index}>
                      {columnConfig.map((column) => (
                        <td
                          key={`${index}-${column.fieldname}`}
                          style={{
                            position: column.isSticky ? "sticky" : "relative",
                            left: column.isSticky ? `${column.stickyLeft}px` : "auto",
                            zIndex: column.isSticky ? 10 : 1,
                            backgroundColor: "white",
                            boxShadow: column.isSticky && column.fieldname === "asset_no" ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none"
                          }}
                        >
                          {row[column.fieldname] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- PRINT ONLY LAYOUT --- */}
      <div className="print-only-layout w-full bg-white text-black">
        <style>{`
          .print-only-layout { display: none; }
          @media print {
            .print-only-layout { display: block !important; }
            @page { margin: 10mm; }
            html, body { height: auto !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0 !important; margin: 0 !important; background: white !important; }
            .module.active { display: none !important; }
            .header, .sidebar, .footer, .mobile-overlay { display: none !important; }
          }
        `}</style>
        <div className="text-center mb-8 font-bold">
          <h2 className="text-2xl border-b-2 border-black pb-2 mb-4">Pump Hour Report</h2>
          <p className="text-sm">Period: {filters.from_date} to {filters.to_date}</p>
        </div>

        <table className="w-full border-collapse border-2 border-black text-sm text-center">
          <thead>
            <tr>
              {columnConfig.map(col => (
                <th key={col.fieldname} className="border-2 border-black p-2 font-bold bg-gray-100">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, idx) => (
              <tr key={idx}>
                {columnConfig.map(col => (
                  <td key={col.fieldname} className="border border-black p-2">{row[col.fieldname] || "-"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
