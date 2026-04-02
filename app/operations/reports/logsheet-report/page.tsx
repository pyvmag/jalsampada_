"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { LinkInput } from "@/components/LinkInput";
import { useAuth } from "@/context/AuthContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// --- API Configuration ---
const API_BASE_URL = "http://103.219.3.169:2223/";
const REPORT_API_PATH = "api/method/frappe.desk.query_report.run";
const REPORT_NAME = "Logsheet Report";

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
  lis: string;
  stage: string;
  from_date: string;
  to_date: string;
  asset: string;
  lis_phase: string;
};

type ColumnConfig = {
  fieldname: string;
  label: string;
  width: string;
  isHtml?: boolean; // Flag to identify HTML content
  formatter?: (value: any) => string;
};

// --- Helper Functions ---
const formatDate = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB");
};

const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleString("en-GB");
};

const toLocalYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- Configuration ---

const columnConfig: ColumnConfig[] = [
  { fieldname: "name", label: "Logsheet", width: "140px" },
  { fieldname: "lis", label: "LIS", width: "140px" },
  { fieldname: "stage_no", label: "Stage No.", width: "120px" },
  { fieldname: "asset", label: "Asset Name", width: "150px" },
  { fieldname: "pump_no", label: "Pump No.", width: "120px" },
  { fieldname: "water_level", label: "Water Level", width: "130px" },
  { fieldname: "date", label: "Date", width: "120px", formatter: formatDate },
  { fieldname: "time", label: "Time", width: "110px" },
  { fieldname: "br", label: "BR", width: "80px" },
  { fieldname: "ry", label: "RY", width: "80px" },
  { fieldname: "yb", label: "YB", width: "80px" },
  { fieldname: "b", label: "B", width: "70px" },
  { fieldname: "y", label: "Y", width: "70px" },
  { fieldname: "r", label: "R", width: "70px" },
  { fieldname: "operator_name", label: "Operator Name", width: "150px" },
  { fieldname: "pressure_guage", label: "Pressure Gauge", width: "150px" },
  { fieldname: "t1___motor_winding_pt1", label: "T1 Motor", width: "110px" },
  { fieldname: "t2___motor_winding_pt2", label: "T2 Motor", width: "110px" },
  { fieldname: "t3___motor_winding_pt3", label: "T3 Motor", width: "110px" },
  { fieldname: "t4___motor_winding_pt4", label: "T4 Motor", width: "110px" },
  { fieldname: "t5___motor_winding_pt5", label: "T5 Motor", width: "110px" },
  { fieldname: "t6___motor_winding_pt6", label: "T6 Motor", width: "110px" },
  { fieldname: "t7___thrust_brg._water_inlet", label: "T7 Thrust", width: "140px" },
  { fieldname: "t8___thrust_brg._water_outlet", label: "T8 Thrust", width: "140px" },
  { fieldname: "t1___motor_wi", label: "T1 Motor Wi", width: "130px" },
  { fieldname: "12", label: "T12", width: "90px" },
  { fieldname: "test_entry", label: "Test Entry", width: "140px" },
];

