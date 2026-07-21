export const dynamic = "force-dynamic";

import Link from "next/link";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { expandFiscalSchedule, computeTvaProvision, type OrgFiscalParams } from "@/lib/audit/fiscal-schedule";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PaiementFacturationTabs } from "@/components/paiement-facturation-tabs";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { fmt, fmtK } from "@/lib/audit/paiement-facturation-data";

/**
 * Fiscal & social — échéancier 12 mois (TVA / IS / URSSAF, paramètres de
 * l'organisation, calendrier CA12 géré) + provision de TVA estimée depuis les
 * flux bancaires réels. Aide à la décision — jamais une déclaration.
 */
export default async function FiscalPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: org }, tva] = await Promise.all([
    supabase
      .from("organizations")
      .select("fiscal_tva_periodicite, fiscal_tva_prochaine, fiscal_tva_montant, fiscal_is_periodicite, fiscal_is_prochaine, fiscal_is_montant, fiscal_urssaf_periodicite, fiscal_urssaf_prochaine, fiscal_urssaf_montant")
      .eq("id", orgId)
      .maybeSingle(),
    computeTvaProvision(supabase, orgId),
  ]);

  const schedule = expandFiscalSchedule((org ?? null) as OrgFiscalParams | null, new Date(), 12);
  const totalSchedule = schedule.reduce((s, i) => s + i.amount, 0);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Trésorerie</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fiscal & social : échéancier TVA · IS · URSSAF et provision de TVA estimée.
        </p>
      </header>

      <PaiementFacturationTabs />

      {/* ── Échéancier 12 mois ── */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Échéancier fiscal (12 mois)
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              {schedule.length > 0 ? `${fmt(schedule.length)} échéances · ${fmtK(totalSchedule)}` : "à paramétrer"}
            </span>
          </h2>
        }
      >
        {schedule.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
            Aucune échéance paramétrée. Renseigne périodicités, prochaines dates et montants dans{" "}
            <Link href="/dashboard/parametres/general" className="text-accent underline decoration-dotted underline-offset-2">
              Paramètres → Organisation → Fiscalité
            </Link>
            {" "}— le régime CA12 (TVA annuelle) est géré : l&apos;échéancier projettera automatiquement
            l&apos;acompte de juillet (55 %), celui de décembre (40 %) et le solde de mai.
          </p>
        ) : (
          <BlockDataTable
            title="Échéances fiscales à venir"
            subtitle="TVA · IS · URSSAF"
            team="finance"
            unit="currency"
            nameLabel="Échéance"
            valueLabel="Montant"
            extraColumns={["Mois"]}
            showTotal
            rows={schedule.map((i) => ({
              name: i.label,
              value: i.amount,
              cells: [i.month],
            }))}
            footnote="Montants issus de tes paramètres d'organisation (dernier avis reçu). Estimations d'aide à la décision — à confirmer avec ton expert-comptable."
          />
        )}
      </CollapsibleBlock>

      {/* ── Provision TVA estimée depuis les flux réels ── */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Provision de TVA estimée
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
              flux bancaires · année en cours
            </span>
          </h2>
        }
      >
        {!tva.hasData ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
            Aucun flux bancaire synchronisé cette année — connecte Pennylane pour estimer la TVA à provisionner.
          </p>
        ) : (
          <BlockDataTable
            title="Provision TVA (estimation)"
            subtitle={`${fmt(tva.moisCouverts)} mois de flux`}
            team="finance"
            unit="currency"
            nameLabel="Poste"
            valueLabel="Montant"
            extraColumns={["Détail"]}
            rows={[
              { name: "TVA collectée (estimée)", value: tva.collectee, unit: "currency" as const, tone: "pos" as const, cells: ["20/120 des encaissements TTC"] },
              { name: "TVA déductible (estimée)", value: tva.deductible, unit: "currency" as const, tone: "neg" as const, cells: ["20/120 des décaissements TTC"] },
              { name: "À provisionner", value: tva.provision, unit: "currency" as const, tone: "auto" as const, cells: ["Collectée − déductible"] },
            ]}
            footnote="Approximation à taux unique 20 %, tous flux supposés assujettis (salaires, assurances et frais bancaires réels sont hors champ TVA) : un ordre de grandeur pour provisionner, pas une déclaration. À confirmer avec l'expert-comptable."
          />
        )}
      </CollapsibleBlock>
    </section>
  );
}
