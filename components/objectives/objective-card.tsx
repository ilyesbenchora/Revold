"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertDeadline } from "@/components/agents/alert-deadline";
import { isSoon } from "@/lib/alerts/deadline";
import { ANALYSIS_SUGGESTIONS } from "@/lib/ai/agents/analysis-suggestions";

export type Objective = {
  id: string;
  title: string;
  description: string | null;
  impact: string | null;
  category: string | null;
  forecast_type: string | null;
  target: number | null;
  unit_mode: string | null;
  direction: string | null;
  current_value: number | null;
  date_from: string | null;
  date_to: string | null;
  created_at: string | null;
  /** Valeur actuelle calculée côté serveur (si forecast_type). */
  computedValue?: number | null;
};

const CAT_LABEL: Record<string, string> = {
  sales: "Ventes", commercial: "Ventes", revops: "RevOps", marketing: "Marketing", finance: "Finance", csm: "Service client",
};

// Objectif → agent le plus pertinent + catégorie de suggestions d'analyse.
function planFor(category: string | null): { agentKey: string; sugCat: string } {
  switch (category) {
    case "finance": return { agentKey: "paiement-facturation", sugCat: "billing" };
    case "csm": return { agentKey: "service-client", sugCat: "support" };
    case "marketing": return { agentKey: "performance", sugCat: "crm" };
    default: return { agentKey: "performance", sugCat: "crm" };
  }
}

function unitStr(u: string | null): string {
  return u === "count" ? "" : u === "currency" ? " €" : " %";
}
function fmtNum(n: number | null): string {
  return n == null ? "—" : Math.round(n).toLocaleString("fr-FR");
}

