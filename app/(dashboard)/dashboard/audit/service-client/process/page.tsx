export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { fetchServiceClientData, fmt } from "@/lib/audit/service-client-data";
import { BlockDataTable } from "@/components/data-tables/block-data-table";

export default async function ServiceClientProcessPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const [data, snapshot] = await Promise.all([
    fetchServiceClientData(token),
    getHubspotSnapshot(),
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
    .map((t) => parseFloat(t.properties.hs_time_to_first_response ?? ""))
    .filter((n) => !isNaN(n) && n > 0);
  const slaRespected = ticketsWithFirstResponse.filter((ms) => ms <= 4 * 3_600_000).length;
  const slaRate = ticketsWithFirstResponse.length > 0
    ? Math.round((slaRespected / ticketsWithFirstResponse.length) * 100)
    : null;

  // Customers handoff = % d'opportunités converties en customer (snapshot)
  const handoffRate = snapshot.opportunitiesCount > 0
    ? Math.round((snapshot.customersCount / (snapshot.opportunitiesCount + snapshot.customersCount)) * 100)
    : null;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Service Client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Process onboarding : SLA, taux de résolution onboarding, handoff sales→CSM.
        </p>
      </header>

      <ServiceClientTabs />

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
            { name: "1ère réponse moy. (h)", value: data.avgFirstResponseHours ?? null, unit: "count", cells: ["SLA cible : ≤ 4h"] },
            { name: "SLA respecté (< 4h)", value: slaRate, unit: "percent", cells: ["% tickets < 4h"] },
            { name: "Résolution moy. (h)", value: data.avgResolutionHours ?? null, unit: "count", cells: ["Cible : ≤ 24h"] },
            { name: "Tickets / contact", value: data.ticketsPerCustomer ?? null, unit: "count", cells: [`${fmt(data.distinctContactsCount)} contacts uniques`] },
            { name: "Contacts uniques", value: data.distinctContactsCount, unit: "count", cells: ["—"] },
          ]}
          footnote="Unités hétérogènes (heures, % et volumes) : pas de total agrégé."
        />
      </CollapsibleBlock>

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
            { name: "Tickets ouverts", value: data.openTickets, unit: "count", cells: ["Charge actuelle CSM"] },
            { name: "Conversations entrantes", value: snapshot.totalConversations, unit: "count", cells: ["Volume Inbox"] },
            { name: "Subscriptions actives", value: snapshot.activeSubscriptions, unit: "count", cells: ["Portefeuille à servir"] },
          ]}
          footnote="Volumes de natures différentes (tickets, conversations, subs) : pas de total agrégé."
        />
      </CollapsibleBlock>
    </section>
  );
}
