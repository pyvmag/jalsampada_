"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { LinkInput } from "@/components/LinkInput";
import { useAuth } from "@/context/AuthContext";

// --- API Configuration ---
const API_BASE_URL = "http://103.219.3.169:2223/";
const REPORT_API_PATH = "api/method/frappe.desk.query_report.run";
const REPORT_NAME = "Stock Summary"; 

// --- Type Definitions ---
type ReportData = Record<string, any>;

type Filters = {
  store_location: string;
  item: string;
  item_group: string;
};

type ColumnConfig = {
  fieldname: string;
  label: string;
  width: string;
  formatter?: (value: any) => string;
};

// --- Helper Functions ---
const formatText = (val: any) => (val === null || val === undefined || val === "" ? "-" : String(val));
const formatNumber = (val: any) => (val === null || val === undefined ? "0" : String(val));

// --- Column Configuration ---
const columnConfig: ColumnConfig[] = [
  { fieldname: "item", label: "Item", width: "150px" },
  { fieldname: "description", label: "Description", width: "250px" },
  { fieldname: "current_quantity", label: "Current Quantity", width: "150px", formatter: formatNumber },
];

export default function StockSummaryReportPage() {
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [filteredData, setFilteredData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    store_location: "",
    item: "",
    item_group: "",
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
      const cleanedFilters: Record<string, string> = {};
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value && value.trim() !== "") {
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

  const handleFilterChange = (field: keyof Filters, value: string) => {
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
    link.setAttribute("download", "stock_summary_report.csv");
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
          <h2>Stock Summary Report</h2>
          <p>View current stock quantities per item.</p>
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

      <div className="filters-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4 mb-6 relative z-[60]">
        {/* Store Location */}
        <div className="form-group z-[50]">
          <label className="text-sm font-medium mb-1 block">Store Location</label>
          <LinkInput
            value={filters.store_location}
            onChange={(v) => handleFilterChange("store_location", v)}
            placeholder="Select Store Location..."
            linkTarget="Warehouse"
            className="w-full"
          />
        </div>

        {/* Item */}
        <div className="form-group z-[50]">
          <label className="text-sm font-medium mb-1 block">Item</label>
          <LinkInput
            value={filters.item}
            onChange={(v) => handleFilterChange("item", v)}
            placeholder="Select Item..."
            linkTarget="Item"
            className="w-full"
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