"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { LinkInput } from "@/components/LinkInput";
import { useAuth } from "@/context/AuthContext";
import jsPDF from 'jspdf';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// --- API Configuration ---
const API_BASE_URL = "http://103.219.1.138:4412/";
const REPORT_API_PATH = "api/method/frappe.desk.query_report.run";
const REPORT_NAME = "Asset Interchange Report";

// --- Type Definitions ---
type ReportField = {
    label: string;
    fieldname: string;
    fieldtype: string;
    options?: string;
    width?: number;
};
//jenkins develop

type ReportData = Record<string, any>;

type Filters = {
    from_date: string;
    to_date: string;
    lis_name: string;
    stage: string;
    asset: string;
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
    return date.toLocaleDateString("en-GB");
};

const formatDateForAPI = (date: Date | null): string => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- Configuration ---
const COLUMN_CONFIG: ColumnConfig[] = [
    { fieldname: "sr_no", label: "Sr.No.", width: "80px" },
    { fieldname: "posting_date", label: "Date", width: "120px", formatter: formatDate },
    { fieldname: "lis_name", label: "LIS", width: "200px" },
    { fieldname: "stage", label: "Stage", width: "150px" },
    { fieldname: "select_asset", label: "Asset", width: "150px" },
    { fieldname: "old_linked_asset", label: "Old Linked Asset", width: "200px" },
    { fieldname: "new_linked_asset", label: "New Linked Asset", width: "200px" },
    { fieldname: "description_ordered_by", label: "Description & Ordered By", width: "350px" },
];

