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
const REPORT_NAME = "Pump Expenditure Report";

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
  lis_name: string;
  stage: string;
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
  isLastSticky?: boolean;
};

// --- CONFIG: Define Fixed Columns Order & Widths ---
const FIXED_COLUMNS_ORDER = [
  { fieldname: "sr_no", label: "Sr. No.", width: 60 },
  { fieldname: "description", label: "Description", width: 250 }
];

// --- Helper Functions ---

const formatDateForAPI = (date: Date | null): string => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value: number | string): string => {
  if (!value) return "";
  return `₹ ${parseFloat(String(value)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
};

const getToday = () => new Date().toISOString().split('T')[0];

const getOneMonthAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split('T')[0];
};

export default function PumpExpenditureReportPage() {
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
    lis_name: "",
    stage: "",
    from_date: getOneMonthAgo(),
    to_date: getToday(),
  });

  // --- Dynamic Column Configuration ---
  const columnConfig = useMemo((): ColumnConfig[] => {
    if (apiFields.length === 0) return [];

    let fixedCols: ColumnConfig[] = [];
    let scrollableCols: ColumnConfig[] = [];

    const apiFieldMap = new Map(apiFields.map(f => [f.fieldname, f]));
    let currentLeftOffset = 0;

    // Process Fixed Columns (Sr. No., Description)
    FIXED_COLUMNS_ORDER.forEach((fixedDef, index) => {
      const apiField = apiFieldMap.get(fixedDef.fieldname);
      if (apiField) {
        const isLastSticky = index === FIXED_COLUMNS_ORDER.length - 1;
        fixedCols.push({
          fieldname: apiField.fieldname,
          label: apiField.label,
          width: `${fixedDef.width}px`,
          widthInt: fixedDef.width,
          formatter: apiField.fieldtype === "Currency" ? formatCurrency : undefined,
          isSticky: true,
          stickyLeft: currentLeftOffset,
          isLastSticky: isLastSticky
        });
        currentLeftOffset += fixedDef.width;
        apiFieldMap.delete(fixedDef.fieldname);
      }
    });

    // Process dynamic pump columns and total column
    apiFields.forEach(field => {
      if (apiFieldMap.has(field.fieldname)) {
        const width = field.width || 120;
        scrollableCols.push({
          fieldname: field.fieldname,
          label: field.label,
          width: `${width}px`,
          widthInt: width,
          formatter: field.fieldtype === "Currency" ? formatCurrency : undefined,
          isSticky: false
        });
      }
    });

    return [...fixedCols, ...scrollableCols];
  }, [apiFields]);

  // --- Helper Functions for Print Layout ---
  const formatDateForPrint = (dateString: string): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const months = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const calculateTotalPumpHours = (): string => {
    // Find the Pump Hrs row and sum all pump columns
    const pumpHrsRow = reportData.find((row: ReportData) =>
      row.description && row.description.includes("Pump Hrs")
    );
    if (!pumpHrsRow) return "0";

    // Get the total from the total_all_pumps column if available
    if (pumpHrsRow.total_all_pumps !== undefined) {
      return parseFloat(pumpHrsRow.total_all_pumps).toFixed(2);
    }

    // Otherwise, sum all pump columns
    let total = 0;
    columnConfig.forEach((col: ColumnConfig) => {
      if (col.fieldname !== "sr_no" && col.fieldname !== "description" && col.fieldname !== "total_all_pumps") {
        total += parseFloat(pumpHrsRow[col.fieldname] || 0);
      }
    });
    return total.toFixed(2);
  };

  const renderPrintValue = (row: ReportData, col: ColumnConfig): string => {
    const value = row[col.fieldname];
    
    // Special formatting for Pump Hrs and Water Lifted rows
    const description = row.description || "";
    if ((description.includes("Pump Hrs.") || description.includes("Water Lifted (MCFT)")) &&
        col.fieldname !== "sr_no" && col.fieldname !== "description") {
      if (value === null || value === undefined || value === "" || value === 0) {
        return "00";
      }
      return parseFloat(value).toFixed(2);
    }

    // For expenditure columns, show "00" if no value
    if (col.fieldname !== "sr_no" && col.fieldname !== "description") {
      if (value === null || value === undefined || value === "" || value === 0) {
        return "00";
      }
    }

    // Currency formatting for expenditure columns
    if (col.formatter) return col.formatter(value, row);

    // Default: return as string
    return String(value);
  };

  // --- Actions ---
  const fetchReportData = useCallback(async (currentFilters: Filters) => {
    if (!isInitialized) return;
    if (!isAuthenticated || !apiKey || !apiSecret) {
      setError("Please log in to view this report.");
      return;
    }

    if (!currentFilters.lis_name) {
      setError("Please select LIS Name (required field).");
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
        if (col.formatter) {
          val = col.formatter(val, row);
          // Remove currency symbol and commas for CSV
          val = String(val).replace(/[₹,]/g, '');
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
    link.download = `pump_expenditure_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [field]: value };
      // Clear dependent filters
      if (field === 'lis_name') {
        newFilters.stage = "";
      }
      return newFilters;
    });
  };

  const totalTableWidth = useMemo(() => {
    return columnConfig.reduce((total, col) => total + col.widthInt, 0);
  }, [columnConfig]);

  const renderCellValue = (row: ReportData, col: ColumnConfig) => {
    const value = row[col.fieldname];
    
    // Special formatting for Pump Hrs and Water Lifted rows (exclude sr_no and description columns)
    const description = row.description || "";
    if ((description.includes("Pump Hrs.") || description.includes("Water Lifted (MCFT)")) && 
        col.fieldname !== "sr_no" && col.fieldname !== "description") {
      if (value === null || value === undefined || value === "" || value === 0) {
        return "0.00";
      }
      return parseFloat(value).toFixed(2);
    }
    
    // For expenditure columns, show "00" if no value
    if (col.fieldname !== "sr_no" && col.fieldname !== "description") {
      if (value === null || value === undefined || value === "" || value === 0) {
        return "0.00";
      }
    }
    
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
            <h2>Pump Expenditure Report</h2>
            <p>Report showing pump expenditures by work type, work subtype, and asset category.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn--primary" onClick={() => fetchReportData(filters)} disabled={loading}>
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button className="btn btn--outline" onClick={handleExportCSV} disabled={reportData.length === 0}>
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
              <label className="text-sm font-medium mb-1 block">LIS Name <span className="text-red-500">*</span></label>
              <LinkInput
                value={filters.lis_name}
                onChange={(v) => handleFilterChange("lis_name", v)}
                placeholder="Select LIS..."
                linkTarget="Lift Irrigation Scheme"
                className="w-full relative"
              />
            </div>

            <div className="form-group z-[140]">
              <label className="text-sm font-medium mb-1 block">Stage/ Sub Scheme</label>
              <LinkInput
                value={filters.stage}
                onChange={(v) => handleFilterChange("stage", v)}
                placeholder="Select Stage..."
                linkTarget="Stage No"
                className="w-full"
                filters={{ lis_name: filters.lis_name || undefined }}
              />
            </div>

            <div className="form-group z-[130]">
              <label className="text-sm font-medium mb-1 block">From Date <span className="text-red-500">*</span></label>
              <DatePicker
                selected={filters.from_date ? new Date(filters.from_date) : null}
                onChange={(date: Date | null) => handleFilterChange("from_date", formatDateForAPI(date))}
                placeholderText="DD/MM/YYYY"
                dateFormat="dd/MM/yyyy"
                className="form-control w-full"
              />
            </div>

            <div className="form-group z-[130]">
              <label className="text-sm font-medium mb-1 block">To Date <span className="text-red-500">*</span></label>
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
                        boxShadow: column.isLastSticky ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none"
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
                  reportData.map((row, index) => {
                    const isBold = row.description && (row.description.includes("<b>") || row.description.includes("Total"));
                    return (
                      <tr key={index} className={isBold ? "font-bold" : ""}>
                        {columnConfig.map((column) => (
                          <td
                            key={`${index}-${column.fieldname}`}
                            style={{
                              position: column.isSticky ? "sticky" : "relative",
                              left: column.isSticky ? `${column.stickyLeft}px` : "auto",
                              zIndex: column.isSticky ? 10 : 1,
                              backgroundColor: column.isSticky ? (index % 2 === 1 ? "#fafafa" : "white") : "inherit",
                              boxShadow: column.isLastSticky ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none",
                              fontWeight: isBold ? "bold" : "normal"
                            }}
                            dangerouslySetInnerHTML={{
                              __html: renderCellValue(row, column)
                            }}
                          />
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- PRINT ONLY LAYOUT --- */}
      <div className="print-only-layout w-full bg-white text-black p-6">
        <style>{`
          .print-only-layout { display: none; }
          @media print {
            .print-only-layout { display: block !important; }
            @page { margin: 10mm; size: landscape; }
            html, body { 
              height: auto !important; 
              overflow: visible !important; 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
              padding: 0 !important; 
              margin: 0 !important; 
              background: white !important;
            }
            .module.active, .header, .sidebar, .footer, .mobile-overlay, .print\\:hidden { display: none !important; }
            .app-container, .main-content {
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              max-width: none !important;
              height: auto !important;
              overflow: visible !important;
              position: static !important;
            }
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            table-layout: auto;
            margin-top: 15px;
          }
          .print-table th, .print-table td {
            border: 1px solid #000;
            padding: 4px 6px;
            vertical-align: middle;
            color: #000;
          }
          .print-table th {
            background-color: #FFFF99 !important;
            font-weight: bold;
            text-align: center;
            font-size: 11px;
            color: #000 !important;
          }
          .print-table td {
            text-align: right;
            color: #000;
          }
          .print-table td:first-child,
          .print-table td:nth-child(2) {
            text-align: left;
          }
          .print-table tr.bold-row td {
            font-weight: bold;
            background-color: #FFFF99 !important;
            color: #000 !important;
          }
          .print-table tr.charges-row td:last-child {
            background-color: #FFFF99 !important;
            font-weight: bold;
          }
          .print-header {
            text-align: center;
            margin-bottom: 15px;
            color: #000;
          }
          .print-title {
            font-size: 14px;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 8px;
            text-transform: uppercase;
            color: #000;
          }
          .print-subtitle {
            font-size: 12px;
            margin-bottom: 5px;
            font-weight: 500;
            color: #000;
          }
          .print-info {
            font-size: 11px;
            margin-bottom: 5px;
            color: #000;
          }
        `}</style>

        <div className="print-header">
          <h1 className="print-title">
            Expenditure for O.M.& R for {filters.lis_name || "LIS"}{filters.stage ? ` Stage ${filters.stage}` : ""}
          </h1>
          <div className="print-subtitle">
            Period: {formatDateForPrint(filters.from_date)} to {formatDateForPrint(filters.to_date)}
          </div>
          <div className="print-info">
            Pump Hrs. for the Period = {calculateTotalPumpHours()}
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              {columnConfig.map((col) => (
                <th key={col.fieldname}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, idx) => {
              const isBold = row.description && (row.description.includes("<b>") || row.description.includes("Total") || row.description.includes("Pump Hrs") || row.description.includes("Water Lifted"));
              const isChargesRow = row.description && (row.description.includes("Charges Per Hr") || row.description.includes("Charges Per MCFT"));
              const cleanDescription = row.description ? row.description.replace(/<b>|<\/b>/g, '') : '';
              return (
                <tr key={idx} className={`${isBold ? "bold-row" : ""} ${isChargesRow ? "charges-row" : ""}`}>
                  {columnConfig.map((col) => (
                    <td key={`${idx}-${col.fieldname}`}>
                      {col.fieldname === "description" ? cleanDescription : renderPrintValue(row, col)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
