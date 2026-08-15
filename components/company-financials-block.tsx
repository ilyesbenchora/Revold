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
  siren: string | null;
  hubspotId: string | null;
  /** siren = clé stockée (déterministe) · name = trouvée par le nom (SIREN non stocké). */
  matchedVia: "siren" | "name";
  confidence: "high" | "medium";
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
      // Périmètre : uniquement les entreprises SANS SIREN — celles qui en ont
      // un sont déjà traitées automatiquement par « Enrichir toute ma base ».
      const res = await fetch("/api/enrichment/financials?scope=no_siren");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Analyse impossible");
      const props = (d.proposals ?? []) as Proposal[];
      setScanned(typeof d.scanned === "number" ? d.scanned : props.length);
      setProposals(props);
      // Pré-cochage : SIREN stocké ou nom exact (déterministe) ; les
      // correspondances de nom « plausibles » se cochent à la main.
      setSelected(new Set(props.filter((p) => p.confidence === "high").map((p) => p.companyId)));
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
          <h3 className="text-sm font-semibold text-slate-900">📈 Effectifs & CA — entreprises sans SIREN</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Complément ciblé : les entreprises <span className="font-medium text-slate-600">sans SIREN</span> (celles
            qui en ont un sont déjà traitées automatiquement ci-dessus). Recherche{" "}
            <span className="font-medium text-slate-600">par le nom — le SIREN trouvé n&apos;est jamais stocké</span>,
            seuls l&apos;effectif officiel (URSSAF/INSEE) et le CA déposé (INPI) sont écrits, chez Revold et dans HubSpot.
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
            Lance l&apos;analyse : Revold cherche les données officielles des entreprises sans SIREN, par leur nom
            (lot de 20, jamais enrichies puis plus anciennes d&apos;abord). Rien n&apos;est écrit sans ta validation.
          </p>
        )}

        {proposals !== null && proposals.length === 0 && (
          <p className="text-xs text-slate-500">
            {scanned === 0
              ? "Toutes tes entreprises ont un SIREN — leurs effectifs et CA sont enrichis automatiquement par « Enrichir toute ma base ». 🎉"
              : "Aucune donnée officielle disponible sur ce lot (effectif non déclaré, comptes déposés en confidentialité, ou entreprise introuvable par son nom)."}
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
                        {p.matchedVia === "siren" ? (
                          <span className="ml-1.5 text-[10px] tabular-nums text-slate-400">{p.siren}</span>
                        ) : (
                          <span
                            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                              p.confidence === "high" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-700"
                            }`}
                            title="Trouvée par le nom — le SIREN n'est pas stocké dans ta base"
                          >
                            {p.confidence === "high" ? "via nom" : "via nom · à vérifier"}
                          </span>
                        )}
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
