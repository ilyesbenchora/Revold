"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertBody, ALERT_CHANNELS, useAvailableChannels } from "./alert-ui";
import { AlertDeadline } from "./alert-deadline";
import { TrackingBadge } from "./tracking-badge";
import type { AggSpec } from "@/lib/alerts/agg-value";

const TYPE_LABELS: Record<string, string> = {
  sales: "Ventes",
  commercial: "Ventes",
  marketing: "Marketing",
  revops: "RevOps",
  finance: "Finance",
  csm: "Service client",
};

export type EditableAlert = {
  id: string;
  title: string;
  description: string | null;
  impact: string | null;
  category: string | null;
  threshold: number | null;
  unit_mode: string | null;
  date_from: string | null;
  date_to: string | null;
  created_at: string | null;
  notification_channels: string[] | null;
  forecast_type?: string | null;
  agg_spec?: AggSpec | null;
};


/** Carte d'alerte avec édition inline (dates, KPI/format, contenu, canaux) + suppression. */
export function EditableAlertCard({ alert, badge = "Alerte de suivi", dataReady }: { alert: EditableAlert; badge?: string; dataReady?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(alert.title);
  const [description, setDescription] = useState(alert.description ?? "");
  const [impact, setImpact] = useState(alert.impact ?? "");
  const [kpiValue, setKpiValue] = useState(alert.threshold != null ? String(alert.threshold) : "");
  const [kpiFormat, setKpiFormat] = useState<"percent" | "count" | "currency">(
    alert.unit_mode === "count" ? "count" : alert.unit_mode === "currency" ? "currency" : "percent",
  );
  const [dateFrom, setDateFrom] = useState(alert.date_from ?? "");
  const [dateTo, setDateTo] = useState(alert.date_to ?? "");
  const [continuous, setContinuous] = useState(!alert.date_to);
  const [channels, setChannels] = useState<string[]>(alert.notification_channels ?? []);
  const { available } = useAvailableChannels();

  function toggleChannel(k: string) {
    setChannels((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  }

  async function save() {
    setBusy(true);
    try {
      await fetch(`/api/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          impact,
          threshold: kpiValue ? Number(kpiValue) : null,
          unit_mode: kpiFormat,
          date_from: dateFrom || null,
          date_to: continuous ? null : dateTo || null,
          notification_channels: channels,
        }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/alerts/${alert.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100";
  const lbl = "text-[10px] font-semibold uppercase tracking-wide text-slate-400";

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-600">
          <span>✨</span> {badge}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {TYPE_LABELS[alert.category ?? ""] ?? "Suivi"}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2.5">
          <div>
            <label className={lbl}>Objectif</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>KPI attendu</label>
              <input type="number" value={kpiValue} onChange={(e) => setKpiValue(e.target.value)} className={field} placeholder="Ex : 30" />
            </div>
            <div>
              <label className={lbl}>Format</label>
              <div className="mt-0.5 flex overflow-hidden rounded-lg border border-slate-200">
                {(["percent", "count", "currency"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setKpiFormat(f)}
                    className={`flex-1 py-1.5 text-xs font-medium transition ${kpiFormat === f ? "bg-fuchsia-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                    {f === "percent" ? "%" : f === "currency" ? "€" : "Nombre"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className={lbl}>Période de suivi</label>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
              {!continuous && <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />}
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={continuous} onChange={(e) => setContinuous(e.target.checked)} /> En continu
              </label>
            </div>
          </div>
          <div>
            <label className={lbl}>Description</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
          </div>
          <div>
            <label className={lbl}>Impact attendu</label>
            <textarea rows={2} value={impact} onChange={(e) => setImpact(e.target.value)} className={field} />
          </div>
          <div>
            <label className={lbl}>Canaux de notification</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ALERT_CHANNELS.filter((c) => available.has(c.key)).map((c) => {
                const on = channels.includes(c.key);
                return (
                  <button key={c.key} type="button" onClick={() => toggleChannel(c.key)}
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition ${on ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                    <span>{c.icon}</span>{c.label}{on && <span className="text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={save} disabled={busy} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button onClick={() => setEditing(false)} disabled={busy} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          <AlertBody
            title={alert.title}
            description={alert.description ?? ""}
            impact={alert.impact}
            category={alert.category}
            channels={alert.notification_channels ?? undefined}
          />
          {alert.threshold != null && (
            <p className="mt-2 text-[11px] text-slate-400">🎯 KPI attendu : {alert.threshold}{alert.unit_mode === "count" ? "" : alert.unit_mode === "currency" ? " €" : " %"}</p>
          )}

          <div className="mt-2">
            <TrackingBadge forecastType={alert.forecast_type} aggSpec={alert.agg_spec} ready={dataReady} />
          </div>

          {/* Échéance en temps réel : début, fin (compte à rebours live) ou en continu */}
          <div className="mt-2.5">
            <AlertDeadline dateFrom={alert.date_from} dateTo={alert.date_to} />
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
            <button onClick={() => setEditing(true)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
              Modifier
            </button>
            <button onClick={remove} disabled={busy} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-60">
              Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  );
}
