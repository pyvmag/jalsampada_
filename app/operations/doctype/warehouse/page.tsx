"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";

// 🟢 New Imports for Bulk Delete
import { useSelection } from "@/hooks/useSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { getApiMessages} from "@/lib/utils";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay";
import { TimeAgo } from "@/components/TimeAgo";
import {
  Search,
  Plus,
  List,
  LayoutGrid,
  ChevronDown,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  Check,
  Clock,
  Loader2 // 🟢 Added Loader2
} from "lucide-react";

// 🟢 Changed: Point to Root URL
const API_BASE_URL = "http://103.219.3.169:2223";

// 🟢 CONFIG: Settings for Pagination
const INITIAL_PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 10;

// --- Debounce Hook ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/* -------------------------------------------------
   Warehouse Type Definition
   ------------------------------------------------- */
interface Warehouse {
  name: string;
  is_group?: 0 | 1;
  parent_warehouse?: string;
  company?: string;
  warehouse_type?: string;
  account?: string;
  modified?: string;
}

type SortDirection = "asc" | "desc"; // 🟢 Fixed typo 'dsc' -> 'desc' to match API expectation
interface SortConfig {
  key: keyof Warehouse;
  direction: SortDirection;
}

const SORT_OPTIONS: { label: string; key: keyof Warehouse }[] = [
  { label: "Last Updated On", key: "modified" },
  { label: "Store Location ID", key: "name" },
  { label: "Company", key: "company" },
  { label: "Parent Store Location", key: "parent_warehouse" },
  { label: "Store Location Type", key: "warehouse_type" },
];

type ViewMode = "grid" | "list";

interface FilterFormData {
  name: string;
  parent_warehouse: string;
  account: string;
  is_group: string;
}