export function ObjectiveCard({ objective }: { objective: Objective }) {
  const router = useRouter();
  const o = objective;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(o.title);
  const [target, setTarget] = useState(o.target != null ? String(o.target) : "");
  const [unit, setUnit] = useState<"percent" | "currency" | "count">(
    o.unit_mode === "count" ? "count" : o.unit_mode === "currency" ? "currency" : "percent",
  );
  const [direction, setDirection] = useState<"above" | "below">(o.direction === "below" ? "below" : "above");
  const [current, setCurrent] = useState(o.current_value != null ? String(o.current_value) : "");
  const [dateFrom, setDateFrom] = useState(o.date_from ?? "");
  const [dateTo, setDateTo] = useState(o.date_to ?? "");
  const [description, setDescription] = useState(o.description ?? "");
  const [impact, setImpact] = useState(o.impact ?? "");
  const [showPlan, setShowPlan] = useState(isSoon(o.date_to, 14));
  const [planText, setPlanText] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  async function generatePlan() {
    setPlanLoading(true);
    try {
      const res = await fetch(`/api/objectives/${o.id}/plan`, { method: "POST" });
      const data = await res.json();
      setPlanText(res.ok ? data.plan : `⚠ ${data.error ?? "Échec de génération"}`);
    } catch {
      setPlanText("⚠ Erreur réseau.");
    } finally {
      setPlanLoading(false);
    }
  }

  const cur = o.computedValue ?? o.current_value ?? null;
  const tgt = o.target ?? null;
  let pct = 0;
  if (tgt != null && cur != null && tgt !== 0) {
    pct = direction === "above" ? (cur / tgt) * 100 : cur > 0 ? (tgt / cur) * 100 : 100;
  }
  pct = Math.max(0, Math.min(100, Math.round(pct)));
  const reached = pct >= 100;
  const soon = isSoon(o.date_to, 14);
  const plan = planFor(o.category);
  const suggestions = (ANALYSIS_SUGGESTIONS[plan.sugCat] ?? []).slice(0, 4);

  async function save() {
    setBusy(true);
    try {
      await fetch(`/api/objectives/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          target: target ? Number(target) : null,
          unit_mode: unit,
          direction,
          current_value: o.forecast_type ? undefined : current ? Number(current) : null,
          date_from: dateFrom || null,
          date_to: dateTo || null,
          description,
          impact,
        }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm("Supprimer cet objectif ?")) return;
    setBusy(true);
    try {
      await fetch(`/api/objectives/${o.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
  const lbl = "text-[10px] font-semibold uppercase tracking-wide text-slate-400";

  return (
    <div className={`card p-4 ${soon && !reached ? "ring-1 ring-amber-200" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
          🎯 Objectif
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {CAT_LABEL[o.category ?? ""] ?? "Général"}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2.5">
          <div><label className={lbl}>Objectif</label><input value={title} onChange={(e) => setTitle(e.target.value)} className={field} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={lbl}>Cible</label><input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className={field} placeholder="Ex : 200000" /></div>
            <div>
              <label className={lbl}>Unité</label>
              <div className="mt-0.5 flex overflow-hidden rounded-lg border border-slate-200">
                {(["percent", "currency", "count"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setUnit(f)} className={`flex-1 py-1.5 text-xs font-medium transition ${unit === f ? "bg-accent text-white" : "bg-white text-slate-500"}`}>
                    {f === "percent" ? "%" : f === "currency" ? "€" : "Nb"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {!o.forecast_type && (
            <div><label className={lbl}>Valeur actuelle (manuelle)</label><input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} className={field} /></div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className={lbl}>Début</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Échéance</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={field} /></div>
          </div>
          <div><label className={lbl}>Description</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={field} /></div>
          <div><label className={lbl}>Impact attendu</label><textarea rows={2} value={impact} onChange={(e) => setImpact(e.target.value)} className={field} /></div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={busy} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60">{busy ? "Enregistrement…" : "Enregistrer"}</button>
            <button onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Annuler</button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-slate-900">{o.title}</h3>
          {o.description && <p className="mt-0.5 text-sm text-slate-600">{o.description}</p>}

          {/* Barre de complétion */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">
                {fmtNum(cur)}{unitStr(o.unit_mode)} <span className="text-slate-400">/ {fmtNum(tgt)}{unitStr(o.unit_mode)}</span>
              </span>
              <span className={`font-semibold ${reached ? "text-emerald-600" : soon ? "text-amber-600" : "text-slate-700"}`}>{pct}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all ${reached ? "bg-emerald-500" : soon ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
            </div>
            {o.forecast_type && <p className="mt-1 text-[10px] text-slate-400">Suivi automatique (KPI temps réel).</p>}
          </div>

          <div className="mt-2.5"><AlertDeadline dateFrom={o.date_from} dateTo={o.date_to} /></div>

          {o.impact && <p className="mt-2 text-[11px] text-slate-500">💡 {o.impact}</p>}

          {/* Plan pour atteindre l'objectif — mis en avant à l'approche de l'échéance */}
          <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-2.5">
            <button onClick={() => setShowPlan((v) => !v)} className="flex w-full items-center justify-between text-left">
              <span className="text-[11px] font-semibold text-indigo-700">
                {soon ? "⚡ Plan d'action — échéance proche" : "Plan pour atteindre l'objectif"}
              </span>
              <span className="text-[10px] text-indigo-400">{showPlan ? "Réduire" : "Voir"}</span>
            </button>
            {showPlan && (
              <div className="mt-2 space-y-1.5">
                {/* Plan IA temps réel : diagnostic + leviers + actions, sur vrais chiffres */}
                <button
                  onClick={generatePlan}
                  disabled={planLoading}
                  className="w-full rounded-md bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-2.5 py-1.5 text-[12px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {planLoading ? "Génération du plan…" : planText ? "↻ Regénérer le plan IA" : "✨ Générer le plan IA (écart & leviers)"}
                </button>
                {planText && (
                  <div className="whitespace-pre-wrap rounded-md border border-indigo-100 bg-white px-2.5 py-2 text-[12px] leading-relaxed text-slate-700">
                    {planText}
                  </div>
                )}
                <p className="pt-1 text-[10px] text-slate-500">Analyses à lancer avec {plan.agentKey === "paiement-facturation" ? "Inès" : "l'agent"} pour piloter cet objectif :</p>
                {suggestions.map((s) => (
                  <Link key={s} href={`/dashboard/agents/${plan.agentKey}`} className="block rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50">
                    💡 {s} <span className="text-[10px] font-medium text-accent">→</span>
                  </Link>
                ))}
                <Link href={`/dashboard/agents/${plan.agentKey}`} className="inline-block pt-1 text-[11px] font-medium text-accent hover:underline">
                  Ouvrir l&apos;agent pour agir (actions exécutables) →
                </Link>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
            <button onClick={() => setEditing(true)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">Modifier</button>
            <button onClick={remove} disabled={busy} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-60">Supprimer</button>
          </div>
        </>
      )}
    </div>
  );
}