export default function LogsheetReportPage() {
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  // --- State ---
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [filteredData, setFilteredData] = useState<ReportData[]>([]);
  const [apiFields, setApiFields] = useState<ReportField[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    lis: "",
    stage: "",
    from_date: "",
    to_date: "",
    asset: "",
    lis_phase: "",
  });

  // --- Actions ---

  // Memoized fetch function
  const fetchReportData = useCallback(async (currentFilters: Filters) => {
    if (!isInitialized) return;
    if (!isAuthenticated || !apiKey || !apiSecret) {
      setError("Please log in to view this report.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Clean filters (remove empty strings)
      const cleanedFilters: Record<string, string> = {};
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value && value.trim() !== "") {
          cleanedFilters[key] = value;
        }
      });

      // 2. Prepare URL Params
      const params = new URLSearchParams({
        report_name: REPORT_NAME,
        filters: JSON.stringify(cleanedFilters)
      });

      // 3. Call Standard Report API
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
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.message) {
        setReportData([]);
        setFilteredData([]);
        setApiFields([]);
      } else {
        const columns = result.message.columns || [];
        const data = result.message.result || [];

        setApiFields(columns);
        setReportData(data);
        setFilteredData(data);
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [apiKey, apiSecret, isAuthenticated, isInitialized]);


  // --- Effects ---

  // Auto-refresh when filters change (Debounced 500ms)
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    const timer = setTimeout(() => {
      fetchReportData(filters);
    }, 500);

    return () => clearTimeout(timer);
  }, [filters, fetchReportData, isInitialized, isAuthenticated]);


  // --- Event Handlers ---

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;

    const headers = columnConfig.map(c => c.label).join(",");
    const rows = filteredData.map(row => {
      return columnConfig.map(col => {
        let val = row[col.fieldname];

        // Strip HTML tags for CSV export cleanliness (though none here, kept for consistency)
        if (col.isHtml && typeof val === 'string') {
          val = val.replace(/<[^>]*>?/gm, '');
        }

        val = val === null || val === undefined ? "" : String(val);
        // CSV Escaping
        if (val.includes(",") || val.includes("\n") || val.includes('"')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(",");
    }).join("\n");

    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "logsheet_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const totalTableWidth = useMemo(() => {
    return columnConfig.reduce((total, col) => {
      const width = parseInt(col.width.replace("px", ""));
      return total + (isNaN(width) ? 150 : width);
    }, 0);
  }, []);

  const renderCellValue = (row: ReportData, col: ColumnConfig) => {
    const value = row[col.fieldname];

    if (value === null || value === undefined || value === "") {
      return "-";
    }

    // Render HTML content safely (none here, but kept for consistency)
    if (col.isHtml) {
      return (
        <div
          className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300"
          dangerouslySetInnerHTML={{ __html: String(value) }}
          style={{
            whiteSpace: 'normal',
            minWidth: '250px',
            wordBreak: 'break-word',
            fontSize: '0.875rem'
          }}
        />
      );
    }

    if (col.formatter) {
      return col.formatter(value);
    }
    return String(value);
  };

  // --- PRINT LAYOUT LOGIC ---
  const groupedData = useMemo(() => {
    const groups: Record<string, typeof filteredData> = {};
    if (!filteredData || filteredData.length === 0) return groups;
    filteredData.forEach(row => {
      const pNo = row.pump_no || "Unknown Pump";
      if (!groups[pNo]) {
        groups[pNo] = [];
      }
      groups[pNo].push(row);
    });
    return groups;
  }, [filteredData]);

  const tempFields = useMemo(() => {
    // The standard static fields are index 0 to 14. 
    // python API appends temperature fields dynamically after pressure_guage.
    if (apiFields && apiFields.length > 15) {
      return apiFields.slice(15);
    }
    return [];
  }, [apiFields]);

  const printLisName = filteredData.length > 0 ? filteredData[0].lis : filters.lis || "Unknown LIS";

  return (
    <>
      <div className="module active print:hidden">
        <div className="module-header">
        <div>
          <h2>Logsheet Report</h2>
          <p>Track logsheet entries and data.</p>
        </div>

        <div className="flex gap-2">
          <button
            className="btn btn--primary"
            onClick={() => fetchReportData(filters)}
            disabled={loading}
          >
            <i className="fas fa-sync-alt"></i> {loading ? "Refreshing..." : "Refresh"}
          </button>
          <div className="export-buttons flex gap-2 ml-2">
            <button className="btn btn--outline" onClick={handleExportCSV}>
              <i className="fas fa-file-csv"></i> CSV
            </button>
            <button className="btn btn--outline" onClick={() => window.print()} disabled={filteredData.length === 0 || loading}>
              <i className="fas fa-print"></i> Print
            </button>
          </div>
        </div>
      </div>

      <div className="tab-content active relative">
        {error && (
          <div className="alert alert--danger" style={{ marginBottom: "20px" }}>
            <i className="fas fa-exclamation-triangle"></i> {error}
          </div>
        )}

        {loading && !reportData.length && (
          <div className="alert alert--info" style={{ marginBottom: "20px" }}>
            <i className="fas fa-spinner fa-spin"></i> Loading data...
          </div>
        )}

        <div className="filters-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 relative z-[60]">

          <div className="form-group z-[110]">
            <label className="text-sm font-medium mb-1 block">From Date</label>
            <DatePicker
              selected={filters.from_date ? new Date(filters.from_date) : null}
              onChange={(date: Date | null) =>
                handleFilterChange("from_date", date ? toLocalYYYYMMDD(date) : "")
              }
              placeholderText="DD/MM/YYYY"
              dateFormat="dd/MM/yyyy"
              className="form-control w-full placeholder:uppercase"
            />
          </div>
          <div className="form-group z-[110]">
            <label className="text-sm font-medium mb-1 block">To Date</label>
            <DatePicker
              selected={filters.to_date ? new Date(filters.to_date) : null}
              onChange={(date: Date | null) =>
                handleFilterChange("to_date", date ? toLocalYYYYMMDD(date) : "")
              }
              placeholderText="DD/MM/YYYY"
              dateFormat="dd/MM/yyyy"
              className="form-control w-full placeholder:uppercase"
            />
          </div>

          <div className="form-group z-[50]">
            <label className="text-sm font-medium mb-1 block">LIS</label>
            <LinkInput
              value={filters.lis}
              onChange={(value) => handleFilterChange("lis", value)}
              placeholder="Select LIS..."
              linkTarget="Lift Irrigation Scheme"
              className="w-full relative"
            />
          </div>



          <div className="form-group relative z-[30]">
            <label className="text-sm font-medium mb-1 block">Stage</label>
            <LinkInput
              value={filters.stage}
              onChange={(value) => handleFilterChange("stage", value)}
              placeholder="Select Stage..."
              linkTarget="Stage No"
              className="w-full relative"
              filters={{
                lis_name: filters.lis || undefined
              }}
            />
          </div>


          <div className="form-group z-[30]">
            <label className="text-sm font-medium mb-1 block">Asset</label>
            <LinkInput
              value={filters.asset}
              onChange={(value) => handleFilterChange("asset", value)}
              placeholder="Select Asset..."
              linkTarget="Asset"
              className="w-full relative"
            />
          </div>
        </div>

        {/* Table Section */}
        <div
          className="stock-table-container border rounded-md relative z-10"
          style={{
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: "70vh",
          }}
        >
          <table
            className="stock-table sticky-header-table"
            style={{ minWidth: `${totalTableWidth}px` }}
          >
            <thead style={{ position: "sticky", top: 0, zIndex: 20, backgroundColor: "white" }}>
              <tr>
                {columnConfig.map((column) => (
                  <th key={column.fieldname} style={{ width: column.width }}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(columnConfig.length, 1)}
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    {loading ? "Fetching records..." : "No records found matching criteria"}
                  </td>
                </tr>
              ) : (
                filteredData.map((row, index) => (
                  <tr key={index}>
                    {columnConfig.map((column) => (
                      <td key={`${index}-${column.fieldname}`}>
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

    {/* --- PRINT ONLY LAYOUT --- */}
    <div className="print-only-layout w-full bg-white text-black mt-4">
      <style>{`
        .print-only-layout { display: none; }
        @media print {
          .print-only-layout { display: block !important; }
          @page { margin: 10mm; size: landscape; }
          html, body { height: auto !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0 !important; margin: 0 !important; background: white !important; }
          .module.active, .header, .sidebar, .footer, .mobile-overlay { display: none !important; }
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
      `}</style>
      
      <div className="text-center mb-6 font-bold">
        <h2 className="text-xl inline-block border-b border-black pb-1 mb-1">Logsheet</h2>
        <h3 className="text-lg">{printLisName}</h3>
      </div>

      {Object.entries(groupedData).map(([pumpNo, rows], groupIdx) => (
        <div key={pumpNo} className="mb-12" style={{ pageBreakInside: 'avoid' }}>
          <div className="font-bold mb-2 text-sm text-left pl-1">
            <span className="inline-block w-20">Pump No.</span>
            <span>{pumpNo}</span>
          </div>
          <table className="w-full border-collapse border border-black text-xs text-center" style={{ tableLayout: 'auto' }}>
            <thead>
              {/* Row 1 Headers */}
              <tr>
                <th className="border border-black p-1 font-bold bg-gray-50 align-middle" rowSpan={2}>Date</th>
                <th className="border border-black p-1 font-bold bg-gray-50 align-middle" rowSpan={2}>Time</th>
                <th className="border border-black p-1 font-bold bg-gray-50 align-middle" colSpan={3}>Voltage</th>
                <th className="border border-black p-1 font-bold bg-gray-50 align-middle" colSpan={3}>Current</th>
                <th className="border border-black p-1 font-bold bg-gray-50 align-middle" rowSpan={2}>Pressure<br/>guage<br/>reading</th>
                <th className="border border-black p-1 font-bold bg-gray-50 align-middle" colSpan={Math.max(tempFields.length, 1)}>Temprature in C</th>
                <th className="border border-black p-1 font-bold bg-gray-50 align-middle" rowSpan={2}>Water<br/>Level</th>
                <th className="border border-black p-1 font-bold bg-gray-50 align-middle w-24" rowSpan={2}>Remark</th>
                <th className="border border-black p-1 font-bold bg-gray-50 align-middle w-24" rowSpan={2}>Sign of<br/>operator</th>
              </tr>
              {/* Row 2 Sub-headers */}
              <tr>
                <th className="border border-black p-1 font-bold bg-gray-50">RY</th>
                <th className="border border-black p-1 font-bold bg-gray-50">YB</th>
                <th className="border border-black p-1 font-bold bg-gray-50">BR</th>
                <th className="border border-black p-1 font-bold bg-gray-50">R</th>
                <th className="border border-black p-1 font-bold bg-gray-50">Y</th>
                <th className="border border-black p-1 font-bold bg-gray-50">B</th>
                {tempFields.length > 0 ? (
                  tempFields.map((f, i) => (
                    <th key={f.fieldname} className="border border-black p-1 font-bold bg-gray-50">{f.label}</th>
                  ))
                ) : (
                  <th className="border border-black p-1 font-bold bg-gray-50">-</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const formatPrintDate = (val: string) => {
                  if (!val) return "";
                  const d = new Date(val);
                  if (isNaN(d.getTime())) return val;
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
                };
                return (
                  <tr key={idx}>
                    <td className="border border-black p-1 whitespace-nowrap">{formatPrintDate(row.date)}</td>
                    <td className="border border-black p-1 whitespace-nowrap">{row.time || ""}</td>
                    <td className="border border-black p-1 whitespace-nowrap">{row.ry || ""}</td>
                    <td className="border border-black p-1 whitespace-nowrap">{row.yb || ""}</td>
                    <td className="border border-black p-1 whitespace-nowrap">{row.br || ""}</td>
                    <td className="border border-black p-1 whitespace-nowrap">{row.r || ""}</td>
                    <td className="border border-black p-1 whitespace-nowrap">{row.y || ""}</td>
                    <td className="border border-black p-1 whitespace-nowrap">{row.b || ""}</td>
                    <td className="border border-black p-1 whitespace-nowrap">{row.pressure_guage || ""}</td>
                    {tempFields.length > 0 ? (
                      tempFields.map((f, i) => (
                        <td key={f.fieldname} className="border border-black p-1 whitespace-nowrap">{row[f.fieldname] || ""}</td>
                      ))
                    ) : (
                      <td className="border border-black p-1 whitespace-nowrap"></td>
                    )}
                    <td className="border border-black p-1 whitespace-nowrap">{row.water_level || ""}</td>
                    {/* Explicitly empty Remark and Sign */}
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  </>
  );
}