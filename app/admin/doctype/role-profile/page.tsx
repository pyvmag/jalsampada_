"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  Search, Plus, List, LayoutGrid, ChevronDown,
  ArrowUpNarrowWide, ArrowDownWideNarrow, Check, Loader2
} from "lucide-react";
import { TimeAgo } from "@/components/TimeAgo";
import { formatTimeAgo } from "@/lib/utils";
import { useSelection } from "@/hooks/useSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

const INITIAL_PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 10;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

interface RoleProfile {
  name: string;
  role_profile: string;
  modified?: string;
  creation?: string;
}

type SortDirection = "asc" | "desc";
interface SortConfig { key: keyof RoleProfile; direction: SortDirection; }

const SORT_OPTIONS: { label: string; key: keyof RoleProfile }[] = [
  { label: "Last Updated On", key: "modified" },
  { label: "Role Profile", key: "role_profile" },
  { label: "Creation Date", key: "creation" },
];

type ViewMode = "grid" | "list";

export default function RoleProfileDoctypePage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Role Profile";

  const [profiles, setProfiles] = React.useState<RoleProfile[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  const [loading, setLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [totalCount, setTotalCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const [sortConfig, setSortConfig] = React.useState<SortConfig>({ key: "modified", direction: "desc" });
  const [isSortMenuOpen, setIsSortMenuOpen] = React.useState(false);
  const sortMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchProfiles = React.useCallback(
    async (start = 0, isReset = false) => {
      if (!isInitialized) return;
      if (!isAuthenticated || !apiKey || !apiSecret) {
        setLoading(false);
        return;
      }

      try {
        if (isReset) { setLoading(true); setError(null); }
        else { setIsLoadingMore(true); }

        const limit = isReset ? INITIAL_PAGE_SIZE : LOAD_MORE_SIZE;
        const params: any = {
          fields: JSON.stringify(["name", "role_profile", "modified", "creation"]),
          limit_start: start,
          limit_page_length: limit,
          order_by: `${sortConfig.key} ${sortConfig.direction}`,
        };

        if (debouncedSearch) {
          params.or_filters = JSON.stringify({
            name: ["like", `%${debouncedSearch}%`],
            role_profile: ["like", `%${debouncedSearch}%`]
          });
        }

        const commonHeaders = { Authorization: `token ${apiKey}:${apiSecret}` };

        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/${doctypeName}`, { params, headers: commonHeaders, withCredentials: true }),
          isReset ? axios.get(`http://103.219.3.169:2223/api/method/frappe.client.get_count`, {
            params: { doctype: doctypeName }, headers: commonHeaders,
          }).catch(() => ({ data: { message: 0 } })) : Promise.resolve({ data: { message: 0 } })
        ]);

        const mapped: RoleProfile[] = (dataResp.data?.data ?? []).map((r: any) => ({
          name: r.name, role_profile: r.role_profile, modified: r.modified, creation: r.creation,
        }));

        if (isReset) {
          setProfiles(mapped);
          if (countResp?.data) setTotalCount(countResp.data.message || 0);
        } else {
          setProfiles((prev) => [...prev, ...mapped]);
        }
        setHasMore(mapped.length === limit);
      } catch (err: any) {
        if (isReset) setError(err.response?.status === 403 ? "Unauthorized" : "Failed to fetch role profiles");
      } finally {
        setLoading(false); setIsLoadingMore(false);
      }
    },
    [apiKey, apiSecret, isAuthenticated, isInitialized, debouncedSearch, sortConfig]
  );

  React.useEffect(() => { fetchProfiles(0, true); }, [fetchProfiles]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) fetchProfiles(profiles.length, false);
  };

  const sortedProfiles = React.useMemo(() => {
    const sortable = [...profiles];
    sortable.sort((a, b) => {
      const aValue = String(a[sortConfig.key] || '');
      const bValue = String(b[sortConfig.key] || '');
      const compare = aValue.localeCompare(bValue);
      return sortConfig.direction === 'asc' ? compare : -compare;
    });
    return sortable;
  }, [profiles, sortConfig]);

  const requestSort = (key: keyof RoleProfile) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const { selectedIds, handleSelectOne, handleSelectAll, clearSelection, isAllSelected } = useSelection(profiles, "name");
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} role profiles permanently?`)) return;
    setIsDeleting(true);
    try {
      const response = await bulkDeleteRPC(doctypeName, Array.from(selectedIds), "http://103.219.3.169:2223", apiKey!, apiSecret!);
      if (response._server_messages) {
        const msgs = JSON.parse(response._server_messages).map((m: string) => JSON.parse(m).message);
        if (msgs.length) {
          toast.error("Delete failed", { description: <FrappeErrorDisplay messages={msgs} />, duration: Infinity });
          return;
        }
      }
      toast.success(`Deleted ${count} role profiles`);
      clearSelection();
      fetchProfiles(0, true);
    } catch (err: any) {
      const messages = getApiMessages(null, err, "Records deleted successfully", "Failed to delete records");
      toast.error(messages.message, { description: messages.description, duration: Infinity });
    } finally { setIsDeleting(false); }
  };

  const title = "Role Profile";
  const handleCardClick = (id: string) => router.push(`/admin/doctype/role-profile/${encodeURIComponent(id)}`);

  return (
    <div className="module active">
      <div className="module-header">
        <div>
          <h2>{title}s</h2>
          <p>Manage role templates to assign multiple roles to users easily</p>
        </div>
        {selectedIds.size > 0 ? (
          <BulkActionBar selectedCount={selectedIds.size} onClear={clearSelection} onDelete={handleBulkDelete} isDeleting={isDeleting} />
        ) : (
          <Link href="/admin/doctype/role-profile/new" passHref>
            <button className="btn btn--primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add {title}</button>
          </Link>
        )}
      </div>

      <div className="search-filter-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", gap: "8px" }}>
        <div className="relative" style={{ flexGrow: 1, maxWidth: '400px' }}>
          <input type="text" placeholder="Search profiles..." className="form-control w-full pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button className="btn btn--outline btn--sm flex items-center justify-center" onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}>
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="view-container" style={{ marginTop: "0.5rem", paddingBottom: "2rem" }}>
        {view === "grid" ? (
          <div className="equipment-grid">
            {profiles.length ? profiles.map(profile => (
              <RecordCard key={profile.name} title={profile.role_profile} subtitle={profile.name} fields={[]} onClick={() => handleCardClick(profile.name)} />
            )) : <p>No role profiles found.</p>}
          </div>
        ) : (
          <div className="stock-table-container">
            <table className="stock-table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => requestSort('name')}>ID</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => requestSort('role_profile')}>Role Profile Name</th>
                  <th className="text-right pr-4" style={{ width: "120px" }}>
                    <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                        <><span>{profiles.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedProfiles.length ? sortedProfiles.map((profile) => {
                  const isSelected = selectedIds.has(profile.name);
                  return (
                    <tr key={profile.name} onClick={() => handleCardClick(profile.name)} style={{ cursor: "pointer", backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined }}>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}><input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(profile.name)} /></td>
                      <td className="font-medium">{profile.name}</td>
                      <td>{profile.role_profile || "—"}</td>
                      <td className="text-right pr-4"><TimeAgo date={profile.modified} /></td>
                    </tr>
                  );
                }) : <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px" }}>No role profiles found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {hasMore && profiles.length > 0 && (
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