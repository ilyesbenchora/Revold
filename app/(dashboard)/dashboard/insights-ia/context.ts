import { SupabaseClient } from "@supabase/supabase-js";
import { selectInsights, type InsightContext } from "@/lib/ai/insights-library";
import { detectIntegrations, type DetectedIntegration } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions, getToolCategory } from "@/lib/reports/report-suggestions";
import { buildCrossSourceContext, selectCrossSourceInsights } from "@/lib/insights/cross-source";
import { generateDataModelInsights } from "@/lib/insights/data-model-insights";
import { filterBusinessIntegrations } from "@/lib/integrations/integration-score";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { fetchHubSpotEcosystemCounts, EMPTY_ECOSYSTEM_COUNTS } from "@/lib/integrations/hubspot";

const PCT = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 100) : 0);

export { selectInsights };
export type { InsightContext };

export type IntInsight = {
  key: string;
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  recommendation: string;
};

/**
 * Génère les liens HubSpot dynamiquement à partir du portal_id réel de l'org.
 * Évite la fuite multi-tenant des anciens liens hardcodés vers le portail démo.
 *
 * Si portal_id est null (ex: org sans OAuth), retourne `https://app.hubspot.com`
 * (la page d'accueil HubSpot, l'utilisateur sera redirigé vers son propre portail).
 */
export function buildHubspotLinks(portalId: string | null | undefined): {
  contacts: string;
  deals: string;
  properties: string;
} {
  const id = portalId ?? "";
  if (!id) {
    return {
      contacts: "https://app.hubspot.com/",
      deals: "https://app.hubspot.com/",
      properties: "https://app.hubspot.com/",
    };
  }
  return {
    contacts: `https://app.hubspot.com/contacts/${id}/objects/0-1`,
    deals: `https://app.hubspot.com/contacts/${id}/objects/0-3`,
    properties: `https://app.hubspot.com/contacts/${id}/settings/properties`,
  };
}

/**
 * Récupère le portal_id de l'org connectée via OAuth.
 * Cached request-scoped via React cache().
 */
export async function getOrgHubspotPortalId(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("integrations")
    .select("portal_id")
    .eq("organization_id", orgId)
    .eq("provider", "hubspot")
    .eq("is_active", true)
    .single();
  return (data?.portal_id as string | null) ?? null;
}

/**
 * Compte exact via /search (POST) qui retourne `total` sans charger les rows.
 * Résilient : retourne 0 en cas d'erreur (scope manquant, propriété inconnue).
 */
async function fetchHubSpotCount(token: string, objectType: string, body?: object): Promise<number> {
  try {
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1, ...body }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data.total === "number" ? data.total : 0;
  } catch {
    return 0;
  }
}

/**
 * Récupère la distribution complète des lifecycle stages depuis HubSpot.
 * Lit d'abord la définition de la propriété `lifecyclestage` (qui inclut
 * les stages custom de l'org), puis compte chaque stage en parallèle.
 *
 * C'est ESSENTIEL pour avoir des chiffres justes : un client peut avoir
 * 6089 leads / 2 MQL / 10k opportunities / 8 customers — impossible de
 * connaître la distribution sans interroger les options de la propriété
 * et compter chaque valeur.
 */
async function fetchLifecycleDistribution(token: string): Promise<{
  byStage: Record<string, { label: string; count: number }>;
  total: number;
  leadsLikeCount: number; // subscriber + lead + MQL
  oppsLikeCount: number;  // SQL + opportunity + customer + evangelist
  customersCount: number;
}> {
  // 1. Définition de la propriété (inclut les options custom)
  let stages: Array<{ value: string; label: string }> = [];
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/properties/contacts/lifecyclestage", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      stages = ((data.options ?? []) as Array<{ value: string; label: string; hidden?: boolean }>)
        .filter((o) => !o.hidden);
    }
  } catch {}

  // Si on n'a pas pu récupérer les options, fallback sur les stages standard
  if (stages.length === 0) {
    stages = [
      { value: "subscriber", label: "Subscriber" },
      { value: "lead", label: "Lead" },
      { value: "marketingqualifiedlead", label: "Marketing Qualified Lead" },
      { value: "salesqualifiedlead", label: "Sales Qualified Lead" },
      { value: "opportunity", label: "Opportunity" },
      { value: "customer", label: "Customer" },
      { value: "evangelist", label: "Evangelist" },
      { value: "other", label: "Other" },
    ];
  }

  // 2. Count par stage en parallèle
  const counts = await Promise.all(
    stages.map(async (s) => {
      const c = await fetchHubSpotCount(token, "contacts", {
        filterGroups: [{ filters: [{ propertyName: "lifecyclestage", operator: "EQ", value: s.value }] }],
      });
      return { stage: s.value, label: s.label, count: c };
    }),
  );

  const byStage: Record<string, { label: string; count: number }> = {};
  let total = 0;
  for (const c of counts) {
    byStage[c.stage] = { label: c.label, count: c.count };
    total += c.count;
  }

  // 3. Buckets sémantiques. Match sur les valeurs HubSpot standards ET
  //    sur les valeurs custom (par label substring) pour robustness.
  const matchAny = (stage: string, label: string, needles: string[]): boolean => {
    const s = `${stage} ${label}`.toLowerCase();
    return needles.some((n) => s.includes(n.toLowerCase()));
  };

  let leadsLike = 0;
  let oppsLike = 0;
  let customers = 0;
  for (const c of counts) {
    if (matchAny(c.stage, c.label, ["subscriber", "lead", "marketingqualifiedlead", "mql", "marketing qualified"])) {
      leadsLike += c.count;
    }
    if (matchAny(c.stage, c.label, ["salesqualifiedlead", "sql", "sales qualified", "opportunity", "opportunit", "customer", "client", "evangelist"])) {
      oppsLike += c.count;
    }
    if (matchAny(c.stage, c.label, ["customer", "client"])) {
      customers += c.count;
    }
  }

  return {
    byStage,
    total,
    leadsLikeCount: leadsLike,
    oppsLikeCount: oppsLike,
    customersCount: customers,
  };
}

/**
 * Récupère TOUS les stats deals/contacts/companies directement depuis l'API
 * HubSpot (source de vérité). Ne dépend plus de la sync Supabase.
 *
 * 17 requêtes en parallèle sur /search?limit=1 — l'endpoint renvoie le total
 * sans charger les rows donc très rapide et économique en quota HubSpot.
 */
async function fetchHubSpotFullContext(token: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime();

  const [
    totalDeals,
    wonDeals,
    lostDeals,
    dealsNoNextActivity,
    dealsNoAmount,
    dealsNoCloseDate,
    dealsStagnant,
    totalContacts,
    orphansCount,
    contactsNoPhone,
    contactsNoTitle,
    totalCompanies,
    companiesNoIndustry,
    companiesNoRevenue,
    lifecycle,
  ] = await Promise.all([
    // Deals
    fetchHubSpotCount(token, "deals"),
    fetchHubSpotCount(token, "deals", { filterGroups: [{ filters: [{ propertyName: "hs_is_closed_won", operator: "EQ", value: "true" }] }] }),
    fetchHubSpotCount(token, "deals", { filterGroups: [{ filters: [{ propertyName: "hs_is_closed", operator: "EQ", value: "true" }, { propertyName: "hs_is_closed_won", operator: "NEQ", value: "true" }] }] }),
    fetchHubSpotCount(token, "deals", {
      filterGroups: [{
        filters: [
          { propertyName: "hs_is_closed", operator: "NEQ", value: "true" },
          { propertyName: "notes_next_activity_date", operator: "NOT_HAS_PROPERTY" },
        ],
      }],
    }),
    fetchHubSpotCount(token, "deals", { filterGroups: [{ filters: [{ propertyName: "amount", operator: "NOT_HAS_PROPERTY" }] }] }),
    fetchHubSpotCount(token, "deals", { filterGroups: [{ filters: [{ propertyName: "closedate", operator: "NOT_HAS_PROPERTY" }] }] }),
    fetchHubSpotCount(token, "deals", {
      filterGroups: [{
        filters: [
          { propertyName: "hs_is_closed", operator: "NEQ", value: "true" },
          { propertyName: "notes_next_activity_date", operator: "NOT_HAS_PROPERTY" },
          { propertyName: "notes_last_contacted", operator: "LT", value: String(sevenDaysAgo) },
        ],
      }],
    }),
    // Contacts
    fetchHubSpotCount(token, "contacts"),
    fetchHubSpotCount(token, "contacts", {
      filterGroups: [{
        filters: [{ propertyName: "associatedcompanyid", operator: "NOT_HAS_PROPERTY" }],
      }],
    }),
    fetchHubSpotCount(token, "contacts", { filterGroups: [{ filters: [{ propertyName: "phone", operator: "NOT_HAS_PROPERTY" }] }] }),
    fetchHubSpotCount(token, "contacts", { filterGroups: [{ filters: [{ propertyName: "jobtitle", operator: "NOT_HAS_PROPERTY" }] }] }),
    // Companies
    fetchHubSpotCount(token, "companies"),
    fetchHubSpotCount(token, "companies", { filterGroups: [{ filters: [{ propertyName: "industry", operator: "NOT_HAS_PROPERTY" }] }] }),
    fetchHubSpotCount(token, "companies", { filterGroups: [{ filters: [{ propertyName: "annualrevenue", operator: "NOT_HAS_PROPERTY" }] }] }),
    // ── DISTRIBUTION LIFECYCLE STAGES (vrai count par stage) ──
    fetchLifecycleDistribution(token),
  ]);

  const closedTotal = wonDeals + lostDeals;
  const openDeals = Math.max(0, totalDeals - closedTotal);

  // opportunitiesCount = vraie distribution (SQL + Opp + Customer + Evangelist)
  // Beaucoup plus juste que le filtre IN précédent qui ratait les stages custom.
  const opportunitiesCount = lifecycle.oppsLikeCount;
  const leadsCount = lifecycle.leadsLikeCount;

  return {
    totalDeals,
    wonDeals,
    lostDeals,
    openDeals,
    closingRate: closedTotal > 0 ? Math.round((wonDeals / closedTotal) * 100) : 0,
    dealsNoNextActivity,
    dealsNoActivity: 0,
    dealsNoAmount,
    dealsNoCloseDate,
    stagnantDeals: dealsStagnant,
    totalContacts,
    leadsCount,
    opportunitiesCount,
    conversionRate: totalContacts > 0 ? Math.round((opportunitiesCount / totalContacts) * 100) : 0,
    orphansCount,
    orphanRate: totalContacts > 0 ? Math.round((orphansCount / totalContacts) * 100) : 0,
    contactsNoPhone,
    contactsNoTitle,
    totalCompanies,
    companiesNoIndustry,
    companiesNoRevenue,
    // Lifecycle distribution complète (utilisable par les templates)
    lifecycleByStage: lifecycle.byStage,
    customersCount: lifecycle.customersCount,
  };
}

