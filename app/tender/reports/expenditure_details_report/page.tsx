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
  stage: string;
  work_type: string;
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

// --- CONFIG: Define Fixed Columns Order & Widths ---
// Only first column (tender_number) is fixed
const FIXED_COLUMNS_ORDER = [
  { fieldname: "tender_number", label: "Tender Number", width: 150 },
  { fieldname: "bill_type", label: "Bill Type", width: 100 },
  { fieldname: "bill_number", label: "Bill No.", width: 150 },
  { fieldname: "bill_date", label: "Bill Date", width: 100 },
];

// Default column widths for remaining columns
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  fiscal_year: 120,
  lis: 120,
  stage: 140,
  work_type: 150,
  work_subtype: 150,
  asset_no: 100,
  bill_type: 150,
  bill_amount: 150,
  bill_number: 150,
  bill_date: 130,
  remarks: 300,
};

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
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);

  const [filters, setFilters] = useState<Filters>({
    fiscal_year: "",
    from_date: getOneMonthAgo(),
    to_date: getToday(),
    lift_irrigation_scheme: "",
    stage: "",
    work_type: "",
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

    // 1. Separate Fixed columns from Scrollable columns
    let fixedCols: ColumnConfig[] = [];
    let scrollableCols: ColumnConfig[] = [];

    // Create a map for quick lookup of API fields
    const apiFieldMap = new Map(apiFields.map(f => [f.fieldname, f]));

    // Process Fixed Columns based on defined order (only first column)
    FIXED_COLUMNS_ORDER.forEach(fixedDef => {
      const apiField = apiFieldMap.get(fixedDef.fieldname);
      if (apiField) {
        fixedCols.push({
          fieldname: apiField.fieldname,
          label: apiField.label,
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
        const width = DEFAULT_COLUMN_WIDTHS[field.fieldname] || field.width || 150;
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

    // 2. Calculate Left Offsets for Sticky Columns (only one column in this case)
    let currentLeftOffset = 0;
    fixedCols = fixedCols.map((col, index) => {
      const updatedCol = {
        ...col,
        stickyLeft: currentLeftOffset,
        isLastSticky: index === fixedCols.length - 1
      };
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

  // --- Export Handlers ---
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
    link.download = `expenditure_details_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    if (reportData.length === 0) return;

    setPdfLoading(true);

    try {
      const { jsPDF } = await import('jspdf');

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const usableWidth = pageWidth - (margin * 2);

      // Title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('Expenditure Details Report', pageWidth / 2, 20, { align: 'center' });

      // Summary
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, margin, 30);
      pdf.text(`Total Records: ${reportData.length}`, margin, 37);

      // Calculate column widths proportionally
      const columnWidths: number[] = [];
      const totalSpecifiedWidth = columnConfig.reduce((sum, col) => {
        return sum + col.widthInt;
      }, 0);

      columnConfig.forEach(col => {
        const proportionalWidth = (col.widthInt / totalSpecifiedWidth) * usableWidth;
        columnWidths.push(proportionalWidth);
      });

      // Headers
      let currentY = 50;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');

      columnConfig.forEach((col, index) => {
        const x = margin + columnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
        pdf.text(col.label, x + 2, currentY);
      });

      // Draw header underline
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

      // Data rows
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      currentY += 8;

      reportData.forEach((row, rowIndex) => {
        if (currentY > pdf.internal.pageSize.getHeight() - 20) {
          pdf.addPage();
          currentY = 20;

          // Redraw headers on new page
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          columnConfig.forEach((col, index) => {
            const x = margin + columnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
            pdf.text(col.label, x + 2, currentY);
          });
          pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          currentY += 8;
        }

        // Alternate row background
        if (rowIndex % 2 === 1) {
          pdf.setFillColor(249, 249, 249);
          pdf.rect(margin, currentY - 4, usableWidth, 10, 'F');
        }

        columnConfig.forEach((col, index) => {
          const x = margin + columnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
          let value = row[col.fieldname];

          if (value === null || value === undefined || value === '') {
            value = '';
          } else if (col.formatter) {
            value = col.formatter(value);
          } else {
            value = String(value);
          }

          // Split text if too long
          const textLines = pdf.splitTextToSize(value, columnWidths[index] - 4);
          pdf.text(textLines, x + 2, currentY);
        });

        currentY += 10;
      });

      pdf.save(`expenditure_details_report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [field]: value };
      // Clear dependent filters
      if (field === 'lift_irrigation_scheme') {
        newFilters.stage = "";
        newFilters.tender_number = "";
      }
      if (field === 'stage') {
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
    <div className="module active">
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
              className="btn btn--danger"
              onClick={handleExportPDF}
              disabled={pdfLoading || reportData.length === 0}
            >
              <i className={`fas ${pdfLoading ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
              {pdfLoading ? 'Generating...' : 'PDF'}
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
              value={filters.stage}
              onChange={(v) => handleFilterChange("stage", v)}
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
                custom_stage_no: filters.stage || undefined
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
    </div >
  );
}