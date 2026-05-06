"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import { useForm, Controller } from "react-hook-form";
import { LinkField } from "@/components/LinkField";

// 🟢 New Imports for Bulk Delete
import { useSelection } from "@/hooks/useSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay"; // Assuming you have sonner installed (or use your preferred toast)
import { Plus, List, LayoutGrid, Loader2 } from "lucide-react"; // Optional: if you want to use Lucide icons for consistency
import { TimeAgo } from "@/components/TimeAgo";

const API_BASE_URL = "http://103.219.3.169:2223"; // 🟢 Changed: Removed /api/resource so RPC helper can append /api/method

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

interface Tender {
  name: string;              // id
  status?: string;           // from custom_tender_status
  tender_name?: string;      // from custom_prapan_suchi
  lis_name?: string;          // from custom_lis_name
  modified?: string;
}

interface LisOption {
  name: string;
}

type ViewMode = "grid" | "list";

export default function DoctypePage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Project"; // 🟢 This is the DocType used for API calls

  const [tenders, setTenders] = React.useState<Tender[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  
  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // 🟢 Total count of records
  const [error, setError] = React.useState<string | null>(null);
  const [prapanSuchiMap, setPrapanSuchiMap] = React.useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = React.useState("");
  const [lisOptions, setLisOptions] = React.useState<LisOption[]>([]);
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Form for filters
  const { control, watch } = useForm({
    defaultValues: {
      lis_name: ""
    }
  });

  const selectedLis = watch("lis_name");

  // Filter tenders client-side
  const filteredTenders = React.useMemo(() => {
    let filtered = tenders;

    // Apply search filter
    if (debouncedSearch) {
      filtered = filtered.filter(tender =>
        tender.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (tender.tender_name && tender.tender_name.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
        (prapanSuchiMap[tender.tender_name || ""] && prapanSuchiMap[tender.tender_name || ""].toLowerCase().includes(debouncedSearch.toLowerCase())) ||
        (tender.status && tender.status.toLowerCase().includes(debouncedSearch.toLowerCase()))
      );
    }

    // Apply LIS filter
    if (selectedLis) {
      filtered = filtered.filter(tender => tender.lis_name === selectedLis);
    }

    return filtered;
  }, [tenders, debouncedSearch, selectedLis]);

  // 🟢 1. Initialize Selection Hook
  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected
  } = useSelection(filteredTenders, "name");

  const [isDeleting, setIsDeleting] = React.useState(false);

  // ── Load Filter Options ────────────────────────────────────────
  React.useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;

      try {
        // Fetch LIS options
        const lisResp = await axios.get(`${API_BASE_URL}/api/resource/Lift Irrigation Scheme`, {
          params: {
            fields: JSON.stringify(["name"]),
            limit_page_length: "100",
            order_by: "name asc",
          },
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        });

        const lisData = lisResp.data?.data ?? [];
        setLisOptions([{ name: "" }, ...lisData]); // empty string = All
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    };

    fetchFilterOptions();
  }, [isInitialized, isAuthenticated, apiKey, apiSecret]);

  // ── 🟢 Fetch Prapan Suchi Mapping for display names ──────────────────
  React.useEffect(() => {
    const fetchPrapanSuchiNames = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;

      try {
        const resp = await axios.get(`${API_BASE_URL}/api/resource/Prapan Suchi`, {
          params: {
            fields: JSON.stringify(["name", "work_name"]),
            limit_page_length: 2000, // Reasonable limit for mapping
          },
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        });

        const data = resp.data?.data ?? [];
        const map: Record<string, string> = {};
        data.forEach((item: any) => {
          map[item.name] = item.work_name;
        });
        setPrapanSuchiMap(map);
      } catch (err) {
        console.error("Failed to load Prapan Suchi mapping:", err);
      }
    };

    fetchPrapanSuchiNames();
  }, [isInitialized, isAuthenticated, apiKey, apiSecret]);

  // ── 🟢 Fetch Logic (Refactored for Pagination and Total Count) ───────────────────
  const fetchTenders = React.useCallback(
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
        if (debouncedSearch) filters.push(["Project", "name", "like", `%${debouncedSearch}%`]);
        if (selectedLis) filters.push(["Project", "custom_lis_name", "=", selectedLis]);

        const commonHeaders = { Authorization: `token ${apiKey}:${apiSecret}` };
        
        // Parallel requests for Data and Total Count
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${doctypeName}`, {
            params: {
              fields: JSON.stringify([
                "name",
                "custom_tender_status",
                "custom_prapan_suchi",
                "custom_lis_name",
                "modified",
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
            params: { doctype: doctypeName, filters: filters.length > 0 ? JSON.stringify(filters) : undefined },
            headers: commonHeaders,
          }) : Promise.resolve(null)
        ]);

        const raw = dataResp.data?.data ?? [];
        const mapped: Tender[] = raw.map((r: any) => ({
          name: r.name,
          status: r.custom_tender_status ?? "",
          tender_name: r.custom_prapan_suchi ?? "",
          lis_name: r.custom_lis_name ?? "",
          modified: r.modified,
        }));

        if (isReset) {
          setTenders(mapped);
          if (countResp) setTotalCount(countResp.data.message || 0);
        } else {
          setTenders((prev) => [...prev, ...mapped]);
        }

        setHasMore(mapped.length === limit);

      } catch (err: any) {
        console.error("API error:", err);
        if (isReset) setError(
          err.response?.status === 403
            ? "Unauthorized - check API key/secret"
            : `Failed to fetch ${doctypeName}`
        );
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [apiKey, apiSecret, isAuthenticated, isInitialized, debouncedSearch, selectedLis, doctypeName]
  );

  React.useEffect(() => {
    fetchTenders(0, true);
  }, [fetchTenders]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchTenders(tenders.length, false);
    }
  };

  // 🟢 2. Handle Bulk Delete Action
  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Are you sure you want to permanently delete ${count} records?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      // Execute the RPC call
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

      // Clear selection and refresh list
      clearSelection();
      fetchTenders(0, true);

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

  const title = "Tender";

  const handleCardClick = (id: string) => {
    router.push(`/tender/doctype/tender/${encodeURIComponent(id)}`);
  };

  const getFieldsForTender = (t: Tender): RecordCardField[] => {
    const fields: RecordCardField[] = [];
    fields.push({ label: "ID", value: t.name });
    if (t.status) fields.push({ label: "Status", value: t.status });
    const workName = prapanSuchiMap[t.tender_name || ""] || t.tender_name;
    if (workName) fields.push({ label: "Name of Work", value: workName });
    if (t.lis_name) fields.push({ label: "LIS", value: t.lis_name });
    return fields;
  };

  // 🟢 3. Modified Grid View (Standard - No Selection for now)
  const renderGridView = () => (
    <div className="equipment-grid">
      {filteredTenders.length ? (
        filteredTenders.map((t) => (
          <RecordCard
            key={t.name}
            title={prapanSuchiMap[t.tender_name || ""] || t.tender_name || t.name}
            subtitle={t.status}
            fields={getFieldsForTender(t)}
            onClick={() => handleCardClick(t.name)}
          />
        ))
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>No records found.</p>
      )}
    </div>
  );

  // 🟢 4. Modified List View (Added Checkboxes)
  const renderListView = () => (
    <div className="stock-table-container">
      <table className="stock-table">
        <thead>
          <tr>
            {/* Header Checkbox */}
            <th style={{ width: "40px", textAlign: "center" }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
            </th>
            <th>ID</th>
            <th>Name of Work</th>
            <th>LIS</th>
            <th>Status</th>
            <th className="text-right pr-4" style={{ width: "100px" }}>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                 {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                   <><span>{filteredTenders.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                 )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredTenders.length ? (
            filteredTenders.map((t) => {
              const isSelected = selectedIds.has(t.name);
              return (
                <tr
                  key={t.name}
                  onClick={() => handleCardClick(t.name)}
                  style={{
                    cursor: "pointer",
                    backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined
                  }}
                >
                  {/* Row Checkbox */}
                  <td
                    style={{ textAlign: "center" }}
                    onClick={(e) => e.stopPropagation()} // 🔴 Prevent navigation
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(t.name)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                  </td>
                  <td>{t.name}</td>
                  <td title={prapanSuchiMap[t.tender_name || ""] || t.tender_name}>
                    {prapanSuchiMap[t.tender_name || ""] 
                      ? (prapanSuchiMap[t.tender_name || ""].length > 60 ? prapanSuchiMap[t.tender_name || ""].substring(0, 60) + "..." : prapanSuchiMap[t.tender_name || ""])
                      : t.tender_name}
                  </td>
                  <td>{t.lis_name}</td>
                  <td>{t.status}</td>
                  <td className="text-right pr-4">
                    <TimeAgo date={t.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  if (loading && !tenders.length) {
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
          <p>Manage tender records</p>
        </div>

        {/* 🟢 5. Switch between "Add New" and "Bulk Actions" */}
        {selectedIds.size > 0 ? (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={clearSelection}
            onDelete={handleBulkDelete}
            isDeleting={isDeleting}
          />
        ) : (
          <button
            className="btn btn--primary"
            onClick={() => router.push('/tender/doctype/tender/new')}
          >
            <i className="fas fa-plus"></i> Add {title}
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
              render={({ field: { onChange, value } }) => {
                const mockField = {
                  name: "lis_name",
                  label: "",
                  type: "Link" as const,
                  linkTarget: "Lift Irrigation Scheme",
                  placeholder: "Select LIS",
                  required: false,
                  defaultValue: ""
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
            className="btn btn--outline btn--sm"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            aria-label="Toggle view"
            title={view === "grid" ? "List view" : "Grid view"}
          >
            {view === "grid" ? <i className="fas fa-list" /> : <i className="fas fa-th-large" />}
          </button>
        </div>
      </div>

      <div className="view-container" style={{ marginTop: "0.5rem", paddingBottom: "2rem" }}>
        {view === "grid" ? renderGridView() : renderListView()}
        {hasMore && filteredTenders.length > 0 && (
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