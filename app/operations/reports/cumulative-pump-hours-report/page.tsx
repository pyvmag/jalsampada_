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
const REPORT_NAME = "Cumulative Pump Hours Report";

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
  lis_name: string;
  stage: string;
  asset_no: string;
};

type ColumnConfig = {
  fieldname: string;
  label: string;
  width: string;
  widthInt: number;
  isHtml?: boolean;
  formatter?: (value: any, row?: ReportData) => string;
  isSticky?: boolean;
  stickyLeft?: number;
};

// --- CONFIG: Define Fixed Columns Order & Widths ---
const FIXED_COLUMNS_ORDER = [
  { fieldname: "lis_name", label: "LIS", width: 200 },
  { fieldname: "stage", label: "Stage", width: 150 },
  { fieldname: "pump_no", label: "Pump No.", width: 100 }
];

export default function CumulativePumpHoursReportPage() {
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
    fiscal_year: "2024-2025",
    lis_name: "",
    stage: "",
    asset_no: "",
  });

  // --- Helper Functions ---
  const groupDataByLISStage = useMemo(() => {
    const grouped: Record<string, Record<string, ReportData[]>> = {};
    
    reportData.forEach((row: ReportData) => {
      const lis = row.lis_name || "Unknown";
      const stage = row.stage || "Unknown";
      
      if (!grouped[lis]) {
        grouped[lis] = {};
      }
      if (!grouped[lis][stage]) {
        grouped[lis][stage] = [];
      }
      grouped[lis][stage].push(row);
    });
    
    return grouped;
  }, [reportData]);

  const calculateStageTotal = useCallback((rows: ReportData[]): ReportData => {
    const total: ReportData = {
      pump_no: "Total",
      hours_till_jun_2024: 0,
      jul_24: 0, aug_24: 0, sep_24: 0, oct_24: 0, nov_24: 0, dec_24: 0,
      jan_25: 0, feb_25: 0, mar_25: 0, apr_25: 0, may_25: 0, jun_25: 0,
      total_this_year: 0,
      cumulative_hours_till_date: 0,
    };
    
    rows.forEach((row: ReportData) => {
      total.hours_till_jun_2024 += parseFloat(row.hours_till_jun_2024) || 0;
      total.jul_24 += parseFloat(row.jul_24) || 0;
      total.aug_24 += parseFloat(row.aug_24) || 0;
      total.sep_24 += parseFloat(row.sep_24) || 0;
      total.oct_24 += parseFloat(row.oct_24) || 0;
      total.nov_24 += parseFloat(row.nov_24) || 0;
      total.dec_24 += parseFloat(row.dec_24) || 0;
      total.jan_25 += parseFloat(row.jan_25) || 0;
      total.feb_25 += parseFloat(row.feb_25) || 0;
      total.mar_25 += parseFloat(row.mar_25) || 0;
      total.apr_25 += parseFloat(row.apr_25) || 0;
      total.may_25 += parseFloat(row.may_25) || 0;
      total.jun_25 += parseFloat(row.jun_25) || 0;
      total.total_this_year += parseFloat(row.total_this_year) || 0;
      total.cumulative_hours_till_date += parseFloat(row.cumulative_hours_till_date) || 0;
    });
    
    return total;
  }, []);

  const formatFiscalYearShort = useCallback((fy: string): string => {
    const parts = fy.split("-");
    if (parts.length === 2) {
      return `${parts[0].slice(-2)}-${parts[1].slice(-2)}`;
    }
    return fy;
  }, []);

  // --- Dynamic Column Configuration ---
  const columnConfig = useMemo((): ColumnConfig[] => {
    const fieldsToUse = apiFields.length > 0 ? apiFields : [
      { fieldname: "lis_name", label: "LIS", fieldtype: "Link", width: 200 },
      { fieldname: "stage", label: "Stage", fieldtype: "Link", width: 150 },
      { fieldname: "pump_no", label: "Pump No.", fieldtype: "Data", width: 100 },
      { fieldname: "hours_till_jun_2024", label: "Hours Till April June 2024", fieldtype: "Float", width: 180 },
      { fieldname: "jul_24", label: "Jul-24", fieldtype: "Float", width: 80 },
      { fieldname: "aug_24", label: "Aug-24", fieldtype: "Float", width: 80 },
      { fieldname: "sep_24", label: "Sep-24", fieldtype: "Float", width: 80 },
      { fieldname: "oct_24", label: "Oct-24", fieldtype: "Float", width: 80 },
      { fieldname: "nov_24", label: "Nov-24", fieldtype: "Float", width: 80 },
      { fieldname: "dec_24", label: "Dec-24", fieldtype: "Float", width: 80 },
      { fieldname: "jan_25", label: "Jan-25", fieldtype: "Float", width: 80 },
      { fieldname: "feb_25", label: "Feb-25", fieldtype: "Float", width: 80 },
      { fieldname: "mar_25", label: "Mar-25", fieldtype: "Float", width: 80 },
      { fieldname: "apr_25", label: "Apr-25", fieldtype: "Float", width: 80 },
      { fieldname: "may_25", label: "May-25", fieldtype: "Float", width: 80 },
      { fieldname: "jun_25", label: "Jun-25", fieldtype: "Float", width: 80 },
      { fieldname: "total_this_year", label: "Total of this year", fieldtype: "Float", width: 150 },
      { fieldname: "cumulative_hours_till_date", label: "Cumulative Hours till Date", fieldtype: "Float", width: 200 },
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

      console.log("Fetching report:", REPORT_NAME, "with filters:", cleanedFilters);

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

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to fetch data: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("API Response:", result);

      if (result.message) {
        setApiFields(result.message.columns || []);
        let formattedResult = result.message.result || [];
        if (formattedResult.length > 0 && Array.isArray(formattedResult[0])) {
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
        console.warn("No message in API response");
        setApiFields([]);
        setReportData([]);
      }

    } catch (err) {
      console.error("Fetch error:", err);
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
  const handleExportCSV = useCallback(() => {
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
    link.download = "cumulative_pump_hours_report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [reportData, columnConfig]);

  const handleFilterChange = useCallback((field: keyof Filters, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [field]: value };
      // Clear stage when LIS changes to maintain data integrity
      if (field === 'lis_name' && value !== prev.lis_name) {
        newFilters.stage = '';
      }
      return newFilters;
    });
  }, []);

  const totalTableWidth = useMemo(() => {
    return columnConfig.reduce((total, col) => total + col.widthInt, 0);
  }, [columnConfig]);

  // --- Horizontal Scroll Drag Handlers ---
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!tableRef.current) return;
    setDragState({
      isGrabbing: true,
      startX: e.pageX - tableRef.current.offsetLeft,
      scrollLeft: tableRef.current.scrollLeft,
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState.isGrabbing || !tableRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableRef.current.offsetLeft;
    const walk = (x - dragState.startX) * 1.5;
    tableRef.current.scrollLeft = dragState.scrollLeft - walk;
  }, [dragState.isGrabbing, dragState.startX, dragState.scrollLeft]);

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
            <h2>Cumulative Pump Hours Report</h2>
            <p>Report showing cumulative pump hours across fiscal years with monthly breakdown.</p>
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
              <label className="text-sm font-medium mb-1 block">Fiscal Year</label>
              <select
                className="form-control w-full"
                value={filters.fiscal_year}
                onChange={(e) => handleFilterChange("fiscal_year", e.target.value)}
              >
                <option value="">Select Fiscal Year</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
              </select>
            </div>
            <div className="form-group z-[140]">
              <label className="text-sm font-medium mb-1 block">LIS Name</label>
              <LinkInput
                key="lis-input"
                linkTarget="Lift Irrigation Scheme"
                value={filters.lis_name}
                onChange={(value) => handleFilterChange("lis_name", value)}
                placeholder="Select LIS"
                className="w-full"
              />
            </div>
            <div className="form-group z-[130]">
              <label className="text-sm font-medium mb-1 block">Stage</label>
              <LinkInput
                key={`stage-input-${filters.lis_name}`}
                linkTarget="Stage No"
                value={filters.stage}
                onChange={(value) => handleFilterChange("stage", value)}
                placeholder="Select Stage"
                className="w-full"
                filters={{
                  lis_name: filters.lis_name || undefined
                }}
              />
            </div>
            <div className="form-group z-[120]">
              <label className="text-sm font-medium mb-1 block">Pump No</label>
              <input
                type="text"
                className="form-control w-full"
                value={filters.asset_no}
                onChange={(e) => handleFilterChange("asset_no", e.target.value)}
                placeholder="Enter Pump No"
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
                        boxShadow: column.isSticky && column.fieldname === "pump_no" ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none"
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
                            boxShadow: column.isSticky && column.fieldname === "pump_no" ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none"
                          }}
                        >
                          {row[column.fieldname] !== undefined && row[column.fieldname] !== null ? row[column.fieldname] : "-"}
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
          .print-table { border-collapse: collapse; width: 100%; font-size: 11px; }
          .print-table th, .print-table td { border: 1px solid black; padding: 6px 8px; text-align: center; }
          .print-table th { background-color: #3683f6 !important; color: white !important; font-weight: bold; }
          .print-table .stage-header { background-color: #e0e0e0 !important; font-weight: bold; text-align: left; }
          .print-table .total-row { background-color: #f0f0f0 !important; font-weight: bold; }
          .print-table .cumulative-col { background-color: #ffe6e6 !important; }
          .print-header { text-align: center; margin-bottom: 20px; }
          .print-header h2 { font-size: 18px; font-weight: bold; margin: 0 0 10px 0; }
        `}</style>
        
        <div className="print-header">
          <h2>CUMULATIVE PUMP HOURS {formatFiscalYearShort(filters.fiscal_year)}</h2>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: "80px" }}>Pump No.</th>
              <th style={{ width: "120px" }}>Hours till April June 2024</th>
              <th style={{ width: "70px" }}>Jul-24</th>
              <th style={{ width: "70px" }}>Aug-24</th>
              <th style={{ width: "70px" }}>Sep-24</th>
              <th style={{ width: "70px" }}>Oct-24</th>
              <th style={{ width: "70px" }}>Nov-24</th>
              <th style={{ width: "70px" }}>Dec-24</th>
              <th style={{ width: "70px" }}>Jan-25</th>
              <th style={{ width: "70px" }}>Feb-25</th>
              <th style={{ width: "70px" }}>Mar-25</th>
              <th style={{ width: "70px" }}>Apr-25</th>
              <th style={{ width: "70px" }}>May-25</th>
              <th style={{ width: "70px" }}>Jun-25</th>
              <th style={{ width: "100px" }}>Total of this year</th>
              <th style={{ width: "120px" }}>Cumulative Hours till Date</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupDataByLISStage).map(([lis, stages]) => (
              Object.entries(stages).map(([stage, rows], stageIdx) => {
                const stageTotal = calculateStageTotal(rows);
                return (
                  <React.Fragment key={`${lis}-${stage}`}>
                    <tr className="stage-header">
                      <td colSpan={16}>{lis} {stage}</td>
                    </tr>
                    {rows.map((row, rowIdx) => (
                      <tr key={`${lis}-${stage}-${rowIdx}`}>
                        <td>{row.pump_no || "-"}</td>
                        <td>{row.hours_till_jun_2024 !== undefined && row.hours_till_jun_2024 !== null ? row.hours_till_jun_2024 : "-"}</td>
                        <td>{row.jul_24 !== undefined && row.jul_24 !== null ? row.jul_24 : "-"}</td>
                        <td>{row.aug_24 !== undefined && row.aug_24 !== null ? row.aug_24 : "-"}</td>
                        <td>{row.sep_24 !== undefined && row.sep_24 !== null ? row.sep_24 : "-"}</td>
                        <td>{row.oct_24 !== undefined && row.oct_24 !== null ? row.oct_24 : "-"}</td>
                        <td>{row.nov_24 !== undefined && row.nov_24 !== null ? row.nov_24 : "-"}</td>
                        <td>{row.dec_24 !== undefined && row.dec_24 !== null ? row.dec_24 : "-"}</td>
                        <td>{row.jan_25 !== undefined && row.jan_25 !== null ? row.jan_25 : "-"}</td>
                        <td>{row.feb_25 !== undefined && row.feb_25 !== null ? row.feb_25 : "-"}</td>
                        <td>{row.mar_25 !== undefined && row.mar_25 !== null ? row.mar_25 : "-"}</td>
                        <td>{row.apr_25 !== undefined && row.apr_25 !== null ? row.apr_25 : "-"}</td>
                        <td>{row.may_25 !== undefined && row.may_25 !== null ? row.may_25 : "-"}</td>
                        <td>{row.jun_25 !== undefined && row.jun_25 !== null ? row.jun_25 : "-"}</td>
                        <td>{row.total_this_year !== undefined && row.total_this_year !== null ? row.total_this_year : "-"}</td>
                        <td className="cumulative-col">{row.cumulative_hours_till_date !== undefined && row.cumulative_hours_till_date !== null ? row.cumulative_hours_till_date : "-"}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td>{stageTotal.pump_no}</td>
                      <td>{stageTotal.hours_till_jun_2024.toFixed(2)}</td>
                      <td>{stageTotal.jul_24.toFixed(2)}</td>
                      <td>{stageTotal.aug_24.toFixed(2)}</td>
                      <td>{stageTotal.sep_24.toFixed(2)}</td>
                      <td>{stageTotal.oct_24.toFixed(2)}</td>
                      <td>{stageTotal.nov_24.toFixed(2)}</td>
                      <td>{stageTotal.dec_24.toFixed(2)}</td>
                      <td>{stageTotal.jan_25.toFixed(2)}</td>
                      <td>{stageTotal.feb_25.toFixed(2)}</td>
                      <td>{stageTotal.mar_25.toFixed(2)}</td>
                      <td>{stageTotal.apr_25.toFixed(2)}</td>
                      <td>{stageTotal.may_25.toFixed(2)}</td>
                      <td>{stageTotal.jun_25.toFixed(2)}</td>
                      <td>{stageTotal.total_this_year.toFixed(2)}</td>
                      <td className="cumulative-col">{stageTotal.cumulative_hours_till_date.toFixed(2)}</td>
                    </tr>
                  </React.Fragment>
                );
              })
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
