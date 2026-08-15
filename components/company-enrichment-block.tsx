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
  /** Taille officielle de l'entreprise — affichée pour aider à trancher. */
  employeeRange: string | null;
  employeeYear: number | null;
  revenue: number | null;
  revenueYear: number | null;
};

const PAGE_SIZES = [15, 20, 50];

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export function CompanyEnrichmentBlock() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ applied: number; pushedToHubspot: number } | null>(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/enrichment/companies");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Chargement impossible");
      setProposals((d.proposals ?? []) as Proposal[]);
      setSelected(new Set());
      setPage(0);
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
      .map((p) => ({
        companyId: p.companyId,
        siren: p.siren,
        siret: p.siret,
        legalName: p.legalName,
        employeeRange: p.employeeRange,
        employeeYear: p.employeeYear,
        revenue: p.revenue,
        revenueYear: p.revenueYear,
      }));
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

  // Pagination : la sélection est conservée d'une page à l'autre (ids).
  const pageCount = Math.max(1, Math.ceil(proposals.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = proposals.slice(current * pageSize, current * pageSize + pageSize);
  const pageAllSelected = visible.length > 0 && visible.every((p) => selected.has(p.companyId));
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of visible) {
        if (pageAllSelected) next.delete(p.companyId);
        else next.add(p.companyId);
      }
      return next;
    });

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
            Revold ne les applique jamais seul. L&apos;effectif et le CA officiels sont affichés pour t&apos;aider à
            trancher, et sont appliqués en même temps que l&apos;identité.
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
                        checked={pageAllSelected}
                        onChange={togglePage}
                        className="accent-[var(--accent)]"
                        title="Sélectionner toute la page"
                      />
                    </th>
                    <th className="px-2.5 py-2 font-semibold">Entreprise (CRM)</th>
                    <th className="px-2.5 py-2 font-semibold">Raison sociale officielle</th>
                    <th className="px-2.5 py-2 font-semibold">Effectif</th>
                    <th className="px-2.5 py-2 font-semibold">CA officiel</th>
                    <th className="px-2.5 py-2 font-semibold">SIREN</th>
                    <th className="px-2.5 py-2 font-semibold">SIRET (siège)</th>
                    <th className="px-2.5 py-2 font-semibold">N° TVA</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
                    <tr key={p.companyId} className="border-b border-slate-100 transition last:border-0 hover:bg-indigo-50/40">
                      <td className="px-2.5 py-2">
                        <input type="checkbox" checked={selected.has(p.companyId)} onChange={() => toggle(p.companyId)} className="accent-[var(--accent)]" />
                      </td>
                      <td className="px-2.5 py-2 font-medium text-slate-800">{p.name}</td>
                      <td className="px-2.5 py-2 text-slate-700">{p.legalName}</td>
                      <td className="px-2.5 py-2 text-slate-700">
                        {p.employeeRange ?? <span className="text-slate-300">—</span>}
                        {p.employeeYear && <span className="ml-1 text-[10px] text-slate-400">({p.employeeYear})</span>}
                      </td>
                      <td className="px-2.5 py-2 tabular-nums text-slate-700">
                        {p.revenue != null ? eur(p.revenue) : <span className="text-slate-300">confidentiel</span>}
                        {p.revenueYear && <span className="ml-1 text-[10px] text-slate-400">({p.revenueYear})</span>}
                      </td>
                      <td className="px-2.5 py-2 tabular-nums text-slate-900">{p.siren}</td>
                      <td className="px-2.5 py-2 tabular-nums text-slate-700">{p.siret ?? "—"}</td>
                      <td className="px-2.5 py-2 tabular-nums text-slate-700">{p.vatNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* ── Pagination ── */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <span>Lignes par page</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-accent"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-slate-400">
                  {current * pageSize + 1}–{Math.min((current + 1) * pageSize, proposals.length)} sur {proposals.length}
                </span>
              </div>
              {pageCount > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={current === 0}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                  >
                    ← Précédent
                  </button>
                  <span className="tabular-nums text-slate-500">Page {current + 1} / {pageCount}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={current >= pageCount - 1}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                  >
                    Suivant →
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400">
                {selected.size} sélectionnée{selected.size > 1 ? "s" : ""} sur {proposals.length} (la sélection est
                conservée d&apos;une page à l&apos;autre) — vérifie que la raison sociale et la taille correspondent
                bien à l&apos;entreprise de ton CRM avant d&apos;appliquer.
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
