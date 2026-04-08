import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { AlertButton } from "@/components/alert-button";
import { AutomationInsights } from "@/components/automation-insights";
import { InsightCard } from "@/components/insight-card";
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
    supabase.from("insight_dismissals").select("template_key").eq("organization_id", orgId),
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

  const dismissedKeys = new Set((dismissals ?? []).map((d) => d.template_key));
  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const totalShown = insightsByCategory.commercial.length + insightsByCategory.marketing.length + insightsByCategory.data.length;

  // ── Scenarios ──
  const scenarios = [
    {
      title: `Si le taux de closing passe de ${closingRate}% à ${Math.min(100, closingRate + 15)}%`,
      description: `Actuellement ${won} transactions gagnées sur ${won + lost} clôturées. Améliorer la qualification et le suivi des deals en cours.`,
      impact: `+${Math.min(100, closingRate + 15) - closingRate} points de closing, potentiellement ${Math.round(won * 0.15)} transactions supplémentaires`,
      category: "sales",
      color: "border-blue-200 bg-blue-50",
    },
    {
      title: `Réduire les transactions sans activité planifiée de ${dealsNoNextActivity ?? 0} à ${Math.round((dealsNoNextActivity ?? 0) * 0.3)}`,
      description: `${dealsNoNextActivity ?? 0} transactions en cours n'ont aucune prochaine activité. Chaque deal devrait avoir un prochain RDV.`,
      impact: `Taux de suivi de ${tDeals > 0 ? Math.round(((tDeals - (dealsNoNextActivity ?? 0)) / tDeals) * 100) : 0}% à ${tDeals > 0 ? Math.round(((tDeals - Math.round((dealsNoNextActivity ?? 0) * 0.3)) / tDeals) * 100) : 0}%`,
      category: "sales",
      color: "border-indigo-200 bg-indigo-50",
    },
    {
      title: `Augmenter la conversion Lead vers Opportunité de ${conversionRate}% à ${Math.min(100, conversionRate + 10)}%`,
      description: `Sur ${tContacts.toLocaleString("fr-FR")} contacts, seulement ${opps.toLocaleString("fr-FR")} sont en phase Opportunité.`,
      impact: `+${Math.round(tContacts * 0.1)} opportunités potentielles dans le pipeline`,
      category: "marketing",
      color: "border-amber-200 bg-amber-50",
    },
    {
      title: `Réduire les contacts orphelins de ${orphanRate}% à ${Math.max(0, orphanRate - 20)}%`,
      description: `${orphans.toLocaleString("fr-FR")} contacts ne sont rattachés à aucune entreprise. L'analyse par compte est impossible.`,
      impact: `Meilleure segmentation et ciblage ABM, fiabilité des rapports par entreprise`,
      category: "data",
      color: "border-emerald-200 bg-emerald-50",
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
            {totalShown} insight{totalShown > 1 ? "s" : ""}
          </span>
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
            {dismissedKeys.size} fait{dismissedKeys.size > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      {/* Scénarios de simulation */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
            <path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
          </svg>
          Scénarios de simulation
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {scenarios.map((s, i) => (
            <article key={i} className={`rounded-xl border p-5 ${s.color}`}>
              <p className="text-sm font-medium text-slate-800">{s.title}</p>
              <p className="mt-1.5 text-xs text-slate-600">{s.description}</p>
              <div className="mt-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
                <p className="text-sm font-semibold text-slate-900">{s.impact}</p>
              </div>
              <div className="mt-4">
                <AlertButton title={s.title} description={s.description} impact={s.impact} category={s.category} />
              </div>
            </article>
          ))}
        </div>
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
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
