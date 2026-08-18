export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { PerformancesTabs } from "@/components/performances-tabs";
import { VentesTabs } from "@/components/ventes-tabs";
import { CloseDateManagementBlock } from "@/components/close-date-management-block";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { fetchCloseDateBuckets } from "@/lib/integrations/hubspot-close-date";
import { fetchOwners } from "@/lib/integrations/hubspot-owners";

// Clé de personnalisation propre à la sous-page (tuiles, KPIs ajoutés) —
// catalogue de KPIs sales hérité de la page Cycle de ventes parente.
const PAGE_KEY = "perf_ventes_expirees";

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export default async function ForecastManagementPage() {
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

  const fallbackBuckets = {
    pipelineId: null as string | null,
    year: new Date().getFullYear(),
    passedCloseDate: [],
    quarters: (["T1", "T2", "T3", "T4"] as const).map((k) => ({
      key: k,
      label: `${k} ${new Date().getFullYear()}`,
      start: "",
      end: "",
      deals: [],
    })),
  };
  // Stage probability map depuis le snapshot pipelines (pour forecast pondéré)
  const stageProbabilities = new Map<string, number>();
  for (const p of snapshot.pipelines ?? []) {
    for (const s of p.stages ?? []) {
      stageProbabilities.set(s.id, s.probability);
    }
  }

  const [initialBuckets, ownersRaw] = await Promise.all([
    token
      ? fetchCloseDateBuckets(token, null, stageProbabilities).catch(() => fallbackBuckets)
      : Promise.resolve(fallbackBuckets),
    token ? fetchOwners(token).catch(() => []) : Promise.resolve([]),
  ]);

  const owners = ownersRaw.map((o) => ({
    id: o.id,
    name: `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || o.id,
  }));

  // Tuiles par défaut depuis les buckets tous pipelines (mêmes données que le bloc).
  const montantExpire = initialBuckets.passedCloseDate.reduce((sum, d) => sum + d.amount, 0);
  const quarterDeals = initialBuckets.quarters.flatMap((q) => q.deals);
  const forecastPondere = quarterDeals.reduce((sum, d) => sum + d.weightedAmount, 0);
  const tiles: DefaultTile[] = pipelines.length > 0
    ? [
        {
          key: "deals_expires",
          label: "Transactions expirées",
          value: String(initialBuckets.passedCloseDate.length),
          raw: initialBuckets.passedCloseDate.length,
          rawUnit: "count",
          tone: initialBuckets.passedCloseDate.length === 0 ? "pos" : "neg",
          sub: "Date de closing dépassée",
          verdict: initialBuckets.passedCloseDate.length === 0
            ? { label: "Forecast à jour", tone: "pos" }
            : { label: "Dates à requalifier", tone: "neg" },
        },
        { key: "montant_expire", label: "Montant expiré", value: eur(montantExpire), raw: Math.round(montantExpire), rawUnit: "currency", tone: montantExpire > 0 ? "neg" : "neutral", sub: "Cumul des transactions expirées" },
        { key: "forecast_pondere_annee", label: "Forecast pondéré", value: eur(forecastPondere), raw: Math.round(forecastPondere), rawUnit: "currency", tone: "accent", sub: `Deals planifiés ${initialBuckets.year} × probabilité` },
        { key: "deals_planifies_annee", label: "Deals planifiés", value: String(quarterDeals.length), raw: quarterDeals.length, rawUnit: "count", tone: "neutral", sub: `Closing prévu en ${initialBuckets.year}` },
      ]
    : [];

  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Forecast Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestion des dates de fermeture et fiabilité du forecast par pipeline.
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
        <CloseDateManagementBlock
          pipelines={pipelines}
          owners={owners}
          initialPipelineId={null}
          initialBuckets={initialBuckets}
        />
      )}

      <PageDataTables pageKey="perf_ventes" />

      <CreateAlertModal hideTrigger />
    </section>
  );
}
