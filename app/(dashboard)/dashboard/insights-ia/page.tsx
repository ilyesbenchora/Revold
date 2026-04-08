import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { AutomationInsights } from "@/components/automation-insights";
import { InsightCard } from "@/components/insight-card";
import { InsightTabs } from "@/components/insight-tabs";
import { ScenarioCarousel } from "@/components/scenario-carousel";
import { selectInsights, type InsightContext } from "@/lib/ai/insights-library";

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

  const allDismissed = (dismissals ?? []) as Array<{ template_key: string; status?: string }>;
  const dismissedKeys = new Set(allDismissed.map((d) => d.template_key));
  // If status column doesn't exist, treat all as "done" for backward compat
  const doneCount = allDismissed.filter((d) => !d.status || d.status === "done").length;
  const removedCount = allDismissed.filter((d) => d.status === "removed").length;
  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const totalShown = insightsByCategory.commercial.length + insightsByCategory.marketing.length + insightsByCategory.data.length;

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

      <InsightTabs />

      {/* Scénarios de simulation */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
              <path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
            </svg>
            Scénarios de simulation
          </h2>
          <span className="text-xs text-slate-400">{scenarios.length} scénarios — faites défiler →</span>
        </div>
        <ScenarioCarousel scenarios={scenarios} />
      </div>

      {/* Insights IA Automation */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
            <path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
          </svg>
          Insights IA Automation
        </h2>
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
      </div>

      {/* Insight blocs (commercial / marketing / data) */}
      {blocs.map((bloc) => (
        <div key={bloc.id} className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className={`h-2 w-2 rounded-full ${bloc.dot}`} />
            {bloc.label}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{bloc.insights.length}</span>
          </h2>

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
        </div>
      ))}
    </section>
  );
}
