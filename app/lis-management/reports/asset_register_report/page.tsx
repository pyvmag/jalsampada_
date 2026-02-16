"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { LinkInput } from "@/components/LinkInput";
import jsPDF from 'jspdf';

// --- API Configuration ---
const API_BASE_URL = "http://103.219.1.138:4412/";

// --- Type Definitions ---
type AssetReportField = {
    label: string;
    fieldname: string;
    fieldtype: string;
    options?: string;
    width?: number;
};

type AssetReportData = Record<string, any>;

type Filters = {
    custom_lis_name: string;
    custom_stage_no: string;
    asset_category: string;
    custom_doctype_name: string;
};

type ColumnConfig = {
    fieldname: string;
    label: string;
    width: string;
    formatter?: (value: any) => string;
};

// --- Helper Functions ---
const formatDate = (dateString: string | null): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
};

const formatCurrency = (amount: number | string | null) => {
    if (amount === null || amount === undefined || amount === "") return "-";
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(Number(amount) * 100000);
};

// Default column widths for fields without API width
const DEFAULT_COLUMN_WIDTHS: Record<string, string> = {
    custom_lis_name: "150px",
    custom_stage_no: "200px",
    custom_doctype_name: "300px",
    custom_asset_no: "150px",
    asset_category: "200px",
    make_model: "200px",
    capacity_rating: "150px",
    location: "200px",
    custom_installation_date: "150px",
    custom_condition: "150px",
    custom_last_repair_date: "150px",
    net_purchase_amount: "180px",
    total_expenditure: "180px"
};

const COLUMN_ORDER = [
    "custom_lis_name",
    "custom_stage_no",
    "custom_doctype_name",
    "custom_asset_no",
    "asset_category",
    "make_model",
    "capacity_rating",
    "location",
    "custom_installation_date",
    "custom_condition",
    "custom_last_repair_date",
    "net_purchase_amount",
    "total_expenditure"
];

const STICKY_COLUMNS = [
    "custom_lis_name",
    "custom_stage_no",
    "custom_doctype_name",
    "custom_asset_no"
];

