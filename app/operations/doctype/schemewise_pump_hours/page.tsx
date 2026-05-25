"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import { Controller, useForm } from "react-hook-form";
import { LinkField } from "@/components/LinkField";
import Link from "next/link";
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
  Loader2,
  Calendar,
  Layers,
  MapPin,
  Clock
} from "lucide-react";

const API_BASE_URL = "http://103.219.3.169:2223";
const INITIAL_PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 10;

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

interface SchemewisePumpHours {
  name: string;
  lis_name?: string;
  stage?: string;
  year?: string;
  month?: string;
  modified?: string;
}

type SortDirection = "asc" | "desc";
interface SortConfig {
  key: keyof SchemewisePumpHours;
  direction: SortDirection;
}

const SORT_OPTIONS: { label: string; key: keyof SchemewisePumpHours }[] = [
  { label: "Last Updated On", key: "modified" },
  { label: "ID", key: "name" },
  { label: "LIS Name", key: "lis_name" },
  { label: "Stage", key: "stage" },
  { label: "Year", key: "year" },
  { label: "Month", key: "month" },
];

type ViewMode = "grid" | "list";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function SchemewisePumpHoursPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Schemewise Pump Hours";

  const [rows, setRows] = React.useState<SchemewisePumpHours[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  const [loading, setLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [totalCount, setTotalCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const { control, watch } = useForm({
    defaultValues: {
      lis_name: "",
      stage: "",
      year: "",
      month: "",
    },
  });

  const selectedLis = watch("lis_name");
  const selectedStage = watch("stage");
  const selectedYear = watch("year");
  const selectedMonth = watch("month");

  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: "modified",
    direction: "desc",
  });

  const [isSortMenuOpen, setIsSortMenuOpen] = React.useState(false);
  const sortMenuRef = React.useRef<HTMLDivElement>(null);

  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected,
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

  const fetchPumpHours = React.useCallback(
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
          fields: JSON.stringify([
            "name",
            "lis_name",
            "stage",
            "year",
            "month",
            "modified",
          ]),
          limit_start: start,
          limit_page_length: limit,
          order_by: `${sortConfig.key} ${sortConfig.direction}`,
        };

        const filters: any[] = [];

        if (debouncedSearch) {
          params.or_filters = JSON.stringify({
            name: ["like", `%${debouncedSearch}%`],
            lis_name: ["like", `%${debouncedSearch}%`],
            stage: ["like", `%${debouncedSearch}%`],
          });
        }

        if (selectedLis) {
          filters.push(["Schemewise Pump Hours", "lis_name", "=", selectedLis]);
        }

        if (selectedStage) {
          filters.push(["Schemewise Pump Hours", "stage", "=", selectedStage]);
        }

        if (selectedYear) {
          filters.push(["Schemewise Pump Hours", "year", "=", selectedYear]);
        }

        if (selectedMonth) {
          filters.push(["Schemewise Pump Hours", "month", "=", selectedMonth]);
        }

        if (filters.length > 0) {
          params.filters = JSON.stringify(filters);
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
              params: {
                doctype: doctypeName,
                filters: filters.length > 0 ? JSON.stringify(filters) : undefined,
              },
              headers: commonHeaders,
            })
            : Promise.resolve(null),
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: SchemewisePumpHours[] = raw.map((r: any) => ({
          name: r.name,
          lis_name: r.lis_name,
          stage: r.stage,
          year: r.year,
          month: r.month,
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
        if (isReset) setError(err.response?.status === 403 ? "Unauthorized" : "Failed to fetch schemewise pump hours");
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [doctypeName, apiKey, apiSecret, isAuthenticated, isInitialized, debouncedSearch, selectedLis, selectedStage, selectedYear, selectedMonth, sortConfig]
  );

  React.useEffect(() => {
    fetchPumpHours(0, true);
  }, [fetchPumpHours]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchPumpHours(rows.length, false);
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
            duration: Infinity,
          });
          return;
        }
      }

      toast.success(`Successfully deleted ${count} records.`);
      clearSelection();
      fetchPumpHours(0, true);
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

  const requestSort = (key: keyof SchemewisePumpHours) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.key === sortConfig.key)?.label || "Sort By";

  const getFieldsForRow = (row: SchemewisePumpHours): RecordCardField[] => {
    const fields: RecordCardField[] = [];
    if (row.lis_name) fields.push({ label: "LIS Name", value: row.lis_name });
    if (row.stage) fields.push({ label: "Stage", value: row.stage });
    if (row.year) fields.push({ label: "Year", value: row.year });
    if (row.month) fields.push({ label: "Month", value: row.month });
    return fields;
  };

  const title = "Schemewise Pump Hours";

  const handleCardClick = (id: string) => {
    router.push(`/operations/doctype/schemewise_pump_hours/${encodeURIComponent(id)}`);
  };

  const renderListView = () => (
    <div className="stock-table-container" style={{ overflowX: "auto" }}>
      <table className="stock-table" style={{ minWidth: "1000px", whiteSpace: "nowrap" }}>
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
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("name")}>
              ID
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("lis_name")}>
              LIS Name
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("stage")}>
              Stage
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("year")}>
              Year
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("month")}>
              Month
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
                    backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined,
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
                  <td>{row.name}</td>
                  <td>{row.lis_name || "—"}</td>
                  <td>{row.stage || "—"}</td>
                  <td>{row.year || "—"}</td>
                  <td>{row.month || "—"}</td>
                  <td className="text-right pr-4">
                    <TimeAgo date={row.modified} />
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
      {rows.length ? (
        rows.map((row) => (
          <RecordCard
            key={row.name}
            title={row.name}
            subtitle={row.lis_name || "—"}
            fields={getFieldsForRow(row)}
            onClick={() => handleCardClick(row.name)}
          />
        ))
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>No records found.</p>
      )}
    </div>
  );

  if (loading && rows.length === 0)
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        Loading schemewise pump hours...
      </div>
    );

  if (error && rows.length === 0)
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        {error}
      </div>
    );

  return (
    <div className="module active">
      <div className="module-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>{title}</h2>
          <p>Schemewise monthly pump operational hours ledger</p>
        </div>

        {selectedIds.size > 0 ? (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={clearSelection}
            onDelete={handleBulkDelete}
            isDeleting={isDeleting}
          />
        ) : (
          <Link href="/operations/doctype/schemewise_pump_hours/new" passHref>
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
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1", flexWrap: "wrap" }}>
          {/* Omni-Search */}
          <div className="relative animate-fade-in" style={{ minWidth: "200px" }}>
            <input
              type="text"
              placeholder="Search ID/LIS/Stage..."
              className="form-control w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search Schemewise Pump Hours"
            />
          </div>

          {/* LIS Filter */}
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

          {/* Stage Filter */}
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
                      filters={selectedLis ? { lis_name: selectedLis } : {}}
                      className="[&>label]:hidden vishal"
                    />
                  </div>
                );
              }}
            />
          </div>

          {/* Year Filter */}
          <div style={{ minWidth: "150px", marginBottom: "0.2rem" }}>
            <Controller
              control={control}
              name="year"
              render={({ field: { value } }) => {
                const mockField = {
                  name: "year",
                  label: "",
                  type: "Link" as const,
                  linkTarget: "Year",
                  placeholder: "Select Year",
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

          {/* Month Filter */}
          <div style={{ minWidth: "150px", marginBottom: "0.2rem" }}>
            <Controller
              control={control}
              name="month"
              render={({ field: { onChange, value } }) => (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <select
                    className="form-control w-full h-[40px] px-3 border rounded-lg bg-background text-sm"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{ height: '40px' }}
                  >
                    <option value="">Select Month</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
            />
          </div>
        </div>

        {/* Right: Sort Pill + View Switcher */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
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
            style={{ height: '40px' }}
          >
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="view-container" style={{ marginTop: "0.5rem", paddingBottom: "2rem" }}>
        {view === "grid" ? renderGridView() : renderListView()}

        {hasMore && rows.length > 0 && (
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
