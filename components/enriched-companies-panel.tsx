"use client";

import { useState } from "react";

/**
 * Panneau « Entreprises enrichies » — DÉPLIABLE (fermé par défaut) avec la
 * même pagination que le bloc « Identités à valider ». Affiché juste sous
 * l'état du moteur : le résultat concret de l'enrichissement, à portée de clic
 * sans alourdir la page.
 */
export type EnrichedRow = {
  name: string | null;
  legal_name: string | null;
  siren: string | null;
  siret: string | null;
  vat_number: string | null;
  official_employee_range: string | null;
  official_revenue: number | null;
  official_revenue_year: number | null;
  activity_label: string | null;
  enriched_at: string | null;
};

const PAGE_SIZES = [15, 20, 50];

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function EnrichedCompaniesPanel({ rows, total }: { rows: EnrichedRow[]; total: number | null }) {
  const [open, setOpen] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = rows.slice(current * pageSize, current * pageSize + pageSize);
  const shown = total ?? rows.length;

  return (
    <div className="card overflow-hidden">
      {/* En-tête cliquable : le bloc se déroule/replie comme un onglet. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 border-b border-card-border bg-slate-50/60 px-4 py-3 text-left transition hover:bg-slate-100/60"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            Entreprises enrichies
            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {shown.toLocaleString("fr-FR")}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Le résultat concret du moteur — identifiants, effectif, CA et secteur officiels posés sur tes fiches.
          </p>
        </div>
        <span
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="p-4">
          {rows.length === 0 ? (
            <p className="text-xs text-slate-500">Aucune entreprise enrichie pour l&apos;instant.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-100">
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
                        <td className="px-3 py-2 text-slate-500">{fmtDate(r.enriched_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination — même modèle que « Identités à valider » ── */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span>Lignes par page</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(0);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-accent"
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span className="text-slate-400">
                    {current * pageSize + 1}–{Math.min((current + 1) * pageSize, rows.length)} sur{" "}
                    {rows.length.toLocaleString("fr-FR")}
                    {total != null && total > rows.length && <> (les {rows.length} plus récentes)</>}
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
