import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { AlertButton } from "@/components/alert-button";

const HUBSPOT_PORTAL = "48372600";
const HS = {
  contacts: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/objects/0-1`,
  companies: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/objects/0-2`,
  deals: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/objects/0-3`,
  settings: `https://app.hubspot.com/settings/${HUBSPOT_PORTAL}`,
  properties: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/settings/properties`,
  workflows: `https://app.hubspot.com/workflows/${HUBSPOT_PORTAL}`,
  reports: `https://app.hubspot.com/reports-dashboard/${HUBSPOT_PORTAL}`,
};

const hubspotLinks: Record<string, { label: string; url: string }> = {
  sales: { label: "Ouvrir les transactions", url: HS.deals },
  pipeline: { label: "Ouvrir les transactions", url: HS.deals },
  marketing: { label: "Ouvrir les contacts", url: HS.contacts },
  data: { label: "Ouvrir les propriétés", url: HS.properties },
};

const severityConfig = {
  critical: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700", label: "Critique" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", label: "Attention" },
  info: { bg: "bg-indigo-50", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-700", label: "Info" },
} as const;

const categoryLabels: Record<string, string> = {
  pipeline: "Pipeline", deal_risk: "Deal à risque", forecast: "Prévision",
  coaching: "Coaching", marketing: "Marketing", data: "Data", sales: "Commercial",
};

function classifyInsight(category: string): "commercial" | "marketing" | "data" {
  if (["pipeline", "deal_risk", "forecast", "coaching", "sales"].includes(category)) return "commercial";
  if (["marketing"].includes(category)) return "marketing";
  if (["data"].includes(category)) return "data";
  return "commercial";
}

type Insight = {
  id: string; category: string; severity: string; title: string;
  body: string; recommendation: string | null; generated_at: string;
};

