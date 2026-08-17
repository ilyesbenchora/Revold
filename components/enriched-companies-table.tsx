import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Entreprises ENRICHIES, sous forme de tableau (même exigence de lisibilité
 * que les blocs de validation en dessous) : le résultat concret du moteur —
 * identifiants posés, effectif, CA, secteur — avec la date d'enrichissement.
 */
type Row = {
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

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export async function EnrichedCompaniesTable({ supabase, orgId }: { supabase: SupabaseClient; orgId: string }) {
  const FULL =
    "name, legal_name, siren, siret, vat_number, official_employee_range, official_revenue, official_revenue_year, activity_label, enriched_at";
  const BASE =
    "name, legal_name, siren, siret, vat_number, official_employee_range, official_revenue, official_revenue_year, enriched_at";
  let rows: Row[] = [];
  try {
    const run = async (cols: string): Promise<{ data: unknown; error: { message: string } | null }> =>
      (await supabase
        .from("companies")
        .select(cols)
        .eq("organization_id", orgId)
        .not("siren", "is", null)
        .order("enriched_at", { ascending: false, nullsFirst: false })
        .limit(50)) as { data: unknown; error: { message: string } | null };
    let res = await run(FULL);
    // Colonne secteur absente (migration non appliquée) → colonnes de base.
    if (res.error && /activity_label/.test(res.error.message)) res = await run(BASE);
    if (!res.error) rows = ((res.data as Row[] | null) ?? []);
  } catch {
    rows = [];
  }
  if (rows.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-card-border bg-slate-50/60 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">
          Entreprises enrichies
          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {rows.length}{rows.length === 50 ? "+" : ""}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Le résultat concret du moteur — identifiants, effectif, CA et secteur officiels posés sur tes fiches (les 50
          plus récentes).
        </p>
      </div>
      <div className="overflow-x-auto">
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
            {rows.map((r, i) => (
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
                      {r.official_revenue_year && <span className="ml-1 text-[10px] text-slate-400">({r.official_revenue_year})</span>}
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
    </div>
  );
}