export async function buildContext(supabase: SupabaseClient, orgId: string): Promise<InsightContext> {
  const token = await getHubSpotToken(supabase, orgId);

  // ═══ STRATÉGIE : HubSpot est la source de vérité ═══
  // Si OAuth HubSpot connecté, on prend TOUT directement de l'API HubSpot
  // (deals, contacts, companies stats + ecosystem counts + owners). On ignore
  // les compteurs Supabase qui peuvent être vides/stales tant que la sync
  // canonique n'a pas tourné.
  // Si pas de token HubSpot → fallback Supabase (cas legacy ou avant connexion).

  if (token) {
    const [hsCore, ecosystem, ownersCount, contactsNoEmail] = await Promise.all([
      fetchHubSpotFullContext(token),
      fetchHubSpotEcosystemCounts(token),
      fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => (d.results ?? []).length)
        .catch(() => 0),
      fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 1,
          filterGroups: [{ filters: [{ propertyName: "email", operator: "NOT_HAS_PROPERTY" }] }],
        }),
      })
        .then((r) => (r.ok ? r.json() : { total: 0 }))
        .then((d) => d.total ?? 0)
        .catch(() => 0),
    ]);

    return {
      ...hsCore,
      contactsNoEmail,
      ticketsCount: ecosystem.tickets,
      conversationsCount: ecosystem.conversations,
      feedbackCount: ecosystem.feedbackSubmissions,
      leadsObjectCount: ecosystem.leads,
      quotesCount: ecosystem.quotes,
      lineItemsCount: ecosystem.lineItems,
      sequencesCount: ecosystem.sequences,
      forecastsCount: ecosystem.forecasts,
      goalsCount: ecosystem.goals,
      invoicesCount: ecosystem.invoices,
      subscriptionsCount: ecosystem.subscriptions,
      marketingCampaignsCount: ecosystem.marketingCampaigns,
      marketingEventsCount: ecosystem.marketingEvents,
      formsCount: ecosystem.forms,
      customObjectsCount: ecosystem.customObjects,
      listsCount: ecosystem.lists,
      workflowsCount: ecosystem.workflows,
      workflowsActiveCount: ecosystem.workflowsActive,
      ownersCount,
      teamsCount: ecosystem.teams,
      appointmentsCount: ecosystem.appointments,
    };
  }

  // ── FALLBACK SUPABASE (pas de token HubSpot) ──
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [
    { count: totalDeals },
    { count: wonDeals },
    { count: lostDeals },
    { count: openDeals },
    { count: dealsNoNextActivity },
    { count: dealsNoActivity },
    { count: dealsNoAmount },
    { count: dealsNoCloseDate },
    { count: stagnantDeals },
    { count: totalContacts },
    { count: opportunitiesCount },
    { count: orphansCount },
    { count: contactsNoPhone },
    { count: contactsNoTitle },
    { count: totalCompanies },
    { count: companiesNoIndustry },
    { count: companiesNoRevenue },
  ] = await Promise.all([
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_lost", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).is("next_activity_date", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).eq("sales_activities_count", 0),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).lte("amount", 0),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("close_date", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).is("next_activity_date", null).lt("last_contacted_at", sevenDaysAgo),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("company_id", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("phone", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("title", null),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("industry", null),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("annual_revenue", null),
  ]);

  const tDeals = totalDeals ?? 0;
  const won = wonDeals ?? 0;
  const lost = lostDeals ?? 0;
  const tContacts = totalContacts ?? 0;
  const opps = opportunitiesCount ?? 0;
  const orphans = orphansCount ?? 0;

  return {
    totalDeals: tDeals,
    openDeals: openDeals ?? 0,
    wonDeals: won,
    lostDeals: lost,
    closingRate: (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0,
    dealsNoNextActivity: dealsNoNextActivity ?? 0,
    dealsNoActivity: dealsNoActivity ?? 0,
    dealsNoAmount: dealsNoAmount ?? 0,
    dealsNoCloseDate: dealsNoCloseDate ?? 0,
    stagnantDeals: stagnantDeals ?? 0,
    totalContacts: tContacts,
    leadsCount: tContacts - opps,
    opportunitiesCount: opps,
    conversionRate: tContacts > 0 ? Math.round((opps / tContacts) * 100) : 0,
    orphansCount: orphans,
    orphanRate: tContacts > 0 ? Math.round((orphans / tContacts) * 100) : 0,
    contactsNoPhone: contactsNoPhone ?? 0,
    contactsNoTitle: contactsNoTitle ?? 0,
    totalCompanies: totalCompanies ?? 0,
    companiesNoIndustry: companiesNoIndustry ?? 0,
    companiesNoRevenue: companiesNoRevenue ?? 0,
  };
}

export async function fetchTrackingStats(token?: string | null): Promise<{ trackingSample: number; onlineContacts: number }> {
  if (!token) return { trackingSample: 0, onlineContacts: 0 };
  try {
    const res = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=hs_analytics_source",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { trackingSample: 0, onlineContacts: 0 };
    const data = await res.json();
    let online = 0;
    const onlineSources = ["ORGANIC_SEARCH", "PAID_SEARCH", "PAID_SOCIAL", "SOCIAL_MEDIA", "EMAIL_MARKETING", "REFERRALS", "DIRECT_TRAFFIC"];
    const results = (data.results ?? []) as Array<{ properties: { hs_analytics_source?: string } }>;
    results.forEach((c) => {
      const src = c.properties.hs_analytics_source || "";
      if (onlineSources.includes(src)) online++;
    });
    return { trackingSample: results.length, onlineContacts: online };
  } catch {
    return { trackingSample: 0, onlineContacts: 0 };
  }
}

// ── Dismissals ──

export async function fetchDismissals(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ dismissedKeys: Set<string>; doneCount: number; removedCount: number }> {
  const { data: dismissals } = await supabase
    .from("insight_dismissals")
    .select("*")
    .eq("organization_id", orgId);

  const allDismissed = (dismissals ?? []) as Array<{ template_key: string; status?: string }>;
  const dismissedKeys = new Set(allDismissed.map((d) => d.template_key));
  const doneCount = allDismissed.filter((d) => !d.status || d.status === "done").length;
  const removedCount = allDismissed.filter((d) => d.status === "removed").length;

  return { dismissedKeys, doneCount, removedCount };
}

// ── Integration Insights ──

