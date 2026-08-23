import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCompanyEstablishments } from "@/lib/reconciliation/company-establishments";

/**
 * Carte « Ventilation par établissement » (facette SIRET) — Trésorerie.
 *
 * La consolidation Revold reste au niveau de l'entité LÉGALE (SIREN) : on ne
 * fragmente pas les comptes. Mais quand une même entité légale facture depuis
 * PLUSIEURS établissements (SIRET distincts sur ses factures), on ventile son
 * CA par établissement — la vue « par club / par site » sans dé-consolider.
 * Ne s'affiche que si au moins une entité a ≥ 2 établissements facturants.
 */

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

/** SIRET lisible : SIREN (3·3·3) + NIC (5). */
function fmtSiret(siret: string): { siren: string; nic: string } {
  const s = siret.padStart(14, "0");
  return {
    siren: `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6, 9)}`,
    nic: s.slice(9),
  };
}

export async function EstablishmentBreakdown({ supabase, orgId }: { supabase: SupabaseClient; orgId: string }) {
  const est = await loadCompanyEstablishments(supabase, orgId);
  if (!est.available || est.multiSiret.size === 0) return null;

  // Entités triées par CA total décroissant (les plus gros comptes d'abord).
  const entities = [...est.byCompany.entries()]
    .map(([companyId, ests]) => ({
      companyId,
      name: est.nameOf.get(companyId) ?? "Entreprise sans nom",
      ests,
      total: ests.reduce((s, e) => s + e.total, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-card-border bg-slate-50/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Ventilation par établissement
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {est.multiSiret.size} entité{est.multiSiret.size > 1 ? "s" : ""} multi-établissements
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Même entité légale (SIREN), plusieurs établissements facturants (SIRET) — le CA ventilé par site, sans dé-consolider le compte.
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {entities.map((e) => (
          <div key={e.companyId} className="px-4 py-3">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-semibold text-slate-800">{e.name}</p>
              <p className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
                {e.ests.length} établissements · {fmtEur(e.total)}
              </p>
            </div>
            <div className="space-y-1.5">
              {e.ests.map((s) => {
                const parts = fmtSiret(s.siret);
                const share = e.total > 0 ? Math.round((s.total / e.total) * 100) : 0;
                return (
                  <div key={s.siret} className="flex items-center gap-3">
                    <div className="flex w-40 shrink-0 items-center gap-1.5 font-mono text-[11px] tabular-nums text-slate-500">
                      <span>{parts.siren}</span>
                      <span className="rounded bg-indigo-50 px-1 font-semibold text-indigo-600" title="NIC — numéro d'établissement">
                        {parts.nic}
                      </span>
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.max(2, share)}%` }} />
                    </div>
                    <p className="w-28 shrink-0 text-right text-xs font-medium tabular-nums text-slate-700">
                      {fmtEur(s.total)}
                      <span className="ml-1 text-[10px] text-slate-400">{s.invoices} fact.</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
