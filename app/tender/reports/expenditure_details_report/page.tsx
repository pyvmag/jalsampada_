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
const REPORT_NAME = "Expenditure Details Report";

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
  fiscal_year: string;
  from_date: string;
  to_date: string;
  lift_irrigation_scheme: string;
  custom_stage_no: string;
  work_type: string;
  asset_category: string;
  tender_number: string;
};

type ColumnConfig = {
  fieldname: string;
  label: string;
  width: string; // "150px"
  widthInt: number; // 150 (numeric for calculations)
  isHtml?: boolean;
  formatter?: (value: any, row?: ReportData) => string;
  // Sticky Logic Properties
  isSticky?: boolean;
  stickyLeft?: number;
  isLastSticky?: boolean;
};

// --- CONFIG: Define Column Order, Labels & Widths ---
const COLUMN_DEFINITIONS = [
  { fieldname: "tender_number", label: "Tender Number", width: 150 },
  { fieldname: "bill_type", label: "Bill Type", width: 120 },
  { fieldname: "bill_number", label: "Bill No", width: 120 },
  { fieldname: "bill_date", label: "Bill Date", width: 120 },
  { fieldname: "fiscal_year", label: "Fiscal Year", width: 100 },
  { fieldname: "lis", label: "LIS", width: 150 },
  { fieldname: "asset_category", label: "Asset Category", width: 150 },
  { fieldname: "stage", label: "Stage", width: 100 },
  { fieldname: "work_type", label: "Work Type", width: 150 },
  { fieldname: "work_subtype", label: "Work Subtype", width: 150 },
  { fieldname: "asset_no", label: "Pump No", width: 100 },
  { fieldname: "bill_amount", label: "Expenditure", width: 120 },
  { fieldname: "remarks", label: "Work Details", width: 250 },
];

const DEFAULT_COLUMN_WIDTH = 150;

// --- Helper Functions ---
const formatDateForAPI = (date: Date | null): string => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB");
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

