export const dynamic = "force-dynamic";

import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PaiementFacturationTabs } from "@/components/paiement-facturation-tabs";
import { fetchPaiementFacturationFor, fmt, fmtK } from "@/lib/audit/paiement-facturation-data";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { SourceToolSwitcher } from "@/components/source-tool-switcher";
import { getSwitchableBillingTools, validateSourceParam } from "@/lib/audit/source-switch";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";
import { blockPreviewMeta } from "@/lib/kpi/block-previews";

// Clé de personnalisation propre à la sous-page (tuiles, blocs masqués, tables) —
// catalogue de KPIs et filtre d'outils hérités de la page Trésorerie parente.
const PAGE_KEY = "audit_paiement_facturation_paiement";

export default async function PaiementPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);

  const sp = (await searchParams) ?? {};
  const switchableTools = await getSwitchableBillingTools(supabase, orgId, token, ["audit_paiement_facturation_paiement", "audit_paiement_facturation"]);
  const overrideSource = validateSourceParam(typeof sp.source === "string" ? sp.source : null, switchableTools);

  const data = await fetchPaiementFacturationFor(supabase, orgId, token, overrideSource, ["audit_paiement_facturation_paiement", "audit_paiement_facturation"]);
  const activeSourceKey = data.source ?? "hubspot";

  // Comptage par statut subscription
  const trialingSubs = data.subscriptions.filter((s) => s.properties.hs_subscription_status === "trialing").length;
  const pastDueSubs = data.subscriptions.filter((s) => s.properties.hs_subscription_status === "past_due").length;

  // Personnalisation de la page : tuiles masquées/ajoutées + blocs retirés.
  const custom = await getPageCustomization(supabase, orgId, PAGE_KEY);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Trésorerie</h1>
        <p className="mt-1 text-sm text-slate-500">
          Détail paiements : MRR, ARR, churn, paiements en échec et santé du portefeuille subscriptions.
        </p>
      </header>

      <PaiementFacturationTabs />

      {/* ── Tuiles KPI configurables (1 ligne) : lecture cockpit + KPIs ajoutés ── */}
      {(() => {
        const churn = data.churnRate;
        const defaults: DefaultTile[] = data.hasData
          ? [
              { key: "mrr", label: "MRR", value: data.mrr > 0 ? fmtK(data.mrr) : "—", raw: Math.round(data.mrr), rawUnit: "currency", tone: "accent", sub: "Revenu mensuel récurrent" },
              { key: "arr", label: "ARR", value: data.arr > 0 ? fmtK(data.arr) : "—", raw: Math.round(data.arr), rawUnit: "currency", tone: "neutral", sub: "Annualisé (MRR × 12)" },
              {
                key: "subs_actives",
                label: "Subscriptions actives",
                value: String(data.activeSubsCount),
                raw: data.activeSubsCount,
                rawUnit: "count",
                tone: "pos",
                sub: `sur ${fmt(data.subscriptions.length)} au total`,
                verdict: pastDueSubs === 0 ? { label: "Aucun paiement en échec", tone: "pos" }
                  : pastDueSubs <= 2 ? { label: `${pastDueSubs} past due`, tone: "warn" }
                  : { label: `${pastDueSubs} past due`, tone: "neg" },
              },
              {
                key: "taux_churn",
                label: "Taux de churn",
                value: churn != null ? `${churn} %` : "—",
                raw: churn,
                rawUnit: "percent",
                tone: churn == null ? "neutral" : churn <= 5 ? "pos" : churn <= 15 ? "accent" : "neg",
                sub: "Annulés / total subscriptions",
                verdict: churn == null ? undefined
                  : churn <= 5 ? { label: "Sain (< 5 %)", tone: "pos" }
                  : churn <= 15 ? { label: "À surveiller", tone: "warn" }
                  : { label: "Élevé (> 15 %)", tone: "neg" },
              },
            ]
          : [];
        return (
          <ConfigurableKpiTiles
            supabase={supabase}
            orgId={orgId}
            pageKey={PAGE_KEY}
            defaults={defaults}
            customization={custom}
            tablesPageKey={PAGE_KEY}
            hiddenBlocks={hiddenBlockList(custom, blockPreviewMeta)}
          />
        );
      })()}

      {!custom.hiddenBlocks.has("revenus_recurrents") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="revenus_recurrents" label="Revenus récurrents">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Revenus récurrents
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Revenus récurrents"
          subtitle="subscriptions"
          team="finance"
          unit="currency"
          nameLabel="Indicateur"
          extraColumns={["Détail"]}
          rows={[
            { name: "MRR", value: data.mrr > 0 ? data.mrr : null, unit: "currency" as const, cells: ["Mensuel récurrent"], spec: { entity: "subscriptions", groupBy: "status", measure: "sum" as const, field: "mrr", target: "active" } },
            { name: "ARR", value: data.arr > 0 ? data.arr : null, unit: "currency" as const, cells: ["Annualisé (MRR × 12)"], spec: { entity: "subscriptions", groupBy: "status", measure: "sum" as const, field: "mrr", target: "active", multiplier: 12 } },
            { name: "Subscriptions actives", value: data.activeSubsCount, unit: "count" as const, cells: [`sur ${fmt(data.subscriptions.length)}`], spec: { entity: "subscriptions", groupBy: "status", measure: "count" as const, target: "active" } },
            {
              name: "ARPU",
              value: data.activeSubsCount > 0 ? Math.round(data.mrr / data.activeSubsCount) : null,
              unit: "currency",
              cells: ["Revenu moy./client/mois"],
            },
          ]}
          footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
        />
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("churn_risque") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="churn_risque" label="Churn & risque revenue">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Churn & risque revenue
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Churn & risque revenue"
          subtitle="subscriptions"
          team="finance"
          unit="count"
          nameLabel="Indicateur"
          extraColumns={["Détail"]}
          rows={[
            { name: "Taux de churn", value: data.churnRate ?? null, unit: "percent", cells: ["Annulés / total subs"] },
            { name: "Subscriptions annulées", value: data.canceledSubsCount, unit: "count", cells: ["canceled / expired / paused"] },
            { name: "Past due", value: pastDueSubs, unit: "count", cells: ["Paiements en échec"] },
            { name: "En période d'essai", value: trialingSubs, unit: "count", cells: ["Conversion à monitorer"] },
          ]}
          footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
        />
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("sante_subs") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="sante_subs" label="Santé du portefeuille subscriptions">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Santé du portefeuille subscriptions
          </h2>
        }
      >
        {data.subscriptions.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune subscription détectée — connectez Stripe ou activez HubSpot Subscriptions.
          </p>
        ) : (
          /* Données du bloc + alerte chirurgicale. */
          <BlockDataTable
            title="Santé du portefeuille subscriptions"
            subtitle="subscriptions · groupé par segment"
            team="finance"
            unit="count"
            nameLabel="Segment"
            valueLabel="Subscriptions"
            extraColumns={["Part du portefeuille", "Détail"]}
            rows={[
              {
                name: "Actives",
                value: data.activeSubsCount,
                cells: [`${Math.round((data.activeSubsCount / data.subscriptions.length) * 100)} %`, "du portefeuille"],
              },
              {
                name: "En essai",
                value: trialingSubs,
                cells: [`${Math.round((trialingSubs / data.subscriptions.length) * 100)} %`, "à convertir"],
              },
              {
                name: "À risque",
                value: pastDueSubs + data.canceledSubsCount,
                cells: [
                  `${Math.round(((pastDueSubs + data.canceledSubsCount) / data.subscriptions.length) * 100)} %`,
                  "Past due + canceled / paused / expired",
                ],
              },
            ]}
            footnote="Segments composites (past due + canceled / paused / expired) : l'agent Revold rattache l'alerte aux données à la création."
          />
        )}
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {/* ── Tables & graphiques ajoutés par l'utilisateur (funnel unique) ── */}
      <PageDataTables pageKey={PAGE_KEY} />

      {/* Outil source des blocs — rappel discret en bas de page, switch au clic */}
      <SourceToolSwitcher
        tools={switchableTools.map((t) => ({ key: t.key, label: t.label, domain: t.domain, icon: t.icon }))}
        activeKey={activeSourceKey}
      />
    </section>
  );
}
