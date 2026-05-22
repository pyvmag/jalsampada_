"use client";

import * as React from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { LinkField } from "@/components/LinkField";
import { PumpHoursPivotTable, PumpHourRow } from "@/components/PumpHoursPivotTable";
import DocumentActivity from "@/components/DocumentActivity";
import { ChevronLeft, Loader2, Save, XCircle } from "lucide-react";
import { getApiMessages } from "@/lib/utils";

const API_BASE = "http://103.219.1.138:4412/api/resource";
const DOCTYPE = "Schemewise Pump Hours";
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface SPHRecord {
  name: string;
  lis_name?: string;
  stage?: string;
  year?: string;
  month?: string;
  pump_hours?: PumpHourRow[];
  docstatus: 0 | 1 | 2;
  modified: string;
  owner?: string;
  modified_by?: string;
}

export default function SchemewisePumpHoursDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
  const docname = params.id as string;

  const [record, setRecord] = React.useState<SPHRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [pumpHoursFlat, setPumpHoursFlat] = React.useState<Omit<PumpHourRow, "name">[]>([]);
  const [pivotKey, setPivotKey] = React.useState(0); // force re-mount on load

  const { control, watch, register, reset, formState: { errors, isDirty } } = useForm({
    defaultValues: { lis_name: "", stage: "", year: "", month: "" },
  });

  const lisName = watch("lis_name");
  const stage = watch("stage");
  const month = watch("month");
  const year = watch("year");

  // ── Fetch record ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isInitialized || !isAuthenticated || !apiKey || !docname) { setLoading(false); return; }
    setLoading(true);
    axios.get(`${API_BASE}/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(docname)}`, {
      headers: { Authorization: `token ${apiKey}:${apiSecret}` },
      withCredentials: true,
    }).then((resp) => {
      const data: SPHRecord = resp.data.data;
      setRecord(data);
      reset({ lis_name: data.lis_name || "", stage: data.stage || "", year: data.year || "", month: data.month || "" });
      if (data.pump_hours?.length) {
        setPumpHoursFlat(data.pump_hours.map((r) => ({ pump: r.pump, reading_date: r.reading_date, hours: r.hours })));
        setPivotKey((k) => k + 1);
      }
    }).catch((e) => {
      const msg = getApiMessages(null, e, "", "Failed to load record");
      setFetchError(msg.description || msg.message);
    }).finally(() => setLoading(false));
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  const isReadOnly = record?.docstatus !== 0;

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async (data: any) => {
    if (!record) return;
    setIsSaving(true);
    try {
      const payload = {
        lis_name: data.lis_name,
        stage: data.stage,
        year: data.year,
        month: data.month,
        pump_hours: pumpHoursFlat.map((r) => ({ pump: r.pump, reading_date: r.reading_date, hours: Number(r.hours) || 0 })),
        modified: record.modified,
        docstatus: record.docstatus,
      };
      const resp = await axios.put(
        `${API_BASE}/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(docname)}`,
        payload,
        { headers: { Authorization: `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" }, withCredentials: true }
      );
      const updated: SPHRecord = resp.data.data;
      setRecord(updated);
      if (updated.pump_hours?.length) {
        setPumpHoursFlat(updated.pump_hours.map((r) => ({ pump: r.pump, reading_date: r.reading_date, hours: r.hours })));
        setPivotKey((k) => k + 1);
      }
      toast.success("Changes saved!");
    } catch (e: any) {
      const msg = getApiMessages(null, e, "", "Failed to save");
      toast.error(msg.message, { description: msg.description, duration: Infinity });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmitDoc = async () => {
    if (!record) return;
    setIsSaving(true);
    try {
      const resp = await axios.put(
        `${API_BASE}/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(docname)}`,
        { ...record, docstatus: 1 },
        { headers: { Authorization: `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" } }
      );
      setRecord(resp.data.data);
      toast.success("Document submitted!");
    } catch (e: any) {
      toast.error("Submit failed", { description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Cancel doc ────────────────────────────────────────────────────────────────
  const handleCancelDoc = async () => {
    if (!record || !window.confirm("Cancel this document? This cannot be undone.")) return;
    setIsSaving(true);
    try {
      const resp = await axios.put(
        `${API_BASE}/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(docname)}`,
        { docstatus: 2, modified: record.modified },
        { headers: { Authorization: `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" } }
      );
      setRecord(resp.data.data);
      toast.success("Document cancelled.");
    } catch (e: any) {
      toast.error("Cancel failed", { description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete ${docname}?`)) return;
    try {
      await axios.delete(`${API_BASE}/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(docname)}`, {
        headers: { Authorization: `token ${apiKey}:${apiSecret}` },
      });
      toast.success("Deleted.");
      router.push("/lis-management/doctype/schemewise_pump_hours");
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    }
  };

  // ── UI guards ─────────────────────────────────────────────────────────────────
  if (loading) return <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>Loading…</div>;
  if (fetchError) return (
    <div className="module active" style={{ padding: "2rem" }}>
      <p style={{ color: "var(--color-error)" }}>{fetchError}</p>
      <button className="btn btn--primary" onClick={() => window.location.reload()}>Retry</button>
    </div>
  );
  if (!record) return <div className="module active" style={{ padding: "2rem" }}>Record not found.</div>;

  const isDraft = record.docstatus === 0;
  const isSubmitted = record.docstatus === 1;
  const isCancelled = record.docstatus === 2;

  const statusBadge = isDraft
    ? { label: "Draft", color: "#f59e0b", bg: "#fffbeb" }
    : isSubmitted
    ? { label: "Submitted", color: "#10b981", bg: "#ecfdf5" }
    : { label: "Cancelled", color: "#ef4444", bg: "#fef2f2" };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => router.back()}>
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{DOCTYPE}: {record.name}</h2>
              <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: statusBadge.bg, color: statusBadge.color, border: `1px solid ${statusBadge.color}30` }}>
                {statusBadge.label}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>Last modified: {record.modified}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isDraft && (
            <>
              <button type="button" className="btn btn--secondary" onClick={handleDelete} style={{ color: "#ef4444" }}>Delete</button>
              <button type="button" className="btn btn--primary" onClick={() => document.getElementById("sph-save-btn")?.click()} disabled={isSaving}>
                {isSaving ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : <Save style={{ width: 16, height: 16 }} />}
                &nbsp;Save
              </button>
            </>
          )}
          {isSubmitted && (
            <button type="button" className="btn btn--secondary" onClick={handleCancelDoc} disabled={isSaving} style={{ color: "#ef4444" }}>
              <XCircle style={{ width: 16, height: 16 }} /> &nbsp;Cancel
            </button>
          )}
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); const data = { lis_name: lisName, stage, year, month }; handleSave(data); }}>
        <button id="sph-save-btn" type="submit" style={{ display: "none" }} />

        {/* Fields Card */}
        <div className="form-panel" style={{ marginBottom: "1.5rem" }}>
          <div className="form-panel__body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
              <LinkField control={control} field={{ name: "lis_name", label: "LIS Name", type: "Link", linkTarget: "Lift Irrigation Scheme", required: true, defaultValue: record.lis_name || "" }} error={errors.lis_name} disabled={isReadOnly} />
              <LinkField control={control} field={{ name: "stage", label: "Stage", type: "Link", linkTarget: "Stage No", required: true, defaultValue: record.stage || "" }} error={errors.stage} filters={lisName ? { lis_name: lisName } : {}} disabled={isReadOnly} />
              <LinkField control={control} field={{ name: "year", label: "Year", type: "Link", linkTarget: "Year", required: true, defaultValue: record.year || "" }} error={errors.year} disabled={isReadOnly} />
              <div className="form-group">
                <label className="form-label">Month <span className="text-red-500">*</span></label>
                <select className="form-control" {...register("month", { required: true })} disabled={isReadOnly}>
                  <option value="">Select Month</option>
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Pivot Table Card */}
        <div className="form-panel" style={{ marginBottom: "1.5rem" }}>
          <div className="form-panel__header" style={{ padding: "0.9rem 1.2rem" }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Pump Hours Matrix</h3>
          
          </div>
          <div className="form-panel__body" style={{ padding: "0rem" }}>
            <PumpHoursPivotTable
              key={`${record.name}-${pivotKey}-${lisName}-${stage}-${month}-${year}`}
              lisName={lisName || record.lis_name || ""}
              stage={stage || record.stage || ""}
              month={month || record.month || ""}
              year={year || record.year || ""}
              existingData={record.pump_hours}
              onChange={setPumpHoursFlat}
              readOnly={isReadOnly}
            />
          </div>
        </div>
      </form>

      {/* Document Activity */}
      <DocumentActivity
        doctype={DOCTYPE}
        docname={docname}
        baseUrl="http://103.219.1.138:4412"
        apiKey={apiKey || ""}
        apiSecret={apiSecret || ""}
        isInitialized={isInitialized}
        currentUserEmail={record.owner}
        modifiedStr={record.modified}
        modifiedBy={record.modified_by}
      />
    </div>
  );
}
