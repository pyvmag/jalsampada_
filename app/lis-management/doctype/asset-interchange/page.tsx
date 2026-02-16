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
import { Plus, List, LayoutGrid, Loader2 } from "lucide-react";
import { TimeAgo } from "@/components/TimeAgo";
import { useForm, Controller } from "react-hook-form";
import { LinkField } from "@/components/LinkField";

const API_BASE_URL = "http://103.219.1.138:4412";

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
interface AssetInterchange {
  name: string;
  docstatus?: string;
  lis_name?: string;
  posting_date?: string;
  stage?: string;
  select_asset?: string;
  modified?: string;
}

type ViewMode = "grid" | "list";

export default function AssetInterchangeListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Asset Interchange";

  const [records, setRecords] = React.useState<AssetInterchange[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");

  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // 🟢 NEW: Total count of records

  const [error, setError] = React.useState<string | null>(null);

  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const title = "Asset Interchange";

  /* ── Search ─────────────────────────────────── */
  /* ── Filter Form ────────────────────────────── */
  const { control, watch } = useForm({
    defaultValues: {
      lis_name: "",
      stage: "",
    },
  });

  const selectedLis = watch("lis_name");
  const selectedStage = watch("stage");

  /* ── Search & Filter ────────────────────────── */
  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        !debouncedSearch ||
        r.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesLis = !selectedLis || r.lis_name === selectedLis;
      const matchesStage = !selectedStage || r.stage === selectedStage;
      return matchesSearch && matchesLis && matchesStage;
    });
  }, [records, debouncedSearch, selectedLis, selectedStage]);

  /* ── Selection ───────────────────────────────── */
  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected,
  } = useSelection(filteredRecords, "name");

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

        const limit = isReset ? 20 : 10;

        const commonHeaders = { Authorization: `token ${apiKey}:${apiSecret}` };

        // Parallel requests for Data and Total Count
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${doctypeName}`, {
            params: {
              fields: JSON.stringify([
                "name",
                "docstatus",
                "lis_name",
                "posting_date",
                "stage",
                "select_asset",
                "modified"
              ]),
              limit_start: start,
              limit_page_length: limit,
              order_by: "creation desc",
            },
            headers: commonHeaders,
            withCredentials: true,
          }),
          // Only fetch count during initial load or filter change
          isReset ? axios.get(`${API_BASE_URL}/api/method/frappe.client.get_count`, {
            params: { doctype: doctypeName },
            headers: commonHeaders,
          }) : Promise.resolve(null)
        ]);

        const raw = dataResp.data?.data ?? [];

        // ✅ STATUS LOGIC ADDED HERE
        const mapped: AssetInterchange[] = raw.map((r: any) => {
          let statusText = "";
          if (r.docstatus === 0) statusText = "Draft";
          else if (r.docstatus === 1) statusText = "Submitted";
          else if (r.docstatus === 2) statusText = "Cancelled";

          return {
            name: r.name,
            docstatus: statusText,
            lis_name: r.lis_name ?? "",
            posting_date: r.posting_date ?? "",
            stage: r.stage ?? "",
            select_asset: r.select_asset ?? "",
            modified: r.modified,
          };
        });

        if (isReset) {
          setRecords(mapped);
          if (countResp) setTotalCount(countResp.data.message);
        } else {
          setRecords((prev) => [...prev, ...mapped]);
        }

        setHasMore(mapped.length === limit);

      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(
          err.response?.status === 403
            ? "Unauthorized – check API key/secret"
            : `Failed to fetch ${doctypeName}`
        );
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    }, [doctypeName, apiKey, apiSecret, isAuthenticated, isInitialized]);

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

  const handleCardClick = (id: string) => {
    router.push(
      `/lis-management/doctype/asset-interchange/${encodeURIComponent(id)}`
    );
  };

  const getFieldsForRecord = (
    record: AssetInterchange
  ): RecordCardField[] => [
      { label: "Status", value: record.docstatus || "-" },
      { label: "LIS Name", value: record.lis_name || "-" },
      { label: "Posting Date", value: record.posting_date || "-" },
      { label: "Stage", value: record.stage || "-" },
      {
        label: "Which Asset to Interchange",
        value: record.select_asset || "-",
      },
    ];

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
            <th>IDs</th>
            <th>Status</th>
            <th>LIS Name</th>
            <th>Posting Date</th>
            <th>Stage</th>
            <th>Which Asset to Interchange</th>
            <th className="text-right pr-4" style={{ width: "120px" }}>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                  <><span>{records.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredRecords.map((r) => {
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
                <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelectOne(r.name)}
                  />
                </td>
                <td>{r.name}</td>
                <td>{r.docstatus}</td>
                <td>{r.lis_name}</td>
                <td>{r.posting_date}</td>
                <td>{r.stage}</td>
                <td>{r.select_asset}</td>
                <td className="text-right pr-4"><TimeAgo date={r.modified} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid">
      {filteredRecords.map((r) => (
        <RecordCard
          key={r.name}
          title={r.name}
          fields={getFieldsForRecord(r)}
          onClick={() => handleCardClick(r.name)}
        />
      ))}
    </div>
  );

  if (loading) return <p style={{ padding: "2rem" }}>Loading Asset Interchange...</p>;
  if (error) return <p style={{ padding: "2rem", color: "red" }}>{error}</p>;

  return (
    <div className="module active">
      <div className="module-header">
        <div>
          <h2>Asset Interchange</h2>
          <p>Manage Asset Interchange Records</p>
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
              router.push("/lis-management/doctype/asset-interchange/new")
            }
          >
            <Plus className="w-4 h-4" /> Add Asset Interchange
          </button>
        )}
      </div>

      <div className="search-filter-section" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1" }}>
          <div style={{ minWidth: "200px" }}>
            <input
              type="text"
              placeholder={`Search ${title}...`}
              className="form-control w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* LIS Filter */}
          <div style={{ minWidth: "200px" }}>
            <Controller
              control={control}
              name="lis_name"
              render={({ field: { value } }) => (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <LinkField
                    control={control}
                    field={{
                      name: "lis_name",
                      label: "",
                      type: "Link",
                      linkTarget: "Lift Irrigation Scheme",
                      placeholder: "Select LIS",
                      required: false,
                      defaultValue: value,
                    }}
                    error={null}
                    className="[&>label]:hidden vishal"
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
                      placeholder: "Select Stage",
                      required: false,
                      defaultValue: value,
                    }}
                    error={null}
                    filters={selectedLis ? { lis_name: selectedLis } : {}}
                    className="[&>label]:hidden vishal"
                  />
                </div>
              )}
            />
          </div>
        </div>

        <div className="view-switcher" style={{ marginLeft: "auto" }}>
          <button
            className="btn btn--outline btn--sm flex items-center justify-center"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
          >
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="view-container">
        {view === "grid" ? renderGridView() : renderListView()}
        {hasMore && records.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button onClick={handleLoadMore} disabled={isLoadingMore} className="btn btn--secondary flex items-center gap-2 px-6 py-2" style={{ minWidth: "140px" }}>
              {isLoadingMore ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</> : "Load More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}