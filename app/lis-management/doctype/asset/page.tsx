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
import { getApiUrl } from "@/config/app.config";

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
} from "lucide-react";

// 🟢 Production-ready configuration
const API_BASE_URL = getApiUrl();

// 🟢 CONFIG: Settings for Frappe-like pagination
const INITIAL_PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 10;

// ── Debounce Hook ────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// ── Types ────────────────────────────────────────────────────────
interface Asset {
  name: string;
  location: string;
  custom_lis_name?: string;
  custom_lis_phase?: string;
  custom_stage_no?: string;
  asset_category?: string;
  status?: string;
  modified?: string;
}

interface AssetCategoryOption {
  name: string;
}

interface StageOption {
  name: string;
}

interface LisPhaseOption {
  name: string;
}

interface LisOption {
  name: string;
}

type SortDirection = "asc" | "desc";
interface SortConfig {
  key: keyof Asset;
  direction: SortDirection;
}

const SORT_OPTIONS: { label: string; key: keyof Asset }[] = [
  { label: "Last Updated On", key: "modified" },
  { label: "ID", key: "name" },
  { label: "Status", key: "status" },
  { label: "Asset Category", key: "asset_category" },
  { label: "Location", key: "location" },
  { label: "LIS", key: "custom_lis_name" },
];

type ViewMode = "grid" | "list";

