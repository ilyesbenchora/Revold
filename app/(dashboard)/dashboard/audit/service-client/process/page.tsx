export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { fetchServiceClientData, firstResponseMsOf, fmt } from "@/lib/audit/service-client-data";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";
import { blockPreviewMeta } from "@/lib/kpi/block-previews";

// Clé de personnalisation propre à la sous-page (tuiles masquées/renommées,
// KPIs ajoutés) — catalogue de KPIs service client hérité de la page parente.
const PAGE_KEY = "audit_service_client_process";
// Sources : réglage propre à la sous-page, héritage Vue d'ensemble sinon.
const SOURCE_KEYS = [PAGE_KEY, "audit_service_client"];

export default async function ServiceClientProcessPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const [data, snapshot, custom] = await Promise.all([
    fetchServiceClientData(supabase, orgId),
    getHubspotSnapshot(),
    getPageCustomization(supabase, orgId, PAGE_KEY),
  ]);

  // Process onboarding KPIs
  // - Time to first response : SLA d'accueil pour nouveau client
  // - Time to resolution : qualité onboarding
  // - Tickets par contact : si > 3, signal d'un onboarding qui échoue
  // - % tickets onboarding (sujet contient "onboarding" ou "setup")
  const onboardingTickets = data.tickets.filter((t) =>
    /(onboard|setup|installation|kickoff|first|premier|d[ée]marrage)/i.test(t.properties.subject ?? ""),
  );
  const onboardingResolved = onboardingTickets.filter((t) => t.properties.closed_date).length;
  const onboardingResolutionRate = onboardingTickets.length > 0
    ? Math.round((onboardingResolved / onboardingTickets.length) * 100)
    : null;

  // SLA respecté = % de tickets avec 1ère réponse < 4h
  const ticketsWithFirstResponse = data.tickets
    .map((t) => firstResponseMsOf(t))
    .filter((n): n is number => n != null);
  const slaRespected = ticketsWithFirstResponse.filter((ms) => ms <= 4 * 3_600_000).length;
  const slaRate = ticketsWithFirstResponse.length > 0
    ? Math.round((slaRespected / ticketsWithFirstResponse.length) * 100)
    : null;

  // Customers handoff = % d'opportunités converties en customer (snapshot)
  const handoffRate = snapshot.opportunitiesCount > 0
    ? Math.round((snapshot.customersCount / (snapshot.opportunitiesCount + snapshot.customersCount)) * 100)
    : null;

  const tiles: DefaultTile[] = [
    {
      key: "sla_respecte",
      label: "SLA respecté (< 4h)",
      value: slaRate != null ? `${slaRate} %` : "—",
      raw: slaRate,
      rawUnit: "percent",
      tone: slaRate == null ? "neutral" : slaRate >= 80 ? "pos" : slaRate >= 50 ? "accent" : "neg",
      sub: "1ère réponse sous 4 h",
    },
    {
      key: "premiere_reponse",
      label: "1ère réponse moyenne",
      value: data.avgFirstResponseHours != null ? `${data.avgFirstResponseHours} h` : "—",
      raw: data.avgFirstResponseHours,
      rawUnit: "count",
      tone: data.avgFirstResponseHours == null ? "neutral" : data.avgFirstResponseHours <= 4 ? "pos" : data.avgFirstResponseHours <= 12 ? "accent" : "neg",
      sub: "SLA cible : ≤ 4 h",
    },
    {
      key: "resolution_onboarding",
      label: "Résolution onboarding",
      value: onboardingResolutionRate != null ? `${onboardingResolutionRate} %` : "—",
      raw: onboardingResolutionRate,
      rawUnit: "percent",
      tone: onboardingResolutionRate == null ? "neutral" : onboardingResolutionRate >= 80 ? "pos" : onboardingResolutionRate >= 50 ? "accent" : "neg",
      sub: `${onboardingResolved} sur ${onboardingTickets.length} tickets onboarding`,
    },
    {
      key: "handoff_sales_csm",
      label: "Handoff sales → CSM",
      value: handoffRate != null ? `${handoffRate} %` : "—",
      raw: handoffRate,
      rawUnit: "percent",
      tone: handoffRate == null ? "neutral" : handoffRate >= 50 ? "pos" : "accent",
      sub: "Customers / (opps + customers)",
    },
  ];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Service Client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Process onboarding : SLA, taux de résolution onboarding, handoff sales→CSM.
        </p>
      </header>

      <ServiceClientTabs />

      {/* Blocs pilotés par « Outil source par page » (réglage propre à la
          sous-page, héritage Vue d'ensemble sinon) — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey={SOURCE_KEYS} categories={["crm", "support"]}>

      {/* Lecture cockpit en un coup d'œil, avant les blocs détaillés —
          tuiles configurables (CTA unique : le panneau d'ajout contient aussi
          les blocs masqués de la page). */}
      <ConfigurableKpiTiles
        supabase={supabase}
        orgId={orgId}
        pageKey={PAGE_KEY}
        defaults={tiles}
        customization={custom}
        tablesPageKey={PAGE_KEY}
        hiddenBlocks={hiddenBlockList(custom, (key) => {
          const m = ({
            sla_accueil: { view: "table", description: "1ère réponse, SLA < 4h, résolution moyenne, tickets/contact" },
            onboarding_livraison: { view: "table", description: "Tickets onboarding, taux de résolution, handoff sales → CSM" },
            capacite_operationnelle: { view: "table", description: "Tickets ouverts, conversations entrantes, tickets sans réponse agent" },
          } as Record<string, { view: string; description: string }>)[key];
          const c = blockPreviewMeta(key);
          return m ? { ...m, preview: c?.preview } : c;
        })}
      />

      {!custom.hiddenBlocks.has("sla_accueil") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="sla_accueil" label="SLA d'accueil & première réponse">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            SLA d&apos;accueil & première réponse
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="SLA d'accueil & première réponse"
          subtitle="SLA support"
          team="csm"
          unit="count"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            { name: "1ère réponse moy. (h)", value: data.avgFirstResponseHours ?? null, unit: "count", cells: ["SLA cible : ≤ 4h"], spec: { entity: "tickets", groupBy: "replied", measure: "avg", field: "first_response_hours", target: "Répondu" } },
            { name: "SLA respecté (< 4h)", value: slaRate, unit: "percent", cells: ["% tickets < 4h"], spec: { entity: "tickets", groupBy: "replied", measure: "avg", field: "sla_4h_hit", target: "Répondu", multiplier: 100 } },
            { name: "Résolution moy. (h)", value: data.avgResolutionHours ?? null, unit: "count", cells: ["Cible : ≤ 24h"], spec: { entity: "tickets", groupBy: "status", measure: "avg", field: "resolution_hours", target: "closed" } },
            { name: "Tickets / contact", value: data.ticketsPerCustomer ?? null, unit: "count", cells: [`${fmt(data.distinctContactsCount)} contacts uniques`] },
            { name: "Contacts uniques", value: data.distinctContactsCount, unit: "count", cells: ["—"] },
          ]}
          footnote="Unités hétérogènes (heures, % et volumes) : pas de total agrégé."
        />
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("onboarding_livraison") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="onboarding_livraison" label="Onboarding & livraison">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Onboarding & livraison
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Onboarding & livraison"
          subtitle="onboarding"
          team="csm"
          unit="count"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            { name: "Tickets onboarding", value: onboardingTickets.length, unit: "count", cells: ["Sujet contient onboard / setup / kickoff"] },
            { name: "Onboarding résolus", value: onboardingResolved, unit: "count", cells: [`sur ${onboardingTickets.length}`] },
            { name: "Taux de résolution onboarding", value: onboardingResolutionRate, unit: "percent", cells: [`${onboardingResolved} sur ${onboardingTickets.length}`] },
            { name: "Handoff sales → CSM", value: handoffRate, unit: "percent", cells: ["Customers / (opps + customers)"] },
          ]}
          footnote="Unités hétérogènes (volumes et %) : pas de total agrégé."
        />
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("capacite_operationnelle") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="capacite_operationnelle" label="Capacité opérationnelle">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Capacité opérationnelle
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Capacité opérationnelle"
          subtitle="charge CSM"
          team="csm"
          unit="count"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            { name: "Tickets ouverts", value: data.openTickets, unit: "count", cells: ["Charge actuelle CSM"], spec: { entity: "tickets", groupBy: "status", measure: "count", target: "open" } },
            { name: "Conversations entrantes", value: snapshot.totalConversations, unit: "count", cells: ["Volume Inbox"] },
            { name: "Tickets sans réponse agent", value: data.tickets.filter((t) => !t.properties.first_agent_reply_date).length, unit: "count", tone: "neg", cells: ["À traiter en priorité"], spec: { entity: "tickets", groupBy: "replied", measure: "count", target: "Sans réponse" } },
          ]}
          footnote="Volumes de natures différentes (tickets, conversations, subs) : pas de total agrégé."
        />
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      </PageSourcesGate>

      <PageDataTables pageKey={PAGE_KEY} />

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey={SOURCE_KEYS} categories={["crm", "support"]} />
    </section>
  );
}