export default async function InsightsPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  // Fetch HubSpot tracking data for marketing insights
  let trackingSample = 0;
  let withMarketingEmails = 0;
  let withFormSubmissions = 0;
  if (process.env.HUBSPOT_ACCESS_TOKEN) {
    try {
      const trackingRes = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=num_conversion_events,hs_email_first_send_date`,
        { headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` } },
      );
      if (trackingRes.ok) {
        const trackingData = await trackingRes.json();
        (trackingData.results ?? []).forEach((c: Record<string, unknown>) => {
          const p = c.properties as Record<string, string | null>;
          trackingSample++;
          if (Number(p.num_conversion_events) > 0) withFormSubmissions++;
          if (p.hs_email_first_send_date) withMarketingEmails++;
        });
      }
    } catch {}
  }

  const [{ data: insights }, r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
    supabase.from("ai_insights").select("*").eq("organization_id", orgId).eq("is_dismissed", false).order("generated_at", { ascending: false }),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_lost", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).is("next_activity_date", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("company_id", null),
  ]);

  const allInsights = (insights ?? []) as Insight[];
  const commercial = allInsights.filter((i) => classifyInsight(i.category) === "commercial");
  const marketing = allInsights.filter((i) => classifyInsight(i.category) === "marketing");
  const data = allInsights.filter((i) => classifyInsight(i.category) === "data");

  // Dynamic marketing insights from tracking data
  const dynamicMarketingInsights: Insight[] = [];
  if (trackingSample > 0 && withMarketingEmails < trackingSample * 0.1) {
    dynamicMarketingInsights.push({
      id: "dynamic-email-marketing",
      category: "marketing",
      severity: "info",
      title: `Email marketing sous-exploité : ${withMarketingEmails} contacts touchés sur ${trackingSample}`,
      body: `Moins de 10% des contacts ont reçu un email marketing. Le canal email est un levier majeur de nurturing et de conversion non exploité.`,
      recommendation: `Mettre en place des séquences email de nurturing pour les leads et des newsletters pour maintenir l'engagement.`,
      generated_at: new Date().toISOString(),
    });
  }
  if (trackingSample > 0 && withFormSubmissions < trackingSample * 0.05) {
    dynamicMarketingInsights.push({
      id: "dynamic-forms",
      category: "marketing",
      severity: "info",
      title: `Formulaires HubSpot non utilisés : ${withFormSubmissions} soumissions sur ${trackingSample} contacts`,
      body: `Les formulaires HubSpot permettent de capturer des leads qualifiés automatiquement avec le tracking. Actuellement très peu de contacts passent par un formulaire.`,
      recommendation: `Créer des formulaires HubSpot sur les pages clés de votre site (contact, devis, démo) pour alimenter automatiquement le CRM.`,
      generated_at: new Date().toISOString(),
    });
  }
  const marketingWithDynamic = [...dynamicMarketingInsights, ...marketing];

  const totalDeals = r1.count ?? 0;
  const won = r2.count ?? 0;
  const lost = r3.count ?? 0;
  const noNext = r4.count ?? 0;
  const totalContacts = r5.count ?? 0;
  const opportunities = r6.count ?? 0;
  const orphans = r7.count ?? 0;

  const closingRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const conversionRate = totalContacts > 0 ? Math.round((opportunities / totalContacts) * 100) : 0;
  const orphanRate = totalContacts > 0 ? Math.round((orphans / totalContacts) * 100) : 0;

  const scenarios = [
    {
      title: `Si le taux de closing passe de ${closingRate}% à ${Math.min(100, closingRate + 15)}%`,
      description: `Actuellement ${won} transactions gagnées sur ${won + lost} clôturées. Améliorer la qualification et le suivi des deals en cours.`,
      impact: `+${Math.min(100, closingRate + 15) - closingRate} points de closing, potentiellement ${Math.round(won * 0.15)} transactions supplémentaires`,
      category: "sales",
      color: "border-blue-200 bg-blue-50",
    },
    {
      title: `Réduire les transactions sans activité planifiée de ${noNext} à ${Math.round(noNext * 0.3)}`,
      description: `${noNext} transactions en cours n'ont aucune prochaine activité. Chaque deal devrait avoir un prochain RDV.`,
      impact: `Taux de suivi de ${totalDeals > 0 ? Math.round(((totalDeals - noNext) / totalDeals) * 100) : 0}% à ${totalDeals > 0 ? Math.round(((totalDeals - Math.round(noNext * 0.3)) / totalDeals) * 100) : 0}%`,
      category: "sales",
      color: "border-indigo-200 bg-indigo-50",
    },
    {
      title: `Augmenter la conversion Lead vers Opportunité de ${conversionRate}% à ${Math.min(100, conversionRate + 10)}%`,
      description: `Sur ${totalContacts.toLocaleString("fr-FR")} contacts, seulement ${opportunities.toLocaleString("fr-FR")} sont en phase Opportunité.`,
      impact: `+${Math.round(totalContacts * 0.1)} opportunités potentielles dans le pipeline`,
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
    { id: "commercial", label: "Insights Commerciaux", insights: commercial, dot: "bg-blue-500", hsLink: hubspotLinks.sales },
    { id: "marketing", label: "Insights Marketing", insights: marketingWithDynamic, dot: "bg-amber-500", hsLink: hubspotLinks.marketing },
    { id: "data", label: "Insights Data", insights: data, dot: "bg-emerald-500", hsLink: hubspotLinks.data },
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
            {allInsights.length} insight{allInsights.length > 1 ? "s" : ""}
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

      {/* Insight blocs */}
      {blocs.map((bloc) => (
        <div key={bloc.id} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className={`h-2 w-2 rounded-full ${bloc.dot}`} />
              {bloc.label}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{bloc.insights.length}</span>
            </h2>
            <a href={bloc.hsLink.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {bloc.hsLink.label}
            </a>
          </div>

          {bloc.insights.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">Aucun insight pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bloc.insights.map((insight) => {
                const config = severityConfig[insight.severity as keyof typeof severityConfig] ?? severityConfig.info;
                return (
                  <article key={insight.id} className={`rounded-xl border p-5 ${config.border} ${config.bg}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${config.badge}`}>{config.label}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                          {categoryLabels[insight.category] ?? insight.category}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{new Date(insight.generated_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-slate-900">{insight.title}</h3>
                    <p className="mt-1.5 text-sm text-slate-700">{insight.body}</p>
                    {insight.recommendation && (
                      <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation</p>
                        <p className="mt-1 text-sm font-medium text-slate-800">{insight.recommendation}</p>
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <a href={bloc.hsLink.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500">
                        À faire dans HubSpot
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
