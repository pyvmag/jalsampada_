"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { getApiMessages} from "@/lib/utils"; // 🟢 Added import for error handling
import { useForm, Controller } from "react-hook-form";
import { LinkField } from "@/components/LinkField";

// 🟢 New Imports for Bulk Delete & Icons
import { useSelection } from "@/hooks/useSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { Plus, List, LayoutGrid, Clock, Loader2 } from "lucide-react";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay";
import { TimeAgo } from "@/components/TimeAgo";

// 🟢 Changed: Point to Root URL (Required for RPC calls)
const API_BASE_URL = "http://103.219.3.169:2223";

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

/* -------------------------------------------------
 1. Minimal LIS type
 ------------------------------------------------- */
interface LiftIrrigationScheme {
  name: string;
  lis_name: string;
  modified?: string;
}

/* -------------------------------------------------
 2. Component
 ------------------------------------------------- */
type ViewMode = "grid" | "list";

export default function DoctypePage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Lift Irrigation Scheme";

  const [schemes, setSchemes] = React.useState<LiftIrrigationScheme[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  
  // 🟢 Loading & Pagination States
  const [loading, setLoading] = React.useState(true);       // Full page load
  const [isLoadingMore, setIsLoadingMore] = React.useState(false); // Button load
  const [hasMore, setHasMore] = React.useState(true);       // Are there more records?
  const [totalCount, setTotalCount] = React.useState(0);    // 🟢 NEW: Total count of records
  const [error, setError] = React.useState<string | null>(null);

  // 🟢 Form for filters
  const { control, watch } = useForm({
    defaultValues: {
      name: "",
      lis_name: ""
    }
  });

  const selectedName = watch("name");
  const selectedLisName = watch("lis_name");
  
  // 🟢 Debounce filter values to reduce API calls
  const debouncedName = useDebounce(selectedName, 300);
  const debouncedLisName = useDebounce(selectedLisName, 300);
  
  // 🟢 Track if filters are changing to show loading state
  const [isFilterChanging, setIsFilterChanging] = React.useState(false);

  // 🟢 Filter schemes client-side for instant results (like original implementation)
  const filteredSchemes = React.useMemo(() => {
    if (!selectedName && !selectedLisName) return schemes;
    return schemes.filter(scheme =>
      (selectedName ? scheme.name === selectedName : true) &&
      (selectedLisName ? scheme.lis_name === selectedLisName : true)
    );
  }, [schemes, selectedName, selectedLisName]);

  // 🟢 Use filtered schemes for display
  const displaySchemes = filteredSchemes;

  // 🟢 1. Initialize Selection Hook
  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected
  } = useSelection(displaySchemes, "name");

  const [isDeleting, setIsDeleting] = React.useState(false);

  // ── 🟢 Fetch Logic (Refactored for Pagination and Total Count) ───────────────────
  const fetchSchemes = React.useCallback(
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

        const commonHeaders = { Authorization: `token ${apiKey}:${apiSecret}` };
        
        // Parallel requests for Data and Total Count
        const [dataResp, countResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/resource/${doctypeName}`, {
            params: {
              fields: JSON.stringify(["name", "lis_name", "modified"]),
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
        const mapped: LiftIrrigationScheme[] = raw.map((r: any) => ({
          name: r.name,
          lis_name: r.lis_name ?? r.name,
          modified: r.modified,
        }));

        if (isReset) {
          setSchemes(mapped);
          if (countResp) setTotalCount(countResp.data.message);
        } else {
          setSchemes((prev) => [...prev, ...mapped]);
        }

        setHasMore(mapped.length === limit);

      } catch (err: any) {
        console.error("API error:", err);
        if (isReset) setError(err.response?.status === 403 ? "Unauthorized" : "Failed to fetch lift irrigation schemes");
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [apiKey, apiSecret, isAuthenticated, isInitialized, doctypeName]
  );

  React.useEffect(() => {
    fetchSchemes(0, true);
  }, [fetchSchemes]);
  
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchSchemes(schemes.length, false);
    }
  };

  // 🟢 2. Handle Bulk Delete (UPDATED with Server Message Parsing)
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

      // 🟢 Added: Check if the response contains server messages indicating errors
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

      toast.success(`Successfully deleted ${count} records.`);
      clearSelection();
      fetchSchemes(0, true);
    } catch (err: any) {
      console.error("Bulk Delete Error:", err);

      // 🟢 Added: Consistent error handling using getApiMessages
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

  const title = "Lift Irrigation Scheme";

  const handleCardClick = (id: string) => {
    router.push(`/lis-management/doctype/lift-irrigation-scheme/${encodeURIComponent(id)}`);
  };

  /* -------------------------------------------------
  4. CARD FIELDS
  ------------------------------------------------- */
  const getFieldsForScheme = (scheme: LiftIrrigationScheme): RecordCardField[] => {
    return [];
  };

  /* -------------------------------------------------
  5. LIST VIEW
  ------------------------------------------------- */
  const renderListView = () => (
  <div className="stock-table-container">
    <table className="stock-table">
      <thead>
        <tr>
          {/* 1. Checkbox */}
          <th style={{ width: "40px", textAlign: "center" }}>
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAll}
              style={{ cursor: "pointer", width: "16px", height: "16px" }}
            />
          </th>
          {/* 2. Primary Data */}
          <th>LIS Name</th>
          <th>ID</th>
          {/* 3. Timestamp (Far Right) */}
          <th className="text-right pr-4" style={{ width: "120px" }}>
            <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                 {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                   <><span>{displaySchemes.length}</span><span className="opacity-50"> /</span><span className="text-gray-900 dark:text-gray-200 font-bold">{totalCount}</span></>
                 )}
              </div>
            </th>
        </tr>
      </thead>
      <tbody>
        {displaySchemes.length ? (
          displaySchemes.map((scheme) => {
            const isSelected = selectedIds.has(scheme.name);
            return (
              <tr
                key={scheme.name}
                onClick={() => handleCardClick(scheme.name)}
                style={{
                  cursor: "pointer",
                  backgroundColor: isSelected ? "var(--color-surface-selected, #f0f9ff)" : undefined
                }}
              >
                <td
                  style={{ textAlign: "center" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelectOne(scheme.name)}
                    style={{ cursor: "pointer", width: "16px", height: "16px" }}
                  />
                </td>
                <td>{scheme.lis_name}</td>
                <td>{scheme.name}</td>
                {/* Right-aligned timestamp snippet */}
                <td className="text-right">
                  <TimeAgo date={scheme.modified} />
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            {/* Updated colSpan to 4 to cover all columns */}
            <td colSpan={4} style={{ textAlign: "center", padding: "32px" }}>
              No records found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

  /* -------------------------------------------------
  6. GRID VIEW
  ------------------------------------------------- */
  const renderGridView = () => (
    <div className="equipment-grid">
      {displaySchemes.length ? (
        displaySchemes.map((scheme) => (
          <RecordCard
            key={scheme.name}
            title={scheme.lis_name}
            subtitle={scheme.name}
            fields={getFieldsForScheme(scheme)}
            onClick={() => handleCardClick(scheme.name)}
          />
        ))
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>
          No records found.
        </p>
      )}
    </div>
  );

  /* -------------------------------------------------
  7. UI STATES
  ------------------------------------------------- */
  if (loading) {
    return (
      <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading {title}...</p>
      </div>
    );
  }

  if (error && schemes.length === 0) {
    return (
      <div className="module active" style={{ padding: "2rem" }}>
        <p style={{ color: "var(--color-error)" }}>{error}</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  /* -------------------------------------------------
  8. MAIN RENDER
  ------------------------------------------------- */
  return (
    <div className="module active">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{title}</h2>
          <p>Manage Lift Irrigation Scheme master</p>
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
          <Link href="/lis-management/doctype/lift-irrigation-scheme/new" passHref>
            <button className="btn btn--primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add {title}
            </button>
          </Link>
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
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1" }}>
          <div style={{ minWidth: "200px" }}>
            <Controller control={control} name="name" render={({ field: { value } }) => (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <LinkField control={control} field={{ name: "name", label: "", type: "Link", linkTarget: "Lift Irrigation Scheme", placeholder: "Select ID", required: false, defaultValue: value }} error={null} className="[&>label]:hidden vishal" />
              </div>
            )} />
          </div>
          <div style={{ minWidth: "200px" }}>
            <Controller control={control} name="lis_name" render={({ field: { value } }) => (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <LinkField control={control} field={{ name: "lis_name", label: "", type: "Link", linkTarget: "Lift Irrigation Scheme", placeholder: "Select LIS Name", required: false, defaultValue: value }} error={null} className="[&>label]:hidden vishal" />
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
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="view-container" style={{ marginTop: "0.5rem", paddingBottom: "2rem" }}>
        {view === "grid" ? renderGridView() : renderListView()}
        {hasMore && displaySchemes.length > 0 && (
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