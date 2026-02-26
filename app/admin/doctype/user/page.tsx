"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  Search,
  Plus,
  List,
  LayoutGrid,
  ChevronDown,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  Check,
  Loader2
} from "lucide-react";
import { TimeAgo } from "@/components/TimeAgo";
import { formatTimeAgo } from "@/lib/utils";
import { useSelection } from "@/hooks/useSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource"; // Fixed double slash

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
interface User {
  name: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  enabled?: boolean;
  modified?: string;
  creation?: string;
  mobile_no?: string;
  phone?: string;
  user_type?: string;
  user_image?: string;
}

type SortDirection = "asc" | "desc";
interface SortConfig {
  key: keyof User;
  direction: SortDirection;
}

const SORT_OPTIONS: { label: string; key: keyof User }[] = [
  { label: "Last Updated On", key: "modified" },
  { label: "Email", key: "email" },
  { label: "Full Name", key: "full_name" },
  { label: "User Type", key: "user_type" },
  { label: "Creation Date", key: "creation" },
];

type ViewMode = "grid" | "list";

// ── Main Component ───────────────────────────────────────────────
export default function UserDoctypePage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "User";

  const [users, setUsers] = React.useState<User[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");

  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // 🟢 Total count of records
  const [error, setError] = React.useState<string | null>(null);

  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: "modified",
    direction: "desc",
  });

  const [isSortMenuOpen, setIsSortMenuOpen] = React.useState(false);
  const sortMenuRef = React.useRef<HTMLDivElement>(null);

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

  // ── Fetch Users ─────────────────────────────────────────────────
  const fetchUsers = React.useCallback(
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
            "name", "email", "first_name", "last_name", "full_name",
            "enabled", "modified", "creation", "mobile_no", "phone",
            "user_type", "user_image"
          ]),
          limit_start: start,
          limit_page_length: limit,
          order_by: `${sortConfig.key} ${sortConfig.direction}`,
        };

        if (debouncedSearch) {
          params.or_filters = JSON.stringify({
            email: ["like", `%${debouncedSearch}%`],
            full_name: ["like", `%${debouncedSearch}%`],
            first_name: ["like", `%${debouncedSearch}%`],
            last_name: ["like", `%${debouncedSearch}%`]
          });
        }

        const commonHeaders = {
          Authorization: `token ${apiKey}:${apiSecret}`,
        };

        // Parallel requests for Data and Total Count
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/User`, {
            params,
            headers: commonHeaders,
            withCredentials: true,
          }),
          // Only fetch count during initial load - without filters to avoid issues
          isReset ? axios.get(`http://103.219.3.169:2223/api/method/frappe.client.get_count`, {
            params: {
              doctype: doctypeName
            },
            headers: commonHeaders,
          }).catch(() => ({ data: { message: 0 } })) // Fallback to 0 if count fails
            : Promise.resolve({ data: { message: 0 } })
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: User[] = raw.map((r: any) => ({
          name: r.name,
          email: r.email,
          first_name: r.first_name,
          last_name: r.last_name,
          full_name: r.full_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
          enabled: r.enabled,
          modified: r.modified,
          creation: r.creation,
          mobile_no: r.mobile_no,
          phone: r.phone,
          user_type: r.user_type,
          user_image: r.user_image,
        }));

        if (isReset) {
          setUsers(mapped);
          if (countResp && countResp.data) setTotalCount(countResp.data.message || 0);
        } else {
          setUsers((prev) => [...prev, ...mapped]);
        }

        setHasMore(mapped.length === limit);
      } catch (err: any) {
        console.error("API error:", err);
        if (isReset) {
          setError(err.response?.status === 403 ? "Unauthorized" : "Failed to fetch users");
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [apiKey, apiSecret, isAuthenticated, isInitialized, debouncedSearch, sortConfig]
  );

  React.useEffect(() => {
    fetchUsers(0, true);
  }, [fetchUsers]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchUsers(users.length, false);
    }
  };

  // ── Sorting Logic (client-side backup) ──────────────────────────────
  const sortedUsers = React.useMemo(() => {
    const sortableUsers = [...users];
    sortableUsers.sort((a, b) => {
      const aValue = String(a[sortConfig.key] || '');
      const bValue = String(b[sortConfig.key] || '');
      const compare = aValue.localeCompare(bValue);
      return sortConfig.direction === 'asc' ? compare : -compare;
    });
    return sortableUsers;
  }, [users, sortConfig]);

  const requestSort = (key: keyof User) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const currentSortLabel = SORT_OPTIONS.find(opt => opt.key === sortConfig.key)?.label || "Sort By";

  // 🟢 Selection Hook
  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected,
  } = useSelection(users, "name");

  const [isDeleting, setIsDeleting] = React.useState(false);

  // 🟢 Bulk Delete Handler
  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} user records permanently?`)) return;

    setIsDeleting(true);
    try {
      const response = await bulkDeleteRPC(
        doctypeName,
        Array.from(selectedIds),
        "http://103.219.3.169:2223",
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

      toast.success(`Deleted ${count} user records`);
      clearSelection();
      fetchUsers(0, true);
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

  const getFieldsForUser = (user: User): RecordCardField[] => {
    const fields: RecordCardField[] = [];
    if (user.email) fields.push({ label: "Email", value: user.email });
    if (user.user_type) fields.push({ label: "User Type", value: user.user_type });
    if (user.mobile_no) fields.push({ label: "Mobile", value: user.mobile_no });
    if (user.enabled !== undefined) fields.push({
      label: "Status",
      value: user.enabled ? "Active" : "Disabled",
      type: user.enabled ? "success" : "danger"
    });
    if (user.creation) fields.push({ label: "Created", value: formatTimeAgo(user.creation) });
    return fields;
  };

  const title = "User";
  const handleCardClick = (id: string) => {
    router.push(`/admin/doctype/user/${encodeURIComponent(id)}`);
  };

  // ── Renderers ────────────────────────────────────────────────────
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
            <th style={{ cursor: 'pointer' }} onClick={() => requestSort('name')}>Username</th>
            <th style={{ cursor: 'pointer' }} onClick={() => requestSort('full_name')}>Full Name</th>
            <th style={{ cursor: 'pointer' }} onClick={() => requestSort('email')}>Email</th>
            <th style={{ cursor: 'pointer' }} onClick={() => requestSort('user_type')}>User Type</th>
            <th style={{ cursor: 'pointer' }} onClick={() => requestSort('enabled')}>Status</th>
            <th className="text-right pr-4" style={{ width: "120px" }}>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                  <><span>{users.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.length ? (
            sortedUsers.map((user) => {
              const isSelected = selectedIds.has(user.name);
              return (
                <tr
                  key={user.name}
                  onClick={() => handleCardClick(user.name)}
                  style={{ cursor: "pointer", backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined }}
                >
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(user.name)}
                    />
                  </td>
                  <td>{user.name}</td>
                  <td>{user.full_name || "—"}</td>
                  <td>{user.email || "—"}</td>
                  <td>{user.user_type || "—"}</td>
                  <td>
                    <span className={`badge ${user.enabled ? 'badge-success' : 'badge-danger'}`}>
                      {user.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="text-right pr-4">
                    <TimeAgo date={user.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>No users found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid">
      {users.length ? users.map(user => (
        <RecordCard
          key={user.name}
          title={user.full_name || user.name}
          subtitle={user.email}
          fields={getFieldsForUser(user)}
          onClick={() => handleCardClick(user.name)}
        />
      )) : <p style={{ color: "var(--color-text-secondary)" }}>No users found.</p>}
    </div>
  );

  if (loading && users.length === 0) return <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>Loading users...</div>;
  if (error && users.length === 0) return <div className="module active" style={{ padding: "2rem" }}>{error}</div>;

  return (
    <div className="module active">
      <div className="module-header">
        <div>
          <h2>{title}</h2>
          <p>Manage system users and their permissions</p>
        </div>
        {selectedIds.size > 0 ? (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={clearSelection}
            onDelete={handleBulkDelete}
            isDeleting={isDeleting}
          />
        ) : (
          <Link href="/admin/doctype/user/new" passHref>
            <button className="btn btn--primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add {title}
            </button>
          </Link>
        )}
      </div>

      {/* FILTER BAR */}
      <div className="search-filter-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", gap: "8px" }}>

        {/* Left: Single Omni-Search */}
        <div className="relative" style={{ flexGrow: 1, maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="Search by name, email..."
            className="form-control w-full pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search Users"
          />
        </div>

        {/* Right: Sort Pill + View Switcher */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>

          {/* Sort Pill */}
          <div className="relative" ref={sortMenuRef}>
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">

              <button
                className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors"
                onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
                title={`Sort ${sortConfig.direction === 'asc' ? 'Descending' : 'Ascending'}`}
                aria-label={sortConfig.direction === 'asc' ? "Sort Descending" : "Sort Ascending"}
              >
                {sortConfig.direction === 'asc' ?
                  <ArrowDownWideNarrow className="w-4 h-4 text-gray-600 dark:text-gray-300" /> :
                  <ArrowUpNarrowWide className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                }
              </button>

              <div className="h-4 w-[1px] bg-gray-300 dark:bg-gray-600 mx-1"></div>

              <button
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors"
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                aria-label="Open Sort Options"
              >
                {currentSortLabel}
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>
            </div>

            {isSortMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                <div className="py-1">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sort By</div>
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${sortConfig.key === option.key ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                      onClick={() => {
                        setSortConfig(prev => ({ ...prev, key: option.key }));
                        setIsSortMenuOpen(false);
                      }}
                    >
                      {option.label}
                      {sortConfig.key === option.key && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* View Switcher */}
          <button
            className="btn btn--outline btn--sm flex items-center justify-center"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            aria-label={view === "grid" ? "Switch to List View" : "Switch to Grid View"}
          >
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="view-container" style={{ marginTop: "0.5rem", paddingBottom: "2rem" }}>
        {view === "grid" ? renderGridView() : renderListView()}
        {hasMore && users.length > 0 && (
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
