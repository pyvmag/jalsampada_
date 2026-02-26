"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard, RecordCardField } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { TimeAgo } from "@/components/TimeAgo";
import {
  Search,
  Plus,
  List,
  LayoutGrid,
  ChevronDown,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  Loader2,
  Clock,
} from "lucide-react";

// 🟢 CONFIG
const DOCTYPE = "WRD District";
const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

// ── Types ────────────────────────────────────────────────────────
interface DistrictRow {
  name: string;
  district: string; // The field you mentioned
  modified: string;
}

type SortDirection = "asc" | "desc";
interface SortConfig {
  key: keyof DistrictRow;
  direction: SortDirection;
}

type ViewMode = "grid" | "list";

export default function DistrictListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const [rows, setRows] = React.useState<DistrictRow[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");

  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: "modified",
    direction: "desc",
  });

  // ── Fetch Data ───────────────────────────────────────────────────
  const fetchData = React.useCallback(async () => {
    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;

    try {
      setLoading(true);
      setError(null);

      const params: any = {
        fields: JSON.stringify(["name", "district", "modified"]),
        limit_page_length: 100,
        order_by: `${sortConfig.key} ${sortConfig.direction}`,
      };

      if (searchTerm) {
        params.filters = JSON.stringify([["District", "district", "like", `%${searchTerm}%`]]);
      }

      const resp = await axios.get(`${API_BASE_URL}/${DOCTYPE}`, {
        params,
        headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        withCredentials: true,
      });

      setRows(resp.data?.data ?? []);
    } catch (err: any) {
      console.error("API error:", err);
      setError("Failed to fetch districts.");
    } finally {
      setLoading(false);
    }
  }, [isInitialized, isAuthenticated, apiKey, apiSecret, searchTerm, sortConfig]);

  React.useEffect(() => {
    // Simple debounce for search
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // ── Render Helpers ──────────────────────────────────────────────
  const handleCardClick = (id: string) => {
    // Optional: Route to detail page if you create one later
    router.push(`/lis-management/doctype/district/${encodeURIComponent(id)}`);
  };

  const renderListView = () => (
    <div className="stock-table-container">
      <table className="stock-table w-full">
        <thead>
          <tr>
            <th className="text-left p-3">ID</th>
            <th className="text-left p-3">District Name</th>
            <th className="text-right p-3" style={{ width: "100px" }}>
              <Clock className="w-4 h-4 mr-1 float-right" />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr
                key={row.name}
                className="hover:bg-muted/50 cursor-pointer"
                onClick={() => handleCardClick(row.name)}
              >
                <td className="p-3 font-medium">{row.name}</td>
                <td className="p-3">{row.district}</td>
                <td className="p-3 text-right">
                  <TimeAgo date={row.modified} />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="text-center p-8 text-muted-foreground">
                No districts found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGridView = () => (
    <div className="equipment-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {rows.length ? (
        rows.map((row) => (
          <RecordCard
            key={row.name}
            title={row.district}
            subtitle={row.name}
            fields={[{ label: "Last Updated", value: row.modified }]}
            onClick={() => handleCardClick(row.name)}
          />
        ))
      ) : (
        <p className="col-span-full text-center py-8 text-muted-foreground">No districts found.</p>
      )}
    </div>
  );

  if (loading && rows.length === 0) {
    return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>;
  }

  return (
    <div className="module active p-6">
      <div className="module-header flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold">District</h2>
          <p className="text-muted-foreground">Manage Districts</p>
        </div>
        <Link href="/lis-management/doctype/district/new" passHref>
          <button className="btn btn--primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add District
          </button>
        </Link>
      </div>

      <div className="flex justify-between items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search District..."
            className="form-control pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            className="btn btn--outline btn--sm w-10 h-10 p-0 flex items-center justify-center"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
          >
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {view === "grid" ? renderGridView() : renderListView()}
    </div>
  );
}