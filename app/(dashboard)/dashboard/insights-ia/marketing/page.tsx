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
const PROPERTIES = `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/settings/properties`;

export default async function MarketingCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);

  const [ctx, { dismissedKeys }, { workflows }, manualCoachings] = await Promise.all([
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
    fetchWorkflows(token),
    fetchReportCoachings(supabase, orgId, "marketing", ["active", "done", "removed"]),
  ]);

  const tracking = await fetchTrackingStats(token);
  ctx.trackingSample = tracking.trackingSample;
  ctx.onlineContacts = tracking.onlineContacts;

  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const insights = insightsByCategory.marketing;

  const wfNames = workflows.map((w) => w.name.toLowerCase());
  const hasLeadScoring = wfNames.some((n) => n.includes("scoring") || n.includes("score") || n.includes("mql") || n.includes("sql") || n.includes("qualif"));
  const hasFormFollowUp = wfNames.some((n) => n.includes("formul") || n.includes("post-form") || n.includes("form submit"));
  const hasReengagement = wfNames.some((n) => n.includes("reengage") || n.includes("re-engage") || n.includes("réengage") || n.includes("réveil"));

  type AutoItem = { key: string; severity: "critical" | "warning" | "info"; title: string; body: string; recommendation: string; hubspotUrl: string; show: boolean };
  const automationItems: AutoItem[] = [
    {
      key: "automation_lead_scoring",
      severity: "critical",
      title: "Aucun workflow de scoring ou qualification des leads",
      body: `${ctx.leadsCount.toLocaleString("fr-FR")} contacts (${ctx.totalContacts > 0 ? Math.round((ctx.leadsCount / ctx.totalContacts) * 100) : 0}%) restent au statut Lead sans logique de qualification automatique.`,
      recommendation: "Mettre en place un score HubSpot basé sur les ouvertures email, visites web, soumissions formulaire.",
      hubspotUrl: PROPERTIES,
      show: !hasLeadScoring,
    },
    {
      key: "automation_form_followup",
      severity: "info",
      title: "Pas de séquence de nurturing post-formulaire",
      body: "Aucun workflow déclenché à la soumission d'un formulaire. Les leads ne reçoivent pas d'email de bienvenue.",
      recommendation: "Créer un workflow déclenché par formulaire qui envoie une séquence de 3-5 emails de nurturing sur 2-3 semaines.",
      hubspotUrl: NEW_WORKFLOW,
      show: !hasFormFollowUp,
    },
    {
      key: "automation_reengagement",
      severity: "info",
      title: "Pas de workflow de réveil des contacts dormants",
      body: `Sur ${ctx.totalContacts.toLocaleString("fr-FR")} contacts, beaucoup sont inactifs. Aucun workflow ne tente de les réactiver.`,
      recommendation: "Créer un workflow qui détecte les contacts sans engagement depuis 6 mois et déclenche une campagne de réveil.",
      hubspotUrl: NEW_WORKFLOW,
      show: !hasReengagement,
    },
  ];
  const visibleAutomation = automationItems.filter((i) => i.show && !dismissedKeys.has(i.key));

  const allItems: UnifiedCoaching[] = [
    ...insights.map((i): UnifiedCoaching => ({
      id: `auto-${i.key}`,
      source: "auto",
      templateKey: i.key,
      severity: i.severity,
      title: i.title,
      body: i.body,
      recommendation: i.recommendation,
      hubspotUrl: hubspotLinks.marketing,
      category: "marketing",
      actionType: inferActionType({ templateKey: i.key, hubspotUrl: hubspotLinks.marketing, title: i.title, body: i.body, recommendation: i.recommendation, category: "marketing" }),
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
      category: "marketing",
      actionType: inferActionType({ templateKey: i.key, hubspotUrl: i.hubspotUrl, title: i.title, body: i.body, recommendation: i.recommendation, category: "marketing" }),
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
      category: "marketing",
      actionType: inferActionType({ title: m.title, body: m.body, recommendation: m.recommendation ?? "", category: "marketing" }),
      status: m.status,
      createdAt: m.created_at,
      sourceReportTitle: m.source_report_title,
      kpiLabel: m.kpi_label,
    })),
  ];

  return <CoachingPageTabs allItems={allItems} categoryLabel="marketing" />;
}
