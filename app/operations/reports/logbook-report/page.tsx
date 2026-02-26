"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { LinkInput } from "@/components/LinkInput";
import { useAuth } from "@/context/AuthContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// --- API Configuration ---
const API_BASE_URL = "http://103.219.3.169:2223/";
const REPORT_API_PATH = "api/method/frappe.desk.query_report.run";
const REPORT_NAME = "Logbook Ledger";

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
  lis_name: string;
  stage: string;
  asset: string;
  status: string;
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
// Ensure these fieldnames match exactly what Frappe returns
const FIXED_COLUMNS_ORDER = [
    { fieldname: "name", label: "Logbook ID", width: 100 }, // Assuming 'name' is the ID
    { fieldname: "lis_name", label: "LIS", width: 100 },
    { fieldname: "stage", label: "Stage", width: 140 },
    { fieldname: "asset", label: "Asset", width: 180 },
    { fieldname: "asset_no", label: "Asset No", width: 50 }
];

// --- Helper Functions ---

const formatDateForAPI = (date: Date | null): string => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-GB"); 
};

const formatCurrency = (value: number | string): string => {
   if (!value) return "-";
   return `₹ ${parseFloat(String(value)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
};

const formatDuration = (value: any): string => {
    if (value === null || value === undefined || value === "") return "00:00";
    
    const num = Number(value);
    if (isNaN(num)) return "00:00";

    const totalMinutes = Math.round(num * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');

    return `${hh}:${mm}`;
};

export default function LogBookSheetReportPage() {
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

  const [filters, setFilters] = useState<Filters>({
    from_date: "",
    to_date: "",
    lis_name: "",
    stage: "",
    asset: "",
    status: "",
  });

  // --- Dynamic Column Configuration ---
  const getFieldFormatter = (fieldtype: string, fieldname: string) => {
      // Special handling for operator_id field - display operator_name instead
      if (fieldname === 'operator_id') {
          return (value: any, row?: ReportData) => {
              return row?.['operator_name'] || value || "-";
          };
      }
      
      switch (fieldtype) {
          case "Datetime": return formatDateTime;
          case "Date": return (val: string) => val ? new Date(val).toLocaleDateString("en-GB") : "-";
          case "Currency": return formatCurrency;
          case "Float": return formatDuration; 
          default: return undefined;
      }
  };

  // --- MODIFIED: Column Logic with Sticky Calculations ---
  const columnConfig = useMemo((): ColumnConfig[] => {
    if (apiFields.length === 0) return [];

    // 1. Separate Fixed columns from Scrollable columns
    let fixedCols: ColumnConfig[] = [];
    let scrollableCols: ColumnConfig[] = [];
    
    // Create a map for quick lookup of API fields
    const apiFieldMap = new Map(apiFields.map(f => [f.fieldname, f]));

    // Process Fixed Columns based on defined order
    FIXED_COLUMNS_ORDER.forEach(fixedDef => {
        const apiField = apiFieldMap.get(fixedDef.fieldname);
        // We include it even if API didn't return it (optional), or only if it exists
        if (apiField) {
            fixedCols.push({
                fieldname: apiField.fieldname,
                label: apiField.label, // Use label from API or Config
                width: `${fixedDef.width}px`,
                widthInt: fixedDef.width,
                formatter: getFieldFormatter(apiField.fieldtype, apiField.fieldname),
                isSticky: true,
                stickyLeft: 0 // Will calculate below
            });
            apiFieldMap.delete(fixedDef.fieldname); // Remove from map so we don't add it again
        }
    });

    // Process remaining fields as Scrollable
    apiFields.forEach(field => {
        if (apiFieldMap.has(field.fieldname)) {
            const width = field.width || 150;
            scrollableCols.push({
                fieldname: field.fieldname,
                label: field.label,
                width: `${width}px`,
                widthInt: width,
                formatter: getFieldFormatter(field.fieldtype, field.fieldname),
                isSticky: false
            });
        }
    });

    // 2. Calculate Left Offsets for Sticky Columns
    let currentLeftOffset = 0;
    fixedCols = fixedCols.map(col => {
        const updatedCol = { ...col, stickyLeft: currentLeftOffset };
        currentLeftOffset += col.widthInt;
        return updatedCol;
    });

    // 3. Combine
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
        setReportData(result.message.result || []);
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
    const timer = setTimeout(() => {
      fetchReportData(filters);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters, fetchReportData]);

  // --- Handlers ---
  const handleExportCSV = () => {
    if (reportData.length === 0) return;
    const headers = columnConfig.map(c => c.label).join(",");
    const rows = reportData.map(row => {
      return columnConfig.map(col => {
        let val = row[col.fieldname];
        if (col.formatter) {
             val = col.formatter(val, row);
        } else {
             val = val === null || val === undefined ? "" : String(val);
        }
        if (val.includes(",") || val.includes("\n") || val.includes('"')) {
            val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(",");
    }).join("\n");

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + headers + "\n" + rows);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = "logbook_report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [field]: value };
      if (field === 'lis_name') { newFilters.stage = ""; newFilters.asset = ""; }
      if (field === 'stage') { newFilters.asset = ""; }
      return newFilters;
    });
  };

  const totalTableWidth = useMemo(() => {
    return columnConfig.reduce((total, col) => total + col.widthInt, 0);
  }, [columnConfig]);

  const renderCellValue = (row: ReportData, col: ColumnConfig) => {
    const value = row[col.fieldname];
    if (value === null || value === undefined || value === "") return "-";
    if (col.formatter) return col.formatter(value, row);
    return String(value);
  };

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
    const walk = (x - dragState.startX) * 1.5; // Optimized scroll speed
    tableRef.current.scrollLeft = dragState.scrollLeft - walk;
  };

  const handleMouseUp = useCallback(() => {
    setDragState(prev => ({ ...prev, isGrabbing: false }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setDragState(prev => ({ ...prev, isGrabbing: false }));
  }, []);

  // Global mouse up handler for better UX
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
    <div className="module active">
      <div className="module-header">
        <div>
          <h2>Logbook Ledger</h2>
          <p>Track pump running hours and operator entries.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn--primary" onClick={() => fetchReportData(filters)} disabled={loading}>
            <i className="fas fa-sync-alt"></i> {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn btn--outline" onClick={handleExportCSV}>
             <i className="fas fa-file-csv"></i> CSV
          </button>
        </div>
      </div>

      <div className="tab-content active relative">
        {error && <div className="alert alert--danger mb-5"><i className="fas fa-exclamation-triangle"></i> {error}</div>}
        {loading && !reportData.length && <div className="alert alert--info mb-5"><i className="fas fa-spinner fa-spin"></i> Loading...</div>}

        <div className="filters-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 relative z-[60]">
          {/* Filters remain the same as your original code */}
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
          <div className="form-group z-[110]">
            <label className="text-sm font-medium mb-1 block">LIS</label>
            <LinkInput value={filters.lis_name} onChange={(v) => handleFilterChange("lis_name", v)} placeholder="Select LIS..." linkTarget="Lift Irrigation Scheme" className="w-full relative" />
          </div>
          <div className="form-group relative z-[110]">
            <label className="text-sm font-medium mb-1 block">Stage</label>
            <LinkInput value={filters.stage} onChange={(v) => handleFilterChange("stage", v)} placeholder="Select Stage..." linkTarget="Stage No" className="w-full" filters={{ lis_name: filters.lis_name || undefined }} />
          </div>
          <div className="form-group z-[50]">
            <label className="text-sm font-medium mb-1 block">Asset Name</label>
            <LinkInput value={filters.asset} onChange={(v) => handleFilterChange("asset", v)} placeholder="Select Asset..." linkTarget="Asset" className="w-full relative" filters={{ custom_lis_name: filters.lis_name || undefined, custom_stage_no: filters.stage || undefined, asset_category: "Pump" }} />
          </div>
          <div className="form-group z-[50]">
            <label className="text-sm font-medium mb-1 block">Status</label>
            <select className="form-control w-full" value={filters.status} onChange={(e) => handleFilterChange("status", e.target.value)}>
              <option value="">All</option>
              <option value="Running">Running</option>
              <option value="Stopped">Stopped</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>

        {/* --- TABLE CONTAINER --- */}
        <div
          ref={tableRef}
          className="stock-table-container border rounded-md relative z-10"
          style={{
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: "70vh",
            cursor: dragState.isGrabbing ? "grabbing" : "grab",
            userSelect: dragState.isGrabbing ? "none" : "auto",
            willChange: dragState.isGrabbing ? "transform" : "auto",
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
                        // Sticky Logic for Header
                        position: column.isSticky ? "sticky" : "relative",
                        left: column.isSticky ? `${column.stickyLeft}px` : "auto",
                        zIndex: column.isSticky ? 30 : 20, // Sticky headers higher than normal headers
                        backgroundColor: "#3683f6", // Blue background matching stock-table style
                        color: "white", // White text for blue background
                        borderRight: column.isSticky ? "none" : "none", // Remove border divider
                        boxShadow: column.isSticky && column.fieldname === "asset_no" ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none" // Shadow on last sticky col
                    }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.length === 0 ? (
                <tr><td colSpan={Math.max(columnConfig.length, 1)} className="text-center p-10">{loading ? "Fetching..." : "No records found"}</td></tr>
              ) : (
                reportData.map((row, index) => (
                  <tr key={index}>
                    {columnConfig.map((column) => (
                      <td 
                        key={`${index}-${column.fieldname}`}
                        style={{
                            // Sticky Logic for Body
                            position: column.isSticky ? "sticky" : "relative",
                            left: column.isSticky ? `${column.stickyLeft}px` : "auto",
                            zIndex: column.isSticky ? 10 : 1, // Sticky body higher than normal body
                            backgroundColor: "white", // CRITICAL: Opaque background so text doesn't overlap
                            borderRight: column.isSticky ? "none" : "none",
                            boxShadow: column.isSticky && column.fieldname === "asset_no" ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none"
                        }}
                      >
                        {renderCellValue(row, column)}
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
  );
}