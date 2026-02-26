"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { LinkInput } from "@/components/LinkInput";
import { useAuth } from "@/context/AuthContext";
import "react-datepicker/dist/react-datepicker.css";

// --- API Configuration ---
const API_BASE_URL = "http://103.219.3.169:2223/";
const REPORT_API_PATH = "api/method/frappe.desk.query_report.run";
const REPORT_NAME = "Stock Projected Qty Report";

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
  warehouse: string;
  item_code: string;
  item_group: string;
  brand: string;
  include_uom: string;
};

type ColumnConfig = {
  fieldname: string;
  label: string;
  width: string;
  isHtml?: boolean;
  formatter?: (value: any) => string;
};

// --- Helper Functions ---
const formatNumber = (val: any) => (val === null || val === undefined ? "0" : String(val));
const formatText = (val: any) => (val === null || val === undefined ? "-" : String(val));

// --- Column Configuration ---
const columnConfig: ColumnConfig[] = [
  { fieldname: "item_code", label: "Item Code", width: "140px" },
  { fieldname: "item_name", label: "Item Name", width: "100px" },
  { fieldname: "item_group", label: "Item Group", width: "100px" },
  { fieldname: "brand", label: "Brand", width: "100px" },
  { fieldname: "warehouse", label: "Warehouse", width: "120px" },
  { fieldname: "stock_uom", label: "UOM", width: "100px" },
  { fieldname: "actual_qty", label: "Actual Qty", width: "100px", formatter: formatNumber },
  { fieldname: "planned_qty", label: "Planned Qty", width: "100px", formatter: formatNumber },
  { fieldname: "indented_qty", label: "Requested Qty", width: "110px", formatter: formatNumber },
  { fieldname: "ordered_qty", label: "Ordered Qty", width: "100px", formatter: formatNumber },
  { fieldname: "reserved_qty", label: "Reserved Qty", width: "100px", formatter: formatNumber },
  { fieldname: "reserved_qty_for_production", label: "Reserved for Production", width: "100px", formatter: formatNumber },
  { fieldname: "reserved_qty_for_production_plan", label: "Reserved for Production Plan", width: "100px", formatter: formatNumber },
  { fieldname: "reserved_qty_for_sub_contract", label: "Reserved for Sub Contracting", width: "100px", formatter: formatNumber },
  { fieldname: "reserved_qty_for_pos", label: "Reserved for POS Transactions", width: "100px", formatter: formatNumber },
  { fieldname: "projected_qty", label: "Projected Qty", width: "100px", formatter: formatNumber },
  { fieldname: "re_order_level", label: "Reorder Level", width: "100px", formatter: formatNumber },
  { fieldname: "re_order_qty", label: "Reorder Qty", width: "100px", formatter: formatNumber },
  { fieldname: "shortage_qty", label: "Shortage Qty", width: "100px", formatter: formatNumber },
];

export default function StockProjectedQtyReportPage() {
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [filteredData, setFilteredData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    warehouse: "",
    item_code: "",
    item_group: "",
    brand: "",
    include_uom: "",
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
      const cleanedFilters: Record<string, any> = {};

      Object.entries(currentFilters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          if (value.length > 0) cleanedFilters[key] = value;
        } else if (value && value.trim() !== "") {
          cleanedFilters[key] = value;
        }
      });

      const params = new URLSearchParams({
        report_name: REPORT_NAME,
        filters: JSON.stringify(cleanedFilters),
      });

      const response = await fetch(
        `${API_BASE_URL}${REPORT_API_PATH}?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `token ${apiKey}:${apiSecret}`,
          },
        }
      );

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (!result.message) {
        setReportData([]);
        setFilteredData([]);
      } else {
        setReportData(result.message.result || []);
        setFilteredData(result.message.result || []);
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

  const handleFilterChange = (field: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;

    const headers = columnConfig.map(c => c.label).join(",");
    const rows = filteredData.map(row =>
      columnConfig.map(col => {
        let val = row[col.fieldname];
        val = val === null || val === undefined ? "" : String(val);
        if (val.includes(",") || val.includes("\n") || val.includes('"')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(",")
    ).join("\n");

    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "stock_projected_qty_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <h2>Stock Projected Qty Report</h2>
          <p>View projected quantities and stock status.</p>
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

        {/* Warehouse - MULTI SELECT */}
        <div className="form-group z-[110]">
          <label className="text-sm font-medium mb-1 block">Warehouse</label>
          <LinkInput
            value={filters.warehouse}
            onChange={(value) => handleFilterChange("warehouse", value)}
            placeholder="Select Warehouse..."
            linkTarget="Warehouse"
            className="w-full relative"
          />
        </div>

        {/* Item Code - MULTI SELECT */}
        <div className="form-group z-[110]">
          <label className="text-sm font-medium mb-1 block">Item</label>
          <LinkInput
            value={filters.item_code}
            onChange={(value) => handleFilterChange("item_code", value)}
            placeholder="Select Item..."
            linkTarget="Item"
            className="w-full relative"
          />
        </div>

        {/* Item Group */}
        <div className="form-group z-[50]">
          <label className="text-sm font-medium mb-1 block">Item Group</label>
          <LinkInput
            value={filters.item_group}
            onChange={(v) => handleFilterChange("item_group", v)}
            placeholder="Select Item Group..."
            linkTarget="Item Group"
            className="w-full"
          />
        </div>

        {/* Brand */}
        <div className="form-group z-[50]">
          <label className="text-sm font-medium mb-1 block">Brand</label>
          <LinkInput
            value={filters.brand}
            onChange={(v) => handleFilterChange("brand", v)}
            placeholder="Select Brand..."
            linkTarget="Brand"
            className="w-full"
          />
        </div>

        {/* Include UOM */}
        <div className="form-group z-[50]">
          <label className="text-sm font-medium mb-1 block">Include UOM</label>
          <LinkInput
            value={filters.include_uom}
            onChange={(v) => handleFilterChange("include_uom", v)}
            placeholder="Select UOM..."
            linkTarget="UOM"
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
                      {column.formatter ? column.formatter(row[column.fieldname]) : formatText(row[column.fieldname])}
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