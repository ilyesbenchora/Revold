export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CoachingPageTabs } from "@/components/coaching-page-tabs";
import { fetchReportCoachings } from "@/lib/reports/fetch-report-coachings";
import { inferActionType, type UnifiedCoaching } from "@/lib/reports/coaching-types";
import { buildContext, fetchDismissals, fetchTrackingStats, fetchWorkflows, selectInsights, hubspotLinks } from "../context";

const HUBSPOT_PORTAL = "48372600";
const NEW_WORKFLOW = `https://app.hubspot.com/workflows/${HUBSPOT_PORTAL}/new`;
const ALL_WORKFLOWS = `https://app.hubspot.com/workflows/${HUBSPOT_PORTAL}`;

export default async function CommercialCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);

  const [ctx, { dismissedKeys }, { workflows, dealsNoOwner }, manualCoachings] = await Promise.all([
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
    fetchWorkflows(token),
    // Tous les status pour l'onglet "Mes coachings IA"
    fetchReportCoachings(supabase, orgId, "commercial", ["active", "done", "removed"]),
  ]);

  const tracking = await fetchTrackingStats(token);
  ctx.trackingSample = tracking.trackingSample;
  ctx.onlineContacts = tracking.onlineContacts;

  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const insights = insightsByCategory.commercial;

  // ── Automation insights (commercial) ──
  const tDeals = ctx.totalDeals;
  const dealsNoOwnerPct = tDeals > 0 ? Math.round((dealsNoOwner / tDeals) * 100) : 0;
  const wfNames = workflows.map((w) => w.name.toLowerCase());
  const hasAttribution = wfNames.some((n) => n.includes("attribut") || n.includes("assign") || n.includes("round") || n.includes("routing"));
  const hasRelance = wfNames.some((n) => n.includes("relance") || n.includes("nurturing") || n.includes("dormant") || n.includes("inactif"));
  const hasSLA = wfNames.some((n) => n.includes("sla") || n.includes("premier contact") || n.includes("first contact") || n.includes("response time"));
  const hasRiskAlert = wfNames.some((n) => n.includes("risque") || n.includes("at risk") || n.includes("at-risk") || n.includes("alerte deal"));
  const inactiveCreationWorkflows = workflows.filter((w) => !w.enabled && (w.name.toLowerCase().includes("création") || w.name.toLowerCase().includes("creation")));

  type AutoItem = { key: string; severity: "critical" | "warning" | "info"; title: string; body: string; recommendation: string; hubspotUrl: string; show: boolean };
  const automationItems: AutoItem[] = [
    {
      key: "automation_attribution",
      severity: "critical",
      title: "Aucun workflow d'attribution automatique des deals",
      body: `${dealsNoOwnerPct}% des transactions (${dealsNoOwner}) n'ont pas de propriétaire assigné.`,
      recommendation: "Créer un workflow déclenché à la création d'un deal qui assigne un propriétaire (round-robin, segment, source).",
      hubspotUrl: NEW_WORKFLOW,
      show: !hasAttribution && dealsNoOwnerPct > 50,
    },
    {
      key: "automation_inactive_creation",
      severity: "warning",
      title: `${inactiveCreationWorkflows.length} workflow${inactiveCreationWorkflows.length > 1 ? "s" : ""} de création de deals désactivé${inactiveCreationWorkflows.length > 1 ? "s" : ""}`,
      body: `Workflows en attente : ${inactiveCreationWorkflows.map((w) => `« ${w.name} »`).join(", ")}.`,
      recommendation: "Vérifier pourquoi ces workflows sont désactivés et les réactiver.",
      hubspotUrl: ALL_WORKFLOWS,
      show: inactiveCreationWorkflows.length > 0,
    },
    {
      key: "automation_relance",
      severity: "critical",
      title: "Aucun workflow de relance commerciale automatique",
      body: `${ctx.dealsNoNextActivity} transactions en cours sans prochaine activité planifiée.`,
      recommendation: "Créer un workflow qui crée une tâche de relance dès qu'un deal est inactif depuis 5 jours.",
      hubspotUrl: NEW_WORKFLOW,
      show: !hasRelance && ctx.dealsNoNextActivity > ctx.openDeals * 0.4,
    },
    {
      key: "automation_sla",
      severity: "warning",
      title: "Aucun SLA premier contact en place",
      body: "Aucun workflow ne vérifie qu'un nouveau lead est contacté dans un délai défini. Contacter un lead dans l'heure augmente la qualification de 7x.",
      recommendation: "Créer un workflow qui notifie le propriétaire immédiatement, et escalade au manager si pas de contact dans les 24h.",
      hubspotUrl: NEW_WORKFLOW,
      show: !hasSLA,
    },
    {
      key: "automation_risk_alert",
      severity: "warning",
      title: "Aucune alerte automatique sur les deals à risque",
      body: `${ctx.dealsNoActivity} transactions en cours sans aucune activité commerciale.`,
      recommendation: "Créer un workflow qui marque un deal « à risque » si aucune activité depuis 14 jours.",
      hubspotUrl: NEW_WORKFLOW,
      show: !hasRiskAlert,
    },
  ];
  const visibleAutomation = automationItems.filter((i) => i.show && !dismissedKeys.has(i.key));

  // ── Construit l'array unifié ──
  const allItems: UnifiedCoaching[] = [
    ...insights.map((i): UnifiedCoaching => ({
      id: `auto-${i.key}`,
      source: "auto",
      templateKey: i.key,
      severity: i.severity,
      title: i.title,
      body: i.body,
      recommendation: i.recommendation,
      hubspotUrl: hubspotLinks.commercial,
      category: "commercial",
      actionType: inferActionType({ templateKey: i.key, hubspotUrl: hubspotLinks.commercial, title: i.title, body: i.body, recommendation: i.recommendation, category: "commercial" }),
    })),
    ...visibleAutomation.map((i): UnifiedCoaching => ({
      id: `automation-${i.key}`,
      source: "automation",
      templateKey: i.key,
      severity: i.severity,
      title: i.title,
      body: i.body,
      recommendation: i.recommendation,
      hubspotUrl: i.hubspotUrl,
      category: "commercial",
      actionType: inferActionType({ templateKey: i.key, hubspotUrl: i.hubspotUrl, title: i.title, body: i.body, recommendation: i.recommendation, category: "commercial" }),
    })),
    ...manualCoachings.map((m): UnifiedCoaching => ({
      id: `manual-${m.id}`,
      source: "manual",
      reportCoachingId: m.id,
      severity: m.severity,
      title: m.title,
      body: m.body,
      recommendation: m.recommendation ?? m.body,
      hubspotUrl: undefined,
      category: "commercial",
      actionType: inferActionType({ title: m.title, body: m.body, recommendation: m.recommendation ?? "", category: "commercial" }),
      status: m.status,
      createdAt: m.created_at,
      sourceReportTitle: m.source_report_title,
      kpiLabel: m.kpi_label,
    })),
  ];

  return <CoachingPageTabs allItems={allItems} categoryLabel="ventes" />;
}
