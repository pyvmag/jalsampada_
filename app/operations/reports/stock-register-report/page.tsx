


"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { LinkInput } from "@/components/LinkInput";
import { DropdownMultiSelect } from "@/components/DropdownMultiSelect";

const API_BASE_URL = "http://103.219.3.169:2223/";
const REPORT_API_PATH = "api/method/frappe.desk.query_report.run";
const REPORT_NAME = "Stock Register Report";

type ReportData = Record<string, any>;

type Filters = {
    from_date: string;
    to_date: string;
    warehouse: string[];
    item: string[];
    item_group: string;
    batch_no: string;
    brand: string;
    voucher: string;
    tender: string;
    include_uom: string;
    valuation_type: string;
};

type ColumnConfig = {
    fieldname: string;
    label: string;
    width: string;
    formatter?: (value: any) => string;
};

const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-GB");
};

const columnConfig: ColumnConfig[] = [
    { fieldname: "date", label: "Date", width: "120px", formatter: formatDate },
    { fieldname: "item", label: "Item", width: "150px" },
    { fieldname: "item_name", label: "Item Name", width: "180px" },
    { fieldname: "stock_uom", label: "Stock Unit", width: "120px" },
    { fieldname: "in_qty", label: "In Qty", width: "100px" },
    { fieldname: "out_qty", label: "Out Qty", width: "100px" },
    { fieldname: "balance_qty", label: "Balance", width: "120px" },
    { fieldname: "warehouse", label: "Store Location", width: "160px" },
    { fieldname: "item_group", label: "Item Group", width: "150px" },
    { fieldname: "brand", label: "Brand", width: "140px" },
    { fieldname: "description", label: "Description", width: "200px" },
];

