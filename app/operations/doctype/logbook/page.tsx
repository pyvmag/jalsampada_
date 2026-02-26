"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import { Controller, useForm } from "react-hook-form";
import { LinkField } from "@/components/LinkField";
import Link from "next/link";
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

// 🟢 New Imports for Bulk Delete
import { useSelection } from "@/hooks/useSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { getApiMessages, parseServerMessages } from "@/lib/utils";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay";
import { TimeAgo } from "@/components/TimeAgo";

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
   1. Logbook Type Definition
   ------------------------------------------------- */
interface Logbook {
  name: string;
  status?: string;
  stop_datetime?: string;
  lis_name?: string;
  modified?: string;
  docstatus?: number;
}

type SortDirection = "asc" | "desc"; // 🟢 Fixed typo 'dsc' -> 'desc' to match API expectation
interface SortConfig {
  key: keyof Logbook;
  direction: SortDirection;
}

const SORT_OPTIONS: { label: string; key: keyof Logbook }[] = [
  { label: "Last Updated On", key: "modified" },
  { label: "ID", key: "name" },
  { label: "Status", key: "status" },
  { label: "Stop Datetime", key: "stop_datetime" },
  { label: "LIS", key: "lis_name" },
];

type ViewMode = "grid" | "list";

export default function LogbookPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Logbook";

  const [logbooks, setLogbooks] = React.useState<Logbook[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // Total count of records
  const [error, setError] = React.useState<string | null>(null);

  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Form for filters
  const { control, watch } = useForm({
    defaultValues: {
      lis_name: "",
      stage: "",
    },
  });

  const selectedLis = watch("lis_name");
  const selectedStage = watch("stage");

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
  } = useSelection(logbooks, "name");

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
     3. FETCH LOGBOOKS (Refactored)
     ------------------------------------------------- */
  const fetchLogbooks = React.useCallback(
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
            "status",
            "stop_datetime",
            "lis_name",
            "modified",
            "docstatus",
          ]),
          limit_start: start,
          limit_page_length: limit,
          order_by: `${sortConfig.key} ${sortConfig.direction}`, // 🟢 Server-side sorting
        };

        const filters: any[] = [];

        if (debouncedSearch) {
          // Search by ID, status, LIS
          params.or_filters = JSON.stringify({
            name: ["like", `%${debouncedSearch}%`],
            status: ["like", `%${debouncedSearch}%`],
            lis_name: ["like", `%${debouncedSearch}%`],
          });
        }

        if (selectedLis) {
          filters.push(["Logbook", "lis_name", "=", selectedLis]);
        }

        if (selectedStage) {
          filters.push(["Logbook", "stage", "=", selectedStage]);
        }

        if (filters.length > 0) {
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
        const mapped: Logbook[] = raw.map((r: any) => ({
          name: r.name,
          status: r.status,
          stop_datetime: r.stop_datetime,
          lis_name: r.lis_name,
          modified: r.modified,
          docstatus: r.docstatus,
        }));

        if (isReset) {
          setLogbooks(mapped);
          if (countResp) setTotalCount(countResp.data.message);
        } else {
          setLogbooks((prev) => [...prev, ...mapped]);
        }

        setHasMore(mapped.length === limit);
      } catch (err: any) {
        console.error("API error:", err);
        if (isReset) setError(err.response?.status === 403 ? "Unauthorized" : "Failed to fetch");
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [doctypeName, apiKey, apiSecret, isAuthenticated, isInitialized, debouncedSearch, selectedLis, selectedStage, sortConfig]
  );

  // 🟢 Trigger fetch on search, filter, or sort change
  React.useEffect(() => {
    fetchLogbooks(0, true);
  }, [fetchLogbooks]);

  // 🟢 Load More Handler
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchLogbooks(logbooks.length, false);
    }
  };

  // Helper function to determine status display based on document status
  const getStatusDisplay = (logbook: Logbook) => {
    // 1. If Cancelled
    if (logbook.docstatus === 2) return "Cancelled";
    
    // 2. If Submitted (Show Operational Status)
    if (logbook.docstatus === 1) {
      return logbook.status || "Submitted";
    }
    
    // 3. If Draft (docstatus === 0) - show Draft instead of operational status
    if (logbook.docstatus === 0) {
      return "Draft";
    }
    
    return logbook.status || "—";
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
        // Use the parseServerMessages function to strip HTML
        const errorMessages = parseServerMessages(response._server_messages);

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
      fetchLogbooks(0, true); // Reload from scratch
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
     4. SORTING LOGIC
     ------------------------------------------------- */
  // 🟢 Removed client-side sortedLogbooks useMemo. 
  // We now rely on 'logbooks' which is sorted by the server via 'order_by' param.

  const requestSort = (key: keyof Logbook) => {
    // This will trigger the useEffect -> fetchLogbooks(0, true)
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.key === sortConfig.key)?.label || "Sort By";

  const getFieldsForLogbook = (l: Logbook): RecordCardField[] => {
    const fields: RecordCardField[] = [];
    const statusDisplay = getStatusDisplay(l);
    if (statusDisplay) fields.push({ label: "Status", value: statusDisplay });
    if (l.lis_name) fields.push({ label: "LIS", value: l.lis_name });
    if (l.stop_datetime) fields.push({ label: "Stop Datetime", value: l.stop_datetime });
    return fields;
  };

  const title = "Logbook";

  const handleCardClick = (id: string) => {
    router.push(`/operations/doctype/logbook/${encodeURIComponent(id)}`);
  };

  /* -------------------------------------------------
     6. RENDERERS
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
              ID
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("status")}>
              Status
            </th>
            <th
              style={{ cursor: "pointer" }}
              onClick={() => requestSort("stop_datetime")}
            >
              Stop Datetime
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("lis_name")}>
              LIS
            </th>
            {/* 🟢 Total Count Header */}
            <th className="text-right pr-4" style={{ width: "140px" }}>
                <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                 {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                   <><span>{logbooks.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                 )}

              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {logbooks.length ? (
            logbooks.map((l) => {
              const isSelected = selectedIds.has(l.name);
              return (
                <tr
                  key={l.name}
                  onClick={() => handleCardClick(l.name)}
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
                      onChange={() => handleSelectOne(l.name)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                  </td>
                  <td>{l.name}</td>
                  <td>
                    <span
                      style={{
                        color:
                          l.docstatus === 2
                            ? "#dc2626" // red-600 for Cancelled
                            : l.docstatus === 0
                            ? "#6b7280" // gray-500 for Draft
                            : l.status === "Stopped"
                            ? "#dc2626" // red-600
                            : l.status === "Running"
                              ? "#16a34a" // green-600
                              : "inherit",
                        fontWeight:
                          l.docstatus === 2 || l.docstatus === 0 || l.status === "Stopped" || l.status === "Running"
                            ? 600
                            : "normal",
                      }}
                    >
                      {getStatusDisplay(l)}
                    </span>
                  </td>
                  <td>{l.stop_datetime || "—"}</td>
                  <td>{l.lis_name || "—"}</td>
                  <td className="text-right pr-4">
                    <TimeAgo date={l.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid">
      {logbooks.length ? (
        logbooks.map((l) => (
          <RecordCard
            key={l.name}
            title={l.name}
            subtitle={l.status || "—"}
            fields={getFieldsForLogbook(l)}
            onClick={() => handleCardClick(l.name)}
          />
        ))
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>No records found.</p>
      )}
    </div>
  );

  if (loading && logbooks.length === 0)
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        Loading logbook entries...
      </div>
    );

  if (error && logbooks.length === 0)
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        {error}
      </div>
    );

  return (
    <div className="module active">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{title}</h2>
          <p>Logbook entries with status, stop time, and LIS</p>
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
          <Link href="/operations/doctype/logbook/new" passHref>
            <button className="btn btn--primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add {title}
            </button>
          </Link>
        )}
      </div>

      {/* --- FILTER BAR --- */}
      <div
        className="search-filter-section"
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginTop: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1" }}>
          {/* Left: Single Omni-Search */}
          <div className="relative" style={{ minWidth: "200px" }}>
            <input
              type="text"
              placeholder="Search Logbook..."
              className="form-control w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search Logbook"
            />
          </div>

          <div style={{ minWidth: "200px", marginBottom: "0.2rem" }}>
            <Controller
              control={control}
              name="lis_name"
              render={({ field: { value } }) => {
                const mockField = {
                  name: "lis_name",
                  label: "",
                  type: "Link" as const,
                  linkTarget: "Lift Irrigation Scheme",
                  placeholder: "Select LIS",
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

          <div style={{ minWidth: "200px", marginBottom: "0.2rem" }}>
            <Controller
              control={control}
              name="stage"
              render={({ field: { value } }) => {
                const mockField = {
                  name: "stage",
                  label: "",
                  type: "Link" as const,
                  linkTarget: "Stage No",
                  placeholder: "Select Stage",
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
                      filters={selectedLis ? { lis_name: selectedLis } : {}}
                    />
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
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                <div className="py-1">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Sort By
                  </div>
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${sortConfig.key === option.key
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
          <button
            className="btn btn--outline btn--sm flex items-center justify-center"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
          >
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="view-container" style={{ marginTop: "0.5rem", paddingBottom: "2rem" }}>
        {view === "grid" ? renderGridView() : renderListView()}

        {/* 🟢 Load More Button */}
        {hasMore && logbooks.length > 0 && (
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
