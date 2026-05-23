"use client";

import * as React from "react";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
  LayoutGrid,
  List,
  Loader2,
  Plus,
} from "lucide-react";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { BulkActionBar } from "@/components/BulkActionBar";
import { TimeAgo } from "@/components/TimeAgo";
import { bulkDeleteRPC } from "@/api/rpc";
import { useSelection } from "@/hooks/useSelection";
import { useAuth } from "@/context/AuthContext";
import { getApiMessages } from "@/lib/utils";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.1.138:4412";
const DOCTYPE = "Year";
const INITIAL_PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 10;

interface YearRecord {
  name: string;
  year?: string;
  modified?: string;
}

type SortDirection = "asc" | "desc";
interface SortConfig {
  key: keyof YearRecord;
  direction: SortDirection;
}

const SORT_OPTIONS: { label: string; key: keyof YearRecord }[] = [
  { label: "Last Updated On", key: "modified" },
  { label: "Year", key: "year" },
  { label: "ID", key: "name" },
];

type ViewMode = "grid" | "list";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function YearListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const [records, setRecords] = React.useState<YearRecord[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  const [loading, setLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [totalCount, setTotalCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: "modified",
    direction: "desc",
  });
  const [isSortMenuOpen, setIsSortMenuOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const sortMenuRef = React.useRef<HTMLDivElement>(null);

  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected,
  } = useSelection(records, "name");

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchYears = React.useCallback(
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
        const params: Record<string, any> = {
          fields: JSON.stringify(["name", "year", "modified"]),
          limit_start: start,
          limit_page_length: limit,
          order_by: `${sortConfig.key} ${sortConfig.direction}`,
        };

        if (debouncedSearch) {
          params.or_filters = JSON.stringify({
            name: ["like", `%${debouncedSearch}%`],
            year: ["like", `%${debouncedSearch}%`],
          });
        }

        const commonHeaders = { Authorization: `token ${apiKey}:${apiSecret}` };
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${encodeURIComponent(DOCTYPE)}`, {
            params,
            headers: commonHeaders,
            withCredentials: true,
          }),
          isReset
            ? axios.get(`${API_BASE_URL}/api/method/frappe.client.get_count`, {
                params: { doctype: DOCTYPE },
                headers: commonHeaders,
              })
            : Promise.resolve(null),
        ]);

        const mapped: YearRecord[] = (dataResp.data?.data || []).map((row: any) => ({
          name: row.name,
          year: row.year,
          modified: row.modified,
        }));

        if (isReset) {
          setRecords(mapped);
          if (countResp) setTotalCount(countResp.data.message);
        } else {
          setRecords((prev) => [...prev, ...mapped]);
        }

        setHasMore(mapped.length === limit);
      } catch (err: any) {
        console.error("Year API error:", err);
        if (isReset) {
          setError(err.response?.status === 403 ? "Unauthorized" : "Failed to fetch years");
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [apiKey, apiSecret, debouncedSearch, isAuthenticated, isInitialized, sortConfig]
  );

  React.useEffect(() => {
    fetchYears(0, true);
  }, [fetchYears]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchYears(records.length, false);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Are you sure you want to permanently delete ${count} records?`)) {
      return;
    }

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
        const serverMessages = JSON.parse(response._server_messages);
        const errorMessages = serverMessages.map((msgStr: string) => {
          const parsed = JSON.parse(msgStr);
          return parsed.message;
        });

        if (errorMessages.length > 0) {
          toast.error("Failed to delete records", {
            description: <FrappeErrorDisplay messages={errorMessages} />,
            duration: Infinity,
          });
          return;
        }
      }

      toast.success(`Successfully deleted ${count} records.`);
      clearSelection();
      fetchYears(0, true);
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

  const requestSort = (key: keyof YearRecord) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const currentSortLabel =
    SORT_OPTIONS.find((option) => option.key === sortConfig.key)?.label || "Sort By";

  const handleRecordClick = (id: string) => {
    router.push(`/operations/doctype/year/${encodeURIComponent(id)}`);
  };

  const getFieldsForRecord = (record: YearRecord): RecordCardField[] => [
    { label: "Year", value: record.year || record.name },
    { label: "Modified", value: record.modified || "-" },
  ];

  const renderListView = () => (
    <div className="stock-table-container">
      <table className="stock-table">
        <thead>
          <tr>
            <th style={{ width: "40px", textAlign: "center" }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                style={{ cursor: "pointer", height: "16px", width: "16px" }}
              />
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("year")}>
              Year
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("name")}>
              ID
            </th>
            <th className="text-right pr-4" style={{ width: "140px" }}>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <span>{records.length}</span>
                    <span className="opacity-50">/</span>
                    <span className="font-bold text-gray-900 dark:text-gray-200">
                      {totalCount}
                    </span>
                  </>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.length ? (
            records.map((record) => {
              const isSelected = selectedIds.has(record.name);
              return (
                <tr
                  key={record.name}
                  onClick={() => handleRecordClick(record.name)}
                  style={{
                    cursor: "pointer",
                    backgroundColor: isSelected
                      ? "var(--color-surface-selected, #f0f9ff)"
                      : undefined,
                  }}
                >
                  <td style={{ textAlign: "center" }} onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(record.name)}
                      style={{ cursor: "pointer", height: "16px", width: "16px" }}
                    />
                  </td>
                  <td>{record.year || record.name}</td>
                  <td>{record.name}</td>
                  <td className="text-right pr-4">
                    <TimeAgo date={record.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={4} style={{ padding: "32px", textAlign: "center" }}>
                {!loading && "No records found."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid">
      {records.length ? (
        records.map((record) => (
          <RecordCard
            key={record.name}
            title={record.year || record.name}
            subtitle={record.name}
            fields={getFieldsForRecord(record)}
            onClick={() => handleRecordClick(record.name)}
          />
        ))
      ) : (
        !loading && <p style={{ color: "var(--color-text-secondary)" }}>No records found.</p>
      )}
    </div>
  );

  if (loading && records.length === 0) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        Loading years...
      </div>
    );
  }

  if (error && records.length === 0) {
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        {error}
      </div>
    );
  }

  return (
    <div className="module active">
      <div
        className="module-header"
        style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}
      >
        <div>
          <h2>Year</h2>
          <p>Years list</p>
        </div>

        {selectedIds.size > 0 ? (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={clearSelection}
            onDelete={handleBulkDelete}
            isDeleting={isDeleting}
          />
        ) : (
          <Link href="/operations/doctype/year/new" passHref>
            <button className="btn btn--primary flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Year
            </button>
          </Link>
        )}
      </div>

      <div
        className="search-filter-section"
        style={{
          alignItems: "center",
          display: "flex",
          gap: "8px",
          justifyContent: "space-between",
          marginTop: "1rem",
        }}
      >
        <div className="relative" style={{ flexGrow: 1, maxWidth: "400px" }}>
          <input
            type="text"
            placeholder="Search Year..."
            className="form-control w-full"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search Year"
          />
        </div>

        <div style={{ alignItems: "center", display: "flex", gap: "12px" }}>
          <div className="relative" ref={sortMenuRef}>
            <div className="flex items-center rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800">
              <button
                className="rounded-md p-2 transition-colors hover:bg-white dark:hover:bg-gray-700"
                onClick={() =>
                  setSortConfig((prev) => ({
                    ...prev,
                    direction: prev.direction === "asc" ? "desc" : "asc",
                  }))
                }
              >
                {sortConfig.direction === "asc" ? (
                  <ArrowDownWideNarrow className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                ) : (
                  <ArrowUpNarrowWide className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                )}
              </button>
              <div className="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600" />
              <button
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-white dark:text-gray-200 dark:hover:bg-gray-700"
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
              >
                {currentSortLabel}
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </div>
            {isSortMenuOpen && (
              <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="py-1">
                  <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Sort By
                  </div>
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        sortConfig.key === option.key
                          ? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-900/20"
                          : "text-gray-700 dark:text-gray-200"
                      }`}
                      onClick={() => {
                        setSortConfig((prev) => ({ ...prev, key: option.key }));
                        setIsSortMenuOpen(false);
                      }}
                    >
                      {option.label}
                      {sortConfig.key === option.key && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            className="btn btn--outline btn--sm flex items-center justify-center"
            onClick={() => setView((current) => (current === "grid" ? "list" : "grid"))}
          >
            {view === "grid" ? (
              <List className="h-4 w-4" />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
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
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
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
