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

interface Role {
    name: string;
    role_name: string;
    home_page?: string;
    disabled?: boolean;
    desk_access?: boolean;
    is_custom?: boolean;
    modified?: string;
    creation?: string;
}

type SortDirection = "asc" | "desc";
interface SortConfig { key: keyof Role; direction: SortDirection; }

const SORT_OPTIONS: { label: string; key: keyof Role }[] = [
    { label: "Last Updated On", key: "modified" },
    { label: "Role Name", key: "name" },
    { label: "Creation Date", key: "creation" },
];

type ViewMode = "grid" | "list";

export default function RoleDoctypePage() {
    const router = useRouter();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
    const doctypeName = "Role";

    const [roles, setRoles] = React.useState<Role[]>([]);
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

    const fetchRoles = React.useCallback(
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
                    fields: JSON.stringify(["name", "role_name", "home_page", "disabled", "desk_access", "is_custom", "modified", "creation"]),
                    limit_start: start,
                    limit_page_length: limit,
                    order_by: `${sortConfig.key} ${sortConfig.direction}`,
                };

                if (debouncedSearch) {
                    params.or_filters = JSON.stringify({
                        name: ["like", `%${debouncedSearch}%`],
                        role_name: ["like", `%${debouncedSearch}%`]
                    });
                }

                const commonHeaders = { Authorization: `token ${apiKey}:${apiSecret}` };

                const [dataResp, countResp] = await Promise.all([
                    axios.get(`${API_BASE_URL}/${doctypeName}`, { params, headers: commonHeaders, withCredentials: true }),
                    isReset ? axios.get(`http://103.219.3.169:2223/api/method/frappe.client.get_count`, {
                        params: { doctype: doctypeName }, headers: commonHeaders,
                    }).catch(() => ({ data: { message: 0 } })) : Promise.resolve({ data: { message: 0 } })
                ]);

                const mapped: Role[] = (dataResp.data?.data ?? []).map((r: any) => ({
                    name: r.name, role_name: r.role_name, home_page: r.home_page,
                    disabled: r.disabled, desk_access: r.desk_access, is_custom: r.is_custom,
                    modified: r.modified, creation: r.creation,
                }));

                if (isReset) {
                    setRoles(mapped);
                    if (countResp?.data) setTotalCount(countResp.data.message || 0);
                } else {
                    setRoles((prev) => [...prev, ...mapped]);
                }
                setHasMore(mapped.length === limit);
            } catch (err: any) {
                if (isReset) setError(err.response?.status === 403 ? "Unauthorized" : "Failed to fetch roles");
            } finally {
                setLoading(false); setIsLoadingMore(false);
            }
        },
        [apiKey, apiSecret, isAuthenticated, isInitialized, debouncedSearch, sortConfig]
    );

    React.useEffect(() => { fetchRoles(0, true); }, [fetchRoles]);

    const handleLoadMore = () => {
        if (!isLoadingMore && hasMore) fetchRoles(roles.length, false);
    };

    const sortedRoles = React.useMemo(() => {
        const sortable = [...roles];
        sortable.sort((a, b) => {
            const aValue = String(a[sortConfig.key] || '');
            const bValue = String(b[sortConfig.key] || '');
            const compare = aValue.localeCompare(bValue);
            return sortConfig.direction === 'asc' ? compare : -compare;
        });
        return sortable;
    }, [roles, sortConfig]);

    const requestSort = (key: keyof Role) => {
        let direction: SortDirection = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const { selectedIds, handleSelectOne, handleSelectAll, clearSelection, isAllSelected } = useSelection(roles, "name");
    const [isDeleting, setIsDeleting] = React.useState(false);

    const handleBulkDelete = async () => {
        const count = selectedIds.size;
        if (!window.confirm(`Delete ${count} roles permanently?`)) return;
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
            toast.success(`Deleted ${count} roles`);
            clearSelection();
            fetchRoles(0, true);
        } catch (err: any) {
            const messages = getApiMessages(null, err, "Records deleted successfully", "Failed to delete records");
            toast.error(messages.message, { description: messages.description, duration: Infinity });
        } finally { setIsDeleting(false); }
    };

    const title = "Role";
    const handleCardClick = (id: string) => router.push(`/admin/doctype/role/${encodeURIComponent(id)}`);

    return (
        <div className="module active">
            <div className="module-header">
                <div>
                    <h2>{title}s</h2>
                    <p>Manage system roles and access levels</p>
                </div>
                {selectedIds.size > 0 ? (
                    <BulkActionBar selectedCount={selectedIds.size} onClear={clearSelection} onDelete={handleBulkDelete} isDeleting={isDeleting} />
                ) : (
                    <Link href="/admin/doctype/role/new" passHref>
                        <button className="btn btn--primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add {title}</button>
                    </Link>
                )}
            </div>

            <div className="search-filter-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", gap: "8px" }}>
                <div className="relative" style={{ flexGrow: 1, maxWidth: '400px' }}>
                    <input type="text" placeholder="Search roles..." className="form-control w-full pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                        {roles.length ? roles.map(role => (
                            <RecordCard key={role.name} title={role.name} subtitle={role.home_page || "Default Home"} fields={[
                                { label: "Desk Access", value: role.desk_access ? "Yes" : "No", type: role.desk_access ? "success" : "default" },
                                { label: "Status", value: role.disabled ? "Disabled" : "Enabled", type: role.disabled ? "danger" : "success" }
                            ]} onClick={() => handleCardClick(role.name)} />
                        )) : <p>No roles found.</p>}
                    </div>
                ) : (
                    <div className="stock-table-container">
                        <table className="stock-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} /></th>
                                    <th style={{ cursor: 'pointer' }} onClick={() => requestSort('name')}>Role Name</th>
                                    <th>Home Page</th>
                                    <th style={{ cursor: 'pointer' }} onClick={() => requestSort('desk_access')}>Desk Access</th>
                                    <th style={{ cursor: 'pointer' }} onClick={() => requestSort('disabled')}>Status</th>
                                    <th className="text-right pr-4" style={{ width: "120px" }}>
                                        <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                                            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                                                <><span>{roles.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                                            )}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRoles.length ? sortedRoles.map((role) => {
                                    const isSelected = selectedIds.has(role.name);
                                    return (
                                        <tr key={role.name} onClick={() => handleCardClick(role.name)} style={{ cursor: "pointer", backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined }}>
                                            <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}><input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(role.name)} /></td>
                                            <td className="font-medium">{role.name}</td>
                                            <td>{role.home_page || "—"}</td>
                                            <td>{role.desk_access ? "Yes" : "No"}</td>
                                            <td><span className={`badge ${role.disabled ? 'badge-danger' : 'badge-success'}`}>{role.disabled ? 'Disabled' : 'Enabled'}</span></td>
                                            <td className="text-right pr-4"><TimeAgo date={role.modified} /></td>
                                        </tr>
                                    );
                                }) : <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px" }}>No roles found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
                {hasMore && roles.length > 0 && (
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