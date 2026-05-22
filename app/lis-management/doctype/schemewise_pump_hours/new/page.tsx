"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { LinkField } from "@/components/LinkField";
import { PumpHoursPivotTable, PumpHourRow } from "@/components/PumpHoursPivotTable";
import { ChevronLeft, Loader2, Save } from "lucide-react";

const API_BASE = "http://103.219.1.138:4412/api/resource";
const DOCTYPE = "Schemewise Pump Hours";
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function NewSchemewisePumpHoursPage() {
  const router = useRouter();
  const { apiKey, apiSecret } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);
  const [pumpHoursFlat, setPumpHoursFlat] = React.useState<Omit<PumpHourRow,"name">[]>([]);

  const { control, watch, register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { lis_name: "", stage: "", year: "", month: "" },
  });

  const lisName = watch("lis_name");
  const stage = watch("stage");
  const month = watch("month");
  const year = watch("year");

  const onSubmit = async (data: any) => {
    if (!data.lis_name || !data.stage || !data.year || !data.month) {
      toast.error("Please fill all required fields.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        doctype: DOCTYPE,
        lis_name: data.lis_name,
        stage: data.stage,
        year: data.year,
        month: data.month,
        pump_hours: pumpHoursFlat.map((r) => ({ pump: r.pump, reading_date: r.reading_date, hours: Number(r.hours) || 0 })),
      };
      const headers: HeadersInit = { "Content-Type": "application/json", Authorization: `token ${apiKey}:${apiSecret}` };
      const resp = await fetch(`${API_BASE}/${DOCTYPE}`, { method: "POST", headers, credentials: "include", body: JSON.stringify(payload) });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.exception || json._server_messages || "Failed to create");
      toast.success("Schemewise Pump Hours created!");
      router.push(`/lis-management/doctype/schemewise_pump_hours/${encodeURIComponent(json.data.name)}`);
    } catch (e: any) {
      toast.error("Failed to create", { description: e.message, duration: Infinity });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => router.back()}>
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>New Schemewise Pump Hours</h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>Create a new monthly pump hours record</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn--secondary" onClick={() => router.back()}>Cancel</button>
          <button type="submit" form="new-schemewise-pump-hours-form" className="btn btn--primary" disabled={isSaving}>
            {isSaving ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : <Save style={{ width: 16, height: 16 }} />}
            &nbsp;{isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <form id="new-schemewise-pump-hours-form" onSubmit={handleSubmit(onSubmit)}>
        {/* Fields Card */}
        <div className="form-panel" style={{ marginBottom: "1.5rem" }}>
          <div className="form-panel__body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
              {/* LIS Name */}
              <LinkField
                control={control}
                field={{ name: "lis_name", label: "LIS Name", type: "Link", linkTarget: "Lift Irrigation Scheme", required: true, defaultValue: "" }}
                error={errors.lis_name}
              />
              {/* Stage */}
              <LinkField
                control={control}
                field={{ name: "stage", label: "Stage", type: "Link", linkTarget: "Stage No", required: true, defaultValue: "" }}
                error={errors.stage}
                filters={lisName ? { lis_name: lisName } : {}}
              />
              {/* Year */}
              <LinkField
                control={control}
                field={{ name: "year", label: "Year", type: "Link", linkTarget: "Year", required: true, defaultValue: "" }}
                error={errors.year}
              />
              {/* Month */}
              <div className="form-group">
                <label className="form-label">Month <span className="text-red-500">*</span></label>
                <select className="form-control" {...register("month", { required: "Month is required" })}>
                  <option value="">Select Month</option>
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {errors.month && <div className="text-red-500 text-xs mt-1">{String(errors.month.message)}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Pivot Table Card */}
        <div className="form-panel" style={{ marginBottom: "1.5rem" }}>
          <div className="form-panel__header" style={{ padding: "0.9rem 1.2rem", borderBottom: "1px solid var(--color-border)" }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Pump Hours Matrix</h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>Enter hours for each pump per date</p>
          </div>
          <div className="form-panel__body" style={{ padding: "1rem" }}>
            <PumpHoursPivotTable
              lisName={lisName}
              stage={stage}
              month={month}
              year={year}
              onChange={setPumpHoursFlat}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