export async function fetchIntegrationInsights(
  token?: string | null,
): Promise<{
  detectedIntegrations: DetectedIntegration[];
  integrationInsights: IntInsight[];
  totalReportSuggestions: number;
}> {
  let detectedIntegrations: DetectedIntegration[] = [];
  if (token) {
    try {
      detectedIntegrations = await detectIntegrations(token);
    } catch {}
  }

  const integrationInsights: IntInsight[] = [];

  detectedIntegrations.forEach((int) => {
    const cat = getToolCategory(int.key);

    // 1. Adoption faible : moins de 2 utilisateurs distincts → conduite du changement
    if (int.distinctUsers > 0 && int.distinctUsers < 2) {
      integrationInsights.push({
        key: `int_low_adoption_${int.key}`,
        severity: "warning",
        title: `${int.icon} ${int.label} : adoption très faible (${int.distinctUsers} utilisateur)`,
        body: `Seul ${int.distinctUsers} utilisateur exploite ${int.label} alors que l'outil est connecté au CRM. C'est un signal de conduite du changement à travailler : formation, ambassadeur interne ou rituel d'équipe.`,
        recommendation: `Identifier un référent ${int.label} dans l'équipe, organiser une session de formation et suivre l'usage hebdomadaire dans Revold.`,
      });
    }

    // 2. Outil avec propriétés mais 0% d'enrichissement → outil branché sans usage
    if (int.totalProperties > 0 && int.enrichmentRate === 0) {
      integrationInsights.push({
        key: `int_no_enrichment_${int.key}`,
        severity: "warning",
        title: `${int.icon} ${int.label} : ${int.totalProperties} propriétés synchronisées mais 0% d'enrichissement`,
        body: `${int.label} a installé ses propriétés dans HubSpot mais aucune donnée n'est remontée. L'intégration est probablement mal configurée ou les utilisateurs ne déclenchent pas l'outil depuis le CRM.`,
        recommendation: `Vérifier la configuration de l'intégration ${int.label} et relancer une formation sur les bons gestes dans HubSpot.`,
      });
    }

    // 3. Outil détecté sans propriétés (via source d'enregistrement uniquement)
    if (int.totalProperties === 0 && int.detectionMethods.includes("source_detail")) {
      integrationInsights.push({
        key: `int_source_only_${int.key}`,
        severity: "info",
        title: `${int.icon} ${int.label} : ${int.enrichedRecords.toLocaleString("fr-FR")} enregistrements détectés sans propriétés`,
        body: `${int.label} alimente votre CRM (${int.enrichedRecords} enregistrements détectés) mais aucune propriété personnalisée n'est synchronisée. Vous perdez de la donnée exploitable pour vos rapports.`,
        recommendation: `Installer la version officielle de l'app ${int.label} sur le marketplace HubSpot pour récupérer toutes les propriétés et activer les rapports Revold associés.`,
      });
    }

    // 4. Suggestion de rapport selon la catégorie d'outil
    if (cat === "outbound") {
      integrationInsights.push({
        key: `int_report_outbound_${int.key}`,
        severity: "info",
        title: `📈 Activer le rapport « Outbound → Deals gagnés » pour ${int.label}`,
        body: `${int.label} est un outil de prospection. Revold peut croiser les séquences envoyées avec les opportunités créées et les deals gagnés pour mesurer le ROI réel de votre outbound.`,
        recommendation: `Activer le rapport « Outbound → Opportunités → Deals gagnés » dans la nouvelle page Rapports pour visualiser le funnel complet et identifier les meilleures séquences.`,
      });
    }

    if (cat === "calling") {
      integrationInsights.push({
        key: `int_report_calling_${int.key}`,
        severity: "info",
        title: `📞 Activer le rapport « Activité téléphonique → Pipeline » pour ${int.label}`,
        body: `Les ${int.enrichedRecords.toLocaleString("fr-FR")} appels passés via ${int.label} peuvent être croisés avec la création et la progression des deals pour mesurer l'impact du téléphone sur votre pipeline.`,
        recommendation: `Activer le rapport téléphonie dans la page Rapports pour identifier les meilleurs créneaux et le bon nombre de tentatives par lead.`,
      });
    }

    if (cat === "billing") {
      integrationInsights.push({
        key: `int_report_billing_${int.key}`,
        severity: "info",
        title: `💳 Activer la réconciliation Deals ↔ Factures avec ${int.label}`,
        body: `${int.label} gère votre facturation. Revold peut croiser automatiquement les opportunités gagnées dans HubSpot avec les paiements réels pour fiabiliser votre forecast et faire apparaître les écarts CA forecast vs réalisé.`,
        recommendation: `Activer le rapport « Réconciliation Deals gagnés ↔ Factures encaissées » dans la page Rapports pour piloter le cash et plus seulement le pipeline.`,
      });
    }

    if (cat === "esign") {
      integrationInsights.push({
        key: `int_report_esign_${int.key}`,
        severity: "info",
        title: `📝 Activer le rapport « Cycle de signature » pour ${int.label}`,
        body: `${int.label} gère vos contrats. Revold peut mesurer le délai entre l'envoi du contrat et la signature, identifier les blocages et calculer le time-to-close réel par commercial.`,
        recommendation: `Activer le rapport e-signature dans la page Rapports pour réduire le cycle de vente et augmenter le taux de transformation closing.`,
      });
    }

    if (cat === "enrichment") {
      integrationInsights.push({
        key: `int_report_enrichment_${int.key}`,
        severity: "info",
        title: `💎 Mesurer le ROI de ${int.label}`,
        body: `${int.label} enrichit votre base contacts. Revold peut comparer les contacts enrichis vs non-enrichis sur le taux de conversion et le CA moyen pour justifier l'investissement.`,
        recommendation: `Activer le rapport « ROI de l'enrichissement » dans la page Rapports pour visualiser l'impact business de l'enrichissement.`,
      });
    }

    if (cat === "support") {
      integrationInsights.push({
        key: `int_report_support_${int.key}`,
        severity: "info",
        title: `🎧 Activer le rapport « Tickets → Risque de churn » pour ${int.label}`,
        body: `${int.label} centralise vos tickets support. Revold peut croiser le volume de tickets avec les renouvellements pour anticiper le churn des comptes à risque.`,
        recommendation: `Activer le rapport churn dans la page Rapports pour permettre à la CSM d'agir en proactif.`,
      });
    }

    if (cat === "conv_intel") {
      integrationInsights.push({
        key: `int_report_conv_${int.key}`,
        severity: "info",
        title: `🎙️ Analyser les appels gagnants vs perdus avec ${int.label}`,
        body: `${int.label} analyse vos conversations commerciales. Revold peut comparer les patterns (talk ratio, objections, mots-clés) entre les deals gagnés et perdus pour affiner votre méthode de vente.`,
        recommendation: `Activer le rapport conversational intelligence dans la page Rapports pour un coaching commercial data-driven.`,
      });
    }
  });

  // 5. Insight de niveau global : peu d'outils métiers connectés → opportunité Revold
  const businessToolCount = detectedIntegrations.filter(
    (i) => getToolCategory(i.key) !== "other",
  ).length;
  if (businessToolCount > 0 && businessToolCount < 3) {
    integrationInsights.push({
      key: "int_global_low_stack",
      severity: "info",
      title: `🔌 Seulement ${businessToolCount} outil${businessToolCount > 1 ? "s" : ""} métier détecté${businessToolCount > 1 ? "s" : ""} dans votre stack`,
      body: `Plus vous connectez de sources (prospection, téléphonie, billing, e-sign, support) à HubSpot, plus Revold peut générer des rapports croisés à forte valeur. Aujourd'hui, certaines briques de votre business ne remontent pas dans le CRM.`,
      recommendation: `Consultez la page Intégration pour découvrir les outils à connecter, et la page Rapports pour voir ce que Revold débloquera ensuite.`,
    });
  }

  // ── ALWAYS-ON integration recommendations (universelles, indépendantes du stack détecté) ──
  integrationInsights.push(
    {
      key: "int_audit_stack_quarterly",
      severity: "info",
      title: "🔌 Audit trimestriel de la stack outils",
      body: "Les apps connectées s'accumulent : trial jamais désactivé, app remplacée non débranchée, doublons. Audit régulier = stack lean + sécurité renforcée.",
      recommendation: "Tous les 3 mois : lister les apps, leur owner, leur usage réel. Désactiver/désinstaller les inactives. Documenter pourquoi chaque app est en place.",
    },
    {
      key: "int_consolidate_stack",
      severity: "info",
      title: "🔌 Identifier les opportunités de consolidation outils",
      body: "Beaucoup de stacks ont 2 outils qui font la même chose (ex: 2 séquenceurs, 2 outils d'enrichissement). Consolidation = -30% de coût + meilleure cohérence data.",
      recommendation: "Lister les redondances dans la stack. Choisir l'outil le plus utilisé, migrer les utilisateurs, négocier la résiliation de l'autre.",
    },
    {
      key: "int_native_vs_third_party",
      severity: "info",
      title: "🔌 Privilégier les apps natives marketplace HubSpot",
      body: "Les apps natives marketplace HubSpot sont mieux maintenues, ont un meilleur support et évitent les casses lors des updates HubSpot.",
      recommendation: "Pour chaque tool tiers en place, vérifier s'il existe une app marketplace officielle. Si oui, basculer dessus.",
    },
    {
      key: "int_data_governance",
      severity: "info",
      title: "🔌 Mettre en place une gouvernance data inter-outils",
      body: "Sans gouvernance, chaque outil ajoute ses propres champs et workflows. Le CRM devient une accumulation incohérente.",
      recommendation: "Créer un comité data trimestriel : qui peut ajouter des champs, sous quelles règles, quel naming, quel cleanup. Documenté.",
    },
    {
      key: "int_security_audit",
      severity: "warning",
      title: "🔌 Audit sécurité des accès tiers",
      body: "Chaque app connectée peut potentiellement lire / écrire dans le CRM. Une app compromise = fuite de données massive.",
      recommendation: "Pour chaque app connectée : vérifier les scopes accordés (principle of least privilege), changer les credentials annuellement, alertes sur les accès anormaux.",
    },
    {
      key: "int_business_continuity",
      severity: "info",
      title: "🔌 Plan de continuité en cas de panne d'un outil",
      body: "Si HubSpot, Stripe, Salesforce tombent, comment l'équipe continue à bosser ? Sans plan, la productivité chute à zéro.",
      recommendation: "Documenter pour chaque outil critique : workaround manuel, contact support, SLA fournisseur, exports backup réguliers.",
    },
    {
      key: "int_onboarding_kit",
      severity: "info",
      title: "🔌 Onboarding kit pour les nouveaux arrivants",
      body: "Sans onboarding kit, chaque nouveau collaborateur perd 2 semaines à découvrir la stack. Et utilise mal les outils.",
      recommendation: "Document Notion/Confluence : liste des outils, à quoi sert chacun, qui est l'owner, formations vidéo. Mis à jour à chaque évolution.",
    },
    {
      key: "int_workflow_documentation",
      severity: "info",
      title: "🔌 Documenter les workflows automatisés critiques",
      body: "Les workflows tournent en silence. Un changement non-documenté peut casser le funnel sans qu'on s'en aperçoive pendant des semaines.",
      recommendation: "Pour chaque workflow critique : ce qu'il fait, qui l'a créé, quand il a été modifié, comment le tester. Audit avant chaque update HubSpot.",
    },
    {
      key: "int_field_mapping_check",
      severity: "warning",
      title: "🔌 Vérifier les mappings champs entre outils",
      body: "Les apps tierces mappent leurs champs sur des champs HubSpot. Si un champ HubSpot est renommé/supprimé, le mapping casse silencieusement.",
      recommendation: "Audit semestriel : lister tous les mappings, vérifier qu'ils fonctionnent, corriger les ruptures.",
    },
    {
      key: "int_revops_role",
      severity: "info",
      title: "🔌 Désigner un RevOps owner pour la stack",
      body: "Sans owner unique, personne n'est responsable de la cohérence inter-outils. Les problèmes restent en suspens 6+ mois.",
      recommendation: "Désigner un RevOps (ou DRH-like role pour les petites structures). Mission : qualité data + workflow design + tools governance. KPIs trackés.",
    },
    {
      key: "int_internal_help_channel",
      severity: "info",
      title: "🔌 Créer un canal Slack dédié aux questions outils",
      body: "Les questions outils traînent dans les DMs ou en réunion. Un canal centralisé = entraide rapide + base de connaissances émergente.",
      recommendation: "Créer #stack-help sur Slack. Demande de réponse < 1h. Capture des FAQs récurrentes vers la doc.",
    },
    {
      key: "int_metrics_dashboard",
      severity: "info",
      title: "🔌 Dashboard d'usage des outils",
      body: "Sans dashboard d'usage, impossible de prouver le ROI d'un outil ou de détecter une chute d'adoption.",
      recommendation: "Pour chaque outil critique : utilisateurs actifs / mois, actions effectuées, comparaison avec mois N-1. Alerte si chute > 20%.",
    },
    {
      key: "int_quarterly_demo",
      severity: "info",
      title: "🔌 Demo trimestrielle des nouveautés outils",
      body: "Les outils sortent des features tous les mois. Sans demo régulière, l'équipe loupe 80% des nouveautés et n'utilise que 20% du potentiel.",
      recommendation: "Tous les trimestres : 30min de demo des nouveautés HubSpot + apps clés. Diapo + replay disponible. Champion désigné.",
    },
    {
      key: "int_partner_managed_services",
      severity: "info",
      title: "🔌 Évaluer un partenaire HubSpot pour la maintenance",
      body: "Pour les stacks complexes, un partenaire HubSpot certifié coûte 1-3k€/mois et économise 5-10x ce coût en évitant les bugs et en optimisant.",
      recommendation: "Demander 3 devis à des partenaires HubSpot Diamond/Elite. Comparer offres + retours clients. Test de 3 mois avant engagement long.",
    },
    {
      key: "int_revold_full_stack",
      severity: "info",
      title: "🔌 Connecter toute la stack à Revold pour cross-source",
      body: "Plus Revold a accès à votre stack complète (HubSpot + Stripe + Zendesk + Pipedrive...), plus la valeur des rapports cross-source explose.",
      recommendation: "Connecter au minimum : CRM + facturation + support + outil de prospection. Chaque ajout débloque 5-10 rapports cross-source.",
    },
  );

  const totalReportSuggestions = getReportSuggestions(detectedIntegrations).length;

  return { detectedIntegrations, integrationInsights, totalReportSuggestions };
}

