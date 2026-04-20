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

export const HUBSPOT_PORTAL = "48372600";
export const HS = {
  contacts: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/objects/0-1`,
  deals: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/objects/0-3`,
  properties: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/settings/properties`,
};
export const hubspotLinks: Record<string, string> = {
  commercial: HS.deals,
  marketing: HS.contacts,
  data: HS.properties,
};

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
) {
  const crossSourceCtx = await buildCrossSourceContext(supabase, orgId);
  return crossSourceCtx
    ? selectCrossSourceInsights(crossSourceCtx, dismissedKeys)
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

export function buildScenarios(ctx: InsightContext) {
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
    simulationCategory: "pipeline" | "lifecycle" | "data_quality";
    color: string;
    forecastType: string;
    threshold: number;
    direction: "above" | "below";
    show: boolean;
  };

  // Seuils volontairement bas pour que les diagnostics fonctionnent dès qu'il
  // y a un minimum de signal. Pour les orgs vides (0 deals/0 contacts), on
  // bascule sur les simulations "starter" plus bas.
  const hasDealSignal = tDeals >= 1 || open >= 1;
  const hasContactSignal = tContacts >= 5;
  const hasCompanySignal = totalCompanies >= 3;
  const isStarter = tDeals === 0 && tContacts === 0;

  // ─── PIPELINE simulations (data-driven uniquement) ──
  const closedTotal = won + lost;
  const closingTarget = Math.min(50, Math.max(closingRate + 10, 30));
  const nextActivityRate = tDeals > 0 ? Math.round(((tDeals - dealsNoNextActivity) / tDeals) * 100) : 0;
  const activationRate = open > 0 ? Math.round(((open - dealsNoActivity) / open) * 100) : 0;
  const amountCompleteness = tDeals > 0 ? Math.round(((tDeals - dealsNoAmount) / tDeals) * 100) : 0;
  const closeDateCompleteness = tDeals > 0 ? Math.round(((tDeals - dealsNoCloseDate) / tDeals) * 100) : 0;

  const pipeline: Sim[] = [
    {
      show: hasDealSignal && closedTotal >= 5 && closingRate < closingTarget,
      title: `Closing rate : ${closingRate}% → ${closingTarget}%`,
      description: `${won} deals gagnés / ${closedTotal} clôturés. Top quartile B2B atteint ${closingTarget}%. Renforcer MEDDIC en stage Qualification = +${closingTarget - closingRate} pts mécaniques.`,
      impact: `~+${Math.max(1, Math.round(closedTotal * (closingTarget - closingRate) / 100))} deals gagnés / quarter`,
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-blue-500 to-indigo-600",
      forecastType: "closing_rate",
      threshold: closingTarget,
      direction: "above",
    },
    {
      show: hasDealSignal && dealsNoNextActivity > 0 && nextActivityRate < 90,
      title: `Suivi pipeline : ${nextActivityRate}% → 90%`,
      description: `${dealsNoNextActivity} deals sur ${open} sans next activity planifiée. Workflow bloquant la sauvegarde sans next_activity_date = effet immédiat.`,
      impact: `+${Math.max(1, Math.round(dealsNoNextActivity * 0.7))} deals remis en suivi actif`,
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-indigo-500 to-purple-600",
      forecastType: "pipeline_coverage",
      threshold: 90,
      direction: "above",
    },
    {
      show: hasDealSignal && dealsNoActivity > 0 && activationRate < 95,
      title: `Activation deals : ${activationRate}% → 95%`,
      description: `${dealsNoActivity} deals créés mais jamais touchés. Sprint nettoyage : 1 décision/deal en 2min (action OU lost). ~${Math.max(1, Math.round(dealsNoActivity * 0.4))} deals récupérables.`,
      impact: `~+${Math.max(1, Math.round(dealsNoActivity * 0.4))} deals réveillés`,
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-cyan-500 to-blue-600",
      forecastType: "deal_activation",
      threshold: 95,
      direction: "above",
    },
    {
      show: hasDealSignal && dealsNoAmount > 0 && amountCompleteness < 95,
      title: `Montants renseignés : ${amountCompleteness}% → 95%`,
      description: `${dealsNoAmount} deals sans amount. Forecast en valeur impossible. Champ obligatoire en stage Qualification = data complète sous 30j.`,
      impact: `Forecast pondéré activé sur ${dealsNoAmount} deals additionnels`,
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-blue-500 to-indigo-600",
      forecastType: "amount_completion",
      threshold: 95,
      direction: "above",
    },
    {
      show: hasDealSignal && dealsNoCloseDate > 0 && closeDateCompleteness < 95,
      title: `Date closing : ${closeDateCompleteness}% → 95%`,
      description: `${dealsNoCloseDate} deals sans closedate. Forecast mensuel/trimestriel cassé. Champ obligatoire avant Proposition.`,
      impact: `Forecast par période fiable sur ${dealsNoCloseDate} deals`,
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-indigo-500 to-violet-600",
      forecastType: "close_date_completion",
      threshold: 95,
      direction: "above",
    },
    {
      show: hasDealSignal && stagnantDeals > 0,
      title: `Stagnation : ${stagnantDeals} → 0 deals figés`,
      description: `${stagnantDeals} deals sans activité depuis 7j+ et sans next activity. War room cette semaine = revue 1-by-1 avec décision binaire.`,
      impact: `~+${Math.max(1, Math.round(stagnantDeals * 0.3))} deals récupérés, pipeline assaini`,
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-rose-500 to-pink-600",
      forecastType: "stagnant_clear",
      threshold: 0,
      direction: "below",
    },
    {
      show: hasDealSignal && lost >= 10 && lost > won * 1.5,
      title: `Lost rate : ${PCT(lost, closedTotal)}% → ${Math.max(40, PCT(lost, closedTotal) - 15)}%`,
      description: `${lost} perdus pour ${won} gagnés. Ratio anormal — qualification trop laxiste. Disqualifier 30% des deals dès la Discovery = baisse mécanique du lost rate.`,
      impact: `~+${Math.max(1, Math.round((lost - won) * 0.2))} deals win supplémentaires`,
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-orange-500 to-rose-600",
      forecastType: "lost_rate",
      threshold: Math.max(40, PCT(lost, closedTotal) - 15),
      direction: "below",
    },
    {
      show: hasDealSignal && open > 0 && open < 20,
      title: `Pipeline : ${open} → ${Math.max(30, open * 3)} deals ouverts`,
      description: `Pipeline anémique. Règle CRO : pipeline = 3x objectif quarter. Mobilisation SDR + inbound combinée pour x3 en 60j.`,
      impact: `+${Math.max(20, open * 3 - open)} deals ouverts, couverture forecast atteinte`,
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-fuchsia-500 to-purple-600",
      forecastType: "pipeline_volume",
      threshold: Math.max(30, open * 3),
      direction: "above",
    },
    {
      show: hasDealSignal && (ctx.sequencesCount ?? 0) === 0,
      title: `Sequences : 0 → 3 séquences actives`,
      description: `Aucune sequence Sales Hub. SDR/AE prospectent à la main = productivité divisée par 2. 3 sequences (cold, follow-up, re-engagement) = effet immédiat.`,
      impact: `~+30% reply rate, ~+20% meetings bookés`,
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-violet-500 to-fuchsia-600",
      forecastType: "sequences_setup",
      threshold: 3,
      direction: "above",
    },
    {
      show: hasDealSignal && (ctx.workflowsActiveCount ?? 0) < 3,
      title: `Workflows actifs : ${ctx.workflowsActiveCount ?? 0} → 5 workflows critiques`,
      description: `Trop peu d'automation sales. 5 workflows clés (attribution, relance 5j, relance 14j, post-démo, alerte stagnation) = -3h/sales/semaine en manuel.`,
      impact: `Économie ~${Math.max(1, (ctx.ownersCount ?? 1)) * 12}h/semaine sur l'équipe`,
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-blue-500 to-cyan-600",
      forecastType: "workflows_setup",
      threshold: 5,
      direction: "above",
    },
  ];

  // ─── LIFECYCLE simulations (data-driven uniquement) ──
  const conversionTarget = Math.max(conversionRate + 10, 25);
  const lifecycle: Sim[] = [
    {
      show: hasContactSignal && conversionRate < conversionTarget,
      title: `Conversion Lead → Opp : ${conversionRate}% → ${conversionTarget}%`,
      description: `${opps} opportunités sur ${tContacts.toLocaleString("fr-FR")} contacts. Top quartile B2B atteint ${conversionTarget}%. Lead scoring + handoff automatique = +${conversionTarget - conversionRate} pts.`,
      impact: `~+${Math.max(1, Math.round(tContacts * (conversionTarget - conversionRate) / 100)).toLocaleString("fr-FR")} opportunités/an`,
      category: "marketing",
      simulationCategory: "lifecycle",
      color: "from-amber-500 to-orange-600",
      forecastType: "conversion_rate",
      threshold: conversionTarget,
      direction: "above",
    },
    {
      show: hasContactSignal && tContacts > opps * 4,
      title: `Réactivation dormants : ~${Math.round(tContacts * 0.05).toLocaleString("fr-FR")} contacts re-engageables`,
      description: `${(tContacts - opps).toLocaleString("fr-FR")} contacts non-opportunités. Statistiquement 5% sont réactivables avec une bonne campagne (offre + content + scoring).`,
      impact: `+${Math.max(1, Math.round(tContacts * 0.005)).toLocaleString("fr-FR")} opportunités gratuites identifiées`,
      category: "marketing",
      simulationCategory: "lifecycle",
      color: "from-amber-500 to-rose-500",
      forecastType: "dormant_reactivation",
      threshold: Math.max(1, Math.round(tContacts * 0.05)),
      direction: "above",
    },
    {
      show: hasContactSignal && (ctx.workflowsActiveCount ?? 0) < 3,
      title: `Workflows lifecycle : ${ctx.workflowsActiveCount ?? 0} → 5 actifs`,
      description: "MQL→SQL auto, nurturing TOFU, re-engagement dormants, post-event, lead scoring composite. 5 automations qui multiplient le ROI marketing.",
      impact: "+30-50% de conversion lead→opp à 12 mois",
      category: "marketing",
      simulationCategory: "lifecycle",
      color: "from-amber-500 to-yellow-600",
      forecastType: "workflows_lifecycle",
      threshold: 5,
      direction: "above",
    },
    {
      show: hasContactSignal && (ctx.formsCount ?? 0) < 5,
      title: `Forms : ${ctx.formsCount ?? 0} → 8 forms par persona/intent`,
      description: "Démo, fiche commerciale, guide TOFU, webinar MOFU, newsletter, contact, partenaires, careers. 8 forms par persona × intent = funnel structuré.",
      impact: `+${Math.max(20, Math.round(tContacts * 0.1)).toLocaleString("fr-FR")} leads/mois (cible)`,
      category: "marketing",
      simulationCategory: "lifecycle",
      color: "from-amber-500 to-orange-500",
      forecastType: "forms_setup",
      threshold: 8,
      direction: "above",
    },
    {
      show: hasContactSignal && (ctx.listsCount ?? 0) < 10,
      title: `Listes segmentation : ${ctx.listsCount ?? 0} → 15 listes dynamiques`,
      description: `Sur ${tContacts.toLocaleString("fr-FR")} contacts, peu de segments. 15 listes intelligentes (lifecycle, persona, intent, engagement) = +60% engagement.`,
      impact: `Personnalisation des campagnes sur 100% de la base`,
      category: "marketing",
      simulationCategory: "lifecycle",
      color: "from-rose-500 to-amber-500",
      forecastType: "lists_setup",
      threshold: 15,
      direction: "above",
    },
    {
      show: hasContactSignal && (ctx.marketingCampaignsCount ?? 0) < 5,
      title: `Campagnes trackées : ${ctx.marketingCampaignsCount ?? 0} → 10 campagnes structurées`,
      description: "Sans tracking de campagnes (Marketing Campaigns HubSpot), impossible de mesurer ROI par initiative. 10 campagnes minimum pour benchmarker.",
      impact: "Reporting ROI par campagne mensuel activé",
      category: "marketing",
      simulationCategory: "lifecycle",
      color: "from-amber-500 to-fuchsia-500",
      forecastType: "campaigns_setup",
      threshold: 10,
      direction: "above",
    },
    {
      show: (ctx.ticketsCount ?? 0) > 0 && (ctx.feedbackCount ?? 0) === 0,
      title: `NPS/CSAT loop : 0 → ${Math.max(10, Math.round((ctx.ticketsCount ?? 0) * 0.3))} feedbacks/mois`,
      description: `${ctx.ticketsCount} tickets ouverts mais 0 feedback collecté. Survey post-ticket + NPS trimestriel = détection proactive churn.`,
      impact: `${Math.max(10, Math.round((ctx.ticketsCount ?? 0) * 0.3))} signaux client/mois pour CSM`,
      category: "csm",
      simulationCategory: "lifecycle",
      color: "from-emerald-500 to-teal-600",
      forecastType: "feedback_loop",
      threshold: Math.max(10, Math.round((ctx.ticketsCount ?? 0) * 0.3)),
      direction: "above",
    },
    {
      show: (ctx.subscriptionsCount ?? 0) > 0,
      title: `Renouvellement : alerte 90j avant échéance`,
      description: `${ctx.subscriptionsCount} subscriptions actives. Workflow d'alerte à J-90 = +5-10 pts de retention.`,
      impact: `Retention améliorée sur ${ctx.subscriptionsCount} comptes récurrents`,
      category: "csm",
      simulationCategory: "lifecycle",
      color: "from-emerald-500 to-cyan-600",
      forecastType: "renewal_alerts",
      threshold: 90,
      direction: "above",
    },
    {
      show: (ctx.invoicesCount ?? 0) > 0 && won > 0,
      title: `Réconciliation deals ↔ factures`,
      description: `${won} deals gagnés vs ${ctx.invoicesCount} factures émises. Audit des écarts = détection fuites revenue + alignement sales/finance.`,
      impact: "Forecast vs réalisé fiabilisé, fuite revenue identifiée",
      category: "csm",
      simulationCategory: "lifecycle",
      color: "from-cyan-500 to-blue-600",
      forecastType: "deals_invoices_match",
      threshold: 0,
      direction: "above",
    },
    {
      show: hasContactSignal && (ctx.marketingEventsCount ?? 0) === 0,
      title: `Events trackés : 0 → minimum 3 events/an`,
      description: "Webinars, conférences, salons non trackés. Attribution event-driven cassée. Connecter Zoom/On24/Eventbrite à HubSpot Events.",
      impact: "ROI events mesurable + lead gen attribué",
      category: "marketing",
      simulationCategory: "lifecycle",
      color: "from-rose-500 to-fuchsia-500",
      forecastType: "events_tracking",
      threshold: 3,
      direction: "above",
    },
  ];

  // ─── DATA QUALITY simulations (data-driven uniquement) ──
  const phoneRate = tContacts > 0 ? PCT(tContacts - contactsNoPhone, tContacts) : 0;
  const titleRate = tContacts > 0 ? PCT(tContacts - contactsNoTitle, tContacts) : 0;
  const industryRate = totalCompanies > 0 ? PCT(totalCompanies - companiesNoIndustry, totalCompanies) : 0;
  const revenueRate = totalCompanies > 0 ? PCT(totalCompanies - companiesNoRevenue, totalCompanies) : 0;

  const dataQuality: Sim[] = [
    {
      show: hasContactSignal && orphanRate > 5,
      title: `Orphelins : ${orphanRate}% → ${Math.max(5, orphanRate - 20)}%`,
      description: `${orphans.toLocaleString("fr-FR")} contacts sans entreprise. Workflow auto-association par domaine email = effet immédiat sur les nouveaux + batch enrichissement sur l'existant.`,
      impact: `${Math.max(1, Math.round(orphans * 0.6)).toLocaleString("fr-FR")} contacts ré-attribués`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-teal-600",
      forecastType: "orphan_rate",
      threshold: Math.max(5, orphanRate - 20),
      direction: "below",
    },
    {
      show: hasContactSignal && phoneRate < 80 && contactsNoPhone > 0,
      title: `Téléphone : ${phoneRate}% → 80%`,
      description: `${contactsNoPhone.toLocaleString("fr-FR")} contacts sans phone. Enrichissement Dropcontact (~0,30€/contact) + champ obligatoire dans les forms futurs.`,
      impact: `+${Math.max(1, Math.round(contactsNoPhone * 0.6)).toLocaleString("fr-FR")} contacts joignables outbound`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-green-600",
      forecastType: "phone_enrichment",
      threshold: 80,
      direction: "above",
    },
    {
      show: hasContactSignal && titleRate < 90 && contactsNoTitle > 0,
      title: `Poste : ${titleRate}% → 90%`,
      description: `${contactsNoTitle.toLocaleString("fr-FR")} contacts sans jobtitle. Personnalisation outbound aveugle. Enrichissement LinkedIn Sales Navigator + champ obligatoire BOFU.`,
      impact: `Personnalisation par fonction sur ${Math.max(1, Math.round(contactsNoTitle * 0.7)).toLocaleString("fr-FR")} contacts`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-teal-500 to-cyan-600",
      forecastType: "title_enrichment",
      threshold: 90,
      direction: "above",
    },
    {
      show: hasCompanySignal && industryRate < 90 && companiesNoIndustry > 0,
      title: `Secteur : ${industryRate}% → 90%`,
      description: `${companiesNoIndustry.toLocaleString("fr-FR")} companies sans industry. HubSpot Insights (gratuit, auto-fill par domaine) ou Clearbit = enrichissement sous 24h.`,
      impact: `Segmentation industry sur +${Math.max(1, Math.round(companiesNoIndustry * 0.8)).toLocaleString("fr-FR")} comptes`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-cyan-500 to-blue-600",
      forecastType: "industry_enrichment",
      threshold: 90,
      direction: "above",
    },
    {
      show: hasCompanySignal && revenueRate < 80 && companiesNoRevenue > 0,
      title: `CA entreprise : ${revenueRate}% → 80%`,
      description: `${companiesNoRevenue.toLocaleString("fr-FR")} companies sans annualrevenue. ICP scoring impossible. Enrichissement Clearbit/Société.com mensuel.`,
      impact: `ICP scoring activé sur +${Math.max(1, Math.round(companiesNoRevenue * 0.7)).toLocaleString("fr-FR")} comptes`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-blue-500 to-indigo-600",
      forecastType: "revenue_enrichment",
      threshold: 80,
      direction: "above",
    },
    {
      show: tContacts >= 1000,
      title: `Dédoublonnage base : ${tContacts.toLocaleString("fr-FR")} contacts à scanner`,
      description: `À cette taille, doublons garantis. HubSpot Manage Duplicates ce mois + détection auto sur email comme clé unique.`,
      impact: `Reporting fiable + sender reputation préservée`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-teal-600",
      forecastType: "dedup",
      threshold: 0,
      direction: "below",
    },
    {
      show: (ctx.customObjectsCount ?? 0) >= 5,
      title: `Audit custom objects : ${ctx.customObjectsCount} schemas`,
      description: `${ctx.customObjectsCount} schemas custom dans HubSpot. Sans gouvernance, le CRM devient illisible. Audit + documentation Notion.`,
      impact: `CRM gouverné, équipes alignées sur les définitions`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-teal-500 to-emerald-600",
      forecastType: "custom_audit",
      threshold: 0,
      direction: "above",
    },
    {
      show: (ctx.ownersCount ?? 0) >= 5 && (ctx.teamsCount ?? 0) === 0,
      title: `Teams : 0 → ${Math.max(2, Math.ceil((ctx.ownersCount ?? 0) / 5))} équipes`,
      description: `${ctx.ownersCount} owners actifs mais aucune team configurée. Reporting par équipe impossible. Round-robin par segment cassé.`,
      impact: `Reporting par team activé, attribution fine possible`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-cyan-600",
      forecastType: "teams_setup",
      threshold: Math.max(2, Math.ceil((ctx.ownersCount ?? 0) / 5)),
      direction: "above",
    },
    {
      show: (ctx.workflowsCount ?? 0) > 0 && (ctx.workflowsActiveCount ?? 0) < (ctx.workflowsCount ?? 0) * 0.5,
      title: `Workflows : ${ctx.workflowsActiveCount}/${ctx.workflowsCount} actifs`,
      description: `${(ctx.workflowsCount ?? 0) - (ctx.workflowsActiveCount ?? 0)} workflows désactivés. Soit pollution historique, soit features cassées.`,
      impact: `Audit + cleanup = automation propre`,
      category: "data",
      simulationCategory: "data_quality",
      color: "from-cyan-500 to-blue-600",
      forecastType: "workflows_audit",
      threshold: ctx.workflowsCount ?? 0,
      direction: "above",
    },
    {
      show: hasContactSignal && (ctx.listsCount ?? 0) === 0,
      title: `Listes : 0 → 10 listes dynamiques`,
      description: `${tContacts.toLocaleString("fr-FR")} contacts sans aucune segmentation. Construction de 10 listes (lifecycle, persona, intent, engagement) = base pour campagnes ciblées.`,
      impact: "Personnalisation activée sur 100% de la base",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-green-600",
      forecastType: "lists_baseline",
      threshold: 10,
      direction: "above",
    },
  ];

  // ─── STARTER simulations (org vide ou très petite) ──
  // Diagnostics de SETUP qui fonctionnent même sans données opérationnelles.
  // Pertinents pour : nouveau CRM, nouvelle org, sync en cours, démarrage.
  const starter: Sim[] = [
    {
      show: tDeals < 5,
      title: `Premier pipeline : ${tDeals} → 20 deals créés`,
      description: "Cible setup CRM : avoir 20 deals en pipeline pour valider le funnel et calibrer les premiers rapports. Mix outbound (SDR) + inbound (formulaires).",
      impact: "Funnel testé + premiers KPIs calculables",
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-fuchsia-500 to-purple-600",
      forecastType: "starter_pipeline",
      threshold: 20,
      direction: "above",
    },
    {
      show: (ctx.ownersCount ?? 0) === 0,
      title: `Owners HubSpot : 0 → ${Math.max(2, ctx.ownersCount ?? 0 + 2)} actifs`,
      description: "Sans owners actifs, aucun deal/contact n'est attribué. Ajout des sales/marketing/CSM dans HubSpot avant tout travail commercial.",
      impact: "Attribution + reporting par personne activé",
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-blue-500 to-indigo-600",
      forecastType: "owners_setup",
      threshold: 2,
      direction: "above",
    },
    {
      show: (ctx.formsCount ?? 0) === 0,
      title: "Site web → CRM : brancher le tracking",
      description: "Sans tracking pixel HubSpot + forms, 100% des leads échappent. Installation prioritaire avant toute campagne marketing.",
      impact: "Top-of-funnel inbound activé",
      category: "marketing",
      simulationCategory: "lifecycle",
      color: "from-amber-500 to-orange-600",
      forecastType: "tracking_setup",
      threshold: 1,
      direction: "above",
    },
    {
      show: tContacts < 50 && (ctx.formsCount ?? 0) === 0,
      title: `Lead generation : 0 → 100 leads/mois`,
      description: "Cible démarrage : générer 100 leads/mois via 1 lead magnet + 3 sources (SEO content, LinkedIn ads, partenaires). Base à 1k contacts en 12 mois.",
      impact: "Pipeline alimenté, base en croissance prévisible",
      category: "marketing",
      simulationCategory: "lifecycle",
      color: "from-rose-500 to-pink-600",
      forecastType: "lead_gen_setup",
      threshold: 100,
      direction: "above",
    },
    {
      show: tContacts < 100,
      title: `ICP defined : 0 → 1 ICP documenté`,
      description: "Avant de scale l'acquisition, documenter l'ICP en 1 page : secteur, taille, persona, pain, déclencheurs. Sans ICP, l'acquisition tire à vue.",
      impact: "Acquisition focalisée, lead quality x2-3",
      category: "marketing",
      simulationCategory: "lifecycle",
      color: "from-amber-500 to-fuchsia-600",
      forecastType: "icp_setup",
      threshold: 1,
      direction: "above",
    },
    {
      show: tDeals < 5 && (ctx.workflowsActiveCount ?? 0) === 0,
      title: `Setup workflows : 0 → 5 automations critiques`,
      description: "5 workflows à activer dès le premier jour : attribution auto, lifecycle progression, MQL→SQL, relance 5j, alerte stagnation.",
      impact: "Sales & marketing sur autopilote",
      category: "sales",
      simulationCategory: "pipeline",
      color: "from-indigo-500 to-blue-600",
      forecastType: "workflows_starter",
      threshold: 5,
      direction: "above",
    },
    {
      show: tContacts < 50 && (ctx.listsCount ?? 0) < 3,
      title: `Listes de base : ${ctx.listsCount ?? 0} → 5 listes setup`,
      description: "5 listes minimales : tous-contacts, MQL actifs, customers, dormants 90j, opt-out. Base de la segmentation marketing.",
      impact: "Campagnes ciblables, audit RGPD simplifié",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-emerald-500 to-teal-600",
      forecastType: "lists_starter",
      threshold: 5,
      direction: "above",
    },
    {
      show: (ctx.workflowsActiveCount ?? 0) === 0,
      title: `Lifecycle stages : 0 → 6 stages activés`,
      description: "Subscriber → Lead → MQL → SQL → Opportunity → Customer. Sans lifecycle, aucun funnel marketing mesurable.",
      impact: "Funnel marketing/sales aligné et mesurable",
      category: "marketing",
      simulationCategory: "lifecycle",
      color: "from-amber-500 to-yellow-600",
      forecastType: "lifecycle_setup",
      threshold: 6,
      direction: "above",
    },
    {
      show: tContacts < 100,
      title: `Premier programme nurturing : 0 → 1 séquence`,
      description: "Email nurturing de 4-5 touches sur 21j pour les nouveaux leads. Activation immédiate, ROI mesurable dès le 2e mois.",
      impact: "+30% de leads convertis vs sans nurturing",
      category: "marketing",
      simulationCategory: "lifecycle",
      color: "from-fuchsia-500 to-rose-600",
      forecastType: "nurturing_starter",
      threshold: 1,
      direction: "above",
    },
    {
      show: (ctx.customObjectsCount ?? 0) === 0 && tDeals < 50,
      title: "Custom properties critiques à créer",
      description: "Avant le 1er gros volume : créer les custom fields qui structurent votre business (lead_source détaillé, ICP_segment, intent_score, churn_risk).",
      impact: "CRM préparé pour scale sans dette technique",
      category: "data",
      simulationCategory: "data_quality",
      color: "from-teal-500 to-emerald-600",
      forecastType: "custom_fields_setup",
      threshold: 0,
      direction: "above",
    },
  ];

  return [...starter, ...pipeline, ...lifecycle, ...dataQuality].filter((s) => s.show);
}

export type SimulationCategory = "pipeline" | "lifecycle" | "data_quality";

export const SIMULATION_CATEGORY_LABELS: Record<SimulationCategory, { label: string; emoji: string }> = {
  pipeline: { label: "Pipeline", emoji: "🚀" },
  lifecycle: { label: "Lifecycle", emoji: "🔄" },
  data_quality: { label: "Données", emoji: "🛡️" },
};
