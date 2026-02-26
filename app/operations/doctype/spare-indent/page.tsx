"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { LinkField } from "@/components/LinkField";

import { useSelection } from "@/hooks/useSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay";
import { TimeAgo } from "@/components/TimeAgo";
import {
  Plus,
  List,
  LayoutGrid,
  ChevronDown,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  Check,
  Loader2
} from "lucide-react";

const API_BASE_URL = "http://103.219.3.169:2223";

const INITIAL_PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 10;

interface MaterialRequest {
  name: string;
  material_request_type?: string;
  title?: string;
  transaction_date?: string;
  modified?: string;
  custom_lis_name?: string;
  custom_stage?: string;
}

type SortDirection = "asc" | "desc";
interface SortConfig {
  key: keyof MaterialRequest;
  direction: SortDirection;
}

const SORT_OPTIONS: { label: string; key: keyof MaterialRequest }[] = [
  { label: "Last Updated On", key: "modified" },
  { label: "ID", key: "name" },
  { label: "LIS Name", key: "custom_lis_name" },
  { label: "Stage", key: "custom_stage" },
  { label: "Request Type", key: "material_request_type" },
  { label: "Date", key: "transaction_date" },
];

type ViewMode = "grid" | "list";

export default function MaterialRequestPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Material Request";

  const [requests, setRequests] = React.useState<MaterialRequest[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  const [loading, setLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [totalCount, setTotalCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  // 🟢 Removed searchTerm and debouncedSearch state

  const { control, watch } = useForm({
    defaultValues: {
      custom_lis_name: "",
      custom_stage: "",
    },
  });

  const selectedLis = watch("custom_lis_name");
  const selectedStage = watch("custom_stage");

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
    isAllSelected
  } = useSelection(requests, "name");

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

  const fetchMaterialRequests = React.useCallback(
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
            "material_request_type",
            "title",
            "transaction_date",
            "modified",
            "custom_lis_name",
            "custom_stage"
          ]),
          limit_start: start,
          limit_page_length: limit,
          order_by: `${sortConfig.key} ${sortConfig.direction}`,
        };

        const filters: any[] = [];

        if (selectedLis) {
          filters.push(["Material Request", "custom_lis_name", "=", selectedLis]);
        }
        if (selectedStage) {
          filters.push(["Material Request", "custom_stage", "=", selectedStage]);
        }

        if (filters.length > 0) {
          params.filters = JSON.stringify(filters);
        }

        // 🟢 Removed or_filters logic related to search

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
                filters: filters.length > 0 ? JSON.stringify(filters) : undefined
              },
              headers: commonHeaders,
            })
            : Promise.resolve(null),
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: MaterialRequest[] = raw.map((r: any) => ({
          name: r.name,
          material_request_type: r.material_request_type,
          title: r.title,
          transaction_date: r.transaction_date,
          modified: r.modified,
          custom_lis_name: r.custom_lis_name,
          custom_stage: r.custom_stage,
        }));

        if (isReset) {
          setRequests(mapped);
          if (countResp) setTotalCount(countResp.data.message);
        } else {
          setRequests((prev) => [...prev, ...mapped]);
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
    [doctypeName, apiKey, apiSecret, isAuthenticated, isInitialized, sortConfig, selectedLis, selectedStage]
  );

  React.useEffect(() => {
    fetchMaterialRequests(0, true);
  }, [fetchMaterialRequests]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchMaterialRequests(requests.length, false);
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
      fetchMaterialRequests(0, true);
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

  const requestSort = (key: keyof MaterialRequest) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.key === sortConfig.key)?.label || "Sort By";

  const getFieldsForRequest = (req: MaterialRequest): RecordCardField[] => {
    const fields: RecordCardField[] = [];
    if (req.custom_lis_name) fields.push({ label: "LIS", value: req.custom_lis_name });
    if (req.custom_stage) fields.push({ label: "Stage", value: req.custom_stage });
    if (req.transaction_date) fields.push({ label: "Date", value: req.transaction_date });
    return fields;
  };

  const handleCardClick = (id: string) => {
    router.push(`/operations/doctype/spare-indent/${encodeURIComponent(id)}`);
  };

  const renderListView = () => (
    <div className="stock-table-container thin-scroll-x" style={{ overflowX: "auto" }}>
      <table className="stock-table" style={{ minWidth: "900px", whiteSpace: "nowrap" }}>
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
            <th style={{ cursor: "pointer", minWidth: 140 }} onClick={() => requestSort("name")}>ID</th>
            <th style={{ cursor: "pointer", minWidth: 180 }} onClick={() => requestSort("custom_lis_name")}>LIS Name</th>
            <th style={{ cursor: "pointer", minWidth: 160 }} onClick={() => requestSort("custom_stage")}>Stage</th>
            <th style={{ cursor: "pointer", minWidth: 160 }} onClick={() => requestSort("material_request_type")}>Type</th>
            <th style={{ cursor: "pointer", minWidth: 140 }} onClick={() => requestSort("transaction_date")}>Date</th>
            
            <th className="text-right pr-4" style={{ width: "140px" }}>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                  <><span>{requests.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.length ? (
            requests.map((req) => {
              const isSelected = selectedIds.has(req.name);
              return (
                <tr
                  key={req.name}
                  onClick={() => handleCardClick(req.name)}
                  style={{
                    cursor: "pointer",
                    backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined
                  }}
                >
                  <td
                    style={{ textAlign: "center" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(req.name)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                  </td>
                  <td style={{ minWidth: 140 }}>{req.name}</td>
                  <td style={{ minWidth: 180 }}>{req.custom_lis_name || "—"}</td>
                  <td style={{ minWidth: 160 }}>{req.custom_stage || "—"}</td>
                  <td style={{ minWidth: 160 }}>{req.material_request_type || "—"}</td>
                  <td style={{ minWidth: 140 }}>{req.transaction_date || "—"}</td>
                  
                  <td className="text-right pr-4">
                    <TimeAgo date={req.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>
                No Spare Indent found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid">
      {requests.length ? (
        requests.map((req) => (
          <RecordCard
            key={req.name}
            title={req.name}
            subtitle={req.title || "No title"}
            fields={getFieldsForRequest(req)}
            onClick={() => handleCardClick(req.name)}
          />
        ))
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>No Spare Indent found.</p>
      )}
    </div>
  );

  if (loading && requests.length === 0)
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        Loading Spare Indents...
      </div>
    );

  if (error && requests.length === 0)
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        {error}
      </div>
    );

  return (
    <div className="module active">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Spare Indent</h2>
          <p>List of Spare Indents with type, title and date</p>
        </div>

        {selectedIds.size > 0 ? (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={clearSelection}
            onDelete={handleBulkDelete}
            isDeleting={isDeleting}
          />
        ) : (
          <Link href="/operations/doctype/spare-indent/new" passHref>
            <button className="btn btn--primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Spare Indent
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
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1" }}>
          
          {/* 🟢 Removed Search Input Code Block here */}

          <div style={{ minWidth: "200px" }}>
            <Controller
              control={control}
              name="custom_lis_name"
              render={({ field: { value } }) => (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <LinkField
                    control={control}
                    field={{
                      name: "custom_lis_name",
                      label: "",
                      type: "Link",
                      linkTarget: "Lift Irrigation Scheme",
                      placeholder: "Filter by LIS",
                      defaultValue: value
                    }}
                    error={null}
                    className="[&>label]:hidden"
                  />
                </div>
              )}
            />
          </div>

          <div style={{ minWidth: "200px" }}>
            <Controller
              control={control}
              name="custom_stage"
              render={({ field: { value } }) => (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <LinkField
                    control={control}
                    field={{
                      name: "custom_stage",
                      label: "",
                      type: "Link",
                      linkTarget: "Stage No",
                      placeholder: "Filter by Stage",
                      defaultValue: value,
                      filterMapping: [{ sourceField: "custom_lis_name", targetField: "lis_name" }]
                    }}
                    error={null}
                    className="[&>label]:hidden"
                    filters={selectedLis ? { lis_name: selectedLis } : {}}
                  />
                </div>
              )}
            />
          </div>
        </div>

        {/* Sort & View Switcher */}
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
        {hasMore && requests.length > 0 && (
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