export default function WarehousePage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Warehouse";

  const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // Total count of records
  const [error, setError] = React.useState<string | null>(null);

  // 🟢 Form controls for filters
  const { control, watch } = useForm<FilterFormData>({
    defaultValues: {
      name: "",
      parent_warehouse: "",
      account: "",
      is_group: "",
    },
  });

  const formValues = watch();
  const debouncedFormValues = useDebounce(formValues, 300);

  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: "modified",
    direction: "desc", // 🟢 Fixed typo
  });

  const [isSortMenuOpen, setIsSortMenuOpen] = React.useState(false);
  const sortMenuRef = React.useRef<HTMLDivElement>(null);

  // 🟢 1. Initialize Selection Hook
  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected
  } = useSelection(warehouses, "name");

  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* -------------------------------------------------
     FETCH WAREHOUSES (Refactored)
     ------------------------------------------------- */
  const fetchWarehouses = React.useCallback(
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

        // Prepare Filters
        const params: any = {
          fields: JSON.stringify([
            "name",
            "is_group",
            "parent_warehouse",
            "company",
            "warehouse_type",
            "account",
            "modified",
          ]),
          limit_start: start,
          limit_page_length: limit,
          order_by: `${sortConfig.key} ${sortConfig.direction}`, // 🟢 Server-side sorting
        };

        // Build filters from form values
        const filters: any = {};
        if (debouncedFormValues.name) {
          filters.name = ["like", `%${debouncedFormValues.name}%`];
        }
        if (debouncedFormValues.parent_warehouse) {
          filters.parent_warehouse = ["like", `%${debouncedFormValues.parent_warehouse}%`];
        }
        if (debouncedFormValues.account) {
          filters.account = ["like", `%${debouncedFormValues.account}%`];
        }
        if (debouncedFormValues.is_group) {
          filters.is_group = ["=", debouncedFormValues.is_group === "1" ? 1 : 0];
        }

        if (Object.keys(filters).length > 0) {
          params.filters = JSON.stringify(filters);
        }

        const commonHeaders = { Authorization: `token ${apiKey}:${apiSecret}` };

        // 🟢 Parallel Requests: Data + Count (only on reset)
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${encodeURIComponent(doctypeName)}`, {
            params,
            headers: commonHeaders,
            withCredentials: true,
          }),
          isReset
            ? axios.get(`${API_BASE_URL}/api/method/frappe.client.get_count`, {
                params: { 
                    doctype: doctypeName,
                    // Note: frappe.client.get_count doesn't easily support or_filters in GET params 
                    // without full filter array. For now, we fetch total unfiltered or simply ignore count filter accuracy for complex OR searches.
                    // If you need accurate count on search, you might need a custom RPC method.
                },
                headers: commonHeaders,
              })
            : Promise.resolve(null),
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: Warehouse[] = raw.map((r: any) => ({
          name: r.name,
          is_group: r.is_group,
          parent_warehouse: r.parent_warehouse,
          company: r.company,
          warehouse_type: r.warehouse_type,
          account: r.account,
          modified: r.modified,
        }));

        if (isReset) {
          setWarehouses(mapped);
          if (countResp) setTotalCount(countResp.data.message);
        } else {
          setWarehouses((prev) => [...prev, ...mapped]);
        }

        setHasMore(mapped.length === limit);
      } catch (err: any) {
        console.error("API error:", err);
        if (isReset) setError(err.response?.status === 403 ? "Unauthorized" : "Failed to fetch warehouses");
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [doctypeName, apiKey, apiSecret, isAuthenticated, isInitialized, debouncedFormValues, sortConfig]
  );

  // 🟢 Trigger fetch on search or sort change
  React.useEffect(() => {
    fetchWarehouses(0, true);
  }, [fetchWarehouses]);

  // 🟢 Load More Handler
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchWarehouses(warehouses.length, false);
    }
  };

  // 🟢 2. Handle Bulk Delete
  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Are you sure you want to permanently delete ${count} records?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await bulkDeleteRPC(
        doctypeName,
        Array.from(selectedIds),
        API_BASE_URL,
        apiKey!,
        apiSecret!
      );

      // Debug: Log the actual response to understand its structure
      console.log("Bulk Delete Response:", response);

      // Check if the response contains server messages indicating errors
      // For bulk delete, error messages are directly in response._server_messages
      if (response._server_messages) {
        // Parse the server messages to check for errors
        const serverMessages = JSON.parse(response._server_messages);
        const errorMessages = serverMessages.map((msgStr: string) => {
          const parsed = JSON.parse(msgStr);
          return parsed.message;
        });

        if (errorMessages.length > 0) {
          // Show error messages from server
          toast.error("Failed to delete records", {
            description: <FrappeErrorDisplay messages={errorMessages} />,
            duration: Infinity
          });
          return; // Don't proceed with success handling
        }
      }

      // If no error messages, proceed with success
      toast.success(`Successfully deleted ${count} records.`);
      clearSelection();
      fetchWarehouses(0, true); // Reload from scratch
    } catch (err: any) {
      console.error("Bulk Delete Error:", err);

      const messages = getApiMessages(
        null,
        err,
        "Records deleted successfully",
        "Failed to delete records"
      );

      toast.error(messages.message, { description: messages.description, duration: Infinity });
    } finally {
      setIsDeleting(false);
    }
  };

  /* -------------------------------------------------
     SORTING LOGIC
     ------------------------------------------------- */
  // 🟢 Removed client-side sortedWarehouses useMemo. 
  // We now rely on 'warehouses' which is sorted by the server via 'order_by' param.

  const requestSort = (key: keyof Warehouse) => {
    // This will trigger the useEffect -> fetchWarehouses(0, true)
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.key === sortConfig.key)?.label || "Sort By";

  const getFieldsForWarehouse = (w: Warehouse): RecordCardField[] => {
    return [
      { label: "Company", value: w.company || "—" },
      { label: "Parent", value: w.parent_warehouse || "—" },
      { label: "Type", value: w.warehouse_type || "—" },
      { label: "Account", value: w.account || "—" },
      {
        label: "Group",
        value: w.is_group ? "Yes" : "No",
      },
    ].filter((f) => f.value !== "—"); // optional: hide empty fields
  };

  const handleCardClick = (id: string) => {
    router.push(`/operations/doctype/warehouse/${encodeURIComponent(id)}`);
  };

  /* -------------------------------------------------
     RENDERERS
     ------------------------------------------------- */
  const renderListView = () => (
    <div className="stock-table-container">
      <table className="stock-table">
        <thead>
          <tr>
            {/* 🟢 Header Checkbox */}
            <th style={{ width: "40px", textAlign: "center" }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("name")}>
              Store Location ID
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("is_group")}>
              Is Group
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("parent_warehouse")}>
              Parent  Store Location
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("company")}>
              Company
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("warehouse_type")}>
              Type
            </th>
            <th>Account</th>
            {/* 🟢 Total Count Header */}
            <th className="text-right pr-4" style={{ width: "140px" }}>
                <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                 {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                   <><span>{warehouses.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                 )}

              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {warehouses.length ? (
            warehouses.map((w) => {
              const isSelected = selectedIds.has(w.name);
              return (
                <tr
                  key={w.name}
                  onClick={() => handleCardClick(w.name)}
                  style={{
                    cursor: "pointer",
                    backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined
                  }}
                >
                  {/* 🟢 Row Checkbox */}
                  <td
                    style={{ textAlign: "center" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(w.name)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                  </td>
                  <td>{w.name}</td>
                  <td>{w.is_group ? "Yes" : "No"}</td>
                  <td>{w.parent_warehouse || "—"}</td>
                  <td>{w.company || "—"}</td>
                  <td>{w.warehouse_type || "—"}</td>
                  <td>{w.account || "—"}</td>
                  <td className="text-right pr-4">
                    <TimeAgo date={w.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={9} style={{ textAlign: "center", padding: "32px" }}>
                No store location found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid">
      {warehouses.length ? (
        warehouses.map((w) => (
          <RecordCard
            key={w.name}
            title={w.name}
            subtitle={w.company || "No company"}
            fields={getFieldsForWarehouse(w)}
            onClick={() => handleCardClick(w.name)}
          />
        ))
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>No warehouses found.</p>
      )}
    </div>
  );

  if (loading && warehouses.length === 0)
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        Loading store locations...
      </div>
    );

  if (error && warehouses.length === 0)
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        {error}
      </div>
    );

  return (
    <div className="module active">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Store Locations</h2>
          <p>List of store locations with company, parent, type and account</p>
        </div>

        {/* 🟢 3. Header Action Switch */}
        {selectedIds.size > 0 ? (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={clearSelection}
            onDelete={handleBulkDelete}
            isDeleting={isDeleting}
          />
        ) : (
          <Link href="/operations/doctype/warehouse/new" passHref>
            <button className="btn btn--primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Store Location
          </button>
        </Link>
      )}
    </div>

    {/* --- FILTER BAR --- */}
    <div
      className="search-filter-section"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "1rem",
        gap: "8px",
      }}
    >
      {/* Left: Individual Filters */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1" }}>
        <div style={{ minWidth: "150px" }}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => {
              const mockField = {
                name: "name",
                label: "",
                type: "Text" as const,
                placeholder: "Store Location",
                required: false,
              };

              return (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <input
                    {...mockField}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="form-control w-full"
                  />
                </div>
              );
            }}
          />
        </div>

        <div style={{ minWidth: "200px" }}>
          <Controller
            control={control}
            name="parent_warehouse"
            render={({ field }) => {
              const mockField = {
                name: "parent_warehouse",
                label: "",
                type: "Text" as const,
                placeholder: "Parent Store Location",
                required: false,
              };

              return (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <input
                    {...mockField}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="form-control w-full"
                  />
                </div>
              );
            }}
          />
        </div>

        <div style={{ minWidth: "200px" }}>
          <Controller
            control={control}
            name="account"
            render={({ field }) => {
              const mockField = {
                name: "account",
                label: "",
                type: "Text" as const,
                placeholder: "Account",
                required: false,
              };

              return (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <input
                    {...mockField}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="form-control w-full"
                  />
                </div>
              );
            }}
          />
        </div>

        <div style={{ minWidth: "150px" }}>
          <Controller
            control={control}
            name="is_group"
            render={({ field }) => {
              const mockField = {
                name: "is_group",
                label: "",
                type: "Select" as const,
                placeholder: "Is Group",
                required: false,
                options: [
                  { label: "All", value: "" },
                  { label: "Yes", value: "1" },
                  { label: "No", value: "0" },
                ]
              };

              return (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <select
                    {...mockField}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="form-control w-full"
                  >
                    {mockField.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }}
          />
        </div>
      </div>

      {/* Right: Sort Pill + View Switcher */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {/* Sort Pill */}
        <div className="relative" ref={sortMenuRef}>
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            <button
              className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors"
              onClick={() =>
                setSortConfig((prev) => ({
                  ...prev,
                  direction: prev.direction === "asc" ? "desc" : "asc",
                }))
              }
              title={`Sort ${sortConfig.direction === "asc" ? "Descending" : "Ascending"}`}
            >
              {sortConfig.direction === "asc" ? (
                <ArrowDownWideNarrow className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              ) : (
                <ArrowUpNarrowWide className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              )}
            </button>

            <div className="h-4 w-[1px] bg-gray-300 dark:bg-gray-600 mx-1"></div>

            <button
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors"
              onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
            >
              {currentSortLabel}
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
          </div>

          {isSortMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
              <div className="py-1">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Sort By
                </div>
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      sortConfig.key === option.key
                        ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20 font-medium"
                        : "text-gray-700 dark:text-gray-200"
                    }`}
                    onClick={() => {
                      setSortConfig((prev) => ({ ...prev, key: option.key }));
                      setIsSortMenuOpen(false);
                    }}
                  >
                    {option.label}
                    {sortConfig.key === option.key && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* View Switcher */}
        <button
          className="btn btn--outline btn--sm flex items-center justify-center"
          onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
          aria-label={view === "grid" ? "Switch to List View" : "Switch to Grid View"}
        >
          {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
        </button>
      </div>
    </div>

    <div className="view-container" style={{ marginTop: "0.5rem", paddingBottom: "2rem" }}>
      {view === "grid" ? renderGridView() : renderListView()}

      {/* 🟢 Load More Button */}
      {hasMore && warehouses.length > 0 && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="btn btn--secondary flex items-center gap-2 px-6 py-2"
            style={{ minWidth: "140px" }}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </>
            ) : (
              "Load More"
            )}
          </button>
        </div>
      )}
    </div>
  </div>
);
}