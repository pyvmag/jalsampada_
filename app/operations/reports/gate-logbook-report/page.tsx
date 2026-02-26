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
const REPORT_NAME = "Gate LogBook Report";

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
  lis_phase: string;
  stage: string;
  gate_no: string;
  from_date: string;
  to_date: string;
};

type ColumnConfig = {
  fieldname: string;
  label: string;
  width: string;
  isHtml?: boolean;
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

// --- Column Configuration (UPDATED) ---
const columnConfig: ColumnConfig[] = [
  { fieldname: "name", label: "Doc Name", width: "150px" },
  { fieldname: "lis_name", label: "LIS Name", width: "150px" },
  { fieldname: "stage", label: "Stage", width: "150px" },
  { fieldname: "gate_no", label: "Gate No.", width: "120px" },
  { fieldname: "lift_by", label: "Lifted By", width: "150px" },
  { fieldname: "lowered_by", label: "Lowered By", width: "150px" },
  { fieldname: "lift_date", label: "Lift Date", width: "160px", formatter: formatDateTime },
  { fieldname: "lowered_date", label: "Lowered Date", width: "160px", formatter: formatDateTime },
  { fieldname: "instruction_reference", label: "Instruction Reference", width: "200px" },
  { fieldname: "remark", label: "Remark", width: "220px" },
];

export default function GateLogBookSheetReportPage() {
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [filteredData, setFilteredData] = useState<ReportData[]>([]);
  const [apiFields, setApiFields] = useState<ReportField[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    lis_name: "",
    lis_phase: "",
    stage: "",
    gate_no: "",
    from_date: "",
    to_date: "",
  });

  // --- Fetch Report ---
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

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;
    const timer = setTimeout(() => {
      fetchReportData(filters);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters, fetchReportData, isInitialized, isAuthenticated]);

  // --- CSV Export (UNCHANGED) ---
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;

    const headers = columnConfig.map(c => c.label).join(",");
    const rows = filteredData.map(row => {
      return columnConfig.map(col => {
        let val = row[col.fieldname];
        if (col.isHtml && typeof val === 'string') {
          val = val.replace(/<[^>]*>?/gm, '');
        }
        val = val === null || val === undefined ? "" : String(val);
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
    link.setAttribute("download", "gate_logbook_report.csv");
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
    if (value === null || value === undefined || value === "") return "-";
    if (col.isHtml) {
      return (
        <div
          className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300"
          dangerouslySetInnerHTML={{ __html: String(value) }}
        />
      );
    }
    if (col.formatter) return col.formatter(value);
    return String(value);
  };

  return (
    <div className="module active">
      <div className="module-header">
        <div>
          <h2>Gate Logbook Ledger</h2>
          <p>Track gate lifting and lowering entries.</p>
        </div>

        <div className="flex gap-2">
          <button className="btn btn--primary" onClick={() => fetchReportData(filters)} disabled={loading}>
            <i className="fas fa-sync-alt"></i> {loading ? "Refreshing..." : "Refresh"}
          </button>
          <div className="export-buttons flex gap-2 ml-2">
            <button className="btn btn--outline" onClick={handleExportCSV}>
              <i className="fas fa-file-csv"></i> CSV
            </button>
          </div>
        </div>
      </div>

      <div className="filters-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 relative z-[60]">

        <div className="form-group z-[110]">
          <label className="text-sm font-medium mb-1 block">From Date</label>
          <DatePicker
            selected={filters.from_date ? new Date(filters.from_date) : null}
            onChange={(date: Date | null) =>
              handleFilterChange("from_date", date ? date.toISOString() : "")
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
              handleFilterChange("to_date", date ? date.toISOString() : "")
            }
            placeholderText="DD/MM/YYYY"
            dateFormat="dd/MM/yyyy"
            className="form-control w-full placeholder:uppercase"
          />
        </div>

        <div className="form-group z-[50]">
          <label className="text-sm font-medium mb-1 block">LIS</label>
          <LinkInput
            value={filters.lis_name}
            onChange={(value) => handleFilterChange("lis_name", value)}
            placeholder="Select LIS..."
            linkTarget="Lift Irrigation Scheme"
            className="w-full relative"
          />
        </div>

        <div className="form-group z-[50]">
          <label className="text-sm font-medium mb-1 block">Stage</label>
          <LinkInput
            value={filters.stage}
            onChange={(value) => handleFilterChange("stage", value)}
            placeholder="Select Stage..."
            linkTarget="Stage No"
            filters={{ lis_name: filters.lis_name || undefined }}
            className="w-full"
          />
        </div>

        <div className="form-group z-[50]">
          <label className="text-sm font-medium mb-1 block">Gate No</label>
          <LinkInput
            value={filters.gate_no}
            onChange={(value) => handleFilterChange("gate_no", value)}
            placeholder="Select Gate..."
            linkTarget="Gate"
            className="w-full"
          />
        </div>

      </div>

      <div className="stock-table-container border rounded-md relative z-10"
        style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
        <table className="stock-table sticky-header-table" style={{ minWidth: `${totalTableWidth}px` }}>
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
                <td colSpan={columnConfig.length} style={{ textAlign: "center", padding: "40px" }}>
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
  );
}