// ── Workflows ──

export async function fetchWorkflows(
  token?: string | null,
): Promise<{
  workflows: Array<{ id: string; name: string; enabled: boolean; type: string; objectType?: string }>;
  dealsNoOwner: number;
}> {
  let workflows: Array<{ id: string; name: string; enabled: boolean; type: string; objectType?: string }> = [];
  let dealsNoOwner = 0;

  if (token) {
    try {
      const [wfRes, ownerRes] = await Promise.all([
        fetch("https://api.hubapi.com/automation/v4/flows?limit=100", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "NOT_HAS_PROPERTY" }] }],
            limit: 1,
          }),
        }),
      ]);
      if (wfRes.ok) {
        const wfData = await wfRes.json();
        workflows = (wfData.results ?? []).map((w: Record<string, unknown>) => ({
          id: w.id as string,
          name: (w.name as string) || "Sans nom",
          enabled: w.isEnabled === true || w.enabled === true,
          type: (w.type as string) || "unknown",
          objectType: w.objectTypeId as string | undefined,
        }));
      }
      if (ownerRes.ok) {
        const od = await ownerRes.json();
        dealsNoOwner = od.total ?? 0;
      }
    } catch {}
  }

  return { workflows, dealsNoOwner };
}

// ── Cross-Source Insights ──

export async function fetchCrossSourceInsights(
  supabase: SupabaseClient,
  orgId: string,
  dismissedKeys: Set<string>,
  connected?: import("@/lib/insights/cross-source").ConnectedCategorySet,
) {
  const crossSourceCtx = await buildCrossSourceContext(supabase, orgId);
  return crossSourceCtx
    ? selectCrossSourceInsights(crossSourceCtx, dismissedKeys, connected)
    : [];
}

// ── Data Model Insights ──

export async function fetchDataModelInsights(
  supabase: SupabaseClient,
  orgId: string,
  detectedIntegrations: DetectedIntegration[],
  ctx: InsightContext,
  dismissedKeys: Set<string>,
) {
  const businessTools = filterBusinessIntegrations(detectedIntegrations);
  let contactsWithCompany = 0;
  let invoicesCount = 0;
  let subscriptionsCount = 0;
  let ticketsCount = 0;
  let revoldIntegrations: Array<{ provider: string; isActive: boolean }> = [];

  try {
    const [cwc, inv, sub, tkt, integ] = await Promise.all([
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("company_id", "is", null),
      supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("tickets").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("integrations").select("provider, is_active").eq("organization_id", orgId),
    ]);
    contactsWithCompany = cwc.count ?? 0;
    invoicesCount = inv.count ?? 0;
    subscriptionsCount = sub.count ?? 0;
    ticketsCount = tkt.count ?? 0;
    revoldIntegrations = (integ.data ?? []).map((i) => ({ provider: i.provider, isActive: i.is_active }));
  } catch {}

  // hasHubSpot : OAuth (présent dans integrations + actif) OU env legacy
  const hasHubSpotOAuth = revoldIntegrations.some((i) => i.provider === "hubspot" && i.isActive);

  return generateDataModelInsights({
    connectedTools: revoldIntegrations,
    hubSpotDetectedTools: businessTools.map((t) => ({
      key: t.key,
      label: t.label,
      totalProperties: t.totalProperties,
      enrichmentRate: t.enrichmentRate,
      distinctUsers: t.distinctUsers,
      enrichedRecords: t.enrichedRecords,
    })),
    hasHubSpot: hasHubSpotOAuth, // strict OAuth-only (plus de fallback env)
    contactsCount: ctx.totalContacts,
    companiesCount: ctx.totalCompanies,
    sourceLinksCount: 0,
    contactsWithCompany,
    invoicesCount,
    subscriptionsCount,
    ticketsCount,
  }).filter((i) => !dismissedKeys.has(i.id));
}

// ── Scenarios ──

type ConnectedCats = Set<"crm" | "billing" | "support" | "phone" | "conv_intel" | "communication">;

