"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { LinkInput } from "@/components/LinkInput";

const API_BASE_URL = "http://103.219.3.169:2223/";
const REPORT_API_PATH = "api/method/frappe.desk.query_report.run";
const REPORT_NAME = "Item Price Stock Report";

type ReportData = Record<string, any>;

type Filters = {
    item: string;
};

type ColumnConfig = {
    fieldname: string;
    label: string;
    width: string;
};

export default function ItemPriceStockReportPage() {
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const [reportData, setReportData] = useState<ReportData[]>([]);
    const [filteredData, setFilteredData] = useState<ReportData[]>([]);
    const [loading, setLoading] = useState(false);

    const [filters, setFilters] = useState<Filters>({
        item: "",
    });

    // ---------- FETCH REPORT ----------
    const fetchReportData = useCallback(async (currentFilters: Filters) => {
        if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;
        setLoading(true);
        try {
            const cleanedFilters: Record<string, any> = {};
            Object.entries(currentFilters).forEach(([key, value]) => {
                if (value !== "") cleanedFilters[key] = value;
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
    const columnConfig: ColumnConfig[] = [
        { fieldname: "item_code", label: "Item Code", width: "150px" },
        { fieldname: "item_name", label: "Item Name", width: "170px" },
        { fieldname: "brand", label: "Brand", width: "140px" },
        { fieldname: "warehouse", label: "Warehouse", width: "160px" },
        { fieldname: "stock_available", label: "Stock Available", width: "140px" },
        { fieldname: "buying_price_list", label: "Buying Price List", width: "150px" },
        { fieldname: "selling_price_list", label: "Selling Price List", width: "150px" },
    ];

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
        link.download = "item_price_stock_report.csv";
        link.click();
    };

    const totalTableWidth = useMemo(() => {
        return columnConfig.reduce((total, col) => total + parseInt(col.width), 0);
    }, []);

    return (
        <div className="module active">
            <div className="module-header">
                <div>
                    <h2>Item Price Stock Report</h2>
                    <p>View item stock with price details.</p>
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

            {/* FILTER GRID */}
            <div className="filters-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 relative z-[60]">

                <div className="form-group z-[130]">
                    <label className="text-sm font-medium mb-1 block">Item</label>
                    <LinkInput
                        value={filters.item}
                        onChange={(v) => handleFilterChange("item", v)}
                        placeholder="Select Item..."
                        linkTarget="Item"
                        className="w-full"
                    />
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