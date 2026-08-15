"use client";

import { useState } from "react";

/**
 * Bloc « Effectifs & CA officiels » (page Suivi → Enrichissement) : par SIREN,
 * Revold propose la tranche d'effectif officielle (URSSAF/INSEE, datée) et le
 * dernier CA déposé à l'INPI — l'utilisateur valide, puis écriture chez Revold
 * ET dans HubSpot (annualrevenue / numberofemployees).
 */

type Proposal = {
  companyId: string;
  name: string;
  siren: string;
  hubspotId: string | null;
  employeeRange: string | null;
  employeeYear: number | null;
  employeeMidpoint: number | null;
  revenue: number | null;
  revenueYear: number | null;
  currentEmployees: number | null;
  currentRevenue: number | null;
  lastEnrichedAt: string | null;
};

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export function CompanyFinancialsBlock() {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [scanned, setScanned] = useState<number | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ applied: number; pushedToHubspot: number } | null>(null);

  async function analyze() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/enrichment/financials");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Analyse impossible");
      const props = (d.proposals ?? []) as Proposal[];
      setScanned(typeof d.scanned === "number" ? d.scanned : props.length);
      setProposals(props);
      // Match par SIREN = déterministe → tout est pré-coché.
      setSelected(new Set(props.map((p) => p.companyId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (applying || !proposals) return;
    const items = proposals
      .filter((p) => selected.has(p.companyId))
      .map((p) => ({
        companyId: p.companyId,
        employeeRange: p.employeeRange,
        employeeYear: p.employeeYear,
        employeeMidpoint: p.employeeMidpoint,
        revenue: p.revenue,
        revenueYear: p.revenueYear,
      }));
    if (items.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/enrichment/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Application impossible");
      setResult({ applied: d.applied ?? 0, pushedToHubspot: d.pushedToHubspot ?? 0 });
      setProposals((prev) => (prev ?? []).filter((p) => !selected.has(p.companyId)));
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setApplying(false);
    }
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-slate-50/60 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">📈 Effectifs & chiffre d&apos;affaires officiels</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Par SIREN : tranche d&apos;effectif officielle (URSSAF/INSEE) et dernier CA déposé à l&apos;INPI. Tu valides —
            Revold met à jour ses données ET les propriétés HubSpot (CA annuel, effectif). Données évolutives :
            relance l&apos;analyse régulièrement, les plus anciennes passent en premier.
          </p>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
        >
          {loading ? "Consultation Sirene/INPI…" : proposals ? "Relancer l'analyse" : "Analyser mes entreprises"}
        </button>
      </div>

      <div className="p-4">
        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
        {result && (
          <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            ✓ {result.applied} entreprise{result.applied > 1 ? "s" : ""} mise{result.applied > 1 ? "s" : ""} à jour
            {result.pushedToHubspot > 0 && <> — dont {result.pushedToHubspot} poussée{result.pushedToHubspot > 1 ? "s" : ""} dans HubSpot (CA annuel + effectif)</>}.
          </p>
        )}

        {proposals === null && !loading && (
          <p className="text-xs text-slate-400">
            Lance l&apos;analyse : Revold consulte les données officielles des entreprises AVEC SIREN (par lot de 20,
            jamais enrichies puis plus anciennes d&apos;abord). Rien n&apos;est écrit sans ta validation.
          </p>
        )}

        {proposals !== null && proposals.length === 0 && (
          <p className="text-xs text-slate-500">
            {scanned === 0
              ? "Aucune entreprise avec SIREN — commence par l'enrichissement des identifiants ci-dessus."
              : "Aucune donnée officielle disponible sur ce lot (effectif non déclaré, comptes déposés en confidentialité)."}
          </p>
        )}

        {proposals !== null && proposals.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="w-8 px-2.5 py-2" />
                    <th className="px-2.5 py-2 font-semibold">Entreprise</th>
                    <th className="px-2.5 py-2 font-semibold">Effectif officiel</th>
                    <th className="px-2.5 py-2 font-semibold">Effectif CRM</th>
                    <th className="px-2.5 py-2 font-semibold">CA officiel (INPI)</th>
                    <th className="px-2.5 py-2 font-semibold">CA CRM</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => (
                    <tr key={p.companyId} className="border-b border-slate-100 transition last:border-0 hover:bg-indigo-50/40">
                      <td className="px-2.5 py-2">
                        <input type="checkbox" checked={selected.has(p.companyId)} onChange={() => toggle(p.companyId)} className="accent-[var(--accent)]" />
                      </td>
                      <td className="px-2.5 py-2 font-medium text-slate-800">
                        {p.name}
                        <span className="ml-1.5 text-[10px] tabular-nums text-slate-400">{p.siren}</span>
                      </td>
                      <td className="px-2.5 py-2 text-slate-900">
                        {p.employeeRange ?? "—"}
                        {p.employeeYear && <span className="ml-1 text-[10px] text-slate-400">({p.employeeYear})</span>}
                      </td>
                      <td className="px-2.5 py-2 tabular-nums text-slate-500">{p.currentEmployees ?? "—"}</td>
                      <td className="px-2.5 py-2 tabular-nums text-slate-900">
                        {p.revenue != null ? eur(p.revenue) : <span className="text-slate-400">confidentiel</span>}
                        {p.revenueYear && <span className="ml-1 text-[10px] text-slate-400">(ex. {p.revenueYear})</span>}
                      </td>
                      <td className="px-2.5 py-2 tabular-nums text-slate-500">{p.currentRevenue != null ? eur(p.currentRevenue) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400">
                {selected.size} sélectionnée{selected.size > 1 ? "s" : ""} sur {proposals.length} — l&apos;effectif HubSpot reçoit
                la valeur représentative de la tranche officielle ; un CA « confidentiel » (comptes non publiés) n&apos;écrase jamais le CRM.
              </p>
              <button
                onClick={apply}
                disabled={applying || selected.size === 0}
                className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
              >
                {applying ? "Application…" : "✓ Appliquer la sélection (Revold + HubSpot)"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
