"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { LinkInput } from "@/components/LinkInput";

const API_BASE_URL = "http://103.219.3.169:2223/";
const REPORT_API_PATH = "api/method/frappe.desk.query_report.run";
const REPORT_NAME = "Stock Ageing Report";

type ReportData = Record<string, any>;

type Filters = {
    as_on_date: string;
    warehouse_type: string;
    warehouse: string;
    item: string;
    brand: string;
    ageing_range: string;
    show_warehouse_wise_stock: boolean;
};

type ColumnConfig = {
    fieldname: string;
    label: string;
    width: string;
};

export default function StockAgeingReportPage() {
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const [reportData, setReportData] = useState<ReportData[]>([]);
    const [filteredData, setFilteredData] = useState<ReportData[]>([]);
    const [loading, setLoading] = useState(false);

    const [filters, setFilters] = useState<Filters>({
        as_on_date: "",
        warehouse_type: "",
        warehouse: "",
        item: "",
        brand: "",
        ageing_range: "",
        show_warehouse_wise_stock: false,
    });

    // ---------- FETCH REPORT ----------
    const fetchReportData = useCallback(async (currentFilters: Filters) => {
        if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;
        setLoading(true);
        try {
            const cleanedFilters: Record<string, any> = {};
            Object.entries(currentFilters).forEach(([key, value]) => {
                if (value !== "" && value !== false) {
                    cleanedFilters[key] = value;
                }
            });

            const params = new URLSearchParams({
                report_name: REPORT_NAME,
                filters: JSON.stringify(cleanedFilters),
            });

            const res = await fetch(`${API_BASE_URL}${REPORT_API_PATH}?${params.toString()}`, {
                headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            });

            const result = await res.json();
            setReportData(result.message?.result || []);
            setFilteredData(result.message?.result || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [apiKey, apiSecret, isAuthenticated, isInitialized]);

    useEffect(() => {
        if (!isInitialized) return;
        const timer = setTimeout(() => fetchReportData(filters), 500);
        return () => clearTimeout(timer);
    }, [filters, fetchReportData, isInitialized]);

    const handleFilterChange = (field: keyof Filters, value: any) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    // ---------- COLUMNS ----------
    const columnConfig: ColumnConfig[] = useMemo(() => {
        const cols: ColumnConfig[] = [
            { fieldname: "item_code", label: "Item Code", width: "150px" },
            { fieldname: "item_name", label: "Item Name", width: "170px" },
            { fieldname: "description", label: "Description", width: "200px" },
            { fieldname: "item_group", label: "Item Group", width: "150px" },
            { fieldname: "brand", label: "Brand", width: "140px" },
        ];

        if (filters.show_warehouse_wise_stock) {
            cols.push({ fieldname: "warehouse", label: "Warehouse", width: "160px" });
        }

        cols.push(
            { fieldname: "available_qty", label: "Available Qty", width: "120px" },
            { fieldname: "average_age", label: "Average Age", width: "120px" },
            { fieldname: "earliest", label: "Earliest", width: "120px" },
            { fieldname: "latest", label: "Latest", width: "120px" },
            { fieldname: "uom", label: "UOM", width: "100px" }
        );

        return cols;
    }, [filters.show_warehouse_wise_stock]);

    // ---------- CSV EXPORT ----------
    const handleExportCSV = () => {
        if (!filteredData.length) return;
        const headers = columnConfig.map(c => c.label).join(",");
        const rows = filteredData.map(row =>
            columnConfig.map(col => {
                let val = row[col.fieldname] ?? "";
                val = String(val);
                if (val.includes(",") || val.includes("\n") || val.includes('"')) {
                    val = `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            }).join(",")
        ).join("\n");

        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
        const link = document.createElement("a");
        link.href = encodeURI(csvContent);
        link.download = "stock_ageing_report.csv";
        link.click();
    };

    const totalTableWidth = useMemo(() => {
        return columnConfig.reduce((total, col) => total + parseInt(col.width), 0);
    }, [columnConfig]);

    return (
        <div className="module active">
            <div className="module-header">
                <div>
                    <h2>Stock Ageing Report</h2>
                    <p>Track stock ageing details.</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn--primary" onClick={() => fetchReportData(filters)} disabled={loading}>
                        {loading ? "Refreshing..." : "Refresh"}
                    </button>
                    <div className="export-buttons flex gap-2 ml-2">
                        <button className="btn btn--outline" onClick={handleExportCSV}>Export CSV</button>
                    </div>
                </div>
            </div>

            {/* FILTER GRID — SAME STRUCTURE */}
            <div className="filters-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 relative z-[60]">

                <div className="form-group z-[150]">
                    <label className="text-sm font-medium mb-1 block">As On Date</label>
                    <DatePicker
                        selected={filters.as_on_date ? new Date(filters.as_on_date) : null}
                        onChange={(d:any)=>handleFilterChange("as_on_date",d?.toISOString()||"")}
                        placeholderText="DD/MM/YYYY"
                        dateFormat="dd/MM/yyyy"
                        className="form-control w-full"
                    />
                </div>

                <div className="form-group z-[130]">
                    <label className="text-sm font-medium mb-1 block">Warehouse Type</label>
                    <LinkInput value={filters.warehouse_type} onChange={(v)=>handleFilterChange("warehouse_type",v)}
                        placeholder="Select Warehouse Type..." linkTarget="Warehouse Type" className="w-full" />
                </div>

                <div className="form-group z-[130]">
                    <label className="text-sm font-medium mb-1 block">Store Location</label>
                    <LinkInput value={filters.warehouse} onChange={(v)=>handleFilterChange("warehouse",v)}
                        placeholder="Select Warehouse..." linkTarget="Warehouse" className="w-full" />
                </div>

                <div className="form-group z-[130]">
                    <label className="text-sm font-medium mb-1 block">Item</label>
                    <LinkInput value={filters.item} onChange={(v)=>handleFilterChange("item",v)}
                        placeholder="Select Item..." linkTarget="Item" className="w-full" />
                </div>

                <div className="form-group z-[130]">
                    <label className="text-sm font-medium mb-1 block">Brand</label>
                    <LinkInput value={filters.brand} onChange={(v)=>handleFilterChange("brand",v)}
                        placeholder="Select Brand..." linkTarget="Brand" className="w-full" />
                </div>

                <div className="form-group z-[110]">
                    <label className="text-sm font-medium mb-1 block">Ageing Range</label>
                    <input type="text" value={filters.ageing_range}
                        onChange={(e)=>handleFilterChange("ageing_range",e.target.value)}
                        className="form-control w-full" placeholder="e.g. 30,60,90" />
                </div>

                <div className="form-group z-[50] flex items-center gap-2">
                    <input type="checkbox"
                        checked={filters.show_warehouse_wise_stock}
                        onChange={(e)=>handleFilterChange("show_warehouse_wise_stock",e.target.checked)} />
                    <label className="text-sm font-medium">Show Warehouse Wise Stock</label>
                </div>
            </div>

            {/* TABLE */}
            <div className="stock-table-container border rounded-md relative z-10"
                style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
                <table className="stock-table sticky-header-table" style={{ minWidth: `${totalTableWidth}px` }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 20, backgroundColor: "white" }}>
                        <tr>
                            {columnConfig.map((column) => (
                                <th key={column.fieldname} style={{ width: column.width }}>{column.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={columnConfig.length} className="text-center p-10">
                                    {loading ? "Fetching records..." : "No records found matching criteria"}
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((row, idx) => (
                                <tr key={idx}>
                                    {columnConfig.map((col) => (
                                        <td key={`${idx}-${col.fieldname}`}>
                                            {row[col.fieldname] || "-"}
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