"use client";

import * as React from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { RecordCard } from "@/components/RecordCard";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { TimeAgo } from "@/components/TimeAgo";
import {
  Search,
  Plus,
  List,
  LayoutGrid,
  Loader2,
  Clock,
} from "lucide-react";

// 🟢 CONFIG
const DOCTYPE = "WRD Taluka";
const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

// ── Types ────────────────────────────────────────────────────────
interface TalukaRow {
  name: string;
  taluka: string;   // The Taluka Name
  district: string; // Link to District
  modified: string;
}

type ViewMode = "grid" | "list";

export default function TalukaListPage() {
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const [rows, setRows] = React.useState<TalukaRow[]>([]);
  const [view, setView] = React.useState<ViewMode>("list");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");

  // ── Fetch Data ───────────────────────────────────────────────────
  const fetchData = React.useCallback(async () => {
    if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;

    try {
      setLoading(true);
      setError(null);

      const params: any = {
        fields: JSON.stringify(["name", "taluka", "district", "modified"]),
        limit_page_length: 100,
        order_by: "modified desc",
      };

      if (searchTerm) {
        // Filter by Taluka Name OR District Name
        params.filters = JSON.stringify([
          ["Taluka", "taluka", "like", `%${searchTerm}%`]
        ]);
      }

      const resp = await axios.get(`${API_BASE_URL}/${DOCTYPE}`, {
        params,
        headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        withCredentials: true,
      });

      setRows(resp.data?.data ?? []);
    } catch (err: any) {
      console.error("API error:", err);
      setError("Failed to fetch talukas.");
    } finally {
      setLoading(false);
    }
  }, [isInitialized, isAuthenticated, apiKey, apiSecret, searchTerm]);

  React.useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleCardClick = (id: string) => {
    router.push(`/lis-management/doctype/taluka/${encodeURIComponent(id)}`);
  };

  // ── Renderers ────────────────────────────────────────────────────
  const renderListView = () => (
    <div className="stock-table-container">
      <table className="stock-table w-full">
        <thead>
          <tr>
            <th className="text-left p-3">Taluka</th>
            <th className="text-left p-3">District</th>
            <th className="text-left p-3">ID</th>
            <th className="text-right p-3" style={{ width: "100px" }}>
              <Clock className="w-4 h-4 mr-1 float-right" />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.name} onClick={() => handleCardClick(row.name)} className="hover:bg-muted/50 cursor-pointer">
                <td className="p-3 font-medium">{row.taluka}</td>
                <td className="p-3">{row.district}</td>
                <td className="p-3 text-muted-foreground text-sm">{row.name}</td>
                <td className="p-3 text-right">
                  <TimeAgo date={row.modified} />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="text-center p-8 text-muted-foreground">
                No talukas found.
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
            title={row.taluka}
            subtitle={row.district} // Show District as subtitle
            fields={[{ label: "ID", value: row.name }]}
            onClick={() => handleCardClick(row.name)}
          />
        ))
      ) : (
        <p className="col-span-full text-center py-8 text-muted-foreground">No talukas found.</p>
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
          <h2 className="text-2xl font-bold">Taluka</h2>
          <p className="text-muted-foreground">Manage Talukas</p>
        </div>
        <Link href="/lis-management/doctype/taluka/new" passHref>
          <button className="btn btn--primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Taluka
          </button>
        </Link>
      </div>

      <div className="flex justify-between items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search Taluka..."
            className="form-control pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          className="btn btn--outline btn--sm w-10 h-10 p-0 flex items-center justify-center"
          onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
        >
          {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
        </button>
      </div>

      {view === "grid" ? renderGridView() : renderListView()}
    </div>
  );
}