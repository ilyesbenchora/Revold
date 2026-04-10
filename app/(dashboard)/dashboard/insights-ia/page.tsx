import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { AutomationInsights } from "@/components/automation-insights";
import { InsightCard } from "@/components/insight-card";
import { InsightTabs } from "@/components/insight-tabs";
import { ScenarioCarousel } from "@/components/scenario-carousel";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { selectInsights, type InsightContext } from "@/lib/ai/insights-library";
import { fetchTrackingStats } from "./context";
import { detectIntegrations, type DetectedIntegration } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions, getToolCategory } from "@/lib/reports/report-suggestions";
import { buildCrossSourceContext, selectCrossSourceInsights } from "@/lib/insights/cross-source";
import { generateDataModelInsights } from "@/lib/insights/data-model-insights";
import { filterBusinessIntegrations } from "@/lib/integrations/integration-score";

const HUBSPOT_PORTAL = "48372600";
const HS = {
  contacts: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/objects/0-1`,
  deals: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/objects/0-3`,
  properties: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/settings/properties`,
};

const hubspotLinks: Record<string, string> = {
  commercial: HS.deals,
  marketing: HS.contacts,
  data: HS.properties,
};

export default async function InsightsPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  // ── Fetch CRM data in parallel ──
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
    { data: dismissals },
  ] = await Promise.all([
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_lost", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).is("next_activity_date", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).eq("sales_activities_count", 0),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).lte("amount", 0),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("close_date", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).is("next_activity_date", null).lt("last_contacted_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("company_id", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("phone", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("title", null),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("industry", null),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("annual_revenue", null),
    supabase.from("insight_dismissals").select("*").eq("organization_id", orgId),
  ]);

  // ── Fetch detected integrations (used by both insights and report suggestions) ──
  let detectedIntegrations: DetectedIntegration[] = [];
  if (process.env.HUBSPOT_ACCESS_TOKEN) {
    try {
      detectedIntegrations = await detectIntegrations(process.env.HUBSPOT_ACCESS_TOKEN);
    } catch {}
  }

  // Build integration insights — adoption, change management, missing reports
  type IntInsight = {
    key: string;
    severity: "critical" | "warning" | "info";
    title: string;
    body: string;
    recommendation: string;
  };
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
    //    → connecter officiellement pour récupérer les propriétés et enrichir
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

  // ── Fetch workflows for automation insights ──
  let workflows: Array<{ id: string; name: string; enabled: boolean; type: string; objectType?: string }> = [];
  let dealsNoOwner = 0;
  if (process.env.HUBSPOT_ACCESS_TOKEN) {
    try {
      const [wfRes, ownerRes] = await Promise.all([
        fetch("https://api.hubapi.com/automation/v4/flows?limit=100", {
          headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` },
        }),
        fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, "Content-Type": "application/json" },
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

  // ── Build context ──
  const tDeals = totalDeals ?? 0;
  const won = wonDeals ?? 0;
  const lost = lostDeals ?? 0;
  const open = openDeals ?? 0;
  const tContacts = totalContacts ?? 0;
  const opps = opportunitiesCount ?? 0;
  const orphans = orphansCount ?? 0;
  const closingRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const conversionRate = tContacts > 0 ? Math.round((opps / tContacts) * 100) : 0;
  const orphanRate = tContacts > 0 ? Math.round((orphans / tContacts) * 100) : 0;
  const dealsNoOwnerPct = tDeals > 0 ? Math.round((dealsNoOwner / tDeals) * 100) : 0;
  const leadsCount = tContacts - opps;

  const ctx: InsightContext = {
    totalDeals: tDeals,
    openDeals: open,
    wonDeals: won,
    lostDeals: lost,
    closingRate,
    dealsNoNextActivity: dealsNoNextActivity ?? 0,
    dealsNoActivity: dealsNoActivity ?? 0,
    dealsNoAmount: dealsNoAmount ?? 0,
    dealsNoCloseDate: dealsNoCloseDate ?? 0,
    stagnantDeals: stagnantDeals ?? 0,
    totalContacts: tContacts,
    leadsCount,
    opportunitiesCount: opps,
    conversionRate,
    orphansCount: orphans,
    orphanRate,
    contactsNoPhone: contactsNoPhone ?? 0,
    contactsNoTitle: contactsNoTitle ?? 0,
    totalCompanies: totalCompanies ?? 0,
    companiesNoIndustry: companiesNoIndustry ?? 0,
    companiesNoRevenue: companiesNoRevenue ?? 0,
  };

  // Add tracking stats from HubSpot for the "no online tracking" insight
  const tracking = await fetchTrackingStats();
  ctx.trackingSample = tracking.trackingSample;
  ctx.onlineContacts = tracking.onlineContacts;

  const allDismissed = (dismissals ?? []) as Array<{ template_key: string; status?: string }>;
  const dismissedKeys = new Set(allDismissed.map((d) => d.template_key));
  // If status column doesn't exist, treat all as "done" for backward compat
  const doneCount = allDismissed.filter((d) => !d.status || d.status === "done").length;
  const removedCount = allDismissed.filter((d) => d.status === "removed").length;
  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const visibleIntegrationInsights = integrationInsights.filter((i) => !dismissedKeys.has(i.key));

  // Cross-source insights — joins canonical Revold entities across providers
  // (HubSpot deals ↔ Stripe invoices ↔ Pipedrive deals ↔ ...)
  const crossSourceCtx = await buildCrossSourceContext(supabase, orgId);
  const crossSourceInsights = crossSourceCtx
    ? selectCrossSourceInsights(crossSourceCtx, dismissedKeys)
    : [];

  // Data Model insights — CRM audit + matching recommendations
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

  const dataModelInsights = generateDataModelInsights({
    connectedTools: revoldIntegrations,
    hubSpotDetectedTools: businessTools.map((t) => ({
      key: t.key,
      label: t.label,
      totalProperties: t.totalProperties,
      enrichmentRate: t.enrichmentRate,
      distinctUsers: t.distinctUsers,
      enrichedRecords: t.enrichedRecords,
    })),
    hasHubSpot: !!process.env.HUBSPOT_ACCESS_TOKEN,
    contactsCount: tContacts,
    companiesCount: totalCompanies ?? 0,
    sourceLinksCount: 0, // source_links count requires try/catch — ok to be 0 here
    contactsWithCompany,
    invoicesCount,
    subscriptionsCount,
    ticketsCount,
  }).filter((i) => !dismissedKeys.has(i.id));

  const totalShown =
    insightsByCategory.commercial.length +
    insightsByCategory.marketing.length +
    insightsByCategory.data.length +
    visibleIntegrationInsights.length +
    crossSourceInsights.length +
    dataModelInsights.length;

  // ── Scenarios (8 scenarios in carousel) ──
  const scenarios = [
    {
      title: `Closing rate : ${closingRate}% → ${Math.min(100, closingRate + 15)}%`,
      description: `Actuellement ${won} transactions gagnées sur ${won + lost} clôturées. Améliorer la qualification.`,
      impact: `+${Math.min(100, closingRate + 15) - closingRate} pts, ~${Math.round(won * 0.5)} deals supplémentaires`,
      category: "sales",
      color: "border-blue-200 bg-blue-50",
    },
    {
      title: `Suivi pipeline : ${tDeals > 0 ? Math.round(((tDeals - (dealsNoNextActivity ?? 0)) / tDeals) * 100) : 0}% → 80%`,
      description: `${dealsNoNextActivity ?? 0} deals sans activité planifiée. Chaque deal doit avoir un prochain RDV.`,
      impact: `+${Math.round((dealsNoNextActivity ?? 0) * 0.7)} deals suivis activement`,
      category: "sales",
      color: "border-indigo-200 bg-indigo-50",
    },
    {
      title: `Conversion Lead→Opp : ${conversionRate}% → ${Math.min(100, conversionRate + 10)}%`,
      description: `Sur ${tContacts.toLocaleString("fr-FR")} contacts, ${opps.toLocaleString("fr-FR")} sont en phase Opportunité.`,
      impact: `+${Math.round(tContacts * 0.1).toLocaleString("fr-FR")} opportunités potentielles`,
      category: "marketing",
      color: "border-amber-200 bg-amber-50",
    },
    {
      title: `Orphelins : ${orphanRate}% → ${Math.max(0, orphanRate - 20)}%`,
      description: `${orphans.toLocaleString("fr-FR")} contacts sans entreprise associée.`,
      impact: `Segmentation ABM, fiabilité des rapports par compte`,
      category: "data",
      color: "border-emerald-200 bg-emerald-50",
    },
    {
      title: `Activation deals : ${open > 0 ? Math.round(((open - (dealsNoActivity ?? 0)) / open) * 100) : 0}% → 100%`,
      description: `${dealsNoActivity ?? 0} deals en cours sans aucune activité commerciale enregistrée.`,
      impact: `Pipeline réellement travaillé, ~${Math.round((dealsNoActivity ?? 0) * 0.4)} deals à transformer`,
      category: "sales",
      color: "border-blue-200 bg-blue-50",
    },
    {
      title: `Données enrichies : téléphone +${tContacts > 0 ? Math.round(((tContacts - (contactsNoPhone ?? 0)) / tContacts) * 100) : 0}% → 80%`,
      description: `${contactsNoPhone ?? 0} contacts sans numéro de téléphone. Outbound téléphone impossible.`,
      impact: `Multicanal débloqué, ${Math.round((contactsNoPhone ?? 0) * 0.6).toLocaleString("fr-FR")} contacts joignables`,
      category: "data",
      color: "border-emerald-200 bg-emerald-50",
    },
    {
      title: `Pipeline en valeur : forecast +20%`,
      description: `Renseigner les montants sur tous les deals permet de construire un forecast fiable.`,
      impact: `Visibilité revenue trimestriel, prévisions data-driven`,
      category: "sales",
      color: "border-indigo-200 bg-indigo-50",
    },
    {
      title: `Réactivation contacts dormants`,
      description: `Lancer une campagne sur les contacts sans engagement depuis 6 mois pour identifier les opportunités latentes.`,
      impact: `~${Math.round(tContacts * 0.05).toLocaleString("fr-FR")} contacts potentiellement réactivables`,
      category: "marketing",
      color: "border-amber-200 bg-amber-50",
    },
  ];

  const blocs = [
    { id: "commercial" as const, label: "Insights Commerciaux", insights: insightsByCategory.commercial, dot: "bg-blue-500" },
    { id: "marketing" as const, label: "Insights Marketing", insights: insightsByCategory.marketing, dot: "bg-amber-500" },
    { id: "data" as const, label: "Insights Data", insights: insightsByCategory.data, dot: "bg-emerald-500" },
  ];

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Insights IA</h1>
          <p className="mt-1 text-sm text-slate-500">Analyses, recommandations et scénarios de simulation.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-slate-600">
            {totalShown} actif{totalShown > 1 ? "s" : ""}
          </span>
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
            {doneCount} réalisé{doneCount > 1 ? "s" : ""}
          </span>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">
            {removedCount} retiré{removedCount > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <InsightTabs doneCount={doneCount} removedCount={removedCount} />

      {/* Scénarios de simulation */}
      <CollapsibleBlock
        title={
          <div className="flex w-full items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                <path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
              </svg>
              Scénarios de simulation
            </h2>
            <span className="mr-4 text-xs text-slate-400">{scenarios.length} scénarios</span>
          </div>
        }
      >
        <ScenarioCarousel scenarios={scenarios} />
      </CollapsibleBlock>

      {/* Insights IA Automation */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
              <path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
            </svg>
            Insights IA Automation
          </h2>
        }
      >
        <p className="text-sm text-slate-500">Workflows manquants ou sous-exploités pour optimiser vos processus RevOps.</p>
        <AutomationInsights
          workflows={workflows}
          dealsNoOwnerPct={dealsNoOwnerPct}
          dealsNoOwner={dealsNoOwner}
          dealsNoNextActivity={dealsNoNextActivity ?? 0}
          dealsNoActivity={dealsNoActivity ?? 0}
          openDeals={open}
          contacts={tContacts}
          leads={leadsCount}
          dismissedKeys={dismissedKeys}
        />
      </CollapsibleBlock>

      {/* Insights Intégration — adoption, change management, suggestions de rapports */}
      {visibleIntegrationInsights.length > 0 && (
        <CollapsibleBlock
          title={
            <div className="flex w-full items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                Insights Intégration
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {visibleIntegrationInsights.length}
                </span>
              </h2>
              {totalReportSuggestions > 0 && (
                <span className="mr-4 text-xs text-indigo-600">
                  {totalReportSuggestions} rapport{totalReportSuggestions > 1 ? "s" : ""} suggéré{totalReportSuggestions > 1 ? "s" : ""}
                </span>
              )}
            </div>
          }
        >
          <p className="text-sm text-slate-500">
            Analyses de l&apos;adoption de vos outils métiers connectés au CRM. Améliorez la conduite du changement
            et activez de nouveaux rapports croisant vos sources de données.
          </p>
          <div className="space-y-3">
            {visibleIntegrationInsights.map((insight) => (
              <InsightCard
                key={insight.key}
                templateKey={insight.key}
                severity={insight.severity}
                title={insight.title}
                body={insight.body}
                recommendation={insight.recommendation}
                hubspotUrl={insight.key.startsWith("int_report_") || insight.key === "int_global_low_stack"
                  ? "/dashboard/rapports"
                  : "/dashboard/integration"}
                actionLabel={insight.key.startsWith("int_report_")
                  ? "Voir le rapport suggéré"
                  : insight.key === "int_global_low_stack"
                  ? "Découvrir les rapports"
                  : "Voir l'intégration"}
                category="integration"
              />
            ))}
          </div>
        </CollapsibleBlock>
      )}

      {/* Insights Cross-Source — joins HubSpot, Stripe, Pipedrive… via canonical entities */}
      {crossSourceInsights.length > 0 && (
        <CollapsibleBlock
          title={
            <div className="flex w-full items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
                Insights Cross-Source
                <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">
                  {crossSourceInsights.length}
                </span>
              </h2>
              <span className="mr-4 rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                🔗 Multi-sources
              </span>
            </div>
          }
        >
          <p className="text-sm text-slate-500">
            Insights impossibles à générer avec un seul outil — Revold croise vos sources connectées
            (HubSpot, Stripe, Pipedrive…) pour faire ressortir les fuites revenue, les angles morts commerciaux et les risques cachés.
          </p>
          <div className="space-y-3">
            {crossSourceInsights.map((insight) => (
              <InsightCard
                key={insight.key}
                templateKey={insight.key}
                severity={insight.severity}
                title={insight.title}
                body={insight.body}
                recommendation={insight.recommendation}
                hubspotUrl="/dashboard/rapports"
                actionLabel="Voir le rapport associé"
                category="cross_source"
              />
            ))}
          </div>
        </CollapsibleBlock>
      )}

      {/* Insights Data Model — CRM audit + matching recommendations */}
      {dataModelInsights.length > 0 && (
        <CollapsibleBlock
          title={
            <div className="flex w-full items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span className="h-2 w-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500" />
                Insights Data Model
                <span className="rounded-full bg-gradient-to-r from-fuchsia-50 to-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {dataModelInsights.length}
                </span>
              </h2>
              <span className="mr-4 text-xs text-indigo-600">
                Audit CRM + recommandations
              </span>
            </div>
          }
        >
          <p className="text-sm text-slate-500">
            Audit automatique des outils connectés à votre CRM et recommandations pour optimiser
            la communication entre tous vos outils — que chaque source de données parle le même langage.
          </p>
          <div className="space-y-3">
            {dataModelInsights.map((insight) => {
              const severityMap = {
                critical: "critical" as const,
                warning: "warning" as const,
                info: "info" as const,
                success: "info" as const,
              };
              return (
                <InsightCard
                  key={insight.id}
                  templateKey={insight.id}
                  severity={severityMap[insight.severity]}
                  title={insight.title}
                  body={insight.body}
                  recommendation={insight.recommendation}
                  hubspotUrl={insight.category === "missing_tool" ? "/dashboard/integration" : "/dashboard/parametres/modele-donnees"}
                  actionLabel={insight.category === "missing_tool" ? "Connecter l'outil" : "Configurer le data model"}
                  category="data_model"
                />
              );
            })}
          </div>
        </CollapsibleBlock>
      )}

      {/* Insight blocs (commercial / marketing / data) */}
      {blocs.map((bloc) => (
        <CollapsibleBlock
          key={bloc.id}
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className={`h-2 w-2 rounded-full ${bloc.dot}`} />
              {bloc.label}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{bloc.insights.length}</span>
            </h2>
          }
        >
          {bloc.insights.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <p className="text-sm text-emerald-700">Toutes les recommandations ont été traitées pour cette catégorie.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bloc.insights.map((insight) => (
                <InsightCard
                  key={insight.key}
                  templateKey={insight.key}
                  severity={insight.severity}
                  title={insight.title}
                  body={insight.body}
                  recommendation={insight.recommendation}
                  hubspotUrl={hubspotLinks[bloc.id]}
                  category={bloc.id}
                />
              ))}
            </div>
          )}
        </CollapsibleBlock>
      ))}
    </section>
  );
}
