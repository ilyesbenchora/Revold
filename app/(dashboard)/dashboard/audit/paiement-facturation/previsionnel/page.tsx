export const dynamic = "force-dynamic";

import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getSwitchableBillingTools, capabilitiesOf } from "@/lib/audit/source-switch";
import { computeCashflow } from "@/lib/audit/cashflow";
import { computeTreasuryForecast } from "@/lib/audit/treasury-forecast";
import type { OrgFiscalParams } from "@/lib/audit/fiscal-schedule";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PaiementFacturationTabs } from "@/components/paiement-facturation-tabs";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { fmt, fmtK } from "@/lib/audit/paiement-facturation-data";

/**
 * Prévisionnel de trésorerie glissant — 12 mois, 3 scénarios (adapté du
 * template Lomed Cockpit). Croise par nature TOUTES les sources : flux
 * bancaires (Pennylane & co), factures ouvertes, pipeline CRM pondéré et
 * échéances fiscales paramétrées — pas de switcher ici.
 */
export default async function PrevisionnelPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);

  // Outil de trésorerie disponible (capacité cashflow) → point de départ réel.
  const tools = await getSwitchableBillingTools(supabase, orgId, token, ["audit_paiement_facturation_previsionnel", "audit_paiement_facturation"]);
  const cashTool = tools.find((t) => capabilitiesOf(t.key).includes("cashflow"))?.key ?? null;
  const cf = cashTool ? await computeCashflow(supabase, orgId, cashTool) : null;

  const { data: org } = await supabase
    .from("organizations")
    .select("fiscal_tva_periodicite, fiscal_tva_prochaine, fiscal_tva_montant, fiscal_is_periodicite, fiscal_is_prochaine, fiscal_is_montant, fiscal_urssaf_periodicite, fiscal_urssaf_prochaine, fiscal_urssaf_montant")
    .eq("id", orgId)
    .maybeSingle();

  const fc = await computeTreasuryForecast(supabase, orgId, cf, (org ?? null) as OrgFiscalParams | null);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Trésorerie</h1>
        <p className="mt-1 text-sm text-slate-500">
          Prévisionnel glissant 12 mois : factures à échéance + pipeline pondéré − charges & échéances fiscales.
        </p>
      </header>

      <PaiementFacturationTabs />

      {!fc.hasData ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Pas encore de matière pour projeter : aucune trésorerie synchronisée, aucune facture ouverte
            et aucun deal avec montant. Synchronise Pennylane (flux bancaires) et renseigne les montants
            de tes deals HubSpot pour activer le prévisionnel.
          </p>
        </div>
      ) : (
        <>
          {/* ── Courbe 3 scénarios ── */}
          <CollapsibleBlock
            title={
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                Projection de trésorerie
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">12 mois · 3 scénarios</span>
              </h2>
            }
          >
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-800">
                Départ : {fc.start != null ? fmtK(fc.start) : "—"} de trésorerie disponible
              </p>
              <p className="mb-2 text-[10px] text-slate-400">
                Prudent = factures ouvertes seules · Probable = + pipeline pondéré (probabilité d&apos;étape × inactivité) · Ambitieux = + pipeline plein
              </p>
              <ForecastChart
                points={fc.points.map((p) => ({ label: p.label, prudent: p.soldePrudent, probable: p.soldeProbable, ambitieux: p.soldeAmbitieux }))}
              />
              {(fc.breakEvenMonth.probable || fc.breakEvenMonth.prudent) && (
                <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  ⚠️ Passage sous zéro : {fc.breakEvenMonth.prudent ? `scénario prudent en ${fc.breakEvenMonth.prudent}` : ""}
                  {fc.breakEvenMonth.prudent && fc.breakEvenMonth.probable ? " · " : ""}
                  {fc.breakEvenMonth.probable ? `scénario probable en ${fc.breakEvenMonth.probable}` : ""}
                </p>
              )}
            </div>

            {/* Détail mensuel + alerte chirurgicale */}
            <div className="mt-4">
              <BlockDataTable
                title="Prévisionnel mensuel (scénario probable)"
                subtitle="12 prochains mois"
                team="finance"
                unit="currency"
                nameLabel="Mois"
                valueLabel="Solde projeté"
                extraColumns={["Factures", "Pipeline pondéré", "Charges", "Fournisseurs", "Fiscal"]}
                rows={fc.points.map((p) => ({
                  name: p.label,
                  value: p.soldeProbable,
                  unit: "currency" as const,
                  tone: "auto" as const,
                  cells: [
                    p.encaissementsFactures > 0 ? fmtK(p.encaissementsFactures) : "—",
                    p.encaissementsPipeline > 0 ? fmtK(p.encaissementsPipeline) : "—",
                    p.decaissementsCharges > 0 ? `− ${fmtK(p.decaissementsCharges)}` : "—",
                    p.decaissementsFournisseurs > 0 ? `− ${fmtK(p.decaissementsFournisseurs)}` : "—",
                    p.decaissementsFiscal > 0 ? `− ${fmtK(p.decaissementsFiscal)}` : "—",
                  ],
                }))}
                footnote="Hypothèses : encaissement d'un deal au mois de clôture + 1 ; retards ramenés au 1er mois projeté ; charges = médiane des décaissements réels ; fiscal = paramètres de l'organisation. Aide à la décision, pas un engagement."
              />
            </div>
          </CollapsibleBlock>

          {/* ── Pipeline retenu dans la projection ── */}
          <CollapsibleBlock
            title={
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                Pipeline pris en compte
                <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-600">
                  {fmt(fc.dealsRetenus.length)} deals · pondéré {fmtK(fc.pipelineWeighted)}
                </span>
              </h2>
            }
          >
            {fc.dealsRetenus.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                Aucun deal ouvert avec un montant renseigné{fc.dealsSansMontant > 0 ? ` — ${fmt(fc.dealsSansMontant)} deals sans montant dans le CRM` : ""}.
                Renseigne les montants dans HubSpot pour nourrir la projection.
              </p>
            ) : (
              <BlockDataTable
                title="Deals pondérés du prévisionnel"
                subtitle="pipeline CRM"
                team="finance"
                unit="currency"
                nameLabel="Deal"
                valueLabel="Pondéré"
                extraColumns={["Montant", "Probabilité", "Étape", "Mois d'encaissement"]}
                rows={fc.dealsRetenus.slice(0, 25).map((d) => ({
                  name: d.name,
                  value: Math.round(d.weighted),
                  unit: "currency" as const,
                  cells: [fmtK(d.amount), `${Math.round(d.probability * 100)} %`, d.stage ?? "—", d.cashMonth],
                }))}
                footnote={`Pondération = probabilité de l'étape × décote d'inactivité (plancher 20 % après 60 j sans contact).${fc.dealsSansMontant > 0 ? ` ${fmt(fc.dealsSansMontant)} deals ignorés faute de montant.` : ""}`}
              />
            )}
          </CollapsibleBlock>
        </>
      )}
    </section>
  );
}
