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

const API_BASE_URL = "http://103.219.3.169:2223";

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
interface ParameterChecklist {
  name: string;
  lis_name?: string;
  stage?: string;
  monitoring_type?: string;
  asset_category?: string;
  creation?: string;
  modified?: string;
}

interface LisOption {
  name: string;
}

interface StageOption {
  name: string;
}

interface AssetCategoryOption {
  name: string;
}

type ViewMode = "grid" | "list";

export default function MaintenanceChecklistListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Maintenance Checklist";

  const [records, setRecords] = React.useState<ParameterChecklist[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  
  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // 🟢 Total count of records
  const [error, setError] = React.useState<string | null>(null);

  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Form for filters
  const { control, watch } = useForm({
    defaultValues: {
      lis_name: "",
      stage: "",
      asset_category: ""
    }
  });

  const selectedLis = watch("lis_name");
  const selectedStage = watch("stage");
  const selectedAssetCategory = watch("asset_category");

  const [lisOptions, setLisOptions] = React.useState<LisOption[]>([]);
  const [stageOptions, setStageOptions] = React.useState<StageOption[]>([]);
  const [assetCategoryOptions, setAssetCategoryOptions] = React.useState<AssetCategoryOption[]>([]);

  const title = "Maintenance Checklist";

  // ── Load Filter Options ───────────────────────────────
  React.useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;

      try {
        const headers = { Authorization: `token ${apiKey}:${apiSecret}` };
        
        const [lisResp, stageResp, assetCategoryResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/Lift Irrigation Scheme`, {
            params: { fields: JSON.stringify(["name"]), limit_page_length: "100", order_by: "name asc" },
            headers
          }),
          axios.get(`${API_BASE_URL}/api/resource/Stage No`, {
            params: { fields: JSON.stringify(["name"]), limit_page_length: "100", order_by: "name asc" },
            headers
          }),
          axios.get(`${API_BASE_URL}/api/resource/Asset Category`, {
            params: { fields: JSON.stringify(["name"]), limit_page_length: "100", order_by: "name asc" },
            headers
          })
        ]);

        setLisOptions([{ name: "" }, ...(lisResp.data?.data ?? [])]);
        setStageOptions([{ name: "" }, ...(stageResp.data?.data ?? [])]);
        setAssetCategoryOptions([{ name: "" }, ...(assetCategoryResp.data?.data ?? [])]);
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    };

    fetchFilterOptions();
  }, [isInitialized, isAuthenticated, apiKey, apiSecret]);

  // ── Filter Stage Options based on LIS ───────────────────────────────
  const filteredStageOptions = React.useMemo(() => {
    if (!selectedLis) {
      return stageOptions;
    }
    
    // If we had a way to filter stages by LIS, we would do it here
    // For now, return all stages since we don't have the relationship data
    return stageOptions;
  }, [selectedLis, stageOptions]);

  /* ── Search & Filter ─────────────────────────────── */
  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      const matchesSearch = !debouncedSearch || 
        r.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesLisName = !selectedLis || r.lis_name === selectedLis;
      const matchesStage = !selectedStage || r.stage === selectedStage;
      const matchesAssetCategory = !selectedAssetCategory || r.asset_category === selectedAssetCategory;
      
      return matchesSearch && matchesLisName && matchesStage && matchesAssetCategory;
    });
  }, [records, debouncedSearch, selectedLis, selectedStage, selectedAssetCategory]);

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
        // 🟢 Removed server-side filters - now using client-side filtering only

        const commonHeaders = {
          Authorization: `token ${apiKey}:${apiSecret}`,
        };

        // Parallel requests for Data and Total Count
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${doctypeName}`, {
            params: {
              fields: JSON.stringify([
                "name",
                "lis_name",
                "stage",
                "monitoring_type",
                "asset_category",
                "creation",
                "modified",
              ]),
              limit_start: start,
              limit_page_length: limit,
              order_by: "creation desc"
            },
            headers: commonHeaders,
            withCredentials: true,
          }),
          // Only fetch count during initial load
          isReset ? axios.get(`${API_BASE_URL}/api/method/frappe.client.get_count`, {
            params: { 
              doctype: doctypeName
            },
            headers: commonHeaders,
          }) : Promise.resolve(null)
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: ParameterChecklist[] = raw.map((r: any) => ({
          name: r.name,
          lis_name: r.lis_name ?? "",
          stage: r.stage ?? "",
          monitoring_type: r.monitoring_type ?? "",
          asset_category: r.asset_category ?? "",
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
      fetchRecords();
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
      `/maintenance/doctype/maintenance-checklist/${encodeURIComponent(id)}`
    );
  };

  const getFieldsForRecord = (
    record: ParameterChecklist
  ): RecordCardField[] => [
    { label: "LIS Name", value: record.lis_name || "-" },
    { label: "Stage", value: record.stage || "-" },
    { label: "Asset Category", value: record.asset_category || "-" },
    { label: "Monitoring Type", value: record.monitoring_type || "-" },
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
            <th>LIS Name</th>
            <th>Stage</th>
            <th>Asset Category</th>
            <th>Monitoring Type</th>
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
                  <td>{r.lis_name}</td>
                  <td>{r.stage}</td>
                  <td>{r.asset_category}</td>
                  <td>{r.monitoring_type}</td>
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

  if (loading)
    return <p style={{ padding: "2rem" }}>Loading Maintenance Checklist...</p>;
  if (error)
    return <p style={{ padding: "2rem", color: "red" }}>{error}</p>;

  return (
    <div className="module active">
      <div className="module-header">
        <div>
          <h2>Maintenance Checklist</h2>
          <p>Manage Maintenance Checklist</p>
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
              router.push("/maintenance/doctype/maintenance-checklist/new")
            }
          >
            <Plus className="w-4 h-4" /> Add Maintenance Checklist
          </button>
        )}
      </div>

      <div
        className="search-filter-section"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder={`Search ${title}...`}
            className="form-control"
            style={{ width: 240 }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <div style={{ minWidth: "200px" }}>
            <Controller control={control} name="lis_name" render={({ field: { value } }) => (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <LinkField control={control} field={{ name: "lis_name", label: "", type: "Link", linkTarget: "Lift Irrigation Scheme", placeholder: "Select LIS", required: false, defaultValue: value }} error={null} className="[&>label]:hidden vishal" />
              </div>
            )} />
          </div>

          <div style={{ minWidth: "200px" }}>
            <Controller control={control} name="stage" render={({ field: { value } }) => (
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
                    defaultValue: value 
                  }} 
                  error={null} 
                  className="[&>label]:hidden vishal" 
                  filters={selectedLis ? { lis_name: selectedLis } : {}}
                />
              </div>
            )} />
          </div>

          <div style={{ minWidth: "200px" }}>
            <Controller control={control} name="asset_category" render={({ field: { value } }) => (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <LinkField control={control} field={{ name: "asset_category", label: "", type: "Link", linkTarget: "Asset Category", placeholder: "Select Category", required: false, defaultValue: value }} error={null} className="[&>label]:hidden vishal" />
              </div>
            )} />
          </div>
        </div>

        <div className="view-switcher">
          <button
            className="btn btn--outline btn--sm flex items-center justify-center"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            aria-label="Toggle view"
            title={view === "grid" ? "List view" : "Grid view"}
          >
            {view === "grid" ? (
              <List className="w-4 h-4" />
            ) : (
              <LayoutGrid className="w-4 h-4" />
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
              {isLoadingMore ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</> : "Load More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



