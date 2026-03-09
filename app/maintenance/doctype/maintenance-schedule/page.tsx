"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import { useForm, Controller } from "react-hook-form";
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

const API_BASE_URL = "http://103.219.1.138:4412";

const INITIAL_PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 10;

/* ── Types ────────────────────────────────────── */
interface MaintenanceSchedule {
  name: string;
  asset_name?: string;
  creation?: string;
  modified?: string;
  custom_lis?: string;
  custom_stage?: string;
  custom_tender_no?: string;
}

type ViewMode = "grid" | "list";

export default function MaintenanceScheduleListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Asset Maintenance";

  const [records, setRecords] = React.useState<MaintenanceSchedule[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");

  const [loading, setLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [totalCount, setTotalCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  // 🟢 1. Add asset_name to form default values
  const { control, watch } = useForm({
    defaultValues: {
      custom_lis: "",
      custom_stage: "",
      asset_name: "", // Added
    },
  });

  const selectedLis = watch("custom_lis");
  const selectedStage = watch("custom_stage");
  const selectedAsset = watch("asset_name"); // Added

  const title = "Work Schedule";

  /* ── Client-side Filtering ─────────────────────────────── */
  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      const matchesLis = !selectedLis || r.custom_lis === selectedLis;
      const matchesStage = !selectedStage || r.custom_stage === selectedStage;
      const matchesAsset = !selectedAsset || r.asset_name === selectedAsset;

      return matchesLis && matchesStage && matchesAsset;
    });
  }, [records, selectedLis, selectedStage, selectedAsset]);

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

        // 🟢 Removed server-side filters - now using client-side filtering only

        const commonHeaders = {
          Authorization: `token ${apiKey}:${apiSecret}`,
        };

        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${encodeURIComponent(doctypeName)}`, {
            params: {
              fields: JSON.stringify([
                "name",
                "asset_name",
                "creation",
                "modified",
                "custom_lis",
                "custom_stage"
              ]),
              limit_start: start,
              limit_page_length: limit,
              order_by: "creation desc"
            },
            headers: commonHeaders,
            withCredentials: true,
          }),
          isReset ? axios.get(`${API_BASE_URL}/api/method/frappe.client.get_count`, {
            params: {
              doctype: doctypeName
            },
            headers: commonHeaders,
          }) : Promise.resolve(null)
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: MaintenanceSchedule[] = raw.map((r: any) => ({
          name: r.name,
          asset_name: r.asset_name ?? "",
          creation: r.creation ?? "",
          modified: r.modified ?? "",
          custom_lis: r.custom_lis,
          custom_stage: r.custom_stage,
          custom_tender_no: r.custom_tender_no,
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
    // 🟢 Removed filter dependencies - now using client-side filtering only
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

  /* ── Bulk Delete ───────────────────────────────── */
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
    router.push(
      `/maintenance/doctype/maintenance-schedule/${encodeURIComponent(id)}`
    );
  };

  const getFieldsForRecord = (
    record: MaintenanceSchedule
  ): RecordCardField[] => [
      { label: "Asset Name", value: record.asset_name || "-" },
      { label: "Tender ID", value: record.custom_tender_no || "-" },
      { label: "LIS", value: record.custom_lis || "-" },
      { label: "Stage", value: record.custom_stage || "-" },
      { label: "Created", value: formatTimeAgo(record.creation) },
    ];

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
            <th>Tender ID</th>
            <th>Asset Name</th>
            <th>LIS Name</th>
            <th>Stage</th>
            <th className="text-right pr-4" style={{ width: "120px" }}>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {loading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <span>{filteredRecords.length}</span>
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
                  <td>{r.custom_tender_no || "—"}</td>
                  <td>{r.asset_name}</td>
                  <td>{r.custom_lis || "—"}</td>
                  <td>{r.custom_stage || "—"}</td>
                  <td className="text-right pr-4">
                    <TimeAgo date={r.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: 32 }}>
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

  if (loading && records.length === 0)
    return <p style={{ padding: "2rem" }}>Loading Work Schedule...</p>;
  if (error && records.length === 0)
    return <p style={{ padding: "2rem", color: "red" }}>{error}</p>;

  return (
    <div className="module active">
      <div className="module-header">
        <div>
          <h2>Work Schedule</h2>
          <p>Manage Work Schedule</p>
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
              router.push("/maintenance/doctype/maintenance-schedule/new")
            }
          >
            <Plus className="w-4 h-4" /> Add Work Schedule
          </button>
        )}
      </div>

      <div className="search-filter-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", gap: "8px" }}>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1" }}>
          <div style={{ minWidth: "200px" }}>
            <Controller
              control={control}
              name="custom_lis"
              render={({ field: { value } }) => (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <LinkField
                    control={control}
                    field={{
                      name: "custom_lis",
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
                      defaultValue: value
                    }}
                    error={null}
                    className="[&>label]:hidden"
                    filters={selectedLis ? { lis_name: selectedLis } : {}}
                  />
                </div>
              )}
            />
          </div>

          {/* 🟢 3. Asset Name Filter */}
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