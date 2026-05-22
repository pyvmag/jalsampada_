"use client";

import * as React from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Loader2, AlertTriangle } from "lucide-react";

const FETCH_PUMPS_URL = "http://103.219.1.138:4412/api/method/quantlis_management.api.fetch_pumps";

const MONTH_TO_NUM: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

function getDatesForMonth(monthName: string, yearStr: string): Date[] {
  const m = MONTH_TO_NUM[monthName];
  const y = parseInt(yearStr, 10);
  if (!m || !y || isNaN(y)) return [];
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(y, m - 1, i + 1));
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export interface PumpHourRow {
  name?: string;
  pump: string;
  reading_date: string;
  hours: number;
  [key: string]: any;
}

type PivotData = Record<string, Record<string, string>>;
const EMPTY_PUMP_ROWS: PumpHourRow[] = [];

function flatToPivot(rows: PumpHourRow[]): PivotData {
  const p: PivotData = {};
  for (const r of rows) {
    if (!r.reading_date || !r.pump) continue;
    if (!p[r.reading_date]) p[r.reading_date] = {};
    p[r.reading_date][r.pump] = r.hours != null ? String(r.hours) : "";
  }
  return p;
}

function flatRowsForDates(rows: PumpHourRow[], validDates: Set<string>): PumpHourRow[] {
  return rows.filter((row) => row.reading_date && validDates.has(row.reading_date));
}

export function pivotToFlat(pivot: PivotData, pumpNames: string[]): Omit<PumpHourRow, "name">[] {
  const flat: Omit<PumpHourRow, "name">[] = [];
  for (const date in pivot) {
    for (const pump of pumpNames) {
      const val = pivot[date]?.[pump];
      if (val !== undefined && val !== "" && val !== null) {
        flat.push({ pump, reading_date: date, hours: parseFloat(val) || 0 });
      }
    }
  }
  return flat;
}

interface PumpInfo { name: string; label: string; }

interface Props {
  lisName: string;
  stage: string;
  month: string;
  year: string;
  existingData?: PumpHourRow[];
  onChange?: (flat: Omit<PumpHourRow, "name">[]) => void;
  readOnly?: boolean;
}

