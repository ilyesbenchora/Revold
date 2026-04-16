import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightCard } from "@/components/insight-card";
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
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  const [ctx, { dismissedKeys }, { workflows }] = await Promise.all([
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
    fetchWorkflows(token),
  ]);

  const tracking = await fetchTrackingStats();
  ctx.trackingSample = tracking.trackingSample;
  ctx.onlineContacts = tracking.onlineContacts;

  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const insights = insightsByCategory.marketing;

  // ── Automation insights (marketing) ──
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

  const allEmpty = insights.length === 0 && visibleAutomation.length === 0;

  return (
    <div className="space-y-6">
      {allEmpty ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-sm text-emerald-700">Toutes les recommandations marketing ont été traitées.</p>
        </div>
      ) : (
        <>
          {insights.length > 0 && (
            <div className={`space-y-3 ${insights.length > 4 ? "max-h-[600px] overflow-y-auto scroll-smooth pr-1" : ""}`}
              style={insights.length > 4 ? { scrollbarWidth: "thin" } : undefined}>
              {insights.map((insight) => (
                <InsightCard
                  key={insight.key}
                  templateKey={insight.key}
                  severity={insight.severity}
                  title={insight.title}
                  body={insight.body}
                  recommendation={insight.recommendation}
                  hubspotUrl={hubspotLinks.marketing}
                  category="marketing"
                />
              ))}
            </div>
          )}

          {visibleAutomation.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                  <path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
                </svg>
                Workflows à mettre en place
              </h3>
              {visibleAutomation.map((i) => (
                <InsightCard
                  key={i.key}
                  templateKey={i.key}
                  severity={i.severity}
                  title={i.title}
                  body={i.body}
                  recommendation={i.recommendation}
                  hubspotUrl={i.hubspotUrl}
                  category="automation"
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
