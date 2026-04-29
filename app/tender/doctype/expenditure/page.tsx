"use client";


import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import { Controller, useForm } from "react-hook-form";
import { LinkField } from "@/components/LinkField";

// 🟢 New Imports for Bulk Delete & Icons
import { useSelection } from "@/hooks/useSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay";
import { Plus, List, LayoutGrid, Loader2 } from "lucide-react";
import { TimeAgo } from "@/components/TimeAgo";

// 🟢 Changed: Point to Root URL (Required for RPC calls)
const API_BASE_URL = "http://103.219.1.138:4412";

// 🟢 CONFIG: Settings for Pagination
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

interface Expenditure {
  name: string; // Corresponds to 'id'
  fiscal_year?: string;
  bill_number?: string;
  bill_amount?: number | string;
  tender_number?: string;
  lift_irrigation_scheme?: string;
  modified?: string;
  docstatus?: number;
}

interface LisOption {
  name: string;
}

type ViewMode = "grid" | "list";

export default function DoctypePage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Expenditure";

  const [rows, setRows] = React.useState<Expenditure[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // Total count of records
  const [error, setError] = React.useState<string | null>(null);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [lisOptions, setLisOptions] = React.useState<LisOption[]>([]);
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Form for filters
  const { control, watch } = useForm({
    defaultValues: {
      lis_name: "",
    },
  });

  const selectedLis = watch("lis_name");

  // Filter rows client-side for instant results
  const filteredRows = React.useMemo(() => {
    let filtered = rows;

    // Apply search filter
    if (debouncedSearch) {
      filtered = filtered.filter(record =>
        record.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (record.bill_number && record.bill_number.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
        (record.tender_number && record.tender_number.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
        (record.lift_irrigation_scheme && record.lift_irrigation_scheme.toLowerCase().includes(debouncedSearch.toLowerCase()))
      );
    }

    // Apply LIS filter
    if (selectedLis) {
      filtered = filtered.filter(record => record.lift_irrigation_scheme === selectedLis);
    }

    return filtered;
  }, [rows, debouncedSearch, selectedLis]);

  // 🟢 1. Initialize Selection Hook
  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected
  } = useSelection(filteredRows, "name");

  const [isDeleting, setIsDeleting] = React.useState(false);

  // ── Load Filter Options ────────────────────────────────────────
  React.useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;

      try {
        const lisResp = await axios.get(
          `${API_BASE_URL}/api/resource/Lift Irrigation Scheme`,
          {
            params: {
              fields: JSON.stringify(["name"]),
              limit_page_length: "100",
              order_by: "name asc",
            },
            headers: { Authorization: `token ${apiKey}:${apiSecret}` },
          }
        );

        const lisData = lisResp.data?.data ?? [];
        setLisOptions([{ name: "" }, ...lisData]);
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    };

    fetchFilterOptions();
  }, [isInitialized, isAuthenticated, apiKey, apiSecret]);

  /* -------------------------------------------------
  3. FETCH (Refactored for Pagination)
  ------------------------------------------------- */
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

        // Prepare Filters (removed server-side filtering)
        const params: any = {
          fields: JSON.stringify([
            "name",
            "fiscal_year",
            "bill_number",
            "bill_amount",
            "tender_number",
            "lift_irrigation_scheme",
            "modified",
            "docstatus",
          ]),
          limit_start: start,
          limit_page_length: limit,
          order_by: "creation desc",
        };

        const commonHeaders = { Authorization: `token ${apiKey}:${apiSecret}` };

        // 🟢 Parallel Requests: Data + Count (only on reset)
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${encodeURIComponent(doctypeName)}`, {
            params,
            headers: commonHeaders,
            withCredentials: true,
          }),
          isReset
            ? axios.get(`${API_BASE_URL}/api/method/frappe.client.get_count`, {
              params: {
                doctype: doctypeName,
              },
              headers: commonHeaders,
            })
            : Promise.resolve(null),
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: Expenditure[] = raw.map((r: any) => ({
          name: r.name,
          fiscal_year: r.fiscal_year ?? "",
          bill_number: r.bill_number ?? "",
          bill_amount: r.bill_amount ?? "",
          tender_number: r.tender_number ?? "",
          lift_irrigation_scheme: r.lift_irrigation_scheme ?? "",
          modified: r.modified ?? "",
          docstatus: r.docstatus ?? 0,
        }));

        if (isReset) {
          setRows(mapped);
          if (countResp) setTotalCount(countResp.data.message || 0);
        } else {
          setRows((prev) => [...prev, ...mapped]);
        }

        setHasMore(mapped.length === limit);
      } catch (err: any) {
        console.error("API error:", err);
        if (isReset) setError(
          err.response?.status === 403
            ? "Unauthorized – check API key/secret"
            : `Failed to fetch ${doctypeName}`
        );
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [doctypeName, apiKey, apiSecret, isAuthenticated, isInitialized]
  );

  // 🟢 Trigger fetch on search or filter change
  React.useEffect(() => {
    fetchRecords(0, true);
  }, [fetchRecords]);

  // 🟢 Load More Handler
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchRecords(rows.length, false);
    }
  };

  // 🟢 2. Handle Bulk Delete
  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Are you sure you want to permanently delete ${count} records?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await bulkDeleteRPC(
        doctypeName,
        Array.from(selectedIds),
        API_BASE_URL,
        apiKey!,
        apiSecret!
      );

      // Debug: Log the actual response to understand its structure
      console.log("Bulk Delete Response:", response);

      // Check if the response contains server messages indicating errors
      // For bulk delete, error messages are directly in response._server_messages
      if (response._server_messages) {
        // Parse the server messages to check for errors
        const serverMessages = JSON.parse(response._server_messages);
        const errorMessages = serverMessages.map((msgStr: string) => {
          const parsed = JSON.parse(msgStr);
          return parsed.message;
        });

        if (errorMessages.length > 0) {
          // Show error messages from server
          toast.error("Failed to delete records", {
            description: <FrappeErrorDisplay messages={errorMessages} />,
            duration: Infinity
          });
          return; // Don't proceed with success handling
        }
      }

      // If no error messages, proceed with success
      toast.success(`Successfully deleted ${count} records.`);
      clearSelection();
      fetchRecords(0, true); // Refresh list
    } catch (err: any) {
      console.error("Bulk Delete Error:", err);

      const messages = getApiMessages(
        null,
        err,
        "Records deleted successfully",
        "Failed to delete records"
      );

      toast.error(messages.message, { description: messages.description, duration: Infinity });
    } finally {
      setIsDeleting(false);
    }
  };

  const title = "Expenditure";

  const handleCardClick = (id: string) => {
    router.push(`/tender/doctype/expenditure/${encodeURIComponent(id)}`);
  };

  const getFieldsForRecord = (record: Expenditure): RecordCardField[] => {
    const fields: RecordCardField[] = [];
    fields.push({ label: "Fiscal Year", value: record.fiscal_year || "-" });
    fields.push({ label: "Bill Number", value: record.bill_number || "-" });
    fields.push({ label: "Tender No.", value: record.tender_number || "-" });
    fields.push({ label: "Bill Amount", value: String(record.bill_amount ?? "-") });
    return fields;
  };

  /* -------------------------------------------------
  5. LIST VIEW
  ------------------------------------------------- */
  const renderListView = () => (
    <div className="stock-table-container">
      <table className="stock-table">
        <thead>
          <tr>
            {/* 🟢 Header Checkbox */}
            <th style={{ width: "40px", textAlign: "center" }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
            </th>
            <th>ID</th>
            <th>Status</th>
            <th>Fiscal Year</th>
            <th>Bill Number</th>
            <th>Bill Amount</th>
            <th>Tender Number</th>
            <th>LIS Scheme</th>
            <th className="text-right pr-4" style={{ width: "100px" }}>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                  <><span>{filteredRows.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.length ? (
            filteredRows.map((record) => {
              const isSelected = selectedIds.has(record.name);
              return (
                <tr
                  key={record.name}
                  onClick={() => handleCardClick(record.name)}
                  style={{
                    cursor: "pointer",
                    backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined
                  }}
                >
                  {/* 🟢 Row Checkbox */}
                  <td
                    style={{ textAlign: "center" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(record.name)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                  </td>
                  <td>{record.name}</td>
                  <td>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${record.docstatus === 1
                          ? "bg-green-100 text-green-800"
                          : record.docstatus === 2
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                    >
                      {record.docstatus === 1 ? "Submitted" : record.docstatus === 2 ? "Cancelled" : "Draft"}
                    </span>
                  </td>
                  <td>{record.fiscal_year}</td>
                  <td>{record.bill_number}</td>
                  <td>{record.bill_amount}</td>
                  <td>{record.tender_number}</td>
                  <td>{record.lift_irrigation_scheme}</td>
                  <td className="text-right pr-4">
                    <TimeAgo date={record.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={9} style={{ textAlign: "center", padding: "32px" }}>
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid">
      {filteredRows.length ? (
        filteredRows.map((record: Expenditure) => (
          <RecordCard
            key={record.name}
            title={record.name} // ID
            subtitle={record.lift_irrigation_scheme} // Use LIS Scheme as subtitle
            fields={getFieldsForRecord(record)}
            onClick={() => handleCardClick(record.name)}
          />
        ))
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>
          No records found.
        </p>
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
          <p>Manage Expenditure records</p>
        </div>

        {/* 🟢 3. Header Action Switch */}
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
            onClick={() => router.push('/tender/doctype/expenditure/new')}
          >
            <Plus className="w-4 h-4" /> Add {title}
          </button>
        )}
      </div>

      <div
        className="search-filter-section"
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginTop: "1rem",
        }}
      >
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

          <div style={{ minWidth: "200px", marginBottom: "0.2rem" }}>
            <Controller
              control={control}
              name="lis_name"
              render={({ field: { value } }) => {
                const mockField = {
                  name: "lis_name",
                  label: "",
                  type: "Link" as const,
                  linkTarget: "Lift Irrigation Scheme",
                  placeholder: "Select LIS",
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

        {/* 🟢 Load More Button */}
        {hasMore && rows.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="btn btn--secondary flex items-center gap-2 px-6 py-2"
              style={{ minWidth: "140px" }}
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </>
              ) : (
                "Load More"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}