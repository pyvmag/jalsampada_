"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import { Controller, useForm } from "react-hook-form";
import { LinkField } from "@/components/LinkField";

import { useSelection } from "@/hooks/useSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay";
import { TimeAgo } from "@/components/TimeAgo";
import { formatTimeAgo } from "@/lib/utils";
import { Plus, List, LayoutGrid, Loader2 } from "lucide-react";

const API_BASE_URL = "http://103.219.3.169:2223";

// 🟢 CONFIG: Settings for Frappe-like pagination
const INITIAL_PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 10;

/* ── Debounce Hook ─────────────────────────────── */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/* ── Types ────────────────────────────────────── */
interface StockEntry {
  name: string;
  stock_entry_type?: string;
  purpose?: string;
  from_warehouse?: string;
  to_warehouse?: string;
  per_transferred?: number;
  is_return?: 0 | 1;
  creation?: string;
  modified?: string;
  docstatus?: 0 | 1 | 2;
}

interface WarehouseOption {
  name: string;
}

interface StockEntryTypeOption {
  name: string;
}

type ViewMode = "grid" | "list";

export default function StockEntryListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Stock Entry";

  const [records, setRecords] = React.useState<StockEntry[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");

  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // 🟢 Total count of records
  const [error, setError] = React.useState<string | null>(null);

  // 🟢 Filter states
  const [idSearch, setIdSearch] = React.useState("");
  const [warehouseOptions, setWarehouseOptions] = React.useState<WarehouseOption[]>([]);
  const [stockEntryTypeOptions, setStockEntryTypeOptions] = React.useState<StockEntryTypeOption[]>([]);

  // Debounce the ID search
  const debouncedIdSearch = useDebounce(idSearch, 300);

  // Form for filter fields
  const { control, watch } = useForm({
    defaultValues: {
      stock_entry_type: "",
      from_warehouse: "",
      to_warehouse: "",
    },
  });

  const selectedStockEntryType = watch("stock_entry_type");
  const selectedFromWarehouse = watch("from_warehouse");
  const selectedToWarehouse = watch("to_warehouse");

  const title = "Stock Entry";

  /* ── Load Filter Options ────────────────────── */
  React.useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;

      try {
        // Fetch Warehouse options
        const warehouseResp = await axios.get(
          `${API_BASE_URL}/api/resource/Warehouse`,
          {
            params: {
              fields: JSON.stringify(["name"]),
              limit_page_length: "100",
              order_by: "name asc",
            },
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
          }
        );

        // Fetch Stock Entry Type options
        const stockEntryTypeResp = await axios.get(
          `${API_BASE_URL}/api/resource/Stock Entry Type`,
          {
            params: {
              fields: JSON.stringify(["name"]),
              limit_page_length: "100",
              order_by: "name asc",
            },
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
          }
        );

        const warehouseData = warehouseResp.data?.data ?? [];
        const stockEntryTypeData = stockEntryTypeResp.data?.data ?? [];

        setWarehouseOptions([{ name: "" }, ...warehouseData]);
        setStockEntryTypeOptions([{ name: "" }, ...stockEntryTypeData]);
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    };

    fetchFilterOptions();
  }, [isInitialized, isAuthenticated, apiKey, apiSecret]);

  /* ── Filter Records ─────────────────────────── */
  const filteredRecords = React.useMemo(() => {
    let filtered = records;

    // Filter by ID (name field)
    if (debouncedIdSearch) {
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(debouncedIdSearch.toLowerCase())
      );
    }

    // Filter by Stock Entry Type
    if (selectedStockEntryType) {
      filtered = filtered.filter(
        (r) => r.stock_entry_type === selectedStockEntryType
      );
    }

    // Filter by Default Source Warehouse
    if (selectedFromWarehouse) {
      filtered = filtered.filter(
        (r) => r.from_warehouse === selectedFromWarehouse
      );
    }

    // Filter by Default Target Warehouse
    if (selectedToWarehouse) {
      filtered = filtered.filter(
        (r) => r.to_warehouse === selectedToWarehouse
      );
    }

    return filtered;
  }, [records, debouncedIdSearch, selectedStockEntryType, selectedFromWarehouse, selectedToWarehouse]);

  /* ── Selection ───────────────────────────────── */
  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected,
  } = useSelection(records, "name");

  const [isDeleting, setIsDeleting] = React.useState(false);

  /* ── Fetch Records ───────────────────────────── */
  const fetchRecords = React.useCallback(
    async (start = 0, isReset = false) => {
      if (!isInitialized) return;
      if (!isAuthenticated || !apiKey || !apiSecret) {
        setLoading(false);
        return;
      }

      try {
        if (isReset) {
          setLoading(true);
          setError(null);
        } else {
          setIsLoadingMore(true);
        }

        const limit = isReset ? INITIAL_PAGE_SIZE : LOAD_MORE_SIZE;

        // Build filters based on selected filters
        const filters: any[] = [];

        if (debouncedIdSearch) {
          filters.push(["Stock Entry", "name", "like", `%${debouncedIdSearch}%`]);
        }

        if (selectedStockEntryType) {
          filters.push(["Stock Entry", "stock_entry_type", "=", selectedStockEntryType]);
        }

        if (selectedFromWarehouse) {
          filters.push(["Stock Entry", "from_warehouse", "=", selectedFromWarehouse]);
        }

        if (selectedToWarehouse) {
          filters.push(["Stock Entry", "to_warehouse", "=", selectedToWarehouse]);
        }

        const commonHeaders = {
          Authorization: `token ${apiKey}:${apiSecret}`,
        };

        // Parallel requests for Data and Total Count
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${doctypeName}`, {
            params: {
              fields: JSON.stringify([
                "name",
                "stock_entry_type",
                "purpose",
                "from_warehouse",
                "to_warehouse",
                "per_transferred",
                "is_return",
                "creation",
                "modified",
                "docstatus"
              ]),
              limit_start: start,
              limit_page_length: limit,
              order_by: "creation desc",
              filters: filters.length > 0 ? JSON.stringify(filters) : undefined,
            },
            headers: commonHeaders,
            withCredentials: true,
          }),
          // Only fetch count during initial load or filter change
          isReset ? axios.get(`${API_BASE_URL}/api/method/frappe.client.get_count`, {
            params: {
              doctype: doctypeName,
              filters: filters.length > 0 ? JSON.stringify(filters) : undefined
            },
            headers: commonHeaders,
          }) : Promise.resolve(null)
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: StockEntry[] = raw.map((r: any) => ({
          name: r.name,
          stock_entry_type: r.stock_entry_type ?? "",
          purpose: r.purpose ?? "",
          from_warehouse: r.from_warehouse ?? "",
          to_warehouse: r.to_warehouse ?? "",
          per_transferred: r.per_transferred ?? 0,
          is_return: r.is_return ?? 0,
          creation: r.creation ?? "",
          modified: r.modified ?? "",
          docstatus: r.docstatus ?? 0,
        }));

        if (isReset) {
          setRecords(mapped);
          if (countResp) setTotalCount(countResp.data.message);
        } else {
          setRecords((prev) => [...prev, ...mapped]);
        }

        setHasMore(mapped.length === limit);
      } catch (err: any) {
        console.error("Fetch error:", err);
        if (isReset) {
          setError(
            err.response?.status === 403
              ? "Unauthorized – check API key/secret"
              : `Failed to fetch ${doctypeName}`
          );
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [doctypeName, apiKey, apiSecret, isAuthenticated, isInitialized, debouncedIdSearch, selectedStockEntryType, selectedFromWarehouse, selectedToWarehouse]
  );

  React.useEffect(() => {
    fetchRecords(0, true);
  }, [fetchRecords]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchRecords(records.length, false);
    }
  };

  /* ── Bulk Delete ─────────────────────────────── */
  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} records permanently?`)) return;

    setIsDeleting(true);
    try {
      const response = await bulkDeleteRPC(
        doctypeName,
        Array.from(selectedIds),
        API_BASE_URL,
        apiKey!,
        apiSecret!
      );

      if (response._server_messages) {
        const msgs = JSON.parse(response._server_messages).map((m: string) =>
          JSON.parse(m).message
        );

        if (msgs.length) {
          toast.error("Delete failed", {
            description: <FrappeErrorDisplay messages={msgs} />,
            duration: Infinity,
          });
          return;
        }
      }

      toast.success(`Deleted ${count} records`);
      clearSelection();
      fetchRecords(0, true); // Reset to page 1 after delete
    } catch (err: any) {
      const messages = getApiMessages(
        null,
        err,
        "Records deleted successfully",
        "Failed to delete records"
      );
      toast.error(messages.message, {
        description: messages.description,
        duration: Infinity,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  /* ── Helpers ─────────────────────────────────── */
  const handleCardClick = (id: string) => {
    router.push(`/operations/doctype/stock-entry/${encodeURIComponent(id)}`);
  };

  const getStatusText = (docstatus: number) => {
    switch (docstatus) {
      case 0: return "Draft";
      case 1: return "Submitted";
      case 2: return "Cancelled";
      default: return "Unknown";
    }
  };

  const getStatusClass = (docstatus: number) => {
    switch (docstatus) {
      case 0: return "status-draft";
      case 1: return "status-submitted";
      case 2: return "status-cancelled";
      default: return "";
    }
  };

  const getFieldsForRecord = (record: StockEntry): RecordCardField[] => [
    { label: "Stock Entry Type", value: record.stock_entry_type || "-" },
    { label: "Status", value: getStatusText(record.docstatus || 0) },
    { label: "Purpose", value: record.purpose || "-" },
    { label: "Source Warehouse", value: record.from_warehouse || "-" },
    { label: "Target Warehouse", value: record.to_warehouse || "-" },
    { label: "Per Transferred", value: record.per_transferred?.toString() || "0" },
    { label: "Is Return", value: record.is_return === 1 ? "Yes" : "No" },
    { label: "Created", value: formatTimeAgo(record.creation) },
  ];

  /* ── List View ───────────────────────────────── */
  const renderListView = () => (
    <div className="stock-table-container">
      <table className="stock-table">
        <thead>
          <tr>
            <th style={{ width: 40, textAlign: "center" }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
            </th>
            <th>ID</th>
            <th>Stock Entry Type</th>
            <th>Status</th>
            <th>Purpose</th>
            <th>Source Warehouse</th>
            <th>Target Warehouse</th>
            <th>Per Transferred</th>
            <th>Is Return</th>
            <th className="text-right pr-4" style={{ width: "120px" }}>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                  <><span>{filteredRecords.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredRecords.length ? (
            filteredRecords.map((r) => {
              const isSelected = selectedIds.has(r.name);
              return (
                <tr
                  key={r.name}
                  onClick={() => handleCardClick(r.name)}
                  style={{
                    cursor: "pointer",
                    backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined,
                  }}
                >
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(r.name)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                  </td>
                  <td>{r.name}</td>
                  <td>{r.stock_entry_type || "-"}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(r.docstatus || 0)}`}>
                      {getStatusText(r.docstatus || 0)}
                    </span>
                  </td>
                  <td>{r.purpose || "-"}</td>
                  <td>{r.from_warehouse || "-"}</td>
                  <td>{r.to_warehouse || "-"}</td>
                  <td>{r.per_transferred || 0}</td>
                  <td style={{ textAlign: "center" }}>
                    {r.is_return === 1 ? (
                      <span className="checkmark">✓</span>
                    ) : (
                      <span className="crossmark">✗</span>
                    )}
                  </td>
                  <td className="text-right pr-4">
                    <TimeAgo date={r.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={10} style={{ textAlign: "center", padding: 32 }}>
                No records found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  /* ── Grid View ───────────────────────────────── */
  const renderGridView = () => (
    <div className="equipment-grid">
      {filteredRecords.length ? (
        filteredRecords.map((r) => (
          <RecordCard
            key={r.name}
            title={r.name}
            subtitle={`${r.stock_entry_type || ""}`}
            fields={getFieldsForRecord(r)}
            onClick={() => handleCardClick(r.name)}
          />
        ))
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>No records found</p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading {title}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="module active">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{title}</h2>
          <p>Manage Stock Entry records</p>
        </div>

        {selectedIds.size > 0 ? (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={clearSelection}
            onDelete={handleBulkDelete}
            isDeleting={isDeleting}
          />
        ) : (
          <button
            className="btn btn--primary flex items-center gap-2"
            onClick={() => router.push("/operations/doctype/stock-entry/new")}
          >
            <Plus className="w-4 h-4" /> Add {title}
          </button>
        )}
      </div>

      {/* 🟢 FOUR FILTER FIELDS */}
      <div
        className="search-filter-section"
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginTop: "1rem"
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1" }}>
          {/* ID Search Field */}
          <div style={{ minWidth: "180px" }}>
            <input
              type="text"
              placeholder="Search by ID..."
              className="form-control w-full"
              value={idSearch}
              onChange={(e) => setIdSearch(e.target.value)}
            />
          </div>

          {/* Stock Entry Type Filter */}
          <div style={{ minWidth: "180px", marginBottom: "0.2rem" }}>
            <Controller
              control={control}
              name="stock_entry_type"
              render={({ field: { value } }) => {
                const mockField = {
                  name: "stock_entry_type",
                  label: "",
                  type: "Link" as const,
                  linkTarget: "Stock Entry Type",
                  placeholder: "Stock Entry Type",
                  required: false,
                  defaultValue: "",
                };

                return (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <LinkField
                      control={control}
                      field={{ ...mockField, defaultValue: value }}
                      error={null}
                      className="[&>label]:hidden vishal"
                    />
                  </div>
                );
              }}
            />
          </div>

          {/* Default Source Warehouse Filter */}
          <div style={{ minWidth: "180px", marginBottom: "0.2rem" }}>
            <Controller
              control={control}
              name="from_warehouse"
              render={({ field: { value } }) => {
                const mockField = {
                  name: "from_warehouse",
                  label: "",
                  type: "Link" as const,
                  linkTarget: "Warehouse",
                  placeholder: "Source Warehouse",
                  required: false,
                  defaultValue: "",
                };

                return (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <LinkField
                      control={control}
                      field={{ ...mockField, defaultValue: value }}
                      error={null}
                      className="[&>label]:hidden vishal"
                    />
                  </div>
                );
              }}
            />
          </div>

          {/* Default Target Warehouse Filter */}
          <div style={{ minWidth: "180px", marginBottom: "0.2rem" }}>
            <Controller
              control={control}
              name="to_warehouse"
              render={({ field: { value } }) => {
                const mockField = {
                  name: "to_warehouse",
                  label: "",
                  type: "Link" as const,
                  linkTarget: "Warehouse",
                  placeholder: "Target Warehouse",
                  required: false,
                  defaultValue: "",
                };

                return (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <LinkField
                      control={control}
                      field={{ ...mockField, defaultValue: value }}
                      error={null}
                      className="[&>label]:hidden vishal"
                    />
                  </div>
                );
              }}
            />
          </div>
        </div>

        <div className="view-switcher">
          <button
            className="btn btn--outline btn--sm flex items-center justify-center"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            aria-label="Toggle view"
            title={view === "grid" ? "List view" : "Grid view"}
          >
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="view-container" style={{ marginTop: "0.5rem", paddingBottom: "2rem" }}>
        {view === "grid" ? renderGridView() : renderListView()}
        {hasMore && records.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="btn btn--secondary flex items-center gap-2 px-6 py-2"
              style={{ minWidth: "140px" }}
            >
              {isLoadingMore ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</> : "Load More"}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}