export function buildScenarios(ctx: InsightContext, connectedCats?: ConnectedCats) {
  const {
    closingRate,
    wonDeals: won,
    lostDeals: lost,
    totalDeals: tDeals,
    dealsNoNextActivity,
    dealsNoAmount,
    dealsNoCloseDate,
    stagnantDeals,
    totalContacts: tContacts,
    opportunitiesCount: opps,
    conversionRate,
    orphansCount: orphans,
    orphanRate,
    openDeals: open,
    dealsNoActivity,
    contactsNoPhone,
    contactsNoTitle,
    totalCompanies,
    companiesNoIndustry,
    companiesNoRevenue,
  } = ctx;

  type Sim = {
    title: string;
    description: string;
    impact: string;
    category: string;
    simulationCategory: "cycle_ventes" | "marketing_cycle" | "deals_risk" | "revenue" | "data_quality";
    color: string;
    forecastType: string;
    threshold: number;
    direction: "above" | "below";
    show: boolean;
    /** Catégories d'outils Revold requises pour que la simulation ait du sens. */
    requires?: Array<"billing" | "support" | "phone" | "conv_intel">;
  };

  // ⚠ Plus de short-circuit hasXSignal : produisait du flicker car les counts
  // HubSpot peuvent varier entre deux renders (rate limit, timeout). On laisse
  // chaque simulation décider via .show, et on garde TOUJOURS les simulations
  // setup/always-on visibles pour avoir un volume stable.


  // Helpers SMART : current → target avec timeframe explicite
  const closedTotal = won + lost;
  const closingTarget = Math.min(50, Math.max(closingRate + 10, 30));
  const conversionTarget = Math.max(conversionRate + 10, 25);
  const phoneRate = tContacts > 0 ? PCT(tContacts - contactsNoPhone, tContacts) : 0;
  const titleRate = tContacts > 0 ? PCT(tContacts - contactsNoTitle, tContacts) : 0;
  const industryRate = totalCompanies > 0 ? PCT(totalCompanies - companiesNoIndustry, totalCompanies) : 0;
  const revenueRate = totalCompanies > 0 ? PCT(totalCompanies - companiesNoRevenue, totalCompanies) : 0;
  const nextActivityRate = open > 0 ? PCT(open - dealsNoNextActivity, open) : 0;
  const activationRate = open > 0 ? PCT(open - dealsNoActivity, open) : 0;
  const amountCompleteness = tDeals > 0 ? PCT(tDeals - dealsNoAmount, tDeals) : 0;

  // ════════════════════════════════════════════════════════════════
  // CYCLE DE VENTES (15 simulations SMART)
  // ════════════════════════════════════════════════════════════════
  const cycleVentes: Sim[] = [
    {
      show: true,
      title: `Closing rate : ${closingRate}% → ${closingTarget}% en 90 jours`,
      description: `${won} deals gagnés / ${closedTotal} clôturés. Top quartile B2B : ${closingTarget}%. Action : MEDDIC en stage Qualification + disqualifier 30% des deals à la Discovery.`,
      impact: `~+${Math.max(1, Math.round(closedTotal * (closingTarget - closingRate) / 100))} deals gagnés / quarter`,
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-blue-500 to-indigo-600",
      forecastType: "closing_rate",
      threshold: closingTarget,
      direction: "above",
    },
    {
      show: true,
      title: `Suivi pipeline : ${nextActivityRate}% → 90% en 30 jours`,
      description: `${dealsNoNextActivity} deals sur ${open} ouverts sans next_activity_date. Workflow bloquant la sauvegarde sans next activity = effet immédiat sur le suivi.`,
      impact: `+${Math.max(1, Math.round(dealsNoNextActivity * 0.7))} deals remis en suivi actif`,
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-indigo-500 to-purple-600",
      forecastType: "pipeline_coverage",
      threshold: 90,
      direction: "above",
    },
    {
      show: true,
      title: `Activation deals : ${activationRate}% → 95% en 14 jours`,
      description: `${dealsNoActivity} deals créés mais 0 activité. Sprint nettoyage : 1 décision/deal en 2min (action OU lost). ~${Math.max(1, Math.round(dealsNoActivity * 0.4))} deals récupérables.`,
      impact: `~+${Math.max(1, Math.round(dealsNoActivity * 0.4))} deals réactivés`,
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-cyan-500 to-blue-600",
      forecastType: "deal_activation",
      threshold: 95,
      direction: "above",
    },
    {
      show: true,
      title: `Cycle de vente : raccourcir de 20% en 6 mois`,
      description: `Cycle plus court = plus de deals fermés sur la même période. Leviers : raccourcir le temps en pipeline, automatiser les contrats (e-sign), template de quote.`,
      impact: `+20% de revenu sur la même équipe sales`,
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-blue-500 to-cyan-600",
      forecastType: "cycle_reduction",
      threshold: 80,
      direction: "below",
    },
    {
      show: true,
      title: `Pipeline coverage : ${open} → ${Math.max(20, open * 3)} deals ouverts en 60 jours`,
      description: `Règle CRO : pipeline = 3x objectif quarter. Mobilisation SDR + inbound combinée pour x3 le pipeline.`,
      impact: `+${Math.max(20, open * 3 - open)} deals ouverts, couverture forecast atteinte`,
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-fuchsia-500 to-purple-600",
      forecastType: "pipeline_volume",
      threshold: Math.max(30, open * 3),
      direction: "above",
    },
    {
      show: true,
      title: `Sequences Sales Hub : ${ctx.sequencesCount ?? 0} → 5 actives en 30 jours`,
      description: "5 sequences clés (cold prospect, follow-up, post-démo, breakup, re-engagement). Cible reply rate 8-15%.",
      impact: `~+30% reply rate, ~+20% meetings bookés`,
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-violet-500 to-fuchsia-600",
      forecastType: "sequences_setup",
      threshold: 5,
      direction: "above",
    },
    {
      show: true,
      title: `Workflows sales : ${ctx.workflowsActiveCount ?? 0} → 5 critiques en 14 jours`,
      description: "5 workflows clés : attribution auto, relance 5j, relance 14j, post-démo, alerte stagnation. -3h/sales/semaine en manuel.",
      impact: `Économie ~${Math.max(1, ctx.ownersCount ?? 1) * 12}h/semaine sur l'équipe`,
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-blue-500 to-cyan-600",
      forecastType: "workflows_setup",
      threshold: 5,
      direction: "above",
    },
    {
      show: true,
      title: `Forecast accuracy : actuel → 90%+ en 60 jours`,
      description: "Audit hebdo des écarts forecast vs réalisé. Discipline sales : pas de forecast sans next_activity, sans amount, sans closedate.",
      impact: "Forecast fiable au QBR + alignement direction commerciale",
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-indigo-500 to-violet-600",
      forecastType: "forecast_accuracy",
      threshold: 90,
      direction: "above",
    },
    {
      show: true,
      title: `Win rate par segment : top 3 ICP +20% en 90 jours`,
      description: "Calculer le win rate par segment (taille, secteur, source) → identifier les top 3 ICP → ré-allouer 80% du budget acquisition vers eux.",
      impact: "Acquisition focalisée sur segments à plus haut win rate",
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-blue-500 to-indigo-600",
      forecastType: "icp_win_rate",
      threshold: 0,
      direction: "above",
    },
    {
      show: true,
      title: `Quotes émis : ${ctx.quotesCount ?? 0} → ${Math.max(open, 20)} en 30 jours`,
      description: "Tous les deals en stage Proposition doivent avoir un quote HubSpot. Templates pré-remplis pour accélérer le cycle quote-to-close.",
      impact: "Cycle quote→close réduit de 40%",
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-cyan-500 to-blue-600",
      forecastType: "quotes_setup",
      threshold: Math.max(open, 20),
      direction: "above",
    },
    {
      show: true,
      title: `Owner attribution : 100% deals avec owner en 30 jours`,
      description: "Workflow auto à la création (round-robin par segment). Audit hebdo des deals sans hubspot_owner_id via report dédié.",
      impact: "0 deal orphelin, attribution claire pour reporting team",
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-blue-500 to-indigo-600",
      forecastType: "owner_attribution",
      threshold: 100,
      direction: "above",
    },
    {
      show: true,
      title: `Rituel pipeline review hebdo : 100% adoption en 14 jours`,
      description: "30min/semaine avec sales lead : top 5 deals chauds, deals à relancer, deals à clôturer en lost. Réduit la stagnation de 50%.",
      impact: "Pipeline assaini chaque semaine, forecast plus fiable",
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-indigo-500 to-blue-600",
      forecastType: "pipeline_review_ritual",
      threshold: 100,
      direction: "above",
    },
    {
      show: true,
      title: `Goals (objectifs) : 0 → 1 par sales en 14 jours`,
      description: `Sales Hub Goals définis par sales : nombre deals créés, meetings bookés, montant pipeline généré, montant won. Revue 1-on-1 mensuelle.`,
      impact: "Coaching sales avec objectifs mesurables, attainment trackable",
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-violet-500 to-purple-600",
      forecastType: "goals_setup",
      threshold: ctx.ownersCount ?? 1,
      direction: "above",
    },
    {
      show: true,
      title: `Playbook commercial : 0 → 1 documenté en 30 jours`,
      description: "Playbook 1 page : ICP, parcours type, questions Discovery, gestion objections, démo standard, négo, signing. Onboarding sales x2 plus rapide.",
      impact: "Standardisation des bonnes pratiques + onboarding accéléré",
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-purple-500 to-indigo-600",
      forecastType: "playbook_setup",
      threshold: 1,
      direction: "above",
    },
    {
      show: true,
      title: `Activité quotidienne : ${Math.max(1, ctx.ownersCount ?? 1) * 5} touches/jour/sales`,
      description: "Quotas activités hebdo : 25 touches outbound + 5 meetings + relances. Sans quotas, capacité sales sous-utilisée.",
      impact: `~+${Math.max(1, (ctx.ownersCount ?? 1) * 10)} opportunités créées/mois`,
      category: "sales",
      simulationCategory: "cycle_ventes",
      color: "from-cyan-500 to-indigo-600",
      forecastType: "daily_activity",
      threshold: Math.max(1, (ctx.ownersCount ?? 1) * 5),
      direction: "above",
    },
  ];

  // ════════════════════════════════════════════════════════════════
  // MARKETING CYCLE — utilise lifecycleByStage RÉEL pour conversions
  // ════════════════════════════════════════════════════════════════
  // Plus de "0% sur 0 contacts alors qu'il y en a 10k" : on lit DIRECTEMENT
  // les counts par stage HubSpot via ctx.lifecycleByStage (snapshot live).
  //
  // Format SMART double :
  //   - title : "actuellement X% (sur N) → Y% en Tjours via [action concrète]"
  //   - impact : "+N [unit chiffrée] mesurable"

  const stageCount = (key: string): number => ctx.lifecycleByStage?.[key]?.count ?? 0;
  const subscriberCount = stageCount("subscriber");
  const leadCount = stageCount("lead");
  const mqlCount = stageCount("marketingqualifiedlead");
  const sqlCount = stageCount("salesqualifiedlead");
  const opportunityCount = stageCount("opportunity");
  const customerCount = stageCount("customer") || (ctx.customersCount ?? 0);
  const evangelistCount = stageCount("evangelist");

  const safeRate = (top: number, bottom: number): number =>
    bottom > 0 ? Math.round((top / bottom) * 1000) / 10 : 0;

  const lifecycle: Sim[] = [
    // ── Conversions stage-to-stage (5 sims) ──
    {
      show: true,
      title: `Conversion Subscriber → Lead : ${safeRate(leadCount, subscriberCount)}% actuellement (${leadCount.toLocaleString("fr-FR")}/${subscriberCount.toLocaleString("fr-FR")}) → 30% en 60 jours via lead magnet + nurturing email 4 touches`,
      description: `Subscriber = newsletter/blog opt-in. Sans nurturing actif, 90% restent froids. 4 emails progressifs sur 21j (valeur → cas client → contenu pédago → CTA démo) = +25 pts conversion.`,
      impact: `+${Math.max(1, Math.round(subscriberCount * 0.25)).toLocaleString("fr-FR")} Leads générés sur ${subscriberCount.toLocaleString("fr-FR")} Subscribers`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-amber-500 to-orange-600",
      forecastType: "conv_subscriber_lead",
      threshold: 30,
      direction: "above",
    },
    {
      show: true,
      title: `Conversion Lead → MQL : ${safeRate(mqlCount, leadCount)}% actuellement (${mqlCount.toLocaleString("fr-FR")}/${leadCount.toLocaleString("fr-FR")}) → 15% en 60 jours via lead scoring + workflow auto`,
      description: `Sans lead scoring composite (engagement + firmographic), les MQL sont produits manuellement et inconsistants. Workflow scoring + handoff auto SDR < 5min = +12 pts.`,
      impact: `+${Math.max(1, Math.round(leadCount * 0.12)).toLocaleString("fr-FR")} MQL/an sur ${leadCount.toLocaleString("fr-FR")} Leads`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-amber-500 to-yellow-600",
      forecastType: "conv_lead_mql",
      threshold: 15,
      direction: "above",
    },
    {
      show: true,
      title: `Conversion MQL → SQL : ${safeRate(sqlCount, mqlCount)}% actuellement (${sqlCount.toLocaleString("fr-FR")}/${mqlCount.toLocaleString("fr-FR")}) → 50% en 60 jours via SLA SDR 5min + critère BANT`,
      description: `Top quartile B2B SaaS : 50% des MQL deviennent SQL. Action : SLA contact SDR < 5min (workflow round-robin) + critères SQL stricts (Budget, Authority, Need, Timeline).`,
      impact: `+${Math.max(1, Math.round(mqlCount * 0.4)).toLocaleString("fr-FR")} SQL/an sur ${mqlCount.toLocaleString("fr-FR")} MQL`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-yellow-500 to-amber-600",
      forecastType: "conv_mql_sql",
      threshold: 50,
      direction: "above",
    },
    {
      show: true,
      title: `Conversion SQL → Opportunity : ${safeRate(opportunityCount, sqlCount)}% actuellement (${opportunityCount.toLocaleString("fr-FR")}/${sqlCount.toLocaleString("fr-FR")}) → 70% en 30 jours via Discovery rapide`,
      description: `Top quartile : 70% des SQL créent une opportunité sous 14j. Action : 1er meeting Discovery < 7j post-handoff, taux RDV honorés > 80%, qualification MEDDIC stricte.`,
      impact: `+${Math.max(1, Math.round(sqlCount * 0.5)).toLocaleString("fr-FR")} opportunités/an sur ${sqlCount.toLocaleString("fr-FR")} SQL`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-orange-500 to-amber-600",
      forecastType: "conv_sql_opp",
      threshold: 70,
      direction: "above",
    },
    {
      show: true,
      title: `Conversion Opportunity → Customer : ${safeRate(customerCount, opportunityCount)}% actuellement (${customerCount.toLocaleString("fr-FR")}/${opportunityCount.toLocaleString("fr-FR")}) → 35% en 90 jours via process closing standardisé`,
      description: `Top quartile B2B SaaS : 30-40%. Workflow Won → set lifecycle Customer auto. E-sign + relances post-quote. Audit pourquoi opps stagnent (souvent prix ou no decision).`,
      impact: `+${Math.max(1, Math.round(opportunityCount * 0.25)).toLocaleString("fr-FR")} Customers/an sur ${opportunityCount.toLocaleString("fr-FR")} Opportunities`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-amber-500 to-emerald-600",
      forecastType: "conv_opp_customer",
      threshold: 35,
      direction: "above",
    },

    // ── Setup marketing (10 sims SMART) ──
    {
      show: true,
      title: `Lifecycle stages : ${Object.values(ctx.lifecycleByStage ?? {}).filter((s) => s.count > 0).length}/6 utilisés actuellement → 6/6 en 14 jours via workflow progression auto`,
      description: `Sans lifecycle stages activés et maintenus, funnel marketing invisible. 6 stages standard : Subscriber → Lead → MQL → SQL → Opportunity → Customer. Workflow scoring pour transitions auto.`,
      impact: `Funnel marketing/sales aligné, conversion mesurable par stage`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-amber-500 to-yellow-600",
      forecastType: "lifecycle_stages_setup",
      threshold: 6,
      direction: "above",
    },
    {
      show: true,
      title: `Forms HubSpot : ${ctx.formsCount ?? 0} actuellement → 8 en 60 jours via création par persona × intent`,
      description: `8 forms par persona × intent : démo (BOFU), fiche commerciale, guide TOFU, webinar (MOFU), newsletter, contact, partenaires, careers. Chaque form augmente la capture leads de ~10%.`,
      impact: `+${Math.max(20, Math.round(tContacts * 0.1)).toLocaleString("fr-FR")} leads/mois cible`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-amber-500 to-orange-500",
      forecastType: "forms_setup",
      threshold: 8,
      direction: "above",
    },
    {
      show: true,
      title: `Listes segmentation : ${ctx.listsCount ?? 0} actuellement → 15 en 30 jours via segmentation lifecycle/persona/intent/engagement`,
      description: `15 listes intelligentes minimum (lifecycle, persona, secteur, taille, engagement récent, intent pricing 7j). Personnalisation campagnes par segment = +60% engagement vs broadcast.`,
      impact: `Personnalisation activée sur 100% de ${tContacts.toLocaleString("fr-FR")} contacts`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-rose-500 to-amber-500",
      forecastType: "lists_setup",
      threshold: 15,
      direction: "above",
    },
    {
      show: true,
      title: `Marketing campaigns : ${ctx.marketingCampaignsCount ?? 0} actuellement → 10 trackées en 90 jours via taggage systématique`,
      description: `Sans tag Campaign HubSpot, ROI marketing invisible. Tagger TOUTES les actions (email, landing, ads, events). Reporting mensuel revenue par campagne.`,
      impact: `ROI mesurable sur 10 campagnes/quarter`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-amber-500 to-fuchsia-500",
      forecastType: "campaigns_setup",
      threshold: 10,
      direction: "above",
    },
    {
      show: true,
      title: `Marketing events : ${ctx.marketingEventsCount ?? 0} actuellement → 3/an en 90 jours via tracking webinars/conférences`,
      description: `Webinars, conférences, salons trackés via HubSpot Events. Connecter Zoom/On24/Eventbrite = attribution event-driven (souvent leads les plus chauds).`,
      impact: `ROI events mesurable + lead gen attribué`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-rose-500 to-fuchsia-500",
      forecastType: "events_setup",
      threshold: 3,
      direction: "above",
    },
    {
      show: true,
      title: `Workflows marketing actifs : ${ctx.workflowsActiveCount ?? 0} actuellement → 5 critiques en 14 jours`,
      description: `5 workflows critiques : MQL→SQL auto, nurturing TOFU, re-engagement dormants, post-event follow-up, lead scoring composite. Sans automation, 80% des leads non-immédiats sont perdus.`,
      impact: `+30 à 50% de conversion totale lead→opp à 12 mois`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-amber-500 to-yellow-600",
      forecastType: "workflows_marketing_setup",
      threshold: 5,
      direction: "above",
    },
    {
      show: true,
      title: `Réactivation dormants : ${(tContacts - opps).toLocaleString("fr-FR")} contacts non-opp actuellement → 5% réactivés en 60 jours via campagne dédiée`,
      description: `Sur ${(tContacts - opps).toLocaleString("fr-FR")} contacts non-opportunités, statistiquement 5% sont réactivables avec une bonne campagne (offre + content + scoring). Coût d'opportunité gratuit.`,
      impact: `+${Math.max(1, Math.round((tContacts - opps) * 0.05)).toLocaleString("fr-FR")} opportunités gratuites identifiées`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-amber-500 to-rose-500",
      forecastType: "dormant_reactivation",
      threshold: Math.max(1, Math.round((tContacts - opps) * 0.05)),
      direction: "above",
    },
    {
      show: true,
      title: `Source attribution : 100% nouveaux contacts en 30 jours via workflow Original Source obligatoire`,
      description: `Workflow obligeant Original Source à la création. Fallback heuristique sur referrer/UTM si vide. Reporting ROI par canal d'acquisition.`,
      impact: `Attribution marketing fiable sur 100% des nouveaux leads`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-orange-500 to-amber-600",
      forecastType: "source_attribution_marketing",
      threshold: 100,
      direction: "above",
    },
    {
      show: true,
      title: `Email validation : 100% nouveaux leads validés en 7 jours via NeverBounce/ZeroBounce intégré`,
      description: `Brancher service email verification sur tous nouveaux leads. Délivrabilité protégée, sender reputation maintenue, 0 bounce sur campagnes.`,
      impact: `Délivrabilité optimale sur ~${Math.max(20, Math.round(tContacts * 0.05)).toLocaleString("fr-FR")} nouveaux leads/mois`,
      category: "marketing",
      simulationCategory: "marketing_cycle",
      color: "from-amber-500 to-orange-500",
      forecastType: "email_validation",
      threshold: 100,
      direction: "above",
    },
  ];


  // ════════════════════════════════════════════════════════════════
  // REVENUE (15 simulations SMART)
  // ════════════════════════════════════════════════════════════════
  const revenue: Sim[] = [
    {
      show: true,
      title: `MRR : croissance +10% en 90 jours`,
      description: `${ctx.subscriptionsCount ?? 0} subscriptions actives. Cible top quartile B2B SaaS : +10% MRR par quarter via expansion + new business.`,
      impact: "MRR boost = ARR x 1.1 sur 12 mois si maintenu",
      category: "csm",
      simulationCategory: "revenue",
      color: "from-emerald-500 to-teal-600",
      forecastType: "mrr_growth",
      threshold: 110,
      direction: "above",
      requires: ["billing"],
    },
    {
      show: true,
      title: `Pipeline value : ${snapshotAmount(ctx)} → 3x objectif quarter en 60 jours`,
      description: "Règle CRO : pipeline ouvert = 3x objectif revenue trimestre. Sans cette couverture, risque manqué de quota élevé.",
      impact: "Couverture forecast atteinte, marge d'erreur acceptable",
      category: "sales",
      simulationCategory: "revenue",
      color: "from-emerald-500 to-blue-600",
      forecastType: "pipeline_3x",
      threshold: 0,
      direction: "above",
    },
    {
      show: true,
      title: `Won amount mensuel : +20% en 90 jours`,
      description: `${won} deals gagnés cumulés. Cible : +20% du run rate mensuel via combinaison closing rate + ticket moyen + volume deals.`,
      impact: "Run rate revenue accéléré, accélération ARR",
      category: "sales",
      simulationCategory: "revenue",
      color: "from-emerald-500 to-cyan-600",
      forecastType: "won_amount_growth",
      threshold: 120,
      direction: "above",
    },
    {
      show: true,
      title: `Churn rate : actuel → < 5% annuel en 6 mois`,
      description: "Top quartile B2B SaaS : churn annuel < 5%. Combinaison NPS + tickets + usage + payment failures comme prédicteur churn.",
      impact: "Net Revenue Retention > 100% atteignable",
      category: "csm",
      simulationCategory: "revenue",
      color: "from-emerald-500 to-teal-600",
      forecastType: "churn_rate",
      threshold: 5,
      direction: "below",
      requires: ["billing"],
    },
    {
      show: true,
      title: `NRR : 100%+ en 12 mois (expansion > churn)`,
      description: "Net Revenue Retention = (MRR_début + expansion - churn - downgrade) / MRR_début. > 100% = croissance même sans new business.",
      impact: "Modèle SaaS sain, valorisation x10 vs churn négatif",
      category: "csm",
      simulationCategory: "revenue",
      color: "from-teal-500 to-emerald-600",
      forecastType: "nrr",
      threshold: 100,
      direction: "above",
      requires: ["billing"],
    },
    {
      show: true,
      title: `Expansion revenue : +10% MRR via upsell en 90 jours`,
      description: "Détection auto comptes prêts pour upsell (usage croissant + NPS promoteur). Workflow d'alerte CSM expansion.",
      impact: "+10% MRR sans coût d'acquisition (CAC payback immédiat)",
      category: "csm",
      simulationCategory: "revenue",
      color: "from-emerald-500 to-fuchsia-600",
      forecastType: "expansion_mrr",
      threshold: 10,
      direction: "above",
      requires: ["billing"],
    },
    {
      show: true,
      title: `LTV moyenne : +30% en 6 mois`,
      description: "Lifetime Value (revenue total / customer count). Levier : raccourcir time-to-value onboarding + booster retention + upsell.",
      impact: "LTV/CAC ratio amélioré, modèle plus sain",
      category: "csm",
      simulationCategory: "revenue",
      color: "from-teal-500 to-cyan-600",
      forecastType: "ltv_growth",
      threshold: 130,
      direction: "above",
      requires: ["billing"],
    },
    {
      show: true,
      title: `Réconciliation deals won ↔ invoices : 100% en 30 jours`,
      description: `${won} deals gagnés vs ${ctx.invoicesCount ?? 0} factures émises. Audit des écarts = détection fuites revenue + alignement sales/finance.`,
      impact: "Forecast vs réalisé fiabilisé, fuite revenue identifiée",
      category: "csm",
      simulationCategory: "revenue",
      color: "from-cyan-500 to-blue-600",
      forecastType: "deals_invoices_match",
      threshold: 100,
      direction: "above",
      requires: ["billing"],
    },
    {
      show: true,
      title: `Subscriptions actives : +20% en 12 mois`,
      description: `${ctx.subscriptionsCount ?? 0} subs actives. Cible : +20% via combinaison new business + expansion + retention améliorée.`,
      impact: "Croissance recurring revenue prédictible",
      category: "csm",
      simulationCategory: "revenue",
      color: "from-emerald-500 to-teal-600",
      forecastType: "subscriptions_growth",
      threshold: 120,
      direction: "above",
      requires: ["billing"],
    },
    {
      show: true,
      title: `Recovery factures impayées : 80% recovery en 60 jours`,
      description: `Workflow de relance auto factures > 30j non payées. Cible recovery 80% via emails J+30 / J+45 / appel J+60.`,
      impact: "Cash collecté + DSO réduit",
      category: "csm",
      simulationCategory: "revenue",
      color: "from-emerald-500 to-amber-600",
      forecastType: "invoice_recovery",
      threshold: 80,
      direction: "above",
      requires: ["billing"],
    },
    {
      show: true,
      title: `Quote-to-close cycle : -30% en 60 jours`,
      description: "Templates quotes pré-remplis + e-sign + relance auto J+3/J+7/J+14. Cycle quote→signature divisé par 1.4.",
      impact: "Cash plus rapide + close rate amélioré (deals moins refroidis)",
      category: "sales",
      simulationCategory: "revenue",
      color: "from-cyan-500 to-emerald-600",
      forecastType: "quote_cycle",
      threshold: 70,
      direction: "below",
    },
    {
      show: true,
      title: `Average deal size : +15% en 90 jours (upsell ciblé)`,
      description: "Identifier les deals win avec packaging premium. Pricing tiers + bundling + démo features avancées en Discovery.",
      impact: "Revenue/deal x 1.15 sans effort sales additionnel",
      category: "sales",
      simulationCategory: "revenue",
      color: "from-emerald-500 to-blue-600",
      forecastType: "avg_deal_size",
      threshold: 115,
      direction: "above",
    },
    {
      show: true,
      title: `Forecast accuracy : 90%+ en 60 jours`,
      description: "Audit hebdo écart forecast vs réalisé par stage. Discipline sales : pas de forecast sans next_activity + amount + closedate.",
      impact: "Direction commerciale alignée + planification produit/finance fiabilisée",
      category: "sales",
      simulationCategory: "revenue",
      color: "from-cyan-500 to-emerald-600",
      forecastType: "forecast_accuracy_revenue",
      threshold: 90,
      direction: "above",
    },
    {
      show: true,
      title: `Cross-sell : 1 produit additionnel par customer en 6 mois`,
      description: "Map produits par persona + déclencheurs upsell auto. Cible : 30% des customers avec 2+ produits actifs en 6 mois.",
      impact: "Expansion revenue sans coût acquisition",
      category: "csm",
      simulationCategory: "revenue",
      color: "from-emerald-500 to-fuchsia-600",
      forecastType: "cross_sell",
      threshold: 30,
      direction: "above",
      requires: ["billing"],
    },
    {
      show: true,
      title: `Programme référencement : 10% revenue via réf en 12 mois`,
      description: "Demande réf systématique post-success. Tracking sales attribuant chaque deal à la source réf si applicable.",
      impact: "10% revenue sans CAC = marge nette quasi-pure",
      category: "csm",
      simulationCategory: "revenue",
      color: "from-fuchsia-500 to-emerald-600",
      forecastType: "referral_revenue",
      threshold: 10,
      direction: "above",
    },
  ];

  // ════════════════════════════════════════════════════════════════
  // DONNÉES (15 simulations SMART)
  // ════════════════════════════════════════════════════════════════
  const dataQuality: Sim[] = [
    {
      show: true,
      title: `Orphelins : ${orphanRate}% → ${Math.max(5, orphanRate - 20)}% en 30 jours`,
      description: `${orphans.toLocaleString("fr-FR")} contacts sans entreprise. Workflow auto-association par domaine email + batch enrichissement Clearbit/Dropcontact.`,
      impact: `${Math.max(1, Math.round(orphans * 0.6)).toLocaleString("fr-FR")} contacts ré-attribués`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-teal-600",
      forecastType: "orphan_rate",
      threshold: Math.max(5, orphanRate - 20),
      direction: "below",
    },
    {
      show: true,
      title: `Téléphone : ${phoneRate}% → 80% en 60 jours`,
      description: `${contactsNoPhone.toLocaleString("fr-FR")} contacts sans phone. Enrichissement Dropcontact (~0,30€/contact) + champ obligatoire forms futurs.`,
      impact: `+${Math.max(1, Math.round(contactsNoPhone * 0.6)).toLocaleString("fr-FR")} contacts joignables outbound`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-green-600",
      forecastType: "phone_enrichment",
      threshold: 80,
      direction: "above",
    },
    {
      show: true,
      title: `Poste (jobtitle) : ${titleRate}% → 90% en 60 jours`,
      description: `${contactsNoTitle.toLocaleString("fr-FR")} contacts sans jobtitle. Enrichissement LinkedIn Sales Navigator + champ obligatoire BOFU.`,
      impact: `Personnalisation par fonction sur ${Math.max(1, Math.round(contactsNoTitle * 0.7)).toLocaleString("fr-FR")} contacts`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-teal-500 to-cyan-600",
      forecastType: "title_enrichment",
      threshold: 90,
      direction: "above",
    },
    {
      show: true,
      title: `Secteur entreprise : ${industryRate}% → 90% en 30 jours`,
      description: `${companiesNoIndustry.toLocaleString("fr-FR")} companies sans industry. HubSpot Insights (gratuit) ou Clearbit = enrichissement auto.`,
      impact: `Segmentation industry sur +${Math.max(1, Math.round(companiesNoIndustry * 0.8)).toLocaleString("fr-FR")} comptes`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-cyan-500 to-blue-600",
      forecastType: "industry_enrichment",
      threshold: 90,
      direction: "above",
    },
    {
      show: true,
      title: `CA entreprise : ${revenueRate}% → 80% en 60 jours`,
      description: `${companiesNoRevenue.toLocaleString("fr-FR")} companies sans annualrevenue. Enrichissement Clearbit/Société.com pour ICP scoring.`,
      impact: `ICP scoring activé sur +${Math.max(1, Math.round(companiesNoRevenue * 0.7)).toLocaleString("fr-FR")} comptes`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-blue-500 to-indigo-600",
      forecastType: "revenue_enrichment",
      threshold: 80,
      direction: "above",
    },
    {
      show: true,
      title: `Dédoublonnage : 0 doublons en 30 jours`,
      description: "Audit HubSpot Manage Duplicates ce mois. Activer détection auto sur email comme clé unique. Process trimestriel ensuite.",
      impact: "Reporting fiable + sender reputation préservée",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-teal-600",
      forecastType: "dedup",
      threshold: 0,
      direction: "below",
    },
    {
      show: true,
      title: `Email valide : 100% nouveaux leads en 7 jours`,
      description: "Branchement service email verification sur tous nouveaux leads. Délivrabilité protégée, sender reputation préservée.",
      impact: "0 bounce sur campagnes + délivrabilité optimale",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-green-600",
      forecastType: "email_validation",
      threshold: 100,
      direction: "above",
    },
    {
      show: true,
      title: `Custom objects audit : ${ctx.customObjectsCount ?? 0} schemas gouvernés en 30 jours`,
      description: `${ctx.customObjectsCount ?? 0} schemas custom dans HubSpot. Sans gouvernance, le CRM devient illisible. Audit + documentation Notion.`,
      impact: "CRM gouverné, équipes alignées sur les définitions",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-teal-500 to-emerald-600",
      forecastType: "custom_audit",
      threshold: 0,
      direction: "above",
    },
    {
      show: true,
      title: `Teams : ${ctx.teamsCount ?? 0} → ${Math.max(2, Math.ceil((ctx.ownersCount ?? 1) / 5))} équipes en 14 jours`,
      description: `${ctx.ownersCount ?? 0} owners actifs. Sans Teams, reporting par équipe impossible + round-robin par segment cassé.`,
      impact: "Reporting par team activé, attribution fine possible",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-cyan-600",
      forecastType: "teams_setup",
      threshold: Math.max(2, Math.ceil((ctx.ownersCount ?? 1) / 5)),
      direction: "above",
    },
    {
      show: true,
      title: `Lifecycle stage tracking : 100% contacts catégorisés en 14 jours`,
      description: "Audit : tous les contacts doivent avoir un lifecycle stage. Workflow auto pour assigner stage par défaut à la création.",
      impact: "Funnel marketing/sales mesurable de bout en bout",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-cyan-500 to-emerald-600",
      forecastType: "lifecycle_coverage",
      threshold: 100,
      direction: "above",
    },
    {
      show: true,
      title: `Country normalization : 0 doublons orthographiques en 30 jours`,
      description: "« France », « FR », « FRANCE » comptent comme 3 valeurs. Forcer listes déroulantes + workflow normalisation rétroactive.",
      impact: "Reporting géographique enfin propre",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-teal-600",
      forecastType: "country_normalize",
      threshold: 0,
      direction: "below",
    },
    {
      show: true,
      title: `Workflows actifs : ${ctx.workflowsActiveCount ?? 0} → ${Math.max(5, ctx.workflowsActiveCount ?? 5)} en 14 jours`,
      description: "5 workflows critiques minimum : attribution, lifecycle progression, MQL→SQL, relance, alerte stagnation.",
      impact: "Sales & marketing sur autopilote pour les actions répétitives",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-blue-600",
      forecastType: "workflows_active",
      threshold: Math.max(5, ctx.workflowsActiveCount ?? 5),
      direction: "above",
    },
    {
      show: true,
      title: `Listes minimum : ${ctx.listsCount ?? 0} → 5 listes setup en 14 jours`,
      description: "5 listes minimales : tous-contacts, MQL actifs, customers, dormants 90j, opt-out. Base pour campagnes ciblées + audit RGPD.",
      impact: "Segmentation marketing activée",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-teal-600",
      forecastType: "lists_starter",
      threshold: 5,
      direction: "above",
    },
    {
      show: true,
      title: `Source originale tracking : 100% nouveaux contacts en 14 jours`,
      description: "Workflow obligeant Original Source à la création (sinon fallback heuristique sur referrer/UTM).",
      impact: "Attribution marketing fiable par canal",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-cyan-500 to-blue-600",
      forecastType: "source_tracking",
      threshold: 100,
      direction: "above",
    },
    {
      show: true,
      title: `Property fill rate audit : top 20 propriétés à 80%+ en 60 jours`,
      description: "Identifier les 20 propriétés les plus importantes pour le business + workflow de complétion auto / champ obligatoire à la progression lifecycle.",
      impact: "Data CRM exploitable pour reporting + scoring",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-blue-500 to-emerald-600",
      forecastType: "property_completeness",
      threshold: 80,
      direction: "above",
    },
  ];

  // Gate les sims qui requièrent un outil non connecté : on n'invente pas
  // de données revenue/MRR/NRR sans billing branché, ni de churn signals
  // sans support, etc. Filtre silencieux ; un CTA dédié est ajouté dans
  // la liste cross-source des coachings.
  const gated = [...cycleVentes, ...lifecycle, ...revenue, ...dataQuality].filter((s) => {
    if (!s.show) return false;
    if (!s.requires || s.requires.length === 0) return true;
    if (!connectedCats) return true; // Pas de gate si l'appelant ne fournit pas l'info
    return s.requires.every((req) => connectedCats.has(req));
  });
  return gated;
}

