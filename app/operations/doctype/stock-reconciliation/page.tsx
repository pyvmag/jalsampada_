"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import { Controller, useForm } from "react-hook-form";
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
interface StockReconciliation {
  name: string;
  status?: string;
  posting_date?: string;
  posting_time?: string;
  expense_account?: string;
  cost_center?: string;
  creation?: string;
  modified?: string;
  docstatus?: 0 | 1;
}

interface AccountOption {
  name: string;
}

interface CostCenterOption {
  name: string;
}

type ViewMode = "grid" | "list";

export default function StockReconciliationListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Stock Reconciliation";

  const [records, setRecords] = React.useState<StockReconciliation[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");

  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // 🟢 Total count of records
  const [error, setError] = React.useState<string | null>(null);

  // 🟢 Filter states
  const [idSearch, setIdSearch] = React.useState("");
  const [accountOptions, setAccountOptions] = React.useState<AccountOption[]>([]);
  const [costCenterOptions, setCostCenterOptions] = React.useState<CostCenterOption[]>([]);

  // Debounce the ID search
  const debouncedIdSearch = useDebounce(idSearch, 300);

  // Form for filter fields
  const { control, watch } = useForm({
    defaultValues: {
      expense_account: "",
      cost_center: "",
    },
  });

  const selectedAccount = watch("expense_account");
  const selectedCostCenter = watch("cost_center");

  const title = "Stock Reconciliation";

  /* ── Load Filter Options ────────────────────── */
  React.useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;

      try {
        // Fetch Account options
        const accountResp = await axios.get(
          `${API_BASE_URL}/api/resource/Account`,
          {
            params: {
              fields: JSON.stringify(["name"]),
              limit_page_length: "100",
              order_by: "name asc",
            },
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
          }
        );

        // Fetch Cost Center options
        const costCenterResp = await axios.get(
          `${API_BASE_URL}/api/resource/Cost Center`,
          {
            params: {
              fields: JSON.stringify(["name"]),
              limit_page_length: "100",
              order_by: "name asc",
            },
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
          }
        );

        const accountData = accountResp.data?.data ?? [];
        const costCenterData = costCenterResp.data?.data ?? [];

        setAccountOptions([{ name: "" }, ...accountData]);
        setCostCenterOptions([{ name: "" }, ...costCenterData]);
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    };

    fetchFilterOptions();
  }, [isInitialized, isAuthenticated, apiKey, apiSecret]);

  /* ── Filter Records ─────────────────────────── */
  const filteredRecords = React.useMemo(() => {
    let filtered = records;

    // Filter by ID (name field)
    if (debouncedIdSearch) {
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(debouncedIdSearch.toLowerCase())
      );
    }

    // Filter by Expense Account
    if (selectedAccount) {
      filtered = filtered.filter(
        (r) => r.expense_account === selectedAccount
      );
    }

    // Filter by Cost Center
    if (selectedCostCenter) {
      filtered = filtered.filter(
        (r) => r.cost_center === selectedCostCenter
      );
    }

    return filtered;
  }, [records, debouncedIdSearch, selectedAccount, selectedCostCenter]);

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

        // Build filters based on selected filters
        const filters: any[] = [];

        if (debouncedIdSearch) {
          filters.push(["Stock Reconciliation", "name", "like", `%${debouncedIdSearch}%`]);
        }

        if (selectedAccount) {
          filters.push(["Stock Reconciliation", "expense_account", "=", selectedAccount]);
        }

        if (selectedCostCenter) {
          filters.push(["Stock Reconciliation", "cost_center", "=", selectedCostCenter]);
        }

        const commonHeaders = {
          Authorization: `token ${apiKey}:${apiSecret}`,
        };

        // Parallel requests for Data and Total Count
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${doctypeName}`, {
            params: {
              fields: JSON.stringify([
                "name",
                "posting_date",
                "posting_time",
                "expense_account",
                "cost_center",
                "creation",
                "modified",
                "docstatus"
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
        const mapped: StockReconciliation[] = raw.map((r: any) => ({
          name: r.name,
          posting_date: r.posting_date ?? "",
          posting_time: r.posting_time ?? "",
          expense_account: r.expense_account ?? "",
          cost_center: r.cost_center ?? "",
          creation: r.creation ?? "",
          modified: r.modified ?? "",
          docstatus: r.docstatus ?? 0,
          status: r.docstatus === 0 ? "Draft" : "Submitted"
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
    [doctypeName, apiKey, apiSecret, isAuthenticated, isInitialized, debouncedIdSearch, selectedAccount, selectedCostCenter]
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
      fetchRecords(0, true); // Reset to page 1 after delete
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
    router.push(`/operations/doctype/stock-reconciliation/${encodeURIComponent(id)}`);
  };

  const getFieldsForRecord = (record: StockReconciliation): RecordCardField[] => [
    { label: "Status", value: record.status || "-" },
    { label: "Posting Date", value: record.posting_date || "-" },
    { label: "Posting Time", value: record.posting_time || "-" },
    { label: "Difference Account", value: record.expense_account || "-" },
    { label: "Cost Center", value: record.cost_center || "-" },
    { label: "Created", value: formatTimeAgo(record.creation) },
  ];

  /* ── List View ───────────────────────────────── */
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
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
            </th>
            <th>ID</th>
            <th>Status</th>
            <th>Posting Date</th>
            <th>Posting Time</th>
            <th>Difference Account</th>
            <th>Cost Center</th>
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
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(r.name)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                  </td>
                  <td>{r.name}</td>
                  <td>
                    <span className={`status-badge ${r.docstatus === 0 ? 'status-draft' : 'status-submitted'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>{r.posting_date || "-"}</td>
                  <td>{r.posting_time || "-"}</td>
                  <td>{r.expense_account || "-"}</td>
                  <td>{r.cost_center || "-"}</td>
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
            subtitle={`${r.posting_date || ""} ${r.posting_time ? `@ ${r.posting_time}` : ""}`.trim()}
            fields={getFieldsForRecord(r)}
            onClick={() => handleCardClick(r.name)}
          />
        ))
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>No records found</p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading {title}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="module active">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{title}</h2>
          <p>Manage Stock Reconciliation records</p>
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
            onClick={() => router.push("/operations/doctype/stock-reconciliation/new")}
          >
            <Plus className="w-4 h-4" /> Add {title}
          </button>
        )}
      </div>

      {/* 🟢 THREE FILTER FIELDS */}
      <div
        className="search-filter-section"
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginTop: "1rem"
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1" }}>
          {/* ID Search Field */}
          <div style={{ minWidth: "200px" }}>
            <input
              type="text"
              placeholder="Search by ID..."
              className="form-control w-full"
              value={idSearch}
              onChange={(e) => setIdSearch(e.target.value)}
            />
          </div>

          {/* Difference Account Filter */}
          <div style={{ minWidth: "200px", marginBottom: "0.2rem" }}>
            <Controller
              control={control}
              name="expense_account"
              render={({ field: { value } }) => {
                const mockField = {
                  name: "expense_account",
                  label: "",
                  type: "Link" as const,
                  linkTarget: "Account",
                  placeholder: "Select Difference Account",
                  required: false,
                  defaultValue: "",
                };

                return (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <LinkField
                      control={control}
                      field={{ ...mockField, defaultValue: value }}
                      error={null}
                      className="[&>label]:hidden vishal"
                    />
                  </div>
                );
              }}
            />
          </div>

          {/* Cost Center Filter */}
          <div style={{ minWidth: "200px", marginBottom: "0.2rem" }}>
            <Controller
              control={control}
              name="cost_center"
              render={({ field: { value } }) => {
                const mockField = {
                  name: "cost_center",
                  label: "",
                  type: "Link" as const,
                  linkTarget: "Cost Center",
                  placeholder: "Select Cost Center",
                  required: false,
                  defaultValue: "",
                };

                return (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <LinkField
                      control={control}
                      field={{ ...mockField, defaultValue: value }}
                      error={null}
                      className="[&>label]:hidden vishal"
                    />
                  </div>
                );
              }}
            />
          </div>
        </div>

        <div className="view-switcher">
          <button
            className="btn btn--outline btn--sm flex items-center justify-center"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            aria-label="Toggle view"
            title={view === "grid" ? "List view" : "Grid view"}
          >
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
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