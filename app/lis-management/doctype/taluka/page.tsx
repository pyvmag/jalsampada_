"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

// 🟢 New Imports for Bulk Delete and Features
import { useSelection } from "@/hooks/useSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
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
  Loader2
} from "lucide-react";

// 🟢 CONFIG
const DOCTYPE = "WRD Taluka";
const API_BASE_URL = "http://103.219.1.138:4412";
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

// ── Types ────────────────────────────────────────────────────────
interface TalukaRow {
  name: string;
  taluka: string;   // The Taluka Name
  district: string; // Link to District
  modified: string;
}

type SortDirection = "asc" | "desc";
interface SortConfig {
  key: keyof TalukaRow;
  direction: SortDirection;
}

const SORT_OPTIONS: { label: string; key: keyof TalukaRow }[] = [
  { label: "Last Updated On", key: "modified" },
  { label: "ID", key: "name" },
  { label: "Taluka", key: "taluka" },
  { label: "District", key: "district" },
];

type ViewMode = "grid" | "list";

export default function TalukaListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = DOCTYPE;

  const [rows, setRows] = React.useState<TalukaRow[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");

  // Loading & Pagination States
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
  const sortMenuRef = React.useRef<HTMLDivElement>(null);

  // Selection Hook
  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected
  } = useSelection(rows, "name");

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

  // ── Fetch Data ───────────────────────────────────────────────────
  const fetchRows = React.useCallback(
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

        const params: any = {
          fields: JSON.stringify(["name", "taluka", "district", "modified"]),
          limit_start: start,
          limit_page_length: limit,
          order_by: `${sortConfig.key} ${sortConfig.direction}`,
        };

        if (debouncedSearch) {
          params.or_filters = JSON.stringify({
            name: ["like", `%${debouncedSearch}%`],
            taluka: ["like", `%${debouncedSearch}%`],
            district: ["like", `%${debouncedSearch}%`],
          });
        }

        const commonHeaders = { Authorization: `token ${apiKey}:${apiSecret}` };

        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${encodeURIComponent(doctypeName)}`, {
            params,
            headers: commonHeaders,
            withCredentials: true,
          }),
          isReset
            ? axios.get(`${API_BASE_URL}/api/method/frappe.client.get_count`, {
                params: { doctype: doctypeName },
                headers: commonHeaders,
              })
            : Promise.resolve(null),
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: TalukaRow[] = raw.map((r: any) => ({
          name: r.name,
          taluka: r.taluka,
          district: r.district,
          modified: r.modified,
        }));

        if (isReset) {
          setRows(mapped);
          if (countResp) setTotalCount(countResp.data.message);
        } else {
          setRows((prev) => [...prev, ...mapped]);
        }

        setHasMore(mapped.length === limit);
      } catch (err: any) {
        console.error("API error:", err);
        if (isReset) setError(err.response?.status === 403 ? "Unauthorized" : "Failed to fetch talukas.");
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [doctypeName, apiKey, apiSecret, isAuthenticated, isInitialized, debouncedSearch, sortConfig]
  );

  React.useEffect(() => {
    fetchRows(0, true);
  }, [fetchRows]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchRows(rows.length, false);
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
        doctypeName,
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
            duration: Infinity
          });
          return;
        }
      }

      toast.success(`Successfully deleted ${count} records.`);
      clearSelection();
      fetchRows(0, true);
    } catch (err: any) {
      console.error("Bulk Delete Error:", err);
      const messages = getApiMessages(null, err, "Records deleted successfully", "Failed to delete records");
      toast.error(messages.message, { description: messages.description, duration: Infinity });
    } finally {
      setIsDeleting(false);
    }
  };

  const requestSort = (key: keyof TalukaRow) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const currentSortLabel = SORT_OPTIONS.find((opt) => opt.key === sortConfig.key)?.label || "Sort By";

  // ── Render Helpers ──────────────────────────────────────────────
  const handleCardClick = (id: string) => {
    router.push(`/lis-management/doctype/taluka/${encodeURIComponent(id)}`);
  };

  const renderListView = () => (
    <div className="stock-table-container thin-scroll-x" style={{ overflowX: "auto" }}>
      <table className="stock-table" style={{ minWidth: "800px", whiteSpace: "nowrap" }}>
        <thead>
          <tr>
            <th style={{ width: "40px", textAlign: "center" }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
            </th>
            <th style={{ cursor: "pointer", minWidth: 140 }} onClick={() => requestSort("name")}>
              ID
            </th>
            <th style={{ cursor: "pointer", minWidth: 200 }} onClick={() => requestSort("taluka")}>
              Taluka
            </th>
            <th style={{ cursor: "pointer", minWidth: 200 }} onClick={() => requestSort("district")}>
              District
            </th>
            <th className="text-right pr-4" style={{ width: "140px" }}>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                  <><span>{rows.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => {
              const isSelected = selectedIds.has(row.name);
              return (
                <tr 
                  key={row.name} 
                  onClick={() => handleCardClick(row.name)}
                  style={{ 
                    cursor: "pointer",
                    backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined
                  }}
                >
                  <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(row.name)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                  </td>
                  <td style={{ minWidth: 140 }}>{row.name}</td>
                  <td style={{ minWidth: 200 }}>{row.taluka}</td>
                  <td style={{ minWidth: 200 }}>{row.district}</td>
                  <td className="text-right pr-4">
                    <TimeAgo date={row.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: "32px" }}>
                No talukas found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {rows.length ? (
        rows.map((row) => (
          <RecordCard
            key={row.name}
            title={row.taluka}
            subtitle={row.district}
            fields={[{ label: "ID", value: row.name }]}
            onClick={() => handleCardClick(row.name)}
          />
        ))
      ) : (
        <p className="col-span-full py-8 text-muted-foreground text-center">No talukas found.</p>
      )}
    </div>
  );

  if (loading && rows.length === 0) {
    return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>;
  }

  if (error && rows.length === 0) {
    return <div className="p-8">{error}</div>;
  }

  return (
    <div className="module active p-6">
      <div className="module-header flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold">Taluka</h2>
          <p className="text-muted-foreground">Manage Talukas</p>
        </div>
        
        {selectedIds.size > 0 ? (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={clearSelection}
            onDelete={handleBulkDelete}
            isDeleting={isDeleting}
          />
        ) : (
          <Link href="/lis-management/doctype/taluka/new" passHref>
            <button className="btn btn--primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Taluka
            </button>
          </Link>
        )}
      </div>

      <div className="search-filter-section flex gap-2 items-center mb-6">
        <div className="flex gap-2 items-center flex-1">
          <div className="relative min-w-[200px]">
            <input
              type="text"
              placeholder="Search Taluka..."
              className="form-control w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search Taluka"
            />
          </div>
        </div>

        <div className="flex gap-3 items-center">
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
              <div className="h-4 w-[1px] bg-gray-300 dark:bg-gray-600 mx-1" />
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
          <button
            className="btn btn--outline btn--sm flex items-center justify-center p-2"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
          >
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="view-container pb-8">
        {view === "grid" ? renderGridView() : renderListView()}

        {hasMore && rows.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="btn btn--secondary flex items-center gap-2 px-6 py-2 min-w-[140px]"
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