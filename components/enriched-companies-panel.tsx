"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Détail « Entreprises enrichies » — DÉPLIABLE, intégré au bloc Historique des
 * enrichissements (le résultat concret des passes, au même endroit que leurs
 * compteurs). Pagination SERVEUR sur toute la base : chaque page est chargée à
 * la demande depuis /api/enrichment/enriched-companies — aucune limite aux
 * N plus récentes.
 */
type EnrichedRow = {
  name: string | null;
  legal_name: string | null;
  siren: string | null;
  siret: string | null;
  vat_number: string | null;
  official_employee_range: string | null;
  official_revenue: number | null;
  official_revenue_year: number | null;
  activity_label?: string | null;
  legal_form?: string | null;
  enriched_at: string | null;
};

const PAGE_SIZES = [15, 20, 50];

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function EnrichedCompaniesPanel() {
  const [open, setOpen] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<EnrichedRow[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p: number, size: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/enrichment/enriched-companies?page=${p}&pageSize=${size}`);
      if (!res.ok) return;
      const d = (await res.json()) as { rows: EnrichedRow[]; total: number };
      setRows(Array.isArray(d.rows) ? d.rows : []);
      setTotal(typeof d.total === "number" ? d.total : null);
    } catch {
      /* réseau : le panneau reste sur sa dernière page chargée */
    } finally {
      setLoading(false);
    }
  }, []);

  // Le total alimente le badge de l'en-tête dès l'affichage du bloc.
  useEffect(() => {
    void load(0, PAGE_SIZES[0]);
  }, [load]);

  const goTo = (p: number, size = pageSize) => {
    setPage(p);
    setPageSize(size);
    void load(p, size);
  };

  const pageCount = total != null ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const visible = rows ?? [];
  if (total === 0) return null;

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-slate-50"
        aria-expanded={open}
      >
        <p className="text-xs font-semibold text-slate-700">
          Entreprises enrichies
          {total != null && (
            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              {total.toLocaleString("fr-FR")}
            </span>
          )}
          <span className="ml-2 font-normal text-slate-400">— le détail fiche par fiche des passes ci-dessus</span>
        </p>
        <span className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-2">
          {visible.length === 0 && !loading ? (
            <p className="text-xs text-slate-500">Aucune entreprise enrichie pour l&apos;instant.</p>
          ) : (
            <>
              <div className={`overflow-x-auto rounded-lg border border-slate-100 ${loading ? "opacity-60" : ""}`}>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-semibold">Entreprise</th>
                      <th className="px-3 py-2 font-semibold">SIREN</th>
                      <th className="px-3 py-2 font-semibold">SIRET</th>
                      <th className="px-3 py-2 font-semibold">TVA</th>
                      <th className="px-3 py-2 font-semibold">Effectif officiel</th>
                      <th className="px-3 py-2 text-right font-semibold">CA officiel</th>
                      <th className="px-3 py-2 font-semibold">Secteur</th>
                      <th className="px-3 py-2 font-semibold">Statut juridique</th>
                      <th className="px-3 py-2 font-semibold">Enrichie le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 transition last:border-0 hover:bg-indigo-50/40">
                        <td className="max-w-48 truncate px-3 py-2 font-medium text-slate-800" title={r.legal_name ?? r.name ?? undefined}>
                          {r.name ?? r.legal_name ?? "—"}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-700">{r.siren ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-500">{r.siret ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-500">{r.vat_number ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-700">{r.official_employee_range ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900">
                          {typeof r.official_revenue === "number" ? (
                            <>
                              {fmtEur(r.official_revenue)}
                              {r.official_revenue_year && (
                                <span className="ml-1 text-[10px] text-slate-400">({r.official_revenue_year})</span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="max-w-40 truncate px-3 py-2 text-slate-600" title={r.activity_label ?? undefined}>
                          {r.activity_label ?? "—"}
                        </td>
                        <td className="max-w-40 truncate px-3 py-2 text-slate-600" title={r.legal_form ?? undefined}>
                          {r.legal_form ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{fmtDate(r.enriched_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination serveur : toute la base est parcourable ── */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span>Lignes par page</span>
                  <select
                    value={pageSize}
                    onChange={(e) => goTo(0, Number(e.target.value))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-accent"
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  {total != null && total > 0 && (
                    <span className="text-slate-400">
                      {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} sur {total.toLocaleString("fr-FR")}
                    </span>
                  )}
                </div>
                {pageCount > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => goTo(Math.max(0, page - 1))}
                      disabled={page === 0 || loading}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      ← Précédent
                    </button>
                    <span className="tabular-nums text-slate-500">Page {page + 1} / {pageCount}</span>
                    <button
                      onClick={() => goTo(Math.min(pageCount - 1, page + 1))}
                      disabled={page >= pageCount - 1 || loading}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      Suivant →
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
