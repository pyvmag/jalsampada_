"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { LinkInput } from "@/components/LinkInput";
import { useAuth } from "@/context/AuthContext";
import jsPDF from 'jspdf';

// --- API Configuration ---
const API_BASE_URL = "http://103.219.3.169:2223/";
const REPORT_API_PATH = "api/method/frappe.desk.query_report.run";
const REPORT_NAME = "LIS Incident Report";

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
  custom_lis: string;
  custom_stage: string;
  asset: string;
  status: string;
};

type ColumnConfig = {
  fieldname: string;
  label: string;
  width: string;
  widthInt: number;
  isHtml?: boolean;
  formatter?: (value: any) => string;
  isSticky?: boolean;
  stickyLeft?: number;
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

const DEFAULT_COLUMN_WIDTHS: Record<string, string> = {
  name: "130px",
  opening_date: "120px",
  custom_incident_subject: "140px",
  priority: "60px",
  customer: "150px",
  raised_by: "130px",
  custom_lis: "120px",
  custom_stage: "150px",
  custom_asset: "120px",
  custom_asset_no: "100px",
  status: "60px",
  workflow_state: "100px",
  issue_type: "120px",
  description: "350px",
  first_responded_on: "180px",
  resolution_details: "350px",
};

const FIXED_COLUMNS_ORDER = [
  { fieldname: "name", label: "Incident Id", width: 130 },
  { fieldname: "opening_date", label: "Date", width: 100 },
  { fieldname: "custom_incident_subject", label: "Subject", width: 140 },
  { fieldname: "priority", label: "Priority", width: 60 }
];

const HTML_FIELDS = ["description", "resolution_details"];

export default function LISIncidentReportPage() {
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  // --- State ---
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [filteredData, setFilteredData] = useState<ReportData[]>([]);
  const [apiFields, setApiFields] = useState<ReportField[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    from_date: "",
    to_date: "",
    custom_lis: "",
    custom_stage: "",
    asset: "",
    status: "",
  });

  const tableRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState({
    isGrabbing: false,
    startX: 0,
    scrollLeft: 0,
  });

  // --- Dependent Filters Logic ---

  // 1. Filter Stage No based on LIS Name
  const stageFilters = useMemo(() => {
    if (filters.custom_lis) {
      // 'lis_name' is the fieldname in the "Stage No" doctype
      return { lis_name: filters.custom_lis };
    }
    return undefined;
  }, [filters.custom_lis]);

  // 2. Filter Asset based on LIS Name AND Stage No
  const assetFilters = useMemo(() => {
    const depFilters: Record<string, string> = {};

    if (filters.custom_lis) {
      // 'custom_lis_name' is the fieldname in the "Asset" doctype
      depFilters["custom_lis_name"] = filters.custom_lis;
    }

    if (filters.custom_stage) {
      // 'custom_stage_no' is the fieldname in the "Asset" doctype
      depFilters["custom_stage_no"] = filters.custom_stage;
    }

    return Object.keys(depFilters).length > 0 ? depFilters : undefined;
  }, [filters.custom_lis, filters.custom_stage]);

  // --- Configuration ---
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
          isHtml: HTML_FIELDS.includes(apiField.fieldname),
          formatter: getFieldFormatter(apiField.fieldtype),
          isSticky: true,
          stickyLeft: 0 // Will calculate below
        });
        apiFieldMap.delete(fixedDef.fieldname); // Remove from map so we don't add it again
      }
    });

    // Process remaining fields as Scrollable
    apiFields.forEach(field => {
      if (apiFieldMap.has(field.fieldname)) {
        const width = parseInt(DEFAULT_COLUMN_WIDTHS[field.fieldname]?.replace("px", "")) || field.width || 150;
        scrollableCols.push({
          fieldname: field.fieldname,
          label: field.label,
          width: `${width}px`,
          widthInt: width,
          isHtml: HTML_FIELDS.includes(field.fieldname),
          formatter: getFieldFormatter(field.fieldtype),
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

  function getFieldFormatter(fieldType: string): ((value: any) => string) | undefined {
    switch (fieldType) {
      case "Date":
        return formatDate;
      case "Datetime":
        return formatDateTime;
      default:
        return undefined;
    }
  }

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
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    const timer = setTimeout(() => {
      fetchReportData(filters);
    }, 500);

    return () => clearTimeout(timer);
  }, [filters, fetchReportData, isInitialized, isAuthenticated]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragState.isGrabbing) {
        setDragState(prev => ({ ...prev, isGrabbing: false }));
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragState.isGrabbing]);

  // --- Event Handlers ---
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
    link.setAttribute("download", "lis_incident_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    if (filteredData.length === 0) return;

    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const usableWidth = pageWidth - (margin * 2);
      const usableHeight = pageHeight - (margin * 2);

      pdf.setFont('helvetica');

      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('LIS Incident Report', pageWidth / 2, 20, { align: 'center' });

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const summaryY = 30;
      pdf.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`, margin, summaryY);
      pdf.text(`Total Records: ${filteredData.length}`, margin, summaryY + 7);

      const filtersApplied = Object.values(filters).filter(v => v).length > 0
        ? Object.entries(filters).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')
        : 'None';
      pdf.text(`Filters Applied: ${filtersApplied}`, margin, summaryY + 14);

      const columnWidths: number[] = [];
      const minColumnWidth = 20;
      const maxColumnWidth = usableWidth / 4;

      columnConfig.forEach(col => {
        let maxWidth = pdf.getStringUnitWidth(col.label) * pdf.getFontSize();
        filteredData.forEach(row => {
          const value = row[col.fieldname];
          let displayValue = value === null || value === undefined || value === '' ? '-' : String(value);

          if (col.isHtml && typeof displayValue === 'string') {
            displayValue = displayValue.replace(/<[^>]*>?/gm, '');
          }

          const textWidth = pdf.getStringUnitWidth(displayValue) * pdf.getFontSize();
          if (textWidth > maxWidth) {
            maxWidth = textWidth;
          }
        });
        let colWidth = maxWidth / pdf.internal.scaleFactor;
        colWidth = Math.max(minColumnWidth, Math.min(maxColumnWidth, colWidth));
        columnWidths.push(colWidth);
      });

      const totalCalculatedWidth = columnWidths.reduce((sum, width) => sum + width, 0);
      const scaleFactor = usableWidth / totalCalculatedWidth;
      const finalColumnWidths = columnWidths.map(width => width * scaleFactor);

      let currentY = summaryY + 25;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');

      let headerMaxHeight = 0;
      columnConfig.forEach((col, index) => {
        const text = col.label;
        const textLines = pdf.splitTextToSize(text, finalColumnWidths[index] - 4);
        const textHeight = (textLines.length * pdf.getFontSize()) / pdf.internal.scaleFactor;
        if (textHeight > headerMaxHeight) {
          headerMaxHeight = textHeight;
        }
      });

      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, currentY - 5, usableWidth, headerMaxHeight + 5, 'F');

      pdf.setTextColor(0, 0, 0);
      columnConfig.forEach((col, index) => {
        const x = margin + finalColumnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
        const text = col.label;
        const textLines = pdf.splitTextToSize(text, finalColumnWidths[index] - 4);
        const textHeight = (textLines.length * pdf.getFontSize()) / pdf.internal.scaleFactor;
        const yOffset = (headerMaxHeight + 5 - textHeight) / 2;
        pdf.text(textLines, x + 2, currentY - 5 + yOffset);
      });

      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, currentY + headerMaxHeight + 3, pageWidth - margin, currentY + headerMaxHeight + 3);

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      currentY += headerMaxHeight + 8;

      let rowsOnPage = 0;
      const maxRowsPerPage = Math.floor((usableHeight - currentY) / 10);

      filteredData.forEach((row, rowIndex) => {
        if (rowsOnPage >= maxRowsPerPage) {
          pdf.addPage();
          currentY = margin + 10;
          rowsOnPage = 0;

          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, currentY - 5, usableWidth, headerMaxHeight + 5, 'F');

          pdf.setTextColor(0, 0, 0);
          columnConfig.forEach((col, index) => {
            const x = margin + finalColumnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
            const text = col.label;
            const textLines = pdf.splitTextToSize(text, finalColumnWidths[index] - 4);
            const textHeight = (textLines.length * pdf.getFontSize()) / pdf.internal.scaleFactor;
            const yOffset = (headerMaxHeight + 5 - textHeight) / 2;
            pdf.text(textLines, x + 2, currentY - 5 + yOffset);
          });

          pdf.setDrawColor(200, 200, 200);
          pdf.line(margin, currentY + headerMaxHeight + 3, pageWidth - margin, currentY + headerMaxHeight + 3);

          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'normal');
          currentY += headerMaxHeight + 8;
        }

        if (rowIndex % 2 === 1) {
          pdf.setFillColor(249, 249, 249);
          pdf.rect(margin, currentY - 4, usableWidth, 8, 'F');
        }

        let rowMaxHeight = 0;

        columnConfig.forEach((col, index) => {
          const x = margin + finalColumnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
          const value = row[col.fieldname];
          let displayValue = value === null || value === undefined || value === '' ? '-' : String(value);

          if (col.isHtml && typeof displayValue === 'string') {
            displayValue = displayValue.replace(/<[^>]*>?/gm, '');
          }

          if (col.formatter) {
            displayValue = col.formatter(value);
          }

          const textLines = pdf.splitTextToSize(displayValue, finalColumnWidths[index] - 4);
          const textHeight = (textLines.length * pdf.getFontSize()) / pdf.internal.scaleFactor;

          if (textHeight > rowMaxHeight) {
            rowMaxHeight = textHeight;
          }
        });

        pdf.setTextColor(0, 0, 0);
        columnConfig.forEach((col, index) => {
          const x = margin + finalColumnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
          const value = row[col.fieldname];
          let displayValue = value === null || value === undefined || value === '' ? '-' : String(value);

          if (col.isHtml && typeof displayValue === 'string') {
            displayValue = displayValue.replace(/<[^>]*>?/gm, '');
          }

          if (col.formatter) {
            displayValue = col.formatter(value);
          }

          const textLines = pdf.splitTextToSize(displayValue, finalColumnWidths[index] - 4);
          pdf.text(textLines, x + 2, currentY);
        });

        pdf.setDrawColor(200, 200, 200);
        let xPos = margin;
        finalColumnWidths.forEach((width, index) => {
          pdf.line(xPos, currentY - 4, xPos, currentY + rowMaxHeight);
          xPos += width;
        });
        pdf.line(pageWidth - margin, currentY - 4, pageWidth - margin, currentY + rowMaxHeight);
        pdf.line(margin, currentY + rowMaxHeight, pageWidth - margin, currentY + rowMaxHeight);

        currentY += rowMaxHeight + 2;
        rowsOnPage++;
      });

      pdf.save(`lis_incident_report_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
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

  const totalTableWidth = useMemo(() => {
    return columnConfig.reduce((total, col) => total + col.widthInt, 0);
  }, [columnConfig]);

  const renderCellValue = (row: ReportData, col: ColumnConfig) => {
    const value = row[col.fieldname];

    if (value === null || value === undefined || value === "") {
      return "-";
    }

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

  return (
    <div className="module active">
      <div className="module-header">
        <div>
          <h2>LIS Incident Report</h2>
          <p>Track issues, maintenance requests, and incidents.</p>
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
            <button className="btn btn--danger" onClick={handleExportPDF}>
              <i className="fas fa-file-pdf"></i> PDF
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
          <div className="form-group z-[50]">
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
          <div className="form-group z-[50]">
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

          <div className="form-group z-[50]">
            <label className="text-sm font-medium mb-1 block">LIS Name</label>
            <LinkInput
              value={filters.custom_lis}
              onChange={(value) => handleFilterChange("custom_lis", value)}
              placeholder="Select LIS..."
              linkTarget="Lift Irrigation Scheme"
              className="w-full relative"
            />
          </div>

          <div className="form-group z-[50]">
            <label className="text-sm font-medium mb-1 block">Stage No</label>
            <LinkInput
              value={filters.custom_stage}
              onChange={(value) => handleFilterChange("custom_stage", value)}
              placeholder="Select Stage..."
              linkTarget="Stage No"
              filters={stageFilters}
              className="w-full relative"

            />
          </div>

          <div className="form-group z-[50]">
            <label className="text-sm font-medium mb-1 block">Asset</label>
            <LinkInput
              value={filters.asset}
              onChange={(value) => handleFilterChange("asset", value)}
              placeholder="Select Asset..."
              linkTarget="Asset"
              filters={assetFilters}
              className="w-full relative"
            />
          </div>

          <div className="form-group z-[50]">
            <label className="text-sm font-medium mb-1 block">Status</label>
            <select
              className="form-control w-full"
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
              <option value="Replied">Replied</option>
              <option value="On Hold">On Hold</option>
              <option value="Resolved">Resolved</option>
            </select>
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
            willChange: dragState.isGrabbing ? "transform" : "auto",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <table
            className="stock-table sticky-header-table"
            style={{ minWidth: `${totalTableWidth}px`, borderCollapse: "separate", borderSpacing: 0 }}
          >
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
                      borderRight: column.isSticky ? "none" : "none",
                      boxShadow: column.isSticky && column.fieldname === "priority" ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none"
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
                          position: column.isSticky ? "sticky" : "relative",
                          left: column.isSticky ? `${column.stickyLeft}px` : "auto",
                          zIndex: column.isSticky ? 10 : 1,
                          backgroundColor: "white",
                          borderRight: column.isSticky ? "none" : "none",
                          boxShadow: column.isSticky && column.fieldname === "priority" ? "4px 0 5px -2px rgba(0,0,0,0.1)" : "none"
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