"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrackingVerification, type TrackingProposal } from "@/components/tracking-verification";

const TEAMS = [
  { id: "sales", label: "Ventes" },
  { id: "marketing", label: "Marketing" },
  { id: "csm", label: "Service client" },
  { id: "finance", label: "Finance" },
  { id: "revops", label: "RevOps" },
];

// KPI auto-trackés proposés (optionnel) — sinon valeur actuelle manuelle.
const KPIS: { id: string; label: string; unit: "percent" | "currency" | "count" }[] = [
  { id: "", label: "Aucun (valeur actuelle manuelle)", unit: "currency" },
  { id: "revenue_won", label: "CA signé", unit: "currency" },
  { id: "deals_won_count", label: "Deals gagnés", unit: "count" },
  { id: "closing_rate", label: "Closing rate", unit: "percent" },
  { id: "pipeline_value", label: "Valeur pipeline", unit: "currency" },
  { id: "weighted_pipeline", label: "Forecast pondéré", unit: "currency" },
];

export function CreateObjectiveModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [team, setTeam] = useState("sales");
  const [forecast, setForecast] = useState("");
  const [unit, setUnit] = useState<"percent" | "currency" | "count">("currency");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [priority, setPriority] = useState<"faible" | "moyen" | "urgent">("moyen");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState("");
  // Étape « Vérification » : câblage proposé par l'agent + volumes par entité.
  const [proposal, setProposal] = useState<TrackingProposal | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [verifying, setVerifying] = useState(false);

  function reset() {
    setTitle(""); setTeam("sales"); setForecast(""); setUnit("currency"); setDirection("above");
    setTarget(""); setCurrent(""); setDateFrom(""); setDateTo(""); setPriority("moyen"); setDescription(""); setImpact("");
    setError(null);
    setProposal(null); setCounts({}); setVerifying(false);
  }

  /**
   * Étape Vérification SYSTÉMATIQUE (comme le funnel des tables de données) :
   *  - KPI catalogué → câblage connu, ré-évalué en DÉTERMINISTE (valeur réelle) ;
   *  - KPI libre → l'agent propose le câblage ;
   *  - `preferredEntity` (imposer une source) → re-câblage agent contraint ;
   *  - `adjustedSpec` (mesure/champ corrigés) → ré-évaluation déterministe.
   */
  async function requestPreview(preferredEntity?: string, adjustedSpec?: Record<string, unknown>) {
    if (verifying) return;
    setVerifying(true); setError(null);
    try {
      const res = await fetch("/api/tracking/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpi_text: title.trim() || KPIS.find((k) => k.id === forecast)?.label || "",
          description: description.trim() || undefined,
          team, category: team,
          value: target ? Number(target) : undefined,
          unit,
          // KPI catalogué : câblage déterministe (sauf re-câblage/ajustement manuel).
          forecast_type: !preferredEntity && !adjustedSpec && forecast ? forecast : undefined,
          entity: preferredEntity,
          agg_spec: adjustedSpec,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.counts) setCounts(d.counts);
      if (res.ok && d.resolution) setProposal(d.resolution);
      else setError(d.error ?? "Vérification impossible.");
    } catch {
      setError("Vérification impossible.");
    } finally {
      setVerifying(false);
    }
  }
  function pickKpi(id: string) {
    setForecast(id);
    setProposal(null);
    const k = KPIS.find((x) => x.id === id);
    if (k) setUnit(k.unit);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !target) { setError("Titre et cible requis."); return; }

    // Étape Vérification d'abord — TOUJOURS : le câblage (catalogué ou proposé
    // par l'agent) est affiché et validé avant la création.
    if (!proposal) { await requestPreview(); return; }

    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          team, category: team,
          // Câblage confirmé à l'écran (appliqué tel quel, sans re-passage agent).
          forecast_type: proposal?.forecast_type ?? (forecast || null),
          agg_spec: proposal?.agg_spec ?? null,
          recon_recipe: proposal?.recon_recipe ?? null,
          target: Number(target),
          unit_mode: unit,
          direction,
          current_value: forecast || proposal ? null : current ? Number(current) : null,
          date_from: dateFrom || null,
          date_to: dateTo || null,
          priority,
          description, impact,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Échec."); return; }
      setOpen(false); reset(); router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-0.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent";
  const lbl = "text-xs font-medium text-slate-600";

  return (
    <>
      <button onClick={() => { reset(); setOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-fuchsia-500/20 transition hover:from-fuchsia-500 hover:to-indigo-500 hover:shadow-md hover:shadow-fuchsia-500/30">
        Créer un objectif
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Nouvel objectif</h2>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

            <div><label className={lbl}>Objectif</label><input value={title} onChange={(e) => { setTitle(e.target.value); setProposal(null); }} placeholder="Ex : +200 k€ de CA signé au T3" className={field} /></div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Pôle</label>
                <select value={team} onChange={(e) => setTeam(e.target.value)} className={field}>
                  {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Suivi (KPI auto)</label>
                <select value={forecast} onChange={(e) => pickKpi(e.target.value)} className={field}>
                  {KPIS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>Cible</label><input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="200000" className={field} /></div>
              <div>
                <label className={lbl}>Unité</label>
                <div className="mt-0.5 flex overflow-hidden rounded-lg border border-slate-200">
                  {(["percent", "currency", "count"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setUnit(f)} className={`flex-1 py-2 text-xs font-medium ${unit === f ? "bg-accent text-white" : "bg-white text-slate-500"}`}>{f === "percent" ? "%" : f === "currency" ? "€" : "Nb"}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={lbl}>Sens</label>
                <div className="mt-0.5 flex overflow-hidden rounded-lg border border-slate-200">
                  {(["above", "below"] as const).map((d) => (
                    <button key={d} type="button" onClick={() => setDirection(d)} className={`flex-1 py-2 text-xs font-medium ${direction === d ? "bg-accent text-white" : "bg-white text-slate-500"}`}>{d === "above" ? "↑" : "↓"}</button>
                  ))}
                </div>
              </div>
            </div>

            {!forecast && (
              <div><label className={lbl}>Valeur actuelle (manuelle)</label><input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} className={field} /></div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Début</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={field} /></div>
              <div><label className={lbl}>Échéance</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={field} /></div>
            </div>

            <div>
              <label className={lbl}>Priorité de l&apos;objectif</label>
              <div className="mt-1 flex gap-2">
                {([
                  { id: "faible", label: "Faible", color: "bg-slate-200 text-slate-700" },
                  { id: "moyen", label: "Moyen", color: "bg-amber-100 text-amber-700" },
                  { id: "urgent", label: "Urgent", color: "bg-red-100 text-red-700" },
                ] as const).map((p) => (
                  <button key={p.id} type="button" onClick={() => setPriority(p.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${priority === p.id ? p.color : "bg-white border border-slate-200 text-slate-500"}`}>{p.label}</button>
                ))}
              </div>
            </div>

            <div><label className={lbl}>Description</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Impact attendu</label><textarea rows={2} value={impact} onChange={(e) => setImpact(e.target.value)} className={field} /></div>

            {/* Étape « Vérification » : câblage affiché SYSTÉMATIQUEMENT avant création. */}
            {proposal && (
              <TrackingVerification
                proposal={proposal}
                counts={counts}
                loading={verifying}
                onPickEntity={(e) => requestPreview(e)}
                onAdjustSpec={(spec) => requestPreview(undefined, spec)}
              />
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Annuler</button>
              <button type="submit" disabled={busy || verifying} className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50">
                {verifying
                  ? "Vérification…"
                  : busy
                    ? "Création…"
                    : !proposal ? "Vérifier le câblage" : "Confirmer et créer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
