"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { LinkInput } from "@/components/LinkInput";
import { useAuth } from "@/context/AuthContext";

// --- API Configuration ---
const API_BASE_URL = "http://103.219.3.169:2223/";
const REPORT_API_PATH = "api/method/frappe.desk.query_report.run";
const REPORT_NAME = "Tender Level Report";

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
  custom_fiscal_year: string;
  from_date: string;
  to_date: string;
  custom_lis_name: string;
  custom_prapan_suchi: string;
  custom_tender_status: string;
};

type ColumnConfig = {
  fieldname: string;
  label: string;
  width: string;
  formatter?: (value: any, row?: any) => React.ReactNode;
};

// --- Helper Functions ---
const formatDate = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB");
};

const formatCurrency = (amount: number | string | null) => {
  if (amount === null || amount === undefined || amount === "") return "-";
  return `₹ ${parseFloat(String(amount)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
};

const DEFAULT_COLUMN_WIDTHS: Record<string, string> = {
  name: "150px",
  custom_fiscal_year: "100px",
  custom_lis_name: "100px",
  custom_stage: "250px",
  custom_prapan_suchi: "150px",
  custom_work_order: "110px",
  custom_tender_amount: "150px",
  custom_tender_status: "120px",
  expected_start_date: "120px",
  custom_expected_date: "180px", // Adjusted width for longer title
  notes: "250px",
  custom_contractor_company: "200px",
  custom_contractor_name: "200px",
  custom_mobile_no: "120px",
  custom_email_id: "200px",
  custom_gst: "120px",
  custom_pan: "120px",
  custom_aadhaar_no: "150px",
  custom_supplier_address: "250px",
  custom_is_extension: "120px",
  extension_count: "120px",
  extension_upto: "120px",
};

const COLUMN_ORDER = [
  "custom_fiscal_year",
  "name",
  "custom_prapan_suchi",
  "custom_lis_name",
  "custom_stage",
  "custom_work_order",
  "expected_start_date",
  "custom_tender_amount",
  "custom_tender_status",
  "custom_expected_date",
  "notes",
  "custom_contractor_company",
  "custom_contractor_name",
  "custom_mobile_no",
  "custom_email_id",
  "custom_gst",
  "custom_pan",
  "custom_aadhaar_no",
  "custom_supplier_address",
];

const STICKY_COLUMNS = [
  "custom_fiscal_year",
  "name",
  "custom_prapan_suchi",
];

export default function TenderLevelReport() {
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  // --- State ---
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [filteredData, setFilteredData] = useState<ReportData[]>([]);
  const [apiFields, setApiFields] = useState<ReportField[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    custom_fiscal_year: "",
    from_date: "",
    to_date: "",
    custom_lis_name: "",
    custom_prapan_suchi: "",
    custom_tender_status: "",
  });

  const tableRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState({
    isGrabbing: false,
    startX: 0,
    scrollLeft: 0,
  });

  const columnConfig = useMemo((): ColumnConfig[] => {
    if (!apiFields.length) return [];
    const filteredFields = apiFields.filter(
      field => field.fieldname !== "custom_posting_date"
    );

    const fieldMap = new Map(
      filteredFields.map(field => [field.fieldname, field])
    );

    const ordered: ReportField[] = [];

    COLUMN_ORDER.forEach(fieldname => {
      if (fieldMap.has(fieldname)) {
        ordered.push(fieldMap.get(fieldname)!);
        fieldMap.delete(fieldname);
      }
    });

    fieldMap.forEach(field => ordered.push(field));

    return ordered.map(field => {
      let label = field.label;

      // Override specific labels
      if (field.fieldname === "name") label = "Tender No";
      if (field.fieldname === "custom_prapan_suchi") label = "Name of Work";
      if (field.fieldname === "expected_start_date") label = "Work Order Date";

      return {
        fieldname: field.fieldname,
        label: label,
        width: DEFAULT_COLUMN_WIDTHS[field.fieldname] || `${field.width || 150}px`,
        formatter: getFieldFormatter(field.fieldtype, field.fieldname),
      };
    });
  }, [apiFields]);

  const stickyLeftMap = useMemo(() => {
    let left = 0;
    const map: Record<string, string> = {};

    columnConfig.forEach(col => {
      if (STICKY_COLUMNS.includes(col.fieldname)) {
        map[col.fieldname] = `${left}px`;
        left += parseInt(col.width.replace("px", "")) || 150;
      }
    });

    return map;
  }, [columnConfig]);

  function getFieldFormatter(fieldType: string, fieldName: string): ((value: any, row?: any) => React.ReactNode) | undefined {
    // Special handling for Status column to add badges
    if (fieldName === "custom_tender_status") {
      return (value) => {
        let colorClass = "bg-gray-100 text-gray-800";
        if (value === "Completed") colorClass = "bg-green-100 text-green-800";
        else if (value === "Ongoing") colorClass = "bg-blue-100 text-blue-800";
        else if (value === "Cancelled" || value === "Canceled") colorClass = "bg-red-100 text-red-800";

        return (
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
            {value}
          </span>
        );
      };
    }

    // Special handling for notes field to strip HTML tags
    if (fieldName === "notes") {
      return (value) => {
        if (!value) return "-";
        const getText = (html: string) => {
          return new DOMParser().parseFromString(html, "text/html").body.textContent;
        };
        const textContent = getText(value) || "";
        return textContent || "-";
      };
    }

    switch (fieldType) {
      case "Date":
        return (val) => formatDate(val);
      case "Currency":
        return (val) => formatCurrency(val);
      default:
        return undefined;
    }
  }

  // --- Dependent Filters Logic ---
  // CORRECTION: Removed '&& filters.custom_prapan_suchi' check.
  // We want to filter the OPTIONS based on LIS immediately, even if no work is selected yet.
  const prapanSuchiFilters = useMemo(() => {
    const depFilters: Record<string, string> = {};

    // Filter the 'Name of Work' list based on the selected LIS
    if (filters.custom_lis_name) {
      depFilters["lis_name"] = filters.custom_lis_name;
    }

    // Filter based on Fiscal Year (if your Prapan Suchi doctype has this field)
    if (filters.custom_fiscal_year) {
      depFilters["fiscal_year"] = filters.custom_fiscal_year;
    }

    return Object.keys(depFilters).length > 0 ? depFilters : undefined;
  }, [filters.custom_lis_name, filters.custom_fiscal_year]); // Removed filters.custom_prapan_suchi from dependency array

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
          // Skip custom_prapan_suchi filter for server-side since it's handled client-side
          if (key !== 'custom_prapan_suchi') {
            cleanedFilters[key] = value;
          }
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

  // --- Effects ---
  // Auto-refresh when server-side filters change (Debounced 500ms)
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    // Only trigger server refresh for filters that are handled server-side
    const serverFilters: Filters = {
      from_date: filters.from_date,
      to_date: filters.to_date,
      custom_lis_name: filters.custom_lis_name,
      custom_fiscal_year: filters.custom_fiscal_year,
      custom_tender_status: filters.custom_tender_status,
      custom_prapan_suchi: "" // Empty since it's handled client-side
    };

    const timer = setTimeout(() => {
      fetchReportData(serverFilters);
    }, 500);

    return () => clearTimeout(timer);
  }, [filters.from_date, filters.to_date, filters.custom_lis_name, filters.custom_fiscal_year, filters.custom_tender_status, fetchReportData, isInitialized, isAuthenticated]);

  // --- Client-side filtering effect ---
  useEffect(() => {
    if (!reportData.length) {
      setFilteredData([]);
      return;
    }

    let filtered = [...reportData];

    // Apply all client-side filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim()) {
        switch (key) {
          case 'custom_prapan_suchi':
            filtered = filtered.filter(row => {
              const prapanSuchi = row.custom_prapan_suchi;
              return prapanSuchi &&
                prapanSuchi.toString().toLowerCase() === value.toLowerCase();
            });
            break;
          case 'custom_lis_name':
            filtered = filtered.filter(row => {
              const lisName = row.custom_lis_name;
              return lisName &&
                lisName.toString().toLowerCase() === value.toLowerCase();
            });
            break;
          case 'custom_fiscal_year':
            filtered = filtered.filter(row => {
              const fiscalYear = row.custom_fiscal_year;
              return fiscalYear &&
                fiscalYear.toString().toLowerCase() === value.toLowerCase();
            });
            break;
          case 'custom_tender_status':
            filtered = filtered.filter(row => {
              const status = row.custom_tender_status;
              return status &&
                status.toString().toLowerCase() === value.toLowerCase();
            });
            break;
          case 'from_date':
            filtered = filtered.filter(row => {
              const postingDate = row.custom_posting_date;
              if (!postingDate) return false;
              return new Date(postingDate) >= new Date(value);
            });
            break;
          case 'to_date':
            filtered = filtered.filter(row => {
              const postingDate = row.custom_posting_date;
              if (!postingDate) return false;
              return new Date(postingDate) <= new Date(value);
            });
            break;
        }
      }
    });

    setFilteredData(filtered);
  }, [reportData, filters]);

  // --- Handlers ---
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;

    const headers = columnConfig.map(c => c.label).join(",");
    const rows = filteredData.map(row => {
      return columnConfig.map(col => {
        let val = row[col.fieldname];
        val = val === null || val === undefined ? "" : String(val);
        // CSV safe string
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
    link.setAttribute("download", "tender_level_report.csv");
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
  }, [columnConfig]);

  const renderCellValue = (row: ReportData, col: ColumnConfig) => {
    const value = row[col.fieldname];

    if (col.formatter) {
      return col.formatter(value, row);
    }

    if (value === null || value === undefined || value === "") {
      return "-";
    }
    return String(value);
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
          <h2>Tender Level Report</h2>
          <p>Track detailed status, stages, and amounts of tenders.</p>
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

        {/* Filters Grid - High Z-Index for Dropdowns */}
        <div className="filters-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 relative z-[60]">
          <div className="form-group z-[70]">
            <label className="text-sm font-medium mb-1 block">Fiscal Year</label>
            <LinkInput
              value={filters.custom_fiscal_year}
              onChange={(value) => handleFilterChange("custom_fiscal_year", value)}
              placeholder="Select Year..."
              linkTarget="Fiscal Year"
              className="w-full relative"
            />
          </div>
          <div className="form-group z-[69]">
            <label className="text-sm font-medium mb-1 block">From Date</label>
            <input
              type="date"
              className="form-control w-full"
              placeholder="DD-MM-YYYY"
              style={{ textTransform: "uppercase" }}
              value={filters.from_date}
              onChange={(e) => handleFilterChange("from_date", e.target.value)}
            />
          </div>
          <div className="form-group z-[68]">
            <label className="text-sm font-medium mb-1 block">To Date</label>
            <input
              type="date"
              className="form-control w-full"
              placeholder="DD-MM-YYYY"
              style={{ textTransform: "uppercase" }}
              value={filters.to_date}
              onChange={(e) => handleFilterChange("to_date", e.target.value)}
            />
          </div>

          <div className="form-group z-[67]">
            <label className="text-sm font-medium mb-1 block">LIS Name</label>
            <LinkInput
              value={filters.custom_lis_name}
              onChange={(value) => handleFilterChange("custom_lis_name", value)}
              placeholder="Select LIS..."
              linkTarget="Lift Irrigation Scheme"
              className="w-full relative"
            />
          </div>

          {/* Dependent Filter: Name of Work (Prapan Suchi) - with LIS filter and work_name field instead of Id */}
          <div className="form-group z-[66]">
            <label className="text-sm font-medium mb-1 block">Name of Work</label>
            <LinkInput
              value={filters.custom_prapan_suchi}
              onChange={(value) => handleFilterChange("custom_prapan_suchi", value)}
              placeholder="Select Work..."
              linkTarget="Prapan Suchi"
              filters={prapanSuchiFilters} // Applies LIS & Fiscal Year filters
              className="w-full relative"
            />
          </div>

          <div className="form-group z-[65]">
            <label className="text-sm font-medium mb-1 block">Tender Status</label>
            <select
              className="form-control w-full"
              value={filters.custom_tender_status}
              onChange={(e) => handleFilterChange("custom_tender_status", e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Report Table */}
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
          <table
            className="stock-table sticky-header-table"
            style={{ minWidth: `${totalTableWidth}px` }}
          >
            <thead style={{ position: "sticky", top: 0, zIndex: 30, backgroundColor: "#3683f6" }}>
              <tr>
                {columnConfig.map((column) => (
                  <th
                    key={column.fieldname}
                    style={{
                      width: column.width,
                      position: STICKY_COLUMNS.includes(column.fieldname) ? "sticky" : "relative",
                      left: stickyLeftMap[column.fieldname] || "auto",
                      zIndex: STICKY_COLUMNS.includes(column.fieldname) ? 30 : 20,
                      backgroundColor: "#3683f6",
                      color: "white",
                      borderRight: "none",
                      boxShadow: STICKY_COLUMNS.includes(column.fieldname) &&
                        column.fieldname === STICKY_COLUMNS[STICKY_COLUMNS.length - 1]
                        ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none"
                    }}
                  >
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
                      <td
                        key={`${index}-${column.fieldname}`}
                        style={{
                          position: STICKY_COLUMNS.includes(column.fieldname) ? "sticky" : "relative",
                          left: stickyLeftMap[column.fieldname] || "auto",
                          zIndex: STICKY_COLUMNS.includes(column.fieldname) ? 10 : 1,
                          backgroundColor: "white",
                          borderRight: "none",
                          boxShadow: STICKY_COLUMNS.includes(column.fieldname) &&
                            column.fieldname === STICKY_COLUMNS[STICKY_COLUMNS.length - 1]
                            ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none"
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