export default function StockRegisterReportPage() {
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const [reportData, setReportData] = useState<ReportData[]>([]);
    const [filteredData, setFilteredData] = useState<ReportData[]>([]);
    const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);
    const [itemOptions, setItemOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const [filters, setFilters] = useState<Filters>({
        from_date: "",
        to_date: "",
        warehouse: [],
        item: [],
        item_group: "",
        batch_no: "",
        brand: "",
        voucher: "",
        tender: "",
        include_uom: "",
        valuation_type: "",
    });

    // --- Fetch Warehouse & Item Options ---
    useEffect(() => {
        if (!isAuthenticated || !apiKey || !apiSecret) return;
        const fetchOptions = async () => {
            try {
                const warehouseRes = await fetch(`${API_BASE_URL}api/resource/Warehouse`, {
                    headers: { Authorization: `token ${apiKey}:${apiSecret}` },
                });
                const warehouseData = await warehouseRes.json();
                setWarehouseOptions((warehouseData.data || []).map((w: any) => w.name));

                const itemRes = await fetch(`${API_BASE_URL}api/resource/Item`, {
                    headers: { Authorization: `token ${apiKey}:${apiSecret}` },
                });
                const itemData = await itemRes.json();
                setItemOptions((itemData.data || []).map((i: any) => i.name));
            } catch (err) {
                console.error(err);
            }
        };
        fetchOptions();
    }, [apiKey, apiSecret, isAuthenticated]);

    // --- Fetch Report Data ---
    const fetchReportData = useCallback(async (currentFilters: Filters) => {
        if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;
        setLoading(true);
        try {
            const cleanedFilters: Record<string, any> = {};
            Object.entries(currentFilters).forEach(([key, value]) => {
                if (value && (Array.isArray(value) ? value.length > 0 : value.trim() !== "")) {
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
        setFilters((prev) => ({ ...prev, [field]: value }));
    };

    const handleExportCSV = () => {
        if (!filteredData.length) return;
        const headers = columnConfig.map((c) => c.label).join(",");
        const rows = filteredData
            .map((row) =>
                columnConfig
                    .map((col) => {
                        let val = row[col.fieldname];
                        val = val === null || val === undefined ? "" : String(val);
                        if (val.includes(",") || val.includes("\n") || val.includes('"')) {
                            val = `"${val.replace(/"/g, '""')}"`;
                        }
                        return val;
                    })
                    .join(",")
            )
            .join("\n");
        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
        const link = document.createElement("a");
        link.href = encodeURI(csvContent);
        link.download = "stock_register_report.csv";
        link.click();
    };

    const totalTableWidth = useMemo(() => {
        return columnConfig.reduce((total, col) => {
            const width = parseInt(col.width.replace("px", ""));
            return total + (isNaN(width) ? 150 : width);
        }, 0);
    }, []);

    return (
        <div className="module active">
            <div className="module-header">
                <div>
                    <h2>Stock Register Ledger</h2>
                    <p>Track stock movement entries.</p>
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

            <div className="filters-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 relative z-[60]">

                <div className="form-group z-[150]">
                    <label className="text-sm font-medium mb-1 block">From Date</label>
                    <DatePicker
                        selected={filters.from_date ? new Date(filters.from_date) : null}
                        onChange={(date: any) => handleFilterChange("from_date", date ? date.toISOString() : "")}
                        placeholderText="DD/MM/YYYY"
                        dateFormat="dd/MM/yyyy"
                        className="form-control w-full placeholder:uppercase"
                    />
                </div>

                <div className="form-group z-[150]">
                    <label className="text-sm font-medium mb-1 block">To Date</label>
                    <DatePicker
                        selected={filters.to_date ? new Date(filters.to_date) : null}
                        onChange={(date: any) => handleFilterChange("to_date", date ? date.toISOString() : "")}
                        placeholderText="DD/MM/YYYY"
                        dateFormat="dd/MM/yyyy"
                        className="form-control w-full placeholder:uppercase"
                    />
                </div>

                <DropdownMultiSelect
                    className="form-group z-[150]"
                    label="Warehouse"
                    options={warehouseOptions}
                    selectedValues={filters.warehouse}
                    onChange={(vals:any) => handleFilterChange("warehouse", vals)}
                />

                <DropdownMultiSelect
                    className="form-group z-[150]"
                    label="Item"
                    options={itemOptions}
                    selectedValues={filters.item}
                    onChange={(vals: any) => handleFilterChange("item", vals)}
                />

                <div className="form-group z-[130]">
                    <label className="text-sm font-medium mb-1 block">Item Group</label>
                    <LinkInput value={filters.item_group} onChange={(v) => handleFilterChange("item_group", v)} placeholder="Select Item Group..." linkTarget="Item Group" className="w-full" />
                </div>

                <div className="form-group z-[130]">
                    <label className="text-sm font-medium mb-1 block">Batch Number</label>
                    <LinkInput value={filters.batch_no} onChange={(v) => handleFilterChange("batch_no", v)} placeholder="Select Batch..." linkTarget="Batch NO" className="w-full" />
                </div>

                <div className="form-group z-[130]">
                    <label className="text-sm font-medium mb-1 block">Brand</label>
                    <LinkInput value={filters.brand} onChange={(v) => handleFilterChange("brand", v)} placeholder="Select Brand..." linkTarget="Brand" className="w-full" />
                </div>

                <div className="form-group z-[110]">
                    <label className="text-sm font-medium mb-1 block">Voucher</label>
                    <input type="text" value={filters.voucher} onChange={(e) => handleFilterChange("voucher", e.target.value)} className="form-control w-full" placeholder="Voucher No..." />
                </div>

                <div className="form-group z-[110]">
                    <label className="text-sm font-medium mb-1 block">Tender</label>
                    <LinkInput value={filters.tender} onChange={(v) => handleFilterChange("tender", v)} placeholder="Select Tender..." linkTarget="Tender" className="w-full" />
                </div>

                <div className="form-group z-[110]">
                    <label className="text-sm font-medium mb-1 block">Include UOM</label>
                    <LinkInput value={filters.include_uom} onChange={(v) => handleFilterChange("include_uom", v)} placeholder="Select UOM..." linkTarget="UOM" className="w-full" />
                </div>

                <div className="form-group z-[50]">
                    <label className="text-sm font-medium mb-1 block">Valuation Type</label>
                    <select value={filters.valuation_type} onChange={(e) => handleFilterChange("valuation_type", e.target.value)} className="form-control w-full">
                        <option value="">Select</option>
                        <option value="Currency">Currency</option>
                        <option value="Float">Float</option>
                    </select>
                </div>
            </div>

            <div className="stock-table-container border rounded-md relative z-10" style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
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
                                            {col.formatter ? col.formatter(row[col.fieldname]) : row[col.fieldname] || "-"}
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