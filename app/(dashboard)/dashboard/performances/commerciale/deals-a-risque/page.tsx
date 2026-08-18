export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { PerformancesTabs } from "@/components/performances-tabs";
import { VentesTabs } from "@/components/ventes-tabs";
import { DealsAtRiskBlock } from "@/components/deals-at-risk-block";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { fetchDealRiskBuckets } from "@/lib/integrations/hubspot-deal-risk";
import { fetchOwners } from "@/lib/integrations/hubspot-owners";

// Clé de personnalisation propre à la sous-page (tuiles, KPIs ajoutés) —
// catalogue de KPIs sales hérité de la page Cycle de ventes parente.
const PAGE_KEY = "perf_ventes_risque";

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export default async function DealsARisquePage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  const pipelines = snapshot.pipelines.map((p) => ({
    id: p.id,
    label: p.label,
    stages: p.stages.map((s) => ({ id: s.id, label: s.label })),
  }));

  // Charge buckets pour TOUS pipelines par défaut + owners en parallèle
  const [initialBuckets, ownersRaw] = await Promise.all([
    token
      ? fetchDealRiskBuckets(token, null).catch(() => ({
          pipelineId: null,
          trueRisk: [],
          blocked: [],
          noVisibility: [],
          noActivity: [],
        }))
      : Promise.resolve({
          pipelineId: null,
          trueRisk: [],
          blocked: [],
          noVisibility: [],
          noActivity: [],
        }),
    token ? fetchOwners(token).catch(() => []) : Promise.resolve([]),
  ]);

  const owners = ownersRaw.map((o) => ({
    id: o.id,
    name: `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || o.id,
  }));

  // Tuiles par défaut depuis les buckets tous pipelines (mêmes données que le bloc).
  const montantRisque = initialBuckets.trueRisk.reduce((sum, d) => sum + d.amount, 0);
  const tiles: DefaultTile[] = pipelines.length > 0
    ? [
        {
          key: "deals_risque",
          label: "Transactions à risque",
          value: String(initialBuckets.trueRisk.length),
          raw: initialBuckets.trueRisk.length,
          rawUnit: "count",
          tone: initialBuckets.trueRisk.length === 0 ? "pos" : "neg",
          sub: "Bloquée + sans visibilité + sans activité",
          verdict: initialBuckets.trueRisk.length === 0
            ? { label: "Aucun risque combiné", tone: "pos" }
            : { label: "Action requise", tone: "neg" },
        },
        { key: "montant_risque", label: "Montant à risque", value: eur(montantRisque), raw: Math.round(montantRisque), rawUnit: "currency", tone: montantRisque > 0 ? "neg" : "neutral", sub: "Cumul des transactions à risque" },
        { key: "deals_bloques", label: "Bloquées", value: String(initialBuckets.blocked.length), raw: initialBuckets.blocked.length, rawUnit: "count", tone: "accent", sub: "> 7 j dans la même étape" },
        { key: "deals_sans_visibilite", label: "Sans visibilité", value: String(initialBuckets.noVisibility.length), raw: initialBuckets.noVisibility.length, rawUnit: "count", tone: "neutral", sub: "Aucune prochaine activité planifiée" },
      ]
    : [];

  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Deals à risque</h1>
          <p className="mt-1 text-sm text-slate-500">
            Identifie les deals bloqués, sans visibilité ou sans activités sur le pipeline sélectionné.
          </p>
        </div>
      </header>

      <PerformancesTabs />
      <VentesTabs />

      {/* ── Tuiles KPI configurables (CTA « Personnaliser les KPIs ») ── */}
      <ConfigurableKpiTiles
        supabase={supabase}
        orgId={orgId}
        pageKey={PAGE_KEY}
        defaults={tiles}
      />

      {pipelines.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun pipeline détecté. Vérifiez la connexion HubSpot.
        </p>
      ) : (
        <DealsAtRiskBlock
          pipelines={pipelines}
          owners={owners}
          initialPipelineId={null}
          initialBuckets={initialBuckets}
        />
      )}

      <PageDataTables pageKey="perf_ventes" />

      {/* Modal hôte (cachée) — conservée pour compat, plus déclenchée ici. */}
      <CreateAlertModal hideTrigger />
    </section>
  );
}