export default function ExpenditureDetailsReport() {
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  // --- State ---
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [apiFields, setApiFields] = useState<ReportField[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    fiscal_year: "",
    from_date: getOneMonthAgo(),
    to_date: getToday(),
    lift_irrigation_scheme: "",
    custom_stage_no: "",
    work_type: "",
    asset_category: "",
    tender_number: "",
  });

  const tableRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState({
    isGrabbing: false,
    startX: 0,
    scrollLeft: 0,
  });

  // --- Dynamic Column Configuration ---
  const getFieldFormatter = (fieldtype: string, fieldname: string) => {
    switch (fieldtype) {
      case "Date":
      case "Datetime":
        return formatDate;
      case "Currency":
        return formatCurrency;
      default:
        return undefined;
    }
  };

  // --- MODIFIED: Column Logic with Sticky Calculations ---
  const columnConfig = useMemo((): ColumnConfig[] => {
    if (apiFields.length === 0) return [];

    const apiFieldMap = new Map(apiFields.map(f => [f.fieldname, f]));
    const resultCols: ColumnConfig[] = [];
    let currentLeftOffset = 0;

    // 1. Process columns in the order defined in COLUMN_DEFINITIONS
    COLUMN_DEFINITIONS.forEach((def, index) => {
      const apiField = apiFieldMap.get(def.fieldname);
      if (apiField) {
        const isSticky = index < 4; // First 4 are sticky
        const col: ColumnConfig = {
          fieldname: apiField.fieldname,
          label: def.label,
          width: `${def.width}px`,
          widthInt: def.width,
          formatter: getFieldFormatter(apiField.fieldtype, apiField.fieldname),
          isSticky: isSticky,
          stickyLeft: isSticky ? currentLeftOffset : undefined,
          isLastSticky: index === 3 // Last of the sticky ones
        };
        resultCols.push(col);
        if (isSticky) currentLeftOffset += def.width;
        apiFieldMap.delete(def.fieldname);
      }
    });

    // 2. Process any remaining fields from API not in our defined list
    apiFields.forEach(field => {
      if (apiFieldMap.has(field.fieldname)) {
        const width = field.width || DEFAULT_COLUMN_WIDTH;
        resultCols.push({
          fieldname: field.fieldname,
          label: field.label,
          width: `${width}px`,
          widthInt: width,
          formatter: getFieldFormatter(field.fieldtype, field.fieldname),
          isSticky: false
        });
      }
    });

    return resultCols;
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

  // --- Export Handlers ---
  const handleExportCSV = () => {
    if (reportData.length === 0) return;

    const headers = columnConfig.map(c => {
      let label = c.label || '';
      if (label.includes(',') || label.includes('\n') || label.includes('"')) {
        label = `"${label.replace(/"/g, '""')}"`;
      }
      return label;
    }).join(",");

    const csvRows = reportData.map(row => {
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

    const csvContent = headers + "\n" + csvRows;
    const BOM = '\ufeff';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `expenditure_details_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [field]: value };
      // Clear dependent filters
      if (field === 'lift_irrigation_scheme') {
        newFilters.custom_stage_no = "";
        newFilters.tender_number = "";
      }
      if (field === 'custom_stage_no') {
        newFilters.tender_number = "";
      }
      return newFilters;
    });
  };

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

  const totalTableWidth = useMemo(() => {
    return columnConfig.reduce((total, col) => total + col.widthInt, 0);
  }, [columnConfig]);

  const renderCellValue = (row: ReportData, col: ColumnConfig) => {
    const value = row[col.fieldname];
    if (value === null || value === undefined || value === "") return "";
    if (col.formatter) return col.formatter(value, row);
    return String(value);
  };

  return (
    <>
      <div className="module active print:hidden">
        <div className="module-header">
          <div>
            <h2>Expenditure Details Report</h2>
            <p>Track tender expenditures, bills, and work details.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn--primary" onClick={() => fetchReportData(filters)} disabled={loading}>
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <div className="export-buttons flex gap-2 ml-2">
              <button
                className="btn btn--outline"
                onClick={handleExportCSV}
                disabled={reportData.length === 0}
              >
                <i className="fas fa-file-csv"></i> CSV
              </button>
              <button
                className="btn btn--outline"
                onClick={() => window.print()}
                disabled={reportData.length === 0 || loading}
              >
                <i className="fas fa-print"></i> Print
              </button>
            </div>
          </div>
        </div>

        <div className="tab-content active relative">
          {error && <div className="alert alert--danger mb-5"><i className="fas fa-exclamation-triangle"></i> {error}</div>}
          {loading && !reportData.length && <div className="alert alert--info mb-5"><i className="fas fa-spinner fa-spin"></i> Loading...</div>}

          <div className="filters-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 relative z-[60]">

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

            <div className="form-group z-[140]">
              <label className="text-sm font-medium mb-1 block">Fiscal Year</label>
              <LinkInput
                value={filters.fiscal_year}
                onChange={(v) => handleFilterChange("fiscal_year", v)}
                placeholder="Select Year..."
                linkTarget="Fiscal Year"
                className="w-full relative"
              />
            </div>

            <div className="form-group z-[130]">
              <label className="text-sm font-medium mb-1 block">Lift Irrigation Scheme</label>
              <LinkInput
                value={filters.lift_irrigation_scheme}
                onChange={(v) => handleFilterChange("lift_irrigation_scheme", v)}
                placeholder="Select LIS..."
                linkTarget="Lift Irrigation Scheme"
                className="w-full relative"
              />
            </div>

            <div className="form-group relative z-[120]">
              <label className="text-sm font-medium mb-1 block">Stage</label>
              <LinkInput
                value={filters.custom_stage_no}
                onChange={(v) => handleFilterChange("custom_stage_no", v)}
                placeholder="Select Stage..."
                linkTarget="Stage No"
                className="w-full"
                filters={{ lis_name: filters.lift_irrigation_scheme || undefined }}
              />
            </div>

            <div className="form-group z-[110]">
              <label className="text-sm font-medium mb-1 block">Tender Number</label>
              <LinkInput
                value={filters.tender_number}
                onChange={(v) => handleFilterChange("tender_number", v)}
                placeholder="Select Tender..."
                linkTarget="Project"
                className="w-full relative"
                filters={{
                  custom_lis_name: filters.lift_irrigation_scheme || undefined,
                  custom_stage_no: filters.custom_stage_no || undefined
                }}
              />
            </div>

            <div className="form-group z-[100]">
              <label className="text-sm font-medium mb-1 block">Work Type</label>
              <LinkInput
                value={filters.work_type}
                onChange={(v) => handleFilterChange("work_type", v)}
                placeholder="Select Work Type..."
                linkTarget="Work Type"
                className="w-full relative"
              />
            </div>

            <div className="form-group z-[90]">
              <label className="text-sm font-medium mb-1 block">Asset Category</label>
              <LinkInput
                value={filters.asset_category}
                onChange={(v) => handleFilterChange("asset_category", v)}
                placeholder="Select Asset Category..."
                linkTarget="Asset Category"
                className="w-full relative"
              />
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
              userSelect: dragState.isGrabbing ? "none" : "auto"
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
                        // Sticky Logic for Header - Only first column is sticky
                        position: column.isSticky ? "sticky" : "relative",
                        left: column.isSticky ? `${column.stickyLeft}px` : "auto",
                        zIndex: column.isSticky ? 30 : 20,
                        backgroundColor: "#3683f6",
                        color: "white",
                        borderRight: "none",
                        boxShadow: column.isLastSticky ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none"
                      }}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(columnConfig.length, 1)} className="text-center p-10">
                      {loading ? "Fetching records..." : "No records found matching criteria"}
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, index) => {
                    const isTotal = !!row.bold || !!row.is_total || [row.tender_number, row.bill_type, row.bill_number].some(val => String(val || "").toLowerCase().includes("total"));
                    return (
                      <tr key={index} className={`${index % 2 === 1 ? "bg-gray-25" : ""} ${isTotal ? "font-bold" : ""}`}>
                        {columnConfig.map((column) => (
                          <td
                            key={`${index}-${column.fieldname}`}
                            style={{
                              // Sticky Logic for Body - Only first column is sticky
                              position: column.isSticky ? "sticky" : "relative",
                              left: column.isSticky ? `${column.stickyLeft}px` : "auto",
                              zIndex: column.isSticky ? 10 : 1,
                              backgroundColor: column.isSticky ? (index % 2 === 1 ? "#fafafa" : "white") : "inherit",
                              borderRight: "none",
                              boxShadow: column.isLastSticky ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none",
                              fontWeight: isTotal ? "bold" : "normal"
                            }}
                          >
                            {renderCellValue(row, column)}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div >
      </div>

      {/* --- PRINT ONLY LAYOUT --- */}
      <div className="print-only-layout w-full bg-white text-black p-4">
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
            font-size: 9px;
            table-layout: auto;
          }
          .print-table th, .print-table td {
            border: 1px solid #000;
            padding: 4px;
            text-align: left;
            word-break: break-word;
            vertical-align: top;
          }
          .print-table th {
            background-color: #f3f4f6 !important;
            font-weight: bold;
          }
          .print-header {
            margin-bottom: 20px;
          }
          .print-title {
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            text-decoration: underline;
            margin-bottom: 10px;
          }
          .print-summary {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 10px;
            font-weight: 500;
          }
        `}</style>

        <div className="print-header">
          <h1 className="print-title">Expenditure Details Report</h1>
          <div className="print-summary">
            <span>Generated At: {new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span>Total Records: {reportData.length}</span>
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
               const isTotal = !!row.bold || !!row.is_total || [row.tender_number, row.bill_type, row.bill_number].some(val => String(val || "").toLowerCase().includes("total"));
               return (
                <tr key={idx} style={{ fontWeight: isTotal ? 'bold' : 'normal', backgroundColor: isTotal ? '#f9fafb' : 'transparent' }}>
                  {columnConfig.map((col) => (
                    <td key={`${idx}-${col.fieldname}`}>
                      {renderCellValue(row, col)}
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