export default function AssetInterchangeReportPage() {
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const [reportData, setReportData] = useState<ReportData[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [apiFields, setApiFields] = useState<ReportField[]>([]);

    const [filters, setFilters] = useState<Filters>({
        from_date: "",
        to_date: "",
        lis_name: "",
        stage: "",
        asset: "",
    });

    const fetchReportData = useCallback(async (currentFilters: Filters) => {
        if (!isInitialized) return;
        if (!isAuthenticated || !apiKey || !apiSecret) {
            setError("Please log in to view this report.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const cleanedFilters: Record<string, any> = {};
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
                setApiFields([]);
            } else {
                const columns: ReportField[] = result.message.columns || [];
                const rawData: any[] = result.message.result || [];

                // Process data: backend returns list of lists (arrays)
                const processedData = rawData.map((row: any) => {
                    if (Array.isArray(row)) {
                        // Map array to object based on column fieldnames
                        const obj: Record<string, any> = {};
                        columns.forEach((col, idx) => {
                            obj[col.fieldname] = row[idx];
                        });
                        return obj;
                    }
                    return row;
                });

                setApiFields(columns);
                setReportData(processedData);
            }

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to fetch data");
        } finally {
            setLoading(false);
        }
    }, [apiKey, apiSecret, isAuthenticated, isInitialized]);

    // Use dynamic columns if available, otherwise fallback to hardcoded ones
    const activeColumns = useMemo(() => {
        if (apiFields.length > 0) {
            // If API provides columns, we filter/map them to match user request if possible
            // but usually we trust the backend's columns for a "Query Report"
            const cols: ColumnConfig[] = apiFields.map(f => ({
                fieldname: f.fieldname,
                label: f.label,
                width: `${f.width || 150}px`,
                formatter: f.fieldtype === "Date" ? formatDate : undefined
            }));

            // Ensure Sr.No is first
            if (!cols.find(c => c.fieldname === "sr_no")) {
                cols.unshift({ fieldname: "sr_no", label: "Sr.No.", width: "80px" });
            }
            return cols;
        }
        return COLUMN_CONFIG;
    }, [apiFields]);

    useEffect(() => {
        if (!isInitialized || !isAuthenticated) return;
        const timer = setTimeout(() => {
            fetchReportData(filters);
        }, 500);
        return () => clearTimeout(timer);
    }, [filters, fetchReportData, isInitialized, isAuthenticated]);

    const handleFilterChange = (field: keyof Filters, value: string) => {
        setFilters((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleExportCSV = () => {
        if (reportData.length === 0) return;

        const headers = activeColumns.map(c => c.label).join(",");
        const rows = reportData.map(row => {
            return activeColumns.map(col => {
                let val = row[col.fieldname];
                if (col.formatter) {
                    val = col.formatter(val);
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
        link.setAttribute("download", "asset_interchange_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        if (reportData.length === 0) return;

        try {
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const margin = 15;
            const usableWidth = pageWidth - (margin * 2);

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(16);
            pdf.text('Asset Interchange Report', pageWidth / 2, 20, { align: 'center' });

            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, margin, 30);

            // Table Header
            let y = 40;
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            pdf.setFillColor(240, 240, 240);
            pdf.rect(margin, y, usableWidth, 10, 'F');

            const colWidths = [15, 20, 35, 25, 25, 35, 35, 75]; // Total: 265
            const scale = usableWidth / colWidths.reduce((a, b) => a + b, 0);
            const finalWidths = colWidths.map(w => w * scale);

            let x = margin;
            activeColumns.forEach((col, i) => {
                pdf.text(col.label, x + 2, y + 6);
                x += finalWidths[i];
            });

            y += 10;
            pdf.setFont('helvetica', 'normal');
            reportData.forEach((row) => {
                if (y > 180) {
                    pdf.addPage();
                    y = 20;
                }
                x = margin;
                activeColumns.forEach((col, i) => {
                    let val = row[col.fieldname];
                    if (col.formatter) val = col.formatter(val);
                    val = String(val ?? "-");
                    const lines = pdf.splitTextToSize(val, finalWidths[i] - 4);
                    pdf.text(lines, x + 2, y + 5);
                    x += finalWidths[i];
                });
                y += 8;
            });

            pdf.save(`Asset_Interchange_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error('PDF Error:', err);
        }
    };

    const stageNoFilters = useMemo(() => {
        return filters.lis_name ? { lis_name: filters.lis_name } : undefined;
    }, [filters.lis_name]);

    const assetFilters = useMemo(() => {
        const depFilters: Record<string, string> = {};
        if (filters.lis_name) depFilters["custom_lis_name"] = filters.lis_name;
        if (filters.stage) depFilters["custom_stage_no"] = filters.stage;
        return Object.keys(depFilters).length > 0 ? depFilters : undefined;
    }, [filters.lis_name, filters.stage]);

    return (
        <div className="module active">
            <div className="module-header">
                <div>
                    <h2>Asset Interchange Report</h2>
                    <p>Track historical interchanges of motors and pumps across LIS stages.</p>
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

                {/* Filters Grid */}
                <div className="filters-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 relative z-[60]">
                    <div className="form-group z-[70]">
                        <label className="text-sm font-medium mb-1 block">From Date</label>
                        <DatePicker
                            selected={filters.from_date ? new Date(filters.from_date) : null}
                            onChange={(date: Date | null) => handleFilterChange("from_date", formatDateForAPI(date))}
                            placeholderText="DD-MM-YYYY"
                            dateFormat="dd-MM-yyyy"
                            className="form-control w-full"
                        />
                    </div>

                    <div className="form-group z-[69]">
                        <label className="text-sm font-medium mb-1 block">To Date</label>
                        <DatePicker
                            selected={filters.to_date ? new Date(filters.to_date) : null}
                            onChange={(date: Date | null) => handleFilterChange("to_date", formatDateForAPI(date))}
                            placeholderText="DD-MM-YYYY"
                            dateFormat="dd-MM-yyyy"
                            className="form-control w-full"
                        />
                    </div>

                    <div className="form-group z-[68]">
                        <label className="text-sm font-medium mb-1 block">LIS</label>
                        <LinkInput
                            value={filters.lis_name}
                            onChange={(value) => handleFilterChange("lis_name", value)}
                            placeholder="Select LIS..."
                            linkTarget="Lift Irrigation Scheme"
                            className="w-full relative"
                        />
                    </div>

                    <div className="form-group z-[67]">
                        <label className="text-sm font-medium mb-1 block">Stage</label>
                        <LinkInput
                            value={filters.stage}
                            onChange={(value) => handleFilterChange("stage", value)}
                            placeholder="Select Stage..."
                            linkTarget="Stage No"
                            filters={stageNoFilters}
                            className="w-full relative"
                        />
                    </div>

                    <div className="form-group z-[66]">
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
                </div>

                {/* Report Table */}
                <div
                    className="stock-table-container border rounded-md relative z-10"
                    style={{
                        overflowX: "auto",
                        overflowY: "auto",
                        maxHeight: "70vh",
                    }}
                >
                    <table className="stock-table sticky-header-table" style={{ width: "100%", borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead style={{ zIndex: 40 }}>
                            <tr>
                                {activeColumns.map((column) => (
                                    <th
                                        key={column.fieldname}
                                        style={{
                                            width: column.width,
                                            position: "sticky",
                                            top: 0,
                                            zIndex: 20,
                                            backgroundColor: "#3683f6", // Always blue for header
                                            color: "white"
                                        }}
                                    >
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={activeColumns.length}
                                        style={{ textAlign: "center", padding: "40px" }}
                                    >
                                        <i className="fas fa-spinner fa-spin"></i> Fetching records...
                                    </td>
                                </tr>
                            ) : reportData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={activeColumns.length}
                                        style={{ textAlign: "center", padding: "40px" }}
                                    >
                                        No records found matching criteria
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((row, index) => (
                                    <tr key={index}>
                                        {activeColumns.map((column) => (
                                            <td key={`${index}-${column.fieldname}`}>
                                                {column.formatter ? column.formatter(row[column.fieldname]) : (row[column.fieldname] || "-")}
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