/**
 * Quelles catégories de simulations sont bloquées faute d'outil connecté ?
 * Utilisé pour afficher un CTA explicite « Connectez X » sur la page
 * Simulations IA, pour chaque tab dont au moins une sim a été filtrée.
 */
export type BlockedSimCategory = {
  category: "billing" | "support" | "phone" | "conv_intel";
  affectedTabs: Array<"revenue" | "cycle_ventes" | "marketing_cycle" | "data_quality">;
  blockedCount: number;
};

export function detectBlockedSimulations(
  ctx: InsightContext,
  connectedCats: ConnectedCats,
): BlockedSimCategory[] {
  const all = buildScenarios(ctx); // Sans gating
  const blocked: Record<string, BlockedSimCategory> = {};
  for (const s of all) {
    if (!s.requires) continue;
    for (const req of s.requires) {
      if (connectedCats.has(req)) continue;
      const tab = s.simulationCategory === "deals_risk" ? "cycle_ventes" : s.simulationCategory;
      if (!blocked[req]) {
        blocked[req] = { category: req, affectedTabs: [], blockedCount: 0 };
      }
      blocked[req].blockedCount++;
      if (!blocked[req].affectedTabs.includes(tab)) blocked[req].affectedTabs.push(tab);
    }
  }
  return Object.values(blocked);
}

function snapshotAmount(_ctx: InsightContext): string {
  return "actuel";
}

export type SimulationCategory =
  | "cycle_ventes"
  | "marketing_cycle"
  | "revenue"
  | "data_quality";

export const SIMULATION_CATEGORY_LABELS: Record<SimulationCategory, { label: string; emoji: string }> = {
  cycle_ventes: { label: "Cycle de ventes", emoji: "🚀" },
  marketing_cycle: { label: "Marketing cycle", emoji: "🔄" },
  revenue: { label: "Revenue", emoji: "💰" },
  data_quality: { label: "Données", emoji: "🛡️" },
};