export default function AssetRegisterReport() {
    // --- State ---
    const [reportData, setReportData] = useState<AssetReportData[]>([]);
    const [filteredData, setFilteredData] = useState<AssetReportData[]>([]);
    const [apiFields, setApiFields] = useState<AssetReportField[]>([]);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [filters, setFilters] = useState<Filters>({
        custom_lis_name: '',
        custom_stage_no: '',
        asset_category: '',
        custom_doctype_name: ''
    });

    const tableRef = useRef<HTMLDivElement>(null);
    const [dragState, setDragState] = useState({
        isGrabbing: false,
        startX: 0,
        scrollLeft: 0,
    });

    // --- Column Configuration ---
    const columnConfig = useMemo((): ColumnConfig[] => {
        if (!apiFields.length) return [];

        const reorderedFields = [...apiFields].sort((a, b) => {
            const aIndex = COLUMN_ORDER.indexOf(a.fieldname);
            const bIndex = COLUMN_ORDER.indexOf(b.fieldname);

            if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
            }

            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;

            return 0;
        });

        return reorderedFields.map(field => ({
            fieldname: field.fieldname,
            label: field.label,
            width: DEFAULT_COLUMN_WIDTHS[field.fieldname] || `${field.width || 150}px`,
            formatter: getFieldFormatter(field.fieldtype)
        }));
    }, [apiFields]);

    // --- Sticky Columns Calculation ---
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

    // --- Field Formatter ---
    function getFieldFormatter(fieldType: string): ((value: any) => string) | undefined {
        switch (fieldType) {
            case 'Date':
                return formatDate;
            case 'Currency':
                return formatCurrency;
            default:
                return undefined;
        }
    }


    // --- Dependent Filters Logic ---
    const stageNoFilters = useMemo(() => {
        const depFilters: Record<string, string> = {};

        if (filters.custom_lis_name) {
            depFilters["lis_name"] = filters.custom_lis_name;
        }

        return Object.keys(depFilters).length > 0 ? depFilters : undefined;
    }, [filters.custom_lis_name]);

    const assetIdFilters = useMemo(() => {
        const depFilters: Record<string, string> = {};

        // Use 'custom_lis_name' as it's a custom field in Asset for LIS
        if (filters.custom_lis_name) depFilters["custom_lis_name"] = filters.custom_lis_name;

        // Use 'custom_stage_no' as it's a custom field in Asset for Stage
        if (filters.custom_stage_no) depFilters["custom_stage_no"] = filters.custom_stage_no;

        if (filters.asset_category) depFilters["asset_category"] = filters.asset_category;

        return Object.keys(depFilters).length > 0 ? depFilters : undefined;
    }, [filters.custom_lis_name, filters.custom_stage_no, filters.asset_category]);

    // --- Actions ---
    const fetchReportData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${API_BASE_URL}api/method/quantlis_management.lis_management.report.asset_register_report.asset_register_report.execute`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const [fields, data] = result.message;

            setApiFields(fields);
            setReportData(data);
            setFilteredData(data);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to fetch data");
        } finally {
            setLoading(false);
        }
    }, []);

    // --- Effects ---
    // Auto-refresh when filters change (Debounced 500ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            // Apply client-side filtering
            if (!reportData.length) {
                setFilteredData([]);
                return;
            }

            let filtered = [...reportData];

            Object.entries(filters).forEach(([key, value]) => {
                if (value && value.trim()) {
                    filtered = filtered.filter(row => {
                        const rowValue = row[key];
                        return rowValue && rowValue.toString().toLowerCase() === value.toLowerCase();
                    });
                }
            });

            setFilteredData(filtered);
        }, 500);

        return () => clearTimeout(timer);
    }, [filters, reportData]);

    // Fetch data on component mount
    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    // --- Handlers ---
    const handleExportCSV = () => {
        if (filteredData.length === 0) return;

        const headers = columnConfig.map(c => c.label).join(",");
        const rows = filteredData.map(row => {
            return columnConfig.map(col => {
                let val = row[col.fieldname];
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
        link.setAttribute("download", "asset_register_report.csv");
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

    const renderCellValue = (row: AssetReportData, col: ColumnConfig) => {
        const value = row[col.fieldname];

        if (col.formatter) {
            return col.formatter(value);
        }

        if (value === null || value === undefined || value === "") {
            return "-";
        }
        return String(value);
    };

    // --- Mouse Handlers ---
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

    // Global mouse up handler
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (dragState.isGrabbing) {
                setDragState(prev => ({ ...prev, isGrabbing: false }));
            }
        };

        document.addEventListener('mouseup', handleGlobalMouseUp);
        return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [dragState.isGrabbing]);

    // PDF Export Function
    const exportToPDF = async () => {
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

            // Pre-calculate Column Widths
            const columnWidths: number[] = [];
            columnConfig.forEach(col => {
                pdf.setFontSize(8);
                let maxWidth = pdf.getStringUnitWidth(col.label) * pdf.getFontSize();
                filteredData.slice(0, 20).forEach(asset => {
                    const val = String(asset[col.fieldname] || '-');
                    const textWidth = pdf.getStringUnitWidth(val) * pdf.getFontSize();
                    if (textWidth > maxWidth) maxWidth = textWidth;
                });
                columnWidths.push(Math.max(20, Math.min(usableWidth / 4, maxWidth / pdf.internal.scaleFactor)));
            });

            const scaleFactor = usableWidth / columnWidths.reduce((sum, w) => sum + w, 0);
            const finalColumnWidths = columnWidths.map(w => w * scaleFactor);

            // Define the Complete Header Function
            const drawPageHeader = (isFirstPage = false) => {
                let y = 20;

                // Report Title
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(16);
                pdf.text('Asset Register Report', pageWidth / 2, y, { align: 'center' });

                // Metadata (Date & Filters)
                y += 10;
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, margin, y);

                const filtersApplied = Object.entries(filters)
                    .filter(([_, v]) => v)
                    .map(([k, v]) => {
                        let label = k;
                        if (k === 'custom_lis_name') label = 'LIS Name';
                        if (k === 'custom_stage_no') label = 'Stage No';
                        if (k === 'asset_category') label = 'Asset Category';
                        if (k === 'custom_doctype_name') label = 'Asset ID';
                        return `${label}: ${v}`;
                    })
                    .join(', ') || 'None';
                y += 5;
                pdf.text(`Filters Applied: ${filtersApplied}`, margin, y);

                // Table Header Row
                y += 10;
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'bold');

                let headerMaxHeight = 0;
                const headerPadding = 3;
                columnConfig.forEach((col, i) => {
                    const lines = pdf.splitTextToSize(col.label, finalColumnWidths[i] - 4).slice(0, 2);
                    const h = (lines.length * pdf.getFontSize()) / pdf.internal.scaleFactor;
                    if (h > headerMaxHeight) headerMaxHeight = h;
                });

                const totalHeaderHeight = headerMaxHeight + headerPadding;

                // Draw Header Background
                pdf.setFillColor(240, 240, 240);
                pdf.rect(margin, y, usableWidth, totalHeaderHeight, 'F');

                // Draw Header Text
                columnConfig.forEach((col, i) => {
                    const x = margin + finalColumnWidths.slice(0, i).reduce((sum, w) => sum + w, 0);
                    const lines = pdf.splitTextToSize(col.label, finalColumnWidths[i] - 4).slice(0, 2);
                    const h = (lines.length * pdf.getFontSize()) / pdf.internal.scaleFactor;
                    const yOffset = (totalHeaderHeight - h) / 2;
                    pdf.text(lines, x + 2, y + yOffset, { baseline: 'top' });
                });

                pdf.setDrawColor(200, 200, 200);
                pdf.line(margin, y + totalHeaderHeight, pageWidth - margin, y + totalHeaderHeight);

                return y + totalHeaderHeight;
            };

            // Start Rendering Rows
            let currentY = drawPageHeader(true);

            filteredData.forEach((asset) => {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7);

                // Calculate row height
                let rowMaxHeight = 0;
                columnConfig.forEach((col, i) => {
                    const textLines = pdf.splitTextToSize(String(asset[col.fieldname] ?? '-'), finalColumnWidths[i] - 4);
                    const h = (textLines.length * pdf.getFontSize()) / pdf.internal.scaleFactor;
                    if (h > rowMaxHeight) rowMaxHeight = h;
                });

                const rowPadding = 4;
                // Check if page break is needed
                if (currentY + rowMaxHeight + rowPadding > usableHeight) {
                    pdf.addPage();
                    currentY = drawPageHeader();
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(7);
                }

                // Draw Data
                columnConfig.forEach((col, i) => {
                    const x = margin + finalColumnWidths.slice(0, i).reduce((sum, w) => sum + w, 0);
                    const textLines = pdf.splitTextToSize(String(asset[col.fieldname] ?? '-'), finalColumnWidths[i] - 4);
                    pdf.text(textLines, x + 2, currentY + 2, { baseline: 'top' });
                });

                // Draw Borders
                pdf.setDrawColor(230, 230, 230);
                let xPos = margin;
                finalColumnWidths.forEach((width) => {
                    pdf.line(xPos, currentY, xPos, currentY + rowMaxHeight + rowPadding);
                    xPos += width;
                });
                pdf.line(pageWidth - margin, currentY, pageWidth - margin, currentY + rowMaxHeight + rowPadding);
                pdf.line(margin, currentY + rowMaxHeight + rowPadding, pageWidth - margin, currentY + rowMaxHeight + rowPadding);

                currentY += rowMaxHeight + rowPadding;
            });

            pdf.save(`Asset_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('PDF Error:', error);
        }
    };

    return (
        <div className="module active">
            <div className="module-header">
                <div>
                    <h2>Asset Register Report</h2>
                    <p>Track detailed information about assets across different stages.</p>
                </div>

                <div className="flex gap-2">
                    <button
                        className="btn btn--primary"
                        onClick={fetchReportData}
                        disabled={loading}
                    >
                        <i className="fas fa-sync-alt"></i> {loading ? "Refreshing..." : "Refresh"}
                    </button>
                    <div className="export-buttons flex gap-2 ml-2">
                        <button className="btn btn--outline" onClick={handleExportCSV}>
                            <i className="fas fa-file-csv"></i> CSV
                        </button>
                        <button className="btn btn--outline" onClick={exportToPDF}>
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

                {/* Filters Grid */}
                <div className="filters-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 relative z-[60]">
                    <div className="form-group z-[70]">
                        <label className="text-sm font-medium mb-1 block">LIS Name</label>
                        <LinkInput
                            value={filters.custom_lis_name}
                            onChange={(value) => handleFilterChange("custom_lis_name", value)}
                            placeholder="Select LIS..."
                            linkTarget="Lift Irrigation Scheme"
                            className="w-full relative"
                        />
                    </div>

                    <div className="form-group z-[69]">
                        <label className="text-sm font-medium mb-1 block">Stage No</label>
                        <LinkInput
                            value={filters.custom_stage_no}
                            onChange={(value) => handleFilterChange("custom_stage_no", value)}
                            placeholder="Select Stage..."
                            linkTarget="Stage No"
                            filters={stageNoFilters}
                            className="w-full relative"
                        />
                    </div>

                    <div className="form-group z-[68]">
                        <label className="text-sm font-medium mb-1 block">Asset Category</label>
                        <LinkInput
                            value={filters.asset_category}
                            onChange={(value) => handleFilterChange("asset_category", value)}
                            placeholder="Select Category..."
                            linkTarget="Asset Category"
                            className="w-full relative"
                        />
                    </div>

                    <div className="form-group z-[67]">
                        <label className="text-sm font-medium mb-1 block">Asset ID</label>
                        <LinkInput
                            value={filters.custom_doctype_name}
                            onChange={(value) => handleFilterChange("custom_doctype_name", value)}
                            placeholder="Select Asset..."
                            linkTarget="Asset"
                            filters={assetIdFilters}
                            className="w-full relative"
                        />
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
                        style={{ minWidth: `${totalTableWidth}px`, borderCollapse: 'separate', borderSpacing: 0 }}
                    >
                        <thead style={{ zIndex: 40 }}>
                            <tr>
                                {columnConfig.map((column) => (
                                    <th
                                        key={column.fieldname}
                                        style={{
                                            width: column.width,
                                            position: "sticky",
                                            top: 0,
                                            left: STICKY_COLUMNS.includes(column.fieldname) ? (stickyLeftMap[column.fieldname] || "0") : "auto",
                                            zIndex: STICKY_COLUMNS.includes(column.fieldname) ? 50 : 20,
                                            backgroundColor: "#3683f6", // Always blue for header
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
                                                    position: STICKY_COLUMNS.includes(column.fieldname) ? "sticky" : "static",
                                                    left: stickyLeftMap[column.fieldname] || "auto",
                                                    zIndex: STICKY_COLUMNS.includes(column.fieldname) ? 30 : 10,
                                                    backgroundColor: STICKY_COLUMNS.includes(column.fieldname)
                                                        ? "white"
                                                        : "inherit",
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