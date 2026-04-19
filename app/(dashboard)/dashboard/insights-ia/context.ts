import { SupabaseClient } from "@supabase/supabase-js";
import { selectInsights, type InsightContext } from "@/lib/ai/insights-library";
import { detectIntegrations, type DetectedIntegration } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions, getToolCategory } from "@/lib/reports/report-suggestions";
import { buildCrossSourceContext, selectCrossSourceInsights } from "@/lib/insights/cross-source";
import { generateDataModelInsights } from "@/lib/insights/data-model-insights";
import { filterBusinessIntegrations } from "@/lib/integrations/integration-score";

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

export async function buildContext(supabase: SupabaseClient, orgId: string): Promise<InsightContext> {
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
    hasHubSpot: hasHubSpotOAuth || !!process.env.HUBSPOT_ACCESS_TOKEN,
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
    totalContacts: tContacts,
    opportunitiesCount: opps,
    conversionRate,
    orphansCount: orphans,
    orphanRate,
    openDeals: open,
    dealsNoActivity,
    contactsNoPhone,
  } = ctx;

  return [
    {
      title: `Closing rate : ${closingRate}% → ${Math.min(100, closingRate + 15)}%`,
      description: `Actuellement ${won} transactions gagnées sur ${won + lost} clôturées. Améliorer la qualification.`,
      impact: `+${Math.min(100, closingRate + 15) - closingRate} pts, ~${Math.round(won * 0.5)} deals supplémentaires`,
      category: "sales",
      simulationCategory: "pipeline" as const,
      color: "border-blue-200 bg-blue-50",
      forecastType: "closing_rate",
      threshold: Math.min(100, closingRate + 15),
      direction: "above" as const,
    },
    {
      title: `Suivi pipeline : ${tDeals > 0 ? Math.round(((tDeals - (dealsNoNextActivity ?? 0)) / tDeals) * 100) : 0}% → 80%`,
      description: `${dealsNoNextActivity ?? 0} deals sans activité planifiée. Chaque deal doit avoir un prochain RDV.`,
      impact: `+${Math.round((dealsNoNextActivity ?? 0) * 0.7)} deals suivis activement`,
      category: "sales",
      simulationCategory: "pipeline" as const,
      color: "border-indigo-200 bg-indigo-50",
      forecastType: "pipeline_coverage",
      threshold: 80,
      direction: "above" as const,
    },
    {
      title: `Conversion Lead→Opp : ${conversionRate}% → ${Math.min(100, conversionRate + 10)}%`,
      description: `Sur ${tContacts.toLocaleString("fr-FR")} contacts, ${opps.toLocaleString("fr-FR")} sont en phase Opportunité.`,
      impact: `+${Math.round(tContacts * 0.1).toLocaleString("fr-FR")} opportunités potentielles`,
      category: "marketing",
      simulationCategory: "lifecycle" as const,
      color: "border-amber-200 bg-amber-50",
      forecastType: "conversion_rate",
      threshold: Math.min(100, conversionRate + 10),
      direction: "above" as const,
    },
    {
      title: `Orphelins : ${orphanRate}% → ${Math.max(0, orphanRate - 20)}%`,
      description: `${orphans.toLocaleString("fr-FR")} contacts sans entreprise associée.`,
      impact: `Segmentation ABM, fiabilité des rapports par compte`,
      category: "data",
      simulationCategory: "data_quality" as const,
      color: "border-emerald-200 bg-emerald-50",
      forecastType: "orphan_rate",
      threshold: Math.max(0, orphanRate - 20),
      direction: "below" as const,
    },
    {
      title: `Activation deals : ${open > 0 ? Math.round(((open - (dealsNoActivity ?? 0)) / open) * 100) : 0}% → 100%`,
      description: `${dealsNoActivity ?? 0} deals en cours sans aucune activité commerciale enregistrée.`,
      impact: `Pipeline réellement travaillé, ~${Math.round((dealsNoActivity ?? 0) * 0.4)} deals à transformer`,
      category: "sales",
      simulationCategory: "pipeline" as const,
      color: "border-blue-200 bg-blue-50",
      forecastType: "deal_activation",
      threshold: 100,
      direction: "above" as const,
    },
    {
      title: `Données enrichies : téléphone +${tContacts > 0 ? Math.round(((tContacts - (contactsNoPhone ?? 0)) / tContacts) * 100) : 0}% → 80%`,
      description: `${contactsNoPhone ?? 0} contacts sans numéro de téléphone. Outbound téléphone impossible.`,
      impact: `Multicanal débloqué, ${Math.round((contactsNoPhone ?? 0) * 0.6).toLocaleString("fr-FR")} contacts joignables`,
      category: "data",
      simulationCategory: "data_quality" as const,
      color: "border-emerald-200 bg-emerald-50",
      forecastType: "phone_enrichment",
      threshold: 80,
      direction: "above" as const,
    },
    {
      title: `Pipeline en valeur : forecast +20%`,
      description: `Renseigner les montants sur tous les deals permet de construire un forecast fiable.`,
      impact: `Visibilité revenus trimestriels, prévisions data-driven`,
      category: "sales",
      simulationCategory: "pipeline" as const,
      color: "border-indigo-200 bg-indigo-50",
      forecastType: "pipeline_value",
      threshold: 0,
      direction: "above" as const,
    },
    {
      title: `Réactivation contacts dormants`,
      description: `Lancer une campagne sur les contacts sans engagement depuis 6 mois pour identifier les opportunités latentes.`,
      impact: `~${Math.round(tContacts * 0.05).toLocaleString("fr-FR")} contacts potentiellement réactivables`,
      category: "marketing",
      simulationCategory: "lifecycle" as const,
      color: "border-amber-200 bg-amber-50",
      forecastType: "dormant_reactivation",
      threshold: Math.round(tContacts * 0.05),
      direction: "below" as const,
    },
  ];
}

export type SimulationCategory = "pipeline" | "lifecycle" | "data_quality";

export const SIMULATION_CATEGORY_LABELS: Record<SimulationCategory, { label: string; emoji: string }> = {
  pipeline: { label: "Pipeline", emoji: "🚀" },
  lifecycle: { label: "Lifecycle", emoji: "🔄" },
  data_quality: { label: "Données", emoji: "🛡️" },
};
