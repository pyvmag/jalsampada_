"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { LinkInput } from "@/components/LinkInput";
import { DropdownMultiSelect } from "@/components/DropdownMultiSelect";

const API_BASE_URL = "http://103.219.3.169:2223/";
const REPORT_API_PATH = "api/method/frappe.desk.query_report.run";
const REPORT_NAME = "Stock Balance Report";

type ReportData = Record<string, any>;

type Filters = {
    from_date: string;
    to_date: string;
    item_group: string;
    item: string[];
    warehouse: string[];
    warehouse_type: string;
    valuation_type: string;
    include_uom: string;
    show_dimension_wise_stock: boolean;
};

type ColumnConfig = {
    fieldname: string;
    label: string;
    width: string;
};

export default function StockBalanceReportPage() {
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const [reportData, setReportData] = useState<ReportData[]>([]);
    const [filteredData, setFilteredData] = useState<ReportData[]>([]);
    const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);
    const [itemOptions, setItemOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const [filters, setFilters] = useState<Filters>({
        from_date: "",
        to_date: "",
        item_group: "",
        item: [],
        warehouse: [],
        warehouse_type: "",
        valuation_type: "",
        include_uom: "",
        show_dimension_wise_stock: false,
    });

    // ---------- FETCH WAREHOUSE OPTIONS ----------
    useEffect(() => {
        if (!isAuthenticated || !apiKey || !apiSecret) return;
        fetch(`${API_BASE_URL}api/resource/Warehouse`, {
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        })
            .then(r => r.json())
            .then(d => setWarehouseOptions((d.data || []).map((w: any) => w.name)))
            .catch(console.error);
    }, [apiKey, apiSecret, isAuthenticated]);

    // ---------- FETCH ITEMS BASED ON ITEM GROUP ----------
    useEffect(() => {
        if (!filters.item_group || !apiKey || !apiSecret) return;
        fetch(`${API_BASE_URL}api/resource/Item?filters=[["item_group","=","${filters.item_group}"]]`, {
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        })
            .then(r => r.json())
            .then(d => setItemOptions((d.data || []).map((i: any) => i.name)))
            .catch(console.error);
    }, [filters.item_group, apiKey, apiSecret]);

    // ---------- FETCH REPORT ----------
    const fetchReportData = useCallback(async (currentFilters: Filters) => {
        if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;
        setLoading(true);
        try {
            const cleanedFilters: Record<string, any> = {};
            Object.entries(currentFilters).forEach(([key, value]) => {
                if (Array.isArray(value) ? value.length > 0 : value !== "" && value !== false) {
                    cleanedFilters[key] = Array.isArray(value) ? value.join(",") : value;
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
            { fieldname: "item", label: "Item", width: "150px" },
            { fieldname: "item_group", label: "Item Group", width: "150px" },
            { fieldname: "warehouse", label: "Warehouse", width: "160px" },
        ];
        if (filters.show_dimension_wise_stock) {
            cols.push({ fieldname: "dimension", label: "Dimension", width: "140px" });
        }
        cols.push(
            { fieldname: "stock_uom", label: "Stock UOM", width: "120px" },
            { fieldname: "balance_qty", label: "Balance Qty", width: "120px" },
            { fieldname: "opening_qty", label: "Opening Qty", width: "120px" },
            { fieldname: "in_qty", label: "In Qty", width: "100px" },
            { fieldname: "out_qty", label: "Out Qty", width: "100px" },
            { fieldname: "valuation_rate", label: "Valuation Rate", width: "120px" },
            { fieldname: "reserved_stock", label: "Reserved Stock", width: "130px" }
        );
        return cols;
    }, [filters.show_dimension_wise_stock]);

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
        link.download = "stock_balance_report.csv";
        link.click();
    };

    const totalTableWidth = useMemo(() => {
        return columnConfig.reduce((total, col) => total + parseInt(col.width), 0);
    }, [columnConfig]);

    return (
        <div className="module active">
            <div className="module-header">
                <div>
                    <h2>Stock Balance</h2>
                    <p>Track stock balance details.</p>
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

            {/* FILTER GRID — EXACT SAME STRUCTURE */}
            <div className="filters-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 relative z-[60]">

                <div className="form-group z-[150]">
                    <label className="text-sm font-medium mb-1 block">From Date</label>
                    <DatePicker
                        selected={filters.from_date ? new Date(filters.from_date) : null}
                        onChange={(d:any)=>handleFilterChange("from_date",d?.toISOString()||"")}
                        placeholderText="DD/MM/YYYY"
                        dateFormat="dd/MM/yyyy"
                        className="form-control w-full"
                    />
                </div>

                <div className="form-group z-[150]">
                    <label className="text-sm font-medium mb-1 block">To Date</label>
                    <DatePicker
                        selected={filters.to_date ? new Date(filters.to_date) : null}
                        onChange={(d:any)=>handleFilterChange("to_date",d?.toISOString()||"")}
                        placeholderText="DD/MM/YYYY"
                        dateFormat="dd/MM/yyyy"
                        className="form-control w-full"
                    />
                </div>

                <div className="form-group z-[130]">
                    <label className="text-sm font-medium mb-1 block">Item Group</label>
                    <LinkInput value={filters.item_group} onChange={(v)=>handleFilterChange("item_group",v)}
                        placeholder="Select Item Group..." linkTarget="Item Group" className="w-full" />
                </div>

                <DropdownMultiSelect
                    className="form-group z-[150]"
                    label="Items"
                    options={itemOptions}
                    selectedValues={filters.item}
                    onChange={(vals: any)=>handleFilterChange("item",vals)}
                />

                <DropdownMultiSelect
                    className="form-group z-[130]"
                    label="Warehouses"
                    options={warehouseOptions}
                    selectedValues={filters.warehouse}
                    onChange={(vals: any)=>handleFilterChange("warehouse",vals)}
                />

                <div className="form-group z-[130]">
                    <label className="text-sm font-medium mb-1 block">Warehouse Type</label>
                    <LinkInput value={filters.warehouse_type} onChange={(v)=>handleFilterChange("warehouse_type",v)}
                        placeholder="Select Warehouse Type..." linkTarget="Warehouse Type" className="w-full" />
                </div>

                 <div className="form-group z-[50]">
                    <label className="text-sm font-medium mb-1 block">Valuation Type</label>
                    <select value={filters.valuation_type} onChange={(e) => handleFilterChange("valuation_type", e.target.value)} className="form-control w-full">
                        <option value="">Select</option>
                        <option value="Currency">Currency</option>
                        <option value="Float">Float</option>
                    </select>
                </div>

                <div className="form-group z-[130]">
                    <label className="text-sm font-medium mb-1 block">Include UOM</label>
                    <LinkInput value={filters.include_uom} onChange={(v)=>handleFilterChange("include_uom",v)}
                        placeholder="Select UOM..." linkTarget="UOM" className="w-full" />
                </div>

                <div className="form-group z-[50] flex items-center gap-2">
                    <input type="checkbox"
                        checked={filters.show_dimension_wise_stock}
                        onChange={(e)=>handleFilterChange("show_dimension_wise_stock",e.target.checked)} />
                    <label className="text-sm font-medium">Show Dimension Wise Stock</label>
                </div>
            </div>

            {/* TABLE SAME */}
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