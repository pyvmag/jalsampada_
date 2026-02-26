"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { LinkField } from "@/components/LinkField";
import {
  Search,
  Plus,
  List,
  LayoutGrid,
  ChevronDown,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  Check,
  User,
  Loader2,
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
interface Employee {
  name: string; // Employee ID (e.g., HR-EMP-2024-001)
  employee_name: string;
  department?: string;
  designation?: string;
  status?: string;
  company?: string;
  image?: string;
  creation?: string;
  modified?: string;
}

type SortDirection = "asc" | "desc";
interface SortConfig {
  key: keyof Employee;
  direction: SortDirection;
}

const SORT_OPTIONS: { label: string; key: keyof Employee }[] = [
  { label: "Last Updated", key: "modified" },
  { label: "ID", key: "name" },
  { label: "Name", key: "employee_name" },
  { label: "Department", key: "department" },
  { label: "Designation", key: "designation" },
  { label: "Status", key: "status" },
];

type ViewMode = "grid" | "list";

// ── Main Component ───────────────────────────────────────────────
export default function EmployeeListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Employee";

  const [employees, setEmployees] = React.useState<Employee[]>([]);
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

  // Form for filters (Department)
  const { control, watch } = useForm({
    defaultValues: {
      department: "",
    },
  });

  const selectedDepartment = watch("department");

  // Close sort menu on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(event.target as Node)
      ) {
        setIsSortMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Fetch Employees ─────────────────────────────────────────────────
  const fetchEmployees = React.useCallback(
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
            "employee_name",
            "department",
            "designation",
            "status",
            "company",
            "image",
            "creation",
            "modified",
          ]),
          limit_start: start,
          limit_page_length: limit,
          order_by: `${sortConfig.key} ${sortConfig.direction}`,
        };

        // Build filters array (Frappe style)
        const filters: any[] = [];

        if (debouncedSearch) {
          filters.push(["Employee", "employee_name", "like", `%${debouncedSearch}%`]);
        }

        if (selectedDepartment) {
          filters.push(["Employee", "department", "=", selectedDepartment]);
        }

        if (filters.length > 0) {
          params.filters = JSON.stringify(filters);
        }

        const commonHeaders = {
          Authorization: `token ${apiKey}:${apiSecret}`,
        };

        // Parallel requests for Data and Total Count
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/Employee`, {
            params,
            headers: commonHeaders,
            withCredentials: true,
          }),
          // Only fetch count during initial load or filter change
          isReset ? axios.get(`http://103.219.3.169:2223/api/method/frappe.client.get_count`, {
            params: {
              doctype: doctypeName,
              filters: filters.length > 0 ? JSON.stringify(filters) : undefined
            },
            headers: commonHeaders,
          }) : Promise.resolve(null)
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: Employee[] = raw.map((r: any) => ({
          name: r.name,
          employee_name: r.employee_name,
          department: r.department,
          designation: r.designation,
          status: r.status,
          company: r.company,
          image: r.image,
          creation: r.creation,
          modified: r.modified,
        }));

        if (isReset) {
          setEmployees(mapped);
          if (countResp) setTotalCount(countResp.data.message || 0);
        } else {
          setEmployees((prev) => [...prev, ...mapped]);
        }

        setHasMore(mapped.length === limit);
      } catch (err: any) {
        console.error("API error:", err);
        if (isReset) {
          setError(
            err.response?.status === 403 ? "Unauthorized" : "Failed to fetch employees"
          );
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [apiKey, apiSecret, isAuthenticated, isInitialized, debouncedSearch, selectedDepartment, sortConfig]
  );

  React.useEffect(() => {
    fetchEmployees(0, true);
  }, [fetchEmployees]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchEmployees(employees.length, false);
    }
  };

  // ── Sorting Logic (client-side backup) ──────────────────────────────
  const sortedEmployees = React.useMemo(() => {
    const sortable = [...employees];
    sortable.sort((a, b) => {
      const aValue = a[sortConfig.key] || "";
      const bValue = b[sortConfig.key] || "";
      const compare = aValue.toString().localeCompare(bValue.toString(), undefined, {
        numeric: true,
      });
      return sortConfig.direction === "asc" ? compare : -compare;
    });
    return sortable;
  }, [employees, sortConfig]);

  const requestSort = (key: keyof Employee) => {
    let direction: SortDirection = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.key === sortConfig.key)?.label || "Sort By";

  // 🟢 Selection Hook
  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected,
  } = useSelection(employees, "name");

  const [isDeleting, setIsDeleting] = React.useState(false);

  // 🟢 Bulk Delete Handler
  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} employee records permanently?`)) return;

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

      toast.success(`Deleted ${count} employee records`);
      clearSelection();
      fetchEmployees(0, true);
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

  const getFieldsForCard = (e: Employee): RecordCardField[] => {
    const fields: RecordCardField[] = [];
    if (e.designation) fields.push({ label: "Designation", value: e.designation });
    if (e.department) fields.push({ label: "Dept", value: e.department });
    if (e.status) fields.push({ label: "Status", value: e.status });
    if (e.company) fields.push({ label: "Company", value: e.company });
    if (e.creation) fields.push({ label: "Created", value: formatTimeAgo(e.creation) });
    return fields;
  };

  const handleCardClick = (id: string) => {
    router.push(`/attendance/doctype/employee/${encodeURIComponent(id)}`);
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
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("name")}>
              ID
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("employee_name")}>
              Name
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("designation")}>
              Designation
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("department")}>
              Department
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("status")}>
              Status
            </th>
            <th style={{ cursor: "pointer" }} onClick={() => requestSort("company")}>
              Company
            </th>
            <th className="text-right pr-4" style={{ width: "120px" }}>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                  <><span>{employees.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.length ? (
            sortedEmployees.map((e) => {
              const isSelected = selectedIds.has(e.name);
              return (
                <tr
                  key={e.name}
                  onClick={() => handleCardClick(e.name)}
                  style={{ cursor: "pointer", backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined }}
                >
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(e.name)}
                    />
                  </td>
                  <td className="font-medium text-blue-600">{e.name}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      {e.image ? (
                        <img
                          src={`${API_BASE_URL}${e.image}`}
                          // Note: You might need to adjust image URL depending on if it's full path or relative
                          alt="avatar"
                          className="h-6 w-6 rounded-full object-cover"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
                          <User className="h-3 w-3 text-gray-400" />
                        </div>
                      )}
                      {e.employee_name}
                    </div>
                  </td>
                  <td>{e.designation || "—"}</td>
                  <td>{e.department || "—"}</td>
                  <td>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${e.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : e.status === "Left"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                    >
                      {e.status || "—"}
                    </span>
                  </td>
                  <td>{e.company || "—"}</td>
                  <td className="text-right pr-4">
                    <TimeAgo date={e.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={8} style={{ textAlign: "center", padding: "32px" }}>
                No employees found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid">
      {employees.length ? (
        employees.map((e) => (
          <RecordCard
            key={e.name}
            title={e.employee_name}
            subtitle={e.name}
            fields={getFieldsForCard(e)}
            onClick={() => handleCardClick(e.name)}
          />
        ))
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>No records found.</p>
      )}
    </div>
  );

  if (loading && employees.length === 0) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        Loading employees...
      </div>
    );
  }
  if (error && employees.length === 0) {
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        {error}
      </div>
    );
  }

  return (
    <div className="module active">
      <div className="module-header">
        <div>
          <h2>Employees</h2>
          <p>Manage employee records and status</p>
        </div>
        {selectedIds.size > 0 ? (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={clearSelection}
            onDelete={handleBulkDelete}
            isDeleting={isDeleting}
          />
        ) : (
          <Link href="/attendance/doctype/employee/new" passHref>
            <button className="btn btn--primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          </Link>
        )}
      </div>

      {/* FILTER BAR */}
      <div
        className="search-filter-section"
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        {/* Filters Container */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1" }}>
          {/* Search */}
          <div style={{ minWidth: "200px" }}>
            <input
              type="text"
              placeholder="Search Name..."
              className="form-control w-full mb-[3px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search Employees"
            />
          </div>

          {/* Department Filter (Link Field) */}
          <div style={{ minWidth: "200px" }}>
            <Controller
              control={control}
              name="department"
              render={({ field: { onChange, value } }) => {
                const mockField = {
                  name: "department",
                  label: "",
                  type: "Link" as const,
                  linkTarget: "Department",
                  placeholder: "Filter by Department",
                  required: false,
                  defaultValue: "",
                };

                return (
                  <div className="form-group" style={{ marginBottom: -9 }}>
                    <LinkField
                      control={control}
                      field={{ ...mockField, defaultValue: value }}
                      error={null}
                    />
                  </div>
                );
              }}
            />
          </div>
        </div>

        {/* Sort + View Toggle */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginLeft: "auto",
          }}
        >
          {/* Sort Pill */}
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
                title={`Sort ${sortConfig.direction === "asc" ? "Descending" : "Ascending"
                  }`}
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

          {/* View Switcher */}
          <button
            className="btn btn--outline btn--sm flex items-center justify-center"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            title="Toggle View"
          >
            {view === "grid" ? (
              <List className="w-4 h-4" />
            ) : (
              <LayoutGrid className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Selected Filter Indicator */}
      {selectedDepartment && (
        <div style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
          Filtering by Department:{" "}
          <span className="font-medium text-blue-600">{selectedDepartment}</span>
        </div>
      )}

      {/* Content */}
      <div className="view-container" style={{ marginTop: "0.5rem", paddingBottom: "2rem" }}>
        {view === "grid" ? renderGridView() : renderListView()}
        {hasMore && employees.length > 0 && (
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
