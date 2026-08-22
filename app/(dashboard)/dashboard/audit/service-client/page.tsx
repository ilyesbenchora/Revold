export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { getToolKeys } from "@/lib/integrations/tool-mappings";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { fetchServiceClientData, fmt } from "@/lib/audit/service-client-data";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";
import { SimpleBarsChart } from "@/components/charts/treso-charts";
import { HBarChart } from "@/components/charts/hbar-chart";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";
import { blockPreviewMeta } from "@/lib/kpi/block-previews";

export default async function ServiceClientOverviewPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const [data, snapshot, allConnectedTools, mappedKeys] = await Promise.all([
    fetchServiceClientData(supabase, orgId),
    getHubspotSnapshot(),
    getConnectedTools(supabase, orgId),
    getToolKeys(supabase, orgId, "audit_service_client"),
  ]);

  const supportCategory = allConnectedTools.filter((t) => t.category === "support");

  // Mapping persisté dans tool_mappings.audit_service_client (Paramètres →
  // Intégrations → "Outil source par page") = single-select. Si défini, on
  // n'affiche que cet outil ; sinon fallback sur tous les supports connectés.
  const hasMapping = mappedKeys.length > 0;
  const supportConnected = hasMapping
    ? supportCategory.filter((t) => mappedKeys.includes(t.key))
    : supportCategory;

  const supportSuggestions = hasMapping
    ? []
    : Object.values(CONNECTABLE_TOOLS)
        .filter((t) => t.category === "support" && !t.comingSoon)
        .map((t) => ({ key: t.key, label: t.label, domain: t.domain, icon: t.icon }));

  // Personnalisation de la page : tuiles KPI masquées/ajoutées + blocs masqués.
  const custom = await getPageCustomization(supabase, orgId, "audit_service_client");

  // Tuiles par défaut (mêmes valeurs qu'avant — désormais masquables/remplaçables).
  const resolutionPct = data.hasData && data.tickets.length > 0
    ? Math.round((data.closedTickets / data.tickets.length) * 100)
    : null;
  const defaultTiles: DefaultTile[] = data.hasData
    ? [
        { key: "tickets_ouverts", label: "Tickets ouverts", value: String(data.openTickets), raw: data.openTickets, rawUnit: "count", tone: "accent", sub: `sur ${fmt(data.tickets.length)} analysés` },
        {
          key: "priorite_haute",
          label: "Priorité haute",
          value: String(data.urgentTickets),
          raw: data.urgentTickets,
          rawUnit: "count",
          tone: data.urgentTickets > 0 ? "neg" : "pos",
          sub: "À traiter en premier",
          verdict: data.urgentTickets === 0 ? { label: "Rien d'urgent", tone: "pos" }
            : data.urgentTickets <= 3 ? { label: "À surveiller", tone: "warn" }
            : { label: "Critique", tone: "neg" },
        },
        {
          key: "taux_resolution",
          label: "Taux de résolution",
          value: resolutionPct != null ? `${resolutionPct} %` : "—",
          raw: resolutionPct,
          rawUnit: "percent",
          tone: resolutionPct == null ? "neutral" : resolutionPct >= 80 ? "pos" : resolutionPct >= 50 ? "accent" : "neg",
          sub: "Fermés / total",
          verdict: resolutionPct == null ? undefined
            : resolutionPct >= 80 ? { label: "Excellent (> 80 %)", tone: "pos" }
            : resolutionPct >= 50 ? { label: "Correct", tone: "warn" }
            : { label: "Faible (< 50 %)", tone: "neg" },
        },
        {
          key: "resolution_moyenne",
          label: "Résolution moyenne",
          value: data.avgResolutionHours != null ? `${Math.round(data.avgResolutionHours)} h` : "—",
          raw: data.avgResolutionHours != null ? Math.round(data.avgResolutionHours) : null,
          rawUnit: "count",
          tone: "neutral",
          sub: "Temps moyen de clôture",
          verdict: data.avgResolutionHours == null ? undefined
            : data.avgResolutionHours <= 24 ? { label: "Rapide (< 24 h)", tone: "pos" }
            : data.avgResolutionHours <= 72 ? { label: "Dans la norme", tone: "warn" }
            : { label: "Lent (> 72 h)", tone: "neg" },
        },
      ]
    : [];

  // ── Séries cockpit depuis les tickets analysés : volume mensuel + priorité ──
  const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const byMonth = new Map<string, number>();
  for (const t of data.tickets) {
    const raw = t.properties.createdate;
    if (!raw) continue;
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const ticketsMonthly = [...byMonth.keys()].sort().slice(-12).map((key) => {
    const [yy, mm] = key.split("-");
    return { label: `${MONTHS_FR[Number(mm) - 1]} ${yy.slice(2)}`, value: byMonth.get(key)! };
  });

  const PRIORITY_LABELS: Record<string, string> = { URGENT: "Urgente", HIGH: "Haute", MEDIUM: "Moyenne", LOW: "Basse" };
  const byPriority = new Map<string, number>();
  for (const t of data.tickets) {
    const p = t.properties.hs_ticket_priority ?? "";
    const label = PRIORITY_LABELS[p] ?? "Sans priorité";
    byPriority.set(label, (byPriority.get(label) ?? 0) + 1);
  }
  const priorityOrder = ["Urgente", "Haute", "Moyenne", "Basse", "Sans priorité"];
  const priorityColors: Record<string, string> = { Urgente: "#e11d48", Haute: "#f59e0b", Moyenne: "#6366f1", Basse: "#10b981", "Sans priorité": "#94a3b8" };
  const ticketsByPriority = priorityOrder
    .filter((l) => (byPriority.get(l) ?? 0) > 0)
    .map((l) => ({ label: l, value: byPriority.get(l)!, color: priorityColors[l] }));

  return (
    <section className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Service Client</h1>
          <p className="mt-1 text-sm text-slate-500">
            Audit cross-source : tickets, satisfaction, churn et expansion CSM.
            {data.hasData && ` (${data.tickets.length} tickets analysés)`}
          </p>
        </div>
      </header>

      <ServiceClientTabs />

      <InsightLockedBlock
        previewTitle={`Analyse IA service client (score ${data.score}/100)`}
        previewBody="L'IA Revold corrèle tickets support, satisfaction client et risque de churn pour recommander les actions CSM les plus impactantes sur la rétention."
      />

      {/* Blocs pilotés par « Outil source par page » — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey="audit_service_client" categories={["crm", "support"]}>

      {/* ── Lecture en un coup d'œil : tuiles KPI configurables ── */}
      <ConfigurableKpiTiles
        supabase={supabase}
        orgId={orgId}
        pageKey="audit_service_client"
        defaults={defaultTiles}
        customization={custom}
        tablesPageKey="audit_service_client"
        hiddenBlocks={hiddenBlockList(custom, (key) => {
          const m = ({
            tickets_volume: { view: "table", description: "Volume de tickets : analysés, portail, ouverts, fermés, priorité haute" },
            satisfaction: { view: "table", description: "Subscriptions, conversations entrantes, feedback CSAT/NPS" },
          } as Record<string, { view: string; description: string }>)[key];
          const c = blockPreviewMeta(key);
          return m ? { ...m, preview: c?.preview } : c;
        })}
      />

      {!custom.hiddenBlocks.has("tickets_volume") && (
      <RemovableBlock pageKey="audit_service_client" blockKey="tickets_volume" label="Volume de tickets">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Volume de tickets
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Volume de tickets"
          subtitle="tickets"
          team="csm"
          unit="count"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            // « sur N au total » n'était affiché par la tuile que si le portail
            // en contenait davantage que ce qui a été analysé : on garde la
            // condition d'origine plutôt que de l'afficher systématiquement.
            { name: "Total tickets analysés", value: data.hasData ? data.tickets.length : null, unit: "count", cells: [snapshot.totalTickets > data.tickets.length ? `sur ${fmt(snapshot.totalTickets)} au total` : "—"] },
            { name: "Tickets portail", value: snapshot.totalTickets, unit: "count", cells: ["Tous tickets du portail"] },
            { name: "Ouverts / en cours", value: data.hasData ? data.openTickets : null, unit: "count", cells: ["—"] },
            { name: "Fermés / résolus", value: data.hasData ? data.closedTickets : null, unit: "count", tone: "pos", cells: ["—"] },
            { name: "Priorité haute", value: data.hasData ? data.urgentTickets : null, unit: "count", tone: "neg", cells: ["—"] },
          ]}
          footnote="Source : tickets HubSpot. Le total portail inclut les tickets hors périmètre analysé."
        />

        {/* Graphes cockpit : volume mensuel + répartition par priorité */}
        {(ticketsMonthly.length > 1 || ticketsByPriority.length > 0) && (
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {ticketsMonthly.length > 1 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-800">Tickets créés par mois</p>
                <p className="mb-2 text-[10px] text-slate-400">Volume entrant · 12 derniers mois</p>
                <SimpleBarsChart points={ticketsMonthly} unit="count" color="#0ea5e9" />
              </div>
            )}
            {ticketsByPriority.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-800">Répartition par priorité</p>
                <p className="mb-3 text-[10px] text-slate-400">Tickets analysés · part du total</p>
                <HBarChart unit="count" items={ticketsByPriority} />
              </div>
            )}
          </div>
        )}
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("satisfaction") && (
      <RemovableBlock pageKey="audit_service_client" blockKey="satisfaction" label="Signaux satisfaction & engagement">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Signaux satisfaction & engagement
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Signaux satisfaction & engagement"
          subtitle="satisfaction"
          team="csm"
          unit="count"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            { name: "Subscriptions actives", value: snapshot.activeSubscriptions, unit: "count", cells: [`sur ${fmt(snapshot.totalSubscriptions)} au total`] },
            { name: "Subscriptions totales", value: snapshot.totalSubscriptions, unit: "count", cells: ["—"] },
            { name: "Conversations entrantes", value: snapshot.totalConversations, unit: "count", cells: ["Inbox HubSpot"] },
            { name: "Feedback (CSAT/NPS)", value: snapshot.feedbackCount, unit: "count", cells: ["feedback_submissions"] },
          ]}
          footnote="Source : snapshot HubSpot (subscriptions, Inbox, feedback_submissions)."
        />
      </CollapsibleBlock>
      </RemovableBlock>
      )}


      {!data.hasData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucun ticket dans HubSpot. Activez Service Hub ou connectez vos outils support
            (Zendesk, Intercom, Freshdesk) à HubSpot pour alimenter cette page.
          </p>
        </div>
      )}

      </PageSourcesGate>

      <PageDataTables pageKey="audit_service_client" />

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey="audit_service_client" />
    </section>
  );
}
