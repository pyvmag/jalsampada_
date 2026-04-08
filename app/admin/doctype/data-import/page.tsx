"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import { useSelection } from "@/hooks/useSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { bulkDeleteRPC } from "@/api/rpc";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import { FrappeErrorDisplay } from "@/components/FrappeErrorDisplay";
import { TimeAgo } from "@/components/TimeAgo";
import { Plus, List, LayoutGrid, Loader2 } from "lucide-react";

const API_BASE_URL = "http://103.219.1.138:4412";
const INITIAL_PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 10;

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

interface DataImport {
  name: string;
  reference_doctype: string;
  import_type: string;
  status: string;
  modified?: string;
}

type ViewMode = "grid" | "list";

export default function DataImportListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const doctypeName = "Data Import";

  const [records, setRecords] = React.useState<DataImport[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  const [loading, setLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [totalCount, setTotalCount] = React.useState(0);

  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const filteredRecords = React.useMemo(() => {
    if (!debouncedSearch) return records;
    const lowerSearch = debouncedSearch.toLowerCase();
    return records.filter(
      (record) =>
        record.name.toLowerCase().includes(lowerSearch) ||
        record.reference_doctype.toLowerCase().includes(lowerSearch)
    );
  }, [records, debouncedSearch]);

  const {
    selectedIds,
    handleSelectOne,
    handleSelectAll,
    clearSelection,
    isAllSelected,
  } = useSelection(filteredRecords, "name");

  const [isDeleting, setIsDeleting] = React.useState(false);

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

        const params: any = {
          fields: JSON.stringify(["name", "reference_doctype", "import_type", "status", "modified"]),
          limit_start: start,
          limit_page_length: limit,
          order_by: "creation desc",
        };

        const commonHeaders = { Authorization: `token ${apiKey}:${apiSecret}` };

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

        if (isReset) {
          setRecords(raw);
          if (countResp) setTotalCount(countResp.data.message || 0);
        } else {
          setRecords((prev) => [...prev, ...raw]);
        }

        setHasMore(raw.length === limit);
      } catch (err: any) {
        console.error("API error:", err);
        if (isReset) setError("Failed to fetch Data Import records");
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

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Are you sure you want to permanently delete ${count} records?`)) return;

    setIsDeleting(true);
    try {
      await bulkDeleteRPC(doctypeName, Array.from(selectedIds), API_BASE_URL, apiKey!, apiSecret!);
      toast.success(`Successfully deleted ${count} records.`);
      clearSelection();
      fetchRecords(0, true);
    } catch (err: any) {
      console.error("Bulk Delete Error:", err);
      toast.error("Failed to delete records");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCardClick = (id: string) => {
    router.push(`/admin/doctype/data-import/${encodeURIComponent(id)}`);
  };

  const getFieldsForRecord = (record: DataImport): RecordCardField[] => {
    return [
      { label: "DocType", value: record.reference_doctype },
      { label: "Type", value: record.import_type },
      { label: "Status", value: record.status },
    ];
  };

  const renderListView = () => (
    <div className="stock-table-container">
      <table className="stock-table">
        <thead>
          <tr>
            <th style={{ width: "40px", textAlign: "center" }}>
              <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} style={{ cursor: "pointer", width: "16px", height: "16px" }} />
            </th>
            <th>ID</th>
            <th>Document Type</th>
            <th>Import Type</th>
            <th>Status</th>
            <th className="text-right pr-4" style={{ width: "100px" }}>
               {filteredRecords.length} / {totalCount}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredRecords.length ? (
            filteredRecords.map((record) => {
              const isSelected = selectedIds.has(record.name);
              return (
                <tr key={record.name} onClick={() => handleCardClick(record.name)} style={{ cursor: "pointer", backgroundColor: isSelected ? "#f0f9ff" : undefined }}>
                  <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(record.name)} style={{ cursor: "pointer", width: "16px", height: "16px" }} />
                  </td>
                  <td>{record.name}</td>
                  <td>{record.reference_doctype}</td>
                  <td>{record.import_type}</td>
                  <td>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      record.status === 'Success' ? 'bg-green-100 text-green-700' :
                      record.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="text-right pr-4">
                    <TimeAgo date={record.modified} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: "32px" }}>No records found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid">
      {filteredRecords.map((record) => (
        <RecordCard key={record.name} title={record.name} fields={getFieldsForRecord(record)} onClick={() => handleCardClick(record.name)} />
      ))}
    </div>
  );

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading Data Import...</div>;

  return (
    <div className="module active">
      <div className="module-header flex justify-between items-center">
        <div>
          <h2>Data Import</h2>
          <p>Import records into system using CSV or Google Sheets</p>
        </div>
        {selectedIds.size > 0 ? (
          <BulkActionBar selectedCount={selectedIds.size} onClear={clearSelection} onDelete={handleBulkDelete} isDeleting={isDeleting} />
        ) : (
          <button className="btn btn--primary flex items-center gap-2" onClick={() => router.push("/admin/doctype/data-import/new")}>
            <Plus className="w-4 h-4" /> Add Data Import
          </button>
        )}
      </div>

      <div className="search-filter-section flex justify-between items-center mt-4">
        <input type="text" placeholder="Search Data Import..." className="form-control w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <div className="view-switcher">
          <button className="btn btn--outline btn--sm" onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}>
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="view-container mt-2 pb-8">
        {view === "grid" ? renderGridView() : renderListView()}
        {hasMore && records.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button onClick={handleLoadMore} disabled={isLoadingMore} className="btn btn--secondary flex items-center gap-2 px-6 py-2">
              {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
