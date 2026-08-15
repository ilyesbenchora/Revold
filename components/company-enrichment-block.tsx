"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Bloc « Identités à valider » (page Suivi → Enrichissement).
 *
 * Le scan de la base est fait par le moteur d'enrichissement (bouton
 * « Enrichir toute ma base » + cron horaire) : il applique SEUL les
 * correspondances sûres et dépose ici les correspondances PLAUSIBLES.
 * Ce bloc ne fait donc que la VALIDATION humaine — la file est persistée en
 * base (elle survit au rafraîchissement de la page).
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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ applied: number; pushedToHubspot: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/enrichment/companies");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Chargement impossible");
      setProposals((d.proposals ?? []) as Proposal[]);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function apply() {
    if (applying) return;
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
      setProposals((prev) => prev.filter((p) => !selected.has(p.companyId)));
      setSelected(new Set());
      router.refresh(); // tuiles de couverture
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

  const allSelected = proposals.length > 0 && selected.size === proposals.length;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-slate-50/60 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">
            ✅ Identités à valider
            {proposals.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {proposals.length}
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Correspondances Sirene <span className="font-medium text-slate-600">plausibles mais pas certaines</span> —
            Revold ne les applique jamais seul. Les correspondances sûres, elles, sont déjà appliquées automatiquement.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Chargement…" : "Rafraîchir la file"}
        </button>
      </div>

      <div className="p-4">
        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
        {result && (
          <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            ✓ {result.applied} entreprise{result.applied > 1 ? "s" : ""} enrichie{result.applied > 1 ? "s" : ""}
            {result.pushedToHubspot > 0 && <> — dont {result.pushedToHubspot} poussée{result.pushedToHubspot > 1 ? "s" : ""} dans HubSpot</>}.
          </p>
        )}

        {loading && proposals.length === 0 && <p className="text-xs text-slate-400">Chargement de la file…</p>}

        {!loading && proposals.length === 0 && (
          <p className="text-xs text-slate-500">
            Aucune correspondance en attente. Lance «&nbsp;Enrichir toute ma base&nbsp;» ci-dessus : les identités
            certaines seront appliquées directement, et les cas ambigus arriveront ici.
          </p>
        )}

        {proposals.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="w-8 px-2.5 py-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(proposals.map((p) => p.companyId)))}
                        className="accent-[var(--accent)]"
                        title="Tout sélectionner"
                      />
                    </th>
                    <th className="px-2.5 py-2 font-semibold">Entreprise (CRM)</th>
                    <th className="px-2.5 py-2 font-semibold">Raison sociale officielle</th>
                    <th className="px-2.5 py-2 font-semibold">SIREN</th>
                    <th className="px-2.5 py-2 font-semibold">SIRET (siège)</th>
                    <th className="px-2.5 py-2 font-semibold">N° TVA</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400">
                {selected.size} sélectionnée{selected.size > 1 ? "s" : ""} sur {proposals.length} — vérifie que la raison
                sociale correspond bien à l&apos;entreprise de ton CRM avant d&apos;appliquer.
              </p>
              <button
                onClick={apply}
                disabled={applying || selected.size === 0}
                className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
              >
                {applying ? "Application…" : "✓ Valider la sélection (Revold + HubSpot)"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
