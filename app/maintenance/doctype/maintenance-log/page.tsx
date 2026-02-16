"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";

import { useSelection } from "@/hooks/useSelection";
import { LinkField } from "@/components/LinkField"; // Added
import { Controller, useForm } from "react-hook-form"; // Added
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay";
import { TimeAgo } from "@/components/TimeAgo";
import { formatTimeAgo } from "@/lib/utils";
import { Plus, List, LayoutGrid, Loader2 } from "lucide-react";

const API_BASE_URL = "http://103.219.1.138:4412";

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
interface MaintenanceLog {
  name: string;
  maintenance_status?: string;
  // next_due_date?: string;   // ⛔ BACKEND DOES NOT ALLOW YET
  completion_date?: string;
  creation?: string;
  modified?: string;
  lis?: string;
  stage?: string;
  asset_name?: string;
}

type ViewMode = "grid" | "list";

export default function MaintenanceLogListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Asset Maintenance Log";

  const [records, setRecords] = React.useState<MaintenanceLog[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");

  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // 🟢 Total count of records
  const [error, setError] = React.useState<string | null>(null);

  /* ── Search ─────────────────────────────────── */
  // 🟢 Filter states
  const { control, watch } = useForm({
    defaultValues: {
      lis: "",
      stage: "",
      asset_name: "",
    },
  });

  const selectedLis = watch("lis");
  const selectedStage = watch("stage");
  const selectedAsset = watch("asset_name");

  const title = "Maintenance Log";

  const filteredRecords = React.useMemo(() => {
    let filtered = records;

    // Client-side filtering for LIS and Stage
    if (selectedLis) {
      filtered = filtered.filter(r => r.lis === selectedLis);
    }

    if (selectedStage) {
      filtered = filtered.filter(r => r.stage === selectedStage);
    }

    if (selectedAsset) {
      filtered = filtered.filter(r => r.asset_name === selectedAsset);
    }

    return filtered;
  }, [records, selectedLis, selectedStage, selectedAsset]);

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

        const commonHeaders = {
          Authorization: `token ${apiKey}:${apiSecret}`,
        };

        // Parallel requests for Data and Total Count
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${doctypeName}`, {
            params: {
              fields: JSON.stringify([
                "name",
                "maintenance_status",
                "completion_date",
                "lis",
                "stage",
                "asset_name",
                "creation",
                "modified",
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
        const mapped: MaintenanceLog[] = raw.map((r: any) => ({
          name: r.name,
          maintenance_status: r.maintenance_status ?? "",
          completion_date: r.completion_date ?? "",
          lis: r.lis ?? "",
          stage: r.stage ?? "",
          asset_name: r.asset_name ?? "",
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
              : `Failed to fetch ${doctypeName}`
          );
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [doctypeName, apiKey, apiSecret, isAuthenticated, isInitialized]
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
    router.push(`/maintenance/doctype/maintenance-log/${encodeURIComponent(id)}`);
  };

  const getFieldsForRecord = (record: MaintenanceLog): RecordCardField[] => [
    { label: "Status", value: record.maintenance_status || "-" },
    { label: "Completion Date", value: record.completion_date || "-" },
    { label: "LIS", value: record.lis || "-" },
    { label: "Stage", value: record.stage || "-" },
    { label: "Asset", value: record.asset_name || "-" },
    { label: "Created", value: formatTimeAgo(record.creation) },
  ];

  /* ── List View ───────────────────────────────── */
  const renderListView = () => (
    <div className="stock-table-container">
      <table className="stock-table">
        <thead>
          <tr>
            <th style={{ width: 40, textAlign: "center" }}>
              <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} />
            </th>
            <th>ID</th>
            <th>Status</th>
            <th>Completion Date</th>
            <th>LIS</th>
            <th>Stage</th>
            <th>Asset</th>
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
                    <input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(r.name)} />
                  </td>
                  <td>{r.name}</td>
                  <td>{r.maintenance_status}</td>
                  <td>{r.completion_date}</td>
                  <td>{r.lis}</td>
                  <td>{r.stage}</td>
                  <td>{r.asset_name}</td>
                  <td className="text-right pr-4">
                    <TimeAgo date={r.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={8} style={{ textAlign: "center", padding: 32 }}>
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
            fields={getFieldsForRecord(r)}
            onClick={() => handleCardClick(r.name)}
          />
        ))
      ) : (
        <p>No records found</p>
      )}
    </div>
  );

  if (loading && records.length === 0) return <p style={{ padding: "2rem" }}>Loading Maintenance Log...</p>;
  if (error && records.length === 0) return <p style={{ padding: "2rem", color: "red" }}>{error}</p>;

  return (
    <div className="module active">
      <div className="module-header">
        <div>
          <h2>Maintenance Log</h2>
          <p>Manage Maintenance Log</p>
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
            onClick={() => router.push("/maintenance/doctype/maintenance-log/new")}
          >
            <Plus className="w-4 h-4" /> Add Maintenance Log
          </button>
        )}
      </div>

      <div className="search-filter-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", gap: "8px" }}>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1" }}>
          {/* LIS Filter */}
          <div style={{ minWidth: "200px" }}>
            <Controller
              control={control}
              name="lis"
              render={({ field: { value } }) => (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  {/* Using import { LinkField } from "@/components/LinkField" */}
                  <LinkField
                    control={control}
                    field={{
                      name: "lis",
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

          {/* Stage Filter */}
          <div style={{ minWidth: "200px" }}>
            <Controller
              control={control}
              name="stage"
              render={({ field: { value } }) => (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <LinkField
                    control={control}
                    field={{
                      name: "stage",
                      label: "",
                      type: "Link",
                      linkTarget: "Stage No",
                      placeholder: "Filter by Stage",
                      defaultValue: value
                    }}
                    error={null}
                    className="[&>label]:hidden"
                    // Pass filters prop if needed, similar to Maintenance Schedule
                    filters={selectedLis ? { lis_name: selectedLis } : {}}
                  />
                </div>
              )}
            />
          </div>

          {/* Asset Filter */}
          <div style={{ minWidth: "200px" }}>
            <Controller
              control={control}
              name="asset_name"
              render={({ field: { value } }) => (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <LinkField
                    control={control}
                    field={{
                      name: "asset_name",
                      label: "",
                      type: "Link",
                      linkTarget: "Asset",
                      placeholder: "Filter by Asset",
                      defaultValue: value
                    }}
                    filters={{
                      ...(selectedLis ? { custom_lis_name: selectedLis } : {}),
                      ...(selectedStage ? { custom_stage_no: selectedStage } : {})
                    }}
                    error={null}
                    className="[&>label]:hidden"
                  />
                </div>
              )}
            />
          </div>


        </div>

        <button
          className="btn btn--outline btn--sm flex items-center justify-center"
          onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
        >
          {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
        </button>
      </div>

      <div className="view-container" style={{ marginTop: "0.5rem", paddingBottom: "2rem" }}>
        {view === "grid" ? renderGridView() : renderListView()}
        {hasMore && filteredRecords.length > 0 && (
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