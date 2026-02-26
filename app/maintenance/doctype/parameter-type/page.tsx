"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import { useSelection } from "@/hooks/useSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay";
import { TimeAgo } from "@/components/TimeAgo";
import { formatTimeAgo } from "@/lib/utils";
import {
  Plus,
  List,
  LayoutGrid,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-react";

/* ─────────────────────────────────────────────── */
const API_BASE_URL = "http://103.219.3.169:2223";

// 🟢 CONFIG: Settings for Frappe-like pagination
const INITIAL_PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 10;
const DOCTYPE = "Parameter Type";

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
interface ParameterType {
  name: string;
  parameter_type?: string;
  creation?: string;
  modified?: string;
}

type ViewMode = "grid" | "list";

type SortDirection = "asc" | "desc";
interface SortConfig {
  key: "name" | "creation" | "modified";
  direction: SortDirection;
}

const SORT_OPTIONS = [
  { label: "Last Updated On", key: "modified" },
  { label: "ID", key: "name" },
  { label: "Created On", key: "creation" },
] as const;

/* ─────────────────────────────────────────────── */
export default function ParameterTypeListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const title = "Parameter Type";

  const [records, setRecords] = React.useState<ParameterType[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");

  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // 🟢 Total count of records
  const [error, setError] = React.useState<string | null>(null);

  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: "modified",
    direction: "desc",
  });

  const [isSortMenuOpen, setIsSortMenuOpen] = React.useState(false);

  /* ── Search ─────────────────────────────────── */
  const filteredRecords = React.useMemo(() => {
    if (!debouncedSearch) return records;
    return records.filter(
      (r) =>
        r.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        r.parameter_type
          ?.toLowerCase()
          .includes(debouncedSearch.toLowerCase())
    );
  }, [records, debouncedSearch]);

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
        const filters: any[] = [];
        if (debouncedSearch) {
          filters.push(["Parameter Type", "name", "like", `%${debouncedSearch}%`]);
          filters.push(["Parameter Type", "parameter_type", "like", `%${debouncedSearch}%`]);
        }

        const commonHeaders = {
          Authorization: `token ${apiKey}:${apiSecret}`,
        };

        // Parallel requests for Data and Total Count
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${DOCTYPE}`, {
            params: {
              fields: JSON.stringify([
                "name",
                "parameter_type",
                "creation",
                "modified",
              ]),
              limit_start: start,
              limit_page_length: limit,
              order_by: `${sortConfig.key} ${sortConfig.direction}`,
              filters: filters.length > 0 ? JSON.stringify(filters) : undefined,
            },
            headers: commonHeaders,
            withCredentials: true,
          }),
          // Only fetch count during initial load or filter change
          isReset ? axios.get(`${API_BASE_URL}/api/method/frappe.client.get_count`, {
            params: {
              doctype: DOCTYPE,
              filters: filters.length > 0 ? JSON.stringify(filters) : undefined
            },
            headers: commonHeaders,
          }) : Promise.resolve(null)
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: ParameterType[] = raw.map((r: any) => ({
          name: r.name,
          parameter_type: r.parameter_type ?? "",
          creation: r.creation ?? "",
          modified: r.modified ?? "",
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
              : `Failed to fetch ${DOCTYPE}`
          );
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [apiKey, apiSecret, isAuthenticated, isInitialized, debouncedSearch, sortConfig]
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
        DOCTYPE,
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
      fetchRecords(0, true);
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
    router.push(
      `/maintenance/doctype/parameter-type/${encodeURIComponent(id)}`
    );
  };

  const getFieldsForRecord = (
    record: ParameterType
  ): RecordCardField[] => [
      {
        label: "Parameter Type",
        value: record.parameter_type || "-",
      },
      { label: "Created", value: formatTimeAgo(record.creation) },
    ];

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.key === sortConfig.key)?.label ??
    "Sort By";

  /* ── Views ───────────────────────────────────── */
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
              />
            </th>
            <th>ID</th>
            <th>Parameter Type</th>
            <th className="text-right pr-4" style={{ width: "120px" }}>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {loading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <span>{records.length}</span>
                    <span className="opacity-50"> /</span>
                    <span className="text-gray-900 dark:text-gray-200 font-bold">
                      {totalCount}
                    </span>
                  </>
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
                    backgroundColor: isSelected
                      ? "var(--color-surface-selected, #f0f9ff)"
                      : undefined,
                  }}
                >
                  <td
                    onClick={(e) => e.stopPropagation()}
                    style={{ textAlign: "center" }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(r.name)}
                    />
                  </td>
                  <td>{r.name}</td>
                  <td>{r.parameter_type}</td>
                  <td className="text-right pr-4">
                    <TimeAgo date={r.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={4} style={{ textAlign: "center", padding: 32 }}>
                No records found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid">
      {filteredRecords.length ? (
        filteredRecords.map((r) => (
          <RecordCard
            key={r.name}
            title={r.name}
            fields={getFieldsForRecord(r)}
            onClick={() => handleCardClick(r.name)}
          />
        ))
      ) : (
        <p>No records found</p>
      )}
    </div>
  );

  if (loading)
    return <p style={{ padding: "2rem" }}>Loading {title}...</p>;
  if (error)
    return <p style={{ padding: "2rem", color: "red" }}>{error}</p>;

  /* ── Render ─────────────────────────────────── */
  return (
    <div className="module active">
      <div className="module-header">
        <div>
          <h2>{title}</h2>
          <p>Manage {title}</p>
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
            onClick={() =>
              router.push("/maintenance/doctype/parameter-type/new")
            }
          >
            <Plus className="w-4 h-4" /> Add {title}
          </button>
        )}
      </div>

      <div
        className="search-filter-section"
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginTop: "1rem",
        }}
      >
        <input
          type="text"
          placeholder={`Search ${title}...`}
          className="form-control"
          style={{ width: 240 }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="relative ml-auto">
          <div className="flex items-center rounded-lg border p-1">
            <button
              className="p-2"
              onClick={() =>
                setSortConfig((prev) => ({
                  ...prev,
                  direction: prev.direction === "asc" ? "desc" : "asc",
                }))
              }
            >
              {sortConfig.direction === "asc" ? (
                <ArrowDownWideNarrow className="w-4 h-4" />
              ) : (
                <ArrowUpNarrowWide className="w-4 h-4" />
              )}
            </button>

            <button
              className="flex items-center gap-2 px-3"
              onClick={() => setIsSortMenuOpen((v) => !v)}
            >
              {currentSortLabel}
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {isSortMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow border z-50">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className="w-full px-4 py-2 flex justify-between hover:bg-gray-100"
                  onClick={() => {
                    setSortConfig((prev) => ({
                      ...prev,
                      key: opt.key,
                    }));
                    setIsSortMenuOpen(false);
                  }}
                >
                  {opt.label}
                  {sortConfig.key === opt.key && (
                    <Check className="w-4 h-4" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="btn btn--outline btn--sm"
          onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
        >
          {view === "grid" ? (
            <List className="w-4 h-4" />
          ) : (
            <LayoutGrid className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="view-container" style={{ marginTop: "0.5rem" }}>
        {view === "grid" ? renderGridView() : renderListView()}
      </div>
    </div>
  );
}