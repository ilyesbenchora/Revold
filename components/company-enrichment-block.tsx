"use client";

import { useState } from "react";

/**
 * Bloc « Enrichissement Sirene » de la page Rapprochement données : Revold ne
 * constate plus les SIREN manquants, il les REMPLIT — SIREN, SIRET (siège),
 * N° TVA calculé et raison sociale officielle, proposés depuis la base Sirene
 * (gratuite) puis VALIDÉS par l'utilisateur avant écriture (Revold + HubSpot).
 */

type Proposal = {
  companyId: string;
  name: string;
  domain: string | null;
  hubspotId: string | null;
  siren: string;
  siret: string | null;
  vatNumber: string;
  legalName: string;
  confidence: "high" | "medium";
};

export function CompanyEnrichmentBlock() {
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
      const res = await fetch("/api/enrichment/companies");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Analyse impossible");
      const props = (d.proposals ?? []) as Proposal[];
      setScanned(typeof d.scanned === "number" ? d.scanned : props.length);
      setProposals(props);
      // Confiance haute pré-cochée ; les correspondances moyennes se cochent à la main.
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
      .map((p) => ({ companyId: p.companyId, siren: p.siren, siret: p.siret, legalName: p.legalName }));
    if (items.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/enrichment/companies", {
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
          <h3 className="text-sm font-semibold text-slate-900">✨ Enrichissement SIREN · SIRET · TVA (base Sirene)</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Revold remplit les identifiants manquants depuis la base officielle Sirene (gratuite), tu valides —
            puis il écrit chez Revold ET dans HubSpot (propriétés mappées).
          </p>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
        >
          {loading ? "Recherche Sirene…" : proposals ? "Relancer l'analyse" : "Analyser mes entreprises"}
        </button>
      </div>

      <div className="p-4">
        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
        {result && (
          <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            ✓ {result.applied} entreprise{result.applied > 1 ? "s" : ""} enrichie{result.applied > 1 ? "s" : ""}
            {result.pushedToHubspot > 0 && <> — dont {result.pushedToHubspot} poussée{result.pushedToHubspot > 1 ? "s" : ""} dans HubSpot</>}.
            Le rapprochement multi-outils en profite dès la prochaine synchronisation.
          </p>
        )}

        {proposals === null && !loading && (
          <p className="text-xs text-slate-400">
            Lance l&apos;analyse : Revold cherche les entreprises SANS SIREN (par lot de 25) et propose leurs
            identifiants officiels. Rien n&apos;est écrit sans ta validation.
          </p>
        )}

        {proposals !== null && proposals.length === 0 && (
          <p className="text-xs text-slate-500">
            {scanned === 0
              ? "Toutes tes entreprises ont déjà un SIREN — rien à enrichir. 🎉"
              : "Aucune correspondance Sirene assez fiable sur ce lot — vérifie les noms d'entreprises dans le CRM."}
          </p>
        )}

        {proposals !== null && proposals.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="w-8 px-2.5 py-2" />
                    <th className="px-2.5 py-2 font-semibold">Entreprise (CRM)</th>
                    <th className="px-2.5 py-2 font-semibold">Raison sociale officielle</th>
                    <th className="px-2.5 py-2 font-semibold">SIREN</th>
                    <th className="px-2.5 py-2 font-semibold">SIRET (siège)</th>
                    <th className="px-2.5 py-2 font-semibold">N° TVA</th>
                    <th className="px-2.5 py-2 font-semibold">Confiance</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => (
                    <tr key={p.companyId} className="border-b border-slate-100 transition last:border-0 hover:bg-indigo-50/40">
                      <td className="px-2.5 py-2">
                        <input type="checkbox" checked={selected.has(p.companyId)} onChange={() => toggle(p.companyId)} className="accent-[var(--accent)]" />
                      </td>
                      <td className="px-2.5 py-2 font-medium text-slate-800">{p.name}</td>
                      <td className="px-2.5 py-2 text-slate-700">{p.legalName}</td>
                      <td className="px-2.5 py-2 tabular-nums text-slate-900">{p.siren}</td>
                      <td className="px-2.5 py-2 tabular-nums text-slate-700">{p.siret ?? "—"}</td>
                      <td className="px-2.5 py-2 tabular-nums text-slate-700">{p.vatNumber}</td>
                      <td className="px-2.5 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          p.confidence === "high" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {p.confidence === "high" ? "Haute" : "À vérifier"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400">
                {selected.size} sélectionnée{selected.size > 1 ? "s" : ""} sur {proposals.length} proposition{proposals.length > 1 ? "s" : ""} —
                les correspondances « À vérifier » se cochent manuellement.
              </p>
              <button
                onClick={apply}
                disabled={applying || selected.size === 0}
                className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
              >
                {applying ? "Application…" : `✓ Appliquer la sélection (Revold + HubSpot)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