// ── Main Component ───────────────────────────────────────────────
export default function DoctypePage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Asset";

  // Data States
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");

  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // 🟢 NEW: Total count of records
  const [error, setError] = React.useState<string | null>(null);

  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: "modified",
    direction: "desc",
  });

  const [categories, setCategories] = React.useState<AssetCategoryOption[]>([]);
  const [stages, setStages] = React.useState<StageOption[]>([]);
  const [lisPhases, setLisPhases] = React.useState<LisPhaseOption[]>([]);
  const [lisOptions, setLisOptions] = React.useState<LisOption[]>([]);
  const [isSortMenuOpen, setIsSortMenuOpen] = React.useState(false);
  const sortMenuRef = React.useRef<HTMLDivElement>(null);

  // 🟢 1. Initialize Selection Hook
  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected
  } = useSelection(assets, "name");

  const [isDeleting, setIsDeleting] = React.useState(false);

  // Form for filters
  const { control, watch } = useForm({
    defaultValues: {
      asset_category: "",
      custom_stage_no: "",
      
      custom_lis_name: ""
    }
  });

  const selectedCategory = watch("asset_category");
  const selectedStage = watch("custom_stage_no");
 
  const selectedLis = watch("custom_lis_name");

  // Close sort menu on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Load Filter Options ────────────────────────────────────────
  React.useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;

      try {
        const headers = { Authorization: `token ${apiKey}:${apiSecret}` };
        
        const [categoryResp, stageResp, lisPhaseResp, lisResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/Asset Category`, {
            params: { fields: JSON.stringify(["name"]), limit_page_length: "100", order_by: "name asc" },
            headers
          }),
          axios.get(`${API_BASE_URL}/api/resource/Stage No`, {
            params: { fields: JSON.stringify(["name"]), limit_page_length: "100", order_by: "name asc" },
            headers
          }),
          axios.get(`${API_BASE_URL}/api/resource/LIS Phases`, {
            params: { fields: JSON.stringify(["name"]), limit_page_length: "100", order_by: "name asc" },
            headers
          }),
          axios.get(`${API_BASE_URL}/api/resource/Lift Irrigation Scheme`, {
            params: { fields: JSON.stringify(["name"]), limit_page_length: "100", order_by: "name asc" },
            headers
          })
        ]);

        setCategories([{ name: "" }, ...(categoryResp.data?.data ?? [])]);
        setStages([{ name: "" }, ...(stageResp.data?.data ?? [])]);
        setLisPhases([{ name: "" }, ...(lisPhaseResp.data?.data ?? [])]);
        setLisOptions([{ name: "" }, ...(lisResp.data?.data ?? [])]);
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    };

    fetchFilterOptions();
  }, [isInitialized, isAuthenticated, apiKey, apiSecret]);

  // ── 🟢 Fetch Logic (Refactored for Pagination and Total Count) ───────────────────
  const fetchData = React.useCallback(
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
        if (debouncedSearch) filters.push(["Asset", "name", "like", `%${debouncedSearch}%`]);
        if (selectedCategory) filters.push(["Asset", "asset_category", "=", selectedCategory]);
        if (selectedLis) filters.push(["Asset", "custom_lis_name", "=", selectedLis]);
        if (selectedStage) filters.push(["Asset", "custom_stage_no", "=", selectedStage]);
        

        const commonHeaders = { Authorization: `token ${apiKey}:${apiSecret}` };

        // Parallel requests for Data and Total Count
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/Asset`, {
            params: {
              fields: JSON.stringify(["name", "location", "custom_lis_name", "custom_lis_phase", "custom_stage_no", "asset_category", "status", "modified"]),
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
            params: { doctype: "Asset", filters: filters.length > 0 ? JSON.stringify(filters) : undefined },
            headers: commonHeaders,
          }) : Promise.resolve(null)
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: Asset[] = raw.map((r: any) => ({
          name: r.name,
          location: r.location ?? "—",
          custom_lis_name: r.custom_lis_name,
          custom_lis_phase: r.custom_lis_phase,
          custom_stage_no: r.custom_stage_no,
          asset_category: r.asset_category,
          status: r.status,
          modified: r.modified,
        }));

        if (isReset) {
          setAssets(mapped);
          if (countResp) setTotalCount(countResp.data.message);
        } else {
          setAssets((prev) => [...prev, ...mapped]);
        }

        setHasMore(mapped.length === limit);

      } catch (err: any) {
        console.error("API error:", err);
        if (isReset) setError(err.response?.status === 403 ? "Unauthorized" : "Failed to fetch assets");
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [apiKey, apiSecret, isAuthenticated, isInitialized, debouncedSearch, selectedCategory, selectedLis, selectedStage,  sortConfig]
  );

  React.useEffect(() => {
    fetchData(0, true);
  }, [fetchData]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchData(assets.length, false);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Are you sure you want to permanently delete ${count} records?`)) return;

    setIsDeleting(true);
    try {
      const response = await bulkDeleteRPC(doctypeName, Array.from(selectedIds), API_BASE_URL, apiKey!, apiSecret!);

      if (response._server_messages) {
        const serverMessages = JSON.parse(response._server_messages);
        const errorMessages = serverMessages.map((msgStr: string) => JSON.parse(msgStr).message);

        if (errorMessages.length > 0) {
          toast.error("Failed to delete records", { description: <FrappeErrorDisplay messages={errorMessages} />, duration: Infinity });
          return;
        }
      }

      toast.success(`Successfully deleted ${count} records.`);
      clearSelection();
      fetchData(0, true);
    } catch (err: any) {
      const messages = getApiMessages(null, err, "Records deleted successfully", "Failed to delete records");
      toast.error(messages.message, { description: messages.description, duration: Infinity });
    } finally {
      setIsDeleting(false);
    }
  };

  const currentSortLabel = SORT_OPTIONS.find((opt) => opt.key === sortConfig.key)?.label || "Sort By";

  const getFieldsForAsset = (a: Asset): RecordCardField[] => {
    const fields: RecordCardField[] = [];
    if (a.status) fields.push({ label: "Status", value: a.status });
    if (a.asset_category) fields.push({ label: "Category", value: a.asset_category });
    if (a.custom_lis_name) fields.push({ label: "LIS", value: a.custom_lis_name });
    if (a.custom_lis_phase) fields.push({ label: "LIS Phase", value: a.custom_lis_phase });
    if (a.custom_stage_no) fields.push({ label: "Stage", value: a.custom_stage_no });
    fields.push({ label: "Location", value: a.location });
    return fields;
  };

  const handleCardClick = (id: string) => {
    router.push(`/lis-management/doctype/asset/${encodeURIComponent(id)}`);
  };

  const renderListView = () => (
    <div className="stock-table-container">
      <table className="stock-table">
        <thead>
          <tr>
            <th style={{ width: "40px", textAlign: "center" }}>
              <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} style={{ cursor: "pointer", width: "16px", height: "16px" }} />
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => setSortConfig({ key: "name", direction: sortConfig.key === "name" && sortConfig.direction === "asc" ? "desc" : "asc" })}>ID</th>
            <th>Status</th>
            <th>Category</th>
            <th>LIS</th>
            <th>Stage</th>
            <th>Location</th>
            <th className="text-right pr-4" style={{ width: "120px" }}>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                  <><span>{assets.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {assets.length ? assets.map((a) => {
            const isSelected = selectedIds.has(a.name);
            return (
              <tr key={a.name} onClick={() => handleCardClick(a.name)} style={{ cursor: "pointer", backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined }}>
                <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(a.name)} style={{ cursor: "pointer", width: "16px", height: "16px" }} />
                </td>
                <td>{a.name}</td>
                <td>{a.status || "—"}</td>
                <td>{a.asset_category || "—"}</td>
                <td>{a.custom_lis_name || "—"}</td>
                <td>{a.custom_stage_no || "—"}</td>
                <td>{a.location}</td>
                <td className="text-right pr-4"><TimeAgo date={a.modified} /></td>
              </tr>
            );
          }) : (
            <tr><td colSpan={9} style={{ textAlign: "center", padding: "32px" }}>{!loading && "No records found."}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid">
      {assets.length ? assets.map((a) => (
        <RecordCard key={a.name} title={a.name} subtitle={a.location} fields={getFieldsForAsset(a)} onClick={() => handleCardClick(a.name)} />
      )) : !loading && <p style={{ color: "var(--color-text-secondary)" }}>No records found.</p>}
    </div>
  );

  if (loading && assets.length === 0) return <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>Loading assets...</div>;
  if (error && assets.length === 0) return <div className="module active" style={{ padding: "2rem" }}>{error}</div>;

  return (
    <div className="module active">
      <div className="module-header">
        <div><h2 className="mt-1">Asset</h2></div>
        {selectedIds.size > 0 ? (
          <BulkActionBar selectedCount={selectedIds.size} onClear={clearSelection} onDelete={handleBulkDelete} isDeleting={isDeleting} />
        ) : (
          <Link href="/lis-management/doctype/asset/new" passHref>
            <button className="btn btn--primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add Asset</button>
          </Link>
        )}
      </div>

      <div className="search-filter-section" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1" }}>
          <div style={{ minWidth: "200px" }}>
            <input type="text" placeholder="Search Asset ID..." className="form-control w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search Assets" />
          </div>
          <div style={{ minWidth: "200px" }}>
            <Controller control={control} name="custom_lis_name" render={({ field: { value } }) => (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <LinkField control={control} field={{ name: "custom_lis_name", label: "", type: "Link", linkTarget: "Lift Irrigation Scheme", placeholder: "Select LIS", required: false, defaultValue: value }} error={null} className="[&>label]:hidden vishal" />
              </div>
            )} />
          </div>
         
          <div style={{ minWidth: "200px" }}>
            <Controller control={control} name="custom_stage_no" render={({ field: { value } }) => (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <LinkField 
                  control={control} 
                  field={{ 
                    name: "custom_stage_no", 
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
                <LinkField control={control} field={{ name: "asset_category", label: "", type: "Link", linkTarget: "Asset Category", placeholder: "Select Category", required: false, defaultValue: value }} error={null} className="[&>label]:hidden vishal"  />
              </div>
            )} />
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginLeft: "auto" }}>
          <div className="relative" ref={sortMenuRef}>
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
              <button className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors" onClick={() => setSortConfig((prev) => ({ ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }))}>
                {sortConfig.direction === "asc" ? <ArrowDownWideNarrow className="w-4 h-4 text-gray-600 dark:text-gray-300" /> : <ArrowUpNarrowWide className="w-4 h-4 text-gray-600 dark:text-gray-300" />}
              </button>
              <div className="h-4 w-[1px] bg-gray-300 dark:bg-gray-600 mx-1"></div>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors" onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}>
                {currentSortLabel} <ChevronDown className="w-3 h-3 opacity-70" />
              </button>
            </div>
            {isSortMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                <div className="py-1">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sort By</div>
                  {SORT_OPTIONS.map((option) => (
                    <button key={option.key} className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${sortConfig.key === option.key ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20 font-medium" : "text-gray-700 dark:text-gray-200"}`} onClick={() => { setSortConfig((prev) => ({ ...prev, key: option.key })); setIsSortMenuOpen(false); }}>
                      {option.label} {sortConfig.key === option.key && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="btn btn--outline btn--sm flex items-center justify-center" onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}>
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="view-container" style={{ marginTop: "0.5rem", paddingBottom: "2rem" }}>
        {view === "grid" ? renderGridView() : renderListView()}
        {hasMore && assets.length > 0 && (
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