export function PumpHoursPivotTable({ lisName, stage, month, year, existingData = EMPTY_PUMP_ROWS, onChange, readOnly = false }: Props) {
  const { apiKey, apiSecret, isAuthenticated } = useAuth();
  const [pumps, setPumps] = React.useState<PumpInfo[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [pivot, setPivot] = React.useState<PivotData>({});
  const previousSelectionKey = React.useRef("");

  const dates = React.useMemo(() => getDatesForMonth(month, year), [month, year]);
  const dateKeys = React.useMemo(() => dates.map(fmtDate), [dates]);
  const dateKeySet = React.useMemo(() => new Set(dateKeys), [dateKeys]);
  const selectionKey = `${lisName}__${stage}__${month}__${year}`;
  const existingDataSignature = React.useMemo(
    () => existingData.map((row) => `${row.reading_date}|${row.pump}|${row.hours ?? ""}`).join("||"),
    [existingData]
  );

  // Fetch pumps when LIS + Stage change
  React.useEffect(() => {
    if (!lisName || !stage || !isAuthenticated || !apiKey) { setPumps([]); return; }
    setLoading(true);
    setFetchError(null);
    axios.get(FETCH_PUMPS_URL, {
      params: { lis_name: lisName, stage },
      headers: { Authorization: `token ${apiKey}:${apiSecret}` },
      withCredentials: true,
    }).then((resp) => {
      const raw = resp.data?.message ?? resp.data?.data ?? resp.data ?? [];
      const arr: PumpInfo[] = Array.isArray(raw) ? raw.map((p: any) => {
        if (typeof p === "string") return { name: p, label: p };
        const nm = p.value ?? p.name ?? p.pump ?? p.asset_name ?? p.asset ?? "";
        const lb = p.label ?? p.asset_name ?? p.pump_name ?? p.name ?? nm;
        return { name: nm, label: lb };
      }).filter((p) => p.name) : [];
      setPumps(arr);
    }).catch((e) => {
      console.error("fetch_pumps error", e);
      setFetchError("Failed to fetch pumps from server.");
      setPumps([]);
    }).finally(() => setLoading(false));
  }, [lisName, stage, isAuthenticated, apiKey, apiSecret]);

  // Keep the matrix scoped to the selected LIS, stage, month and year.
  React.useEffect(() => {
    const scopedRows = flatRowsForDates(existingData, dateKeySet);
    setPivot(flatToPivot(scopedRows));

    if (previousSelectionKey.current && previousSelectionKey.current !== selectionKey) {
      onChange?.(
        scopedRows.map((row) => ({
          pump: row.pump,
          reading_date: row.reading_date,
          hours: Number(row.hours) || 0,
        }))
      );
    }

    previousSelectionKey.current = selectionKey;
  }, [selectionKey, existingDataSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCell = (date: string, pump: string, val: string) => {
    setPivot((prev) => {
      const next = { ...prev, [date]: { ...(prev[date] || {}), [pump]: val } };
      if (onChange && pumps.length > 0) {
        onChange(pivotToFlat(next, pumps.map((p) => p.name)));
      }
      return next;
    });
  };

  if (!lisName || !stage) return <HintBox text="Select LIS Name and Stage to load the pump hours matrix." />;
  if (!month || !year) return <HintBox text="Select Month and Year to view the date-wise matrix." />;
  if (loading) return <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "1rem", color: "#64748b", fontSize: "0.875rem" }}><Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> Fetching pumps…</div>;
  if (fetchError) return <HintBox text={fetchError} variant="error" />;
  if (pumps.length === 0) return <HintBox text="No pumps found for the selected LIS and Stage." variant="warn" />;

  return (
    <div className="stock-table-container" style={{ overflowX: "auto" }}>
      <table className="stock-table" style={{ minWidth: `${150 + pumps.length * 130}px` }}>
        <thead>
          <tr>
            <th style={stickyHead}>Date</th>
            {pumps.map((p) => (
              <th key={p.name} title={p.name} style={pumpHead}>
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((d) => {
            const dateStr = fmtDate(d);
            const isSun = d.getDay() === 0;
            const rowBg = isSun ? "#fff8f0" : "var(--color-surface,#fff)";
            return (
              <tr key={dateStr} style={{ background: isSun ? "#fff8f0" : undefined }}>
                <td style={{ ...stickyCell, background: rowBg }}>
                  <span style={{ fontWeight: 600 }}>{String(d.getDate()).padStart(2, "0")} {month.slice(0, 3)}</span>
                  {" "}<span style={{ color: isSun ? "#ef4444" : "#94a3b8", fontSize: "0.75rem" }}>
                    ({d.toLocaleDateString("en-IN", { weekday: "short" })})
                  </span>
                </td>
                {pumps.map((p) => (
                  <td key={p.name} style={{ textAlign: "center", padding: "3px 6px" }}>
                    <input
                      type="number" step="0.01" min="0"
                      placeholder="—"
                      value={pivot[dateStr]?.[p.name] ?? ""}
                      onChange={(e) => handleCell(dateStr, p.name, e.target.value)}
                      disabled={readOnly}
                      style={{ width: "100%", textAlign: "center", fontSize: "0.875rem", padding: "5px 4px", borderRadius: 6, border: "1px solid transparent", background: "transparent", transition: "all 0.15s", cursor: readOnly ? "default" : "text" }}
                      onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.background = "#eff6ff"; }}
                      onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function HintBox({ text, variant = "info" }: { text: string; variant?: "info" | "error" | "warn" }) {
  const colors = {
    info:  { bg: "#f8fafc", border: "#cbd5e1", color: "#64748b" },
    error: { bg: "#fef2f2", border: "#fca5a5", color: "#dc2626" },
    warn:  { bg: "#fffbeb", border: "#fbbf24", color: "#92400e" },
  }[variant];
  return (
    <div style={{ padding: "0.9rem 1.2rem", background: colors.bg, borderRadius: 8, border: `1.5px dashed ${colors.border}`, color: colors.color, fontSize: "0.875rem" }}>
      {variant === "error" && <AlertTriangle style={{ width: 14, height: 14, display: "inline", marginRight: 6 }} />}
      <span dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  );
}

const stickyHead: React.CSSProperties = {
  position: "sticky",
  left: 0,
  top: 0,
  zIndex: 20,
  background: "#3683f6",
  color: "#fff",
  minWidth: 140,
  fontWeight: 700,
  textAlign: "center",
  padding: "10px 16px",
  borderRight: "1px solid var(--color-border, #e5e7eb)",
  whiteSpace: "nowrap",
};

const pumpHead: React.CSSProperties = {
  minWidth: 130,
  textAlign: "center",
  padding: "10px 8px",
  fontWeight: 600,
  fontSize: "0.9rem",
  color: "#fff",
  background: "#3683f6",
  whiteSpace: "nowrap",
};

const stickyCell: React.CSSProperties = {
  position: "sticky", left: 0, zIndex: 5,
  fontWeight: 500, fontSize: "0.82rem", textAlign: "center",
  padding: "6px 12px", borderRight: "1px solid var(--color-border, #e5e7eb)", whiteSpace: "nowrap",
};
