import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getLatestKpi } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import Link from "next/link";

function getScoreLabel(score: number): { label: string; className: string } {
  if (score >= 80) return { label: "Excellent", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 50) return { label: "Moyen", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Insuffisant", className: "bg-red-50 text-red-700 border-red-200" };
}

function getBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export default async function DashboardOverviewPage() {
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();

  const [
    latestKpi,
    { data: insight },
    { data: allDeals },
    { data: allContacts },
    { data: integrations },
    { count: totalUsers },
  ] = await Promise.all([
    getLatestKpi(),
    supabase
      .from("ai_insights")
      .select("*")
      .eq("organization_id", orgId)
      .is("deal_id", null)
      .eq("is_dismissed", false)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("deals")
      .select("id, amount, is_closed_won, is_closed_lost, is_at_risk")
      .eq("organization_id", orgId),
    supabase
      .from("contacts")
      .select("id, company_id, is_mql, is_sql")
      .eq("organization_id", orgId),
    supabase
      .from("integrations")
      .select("provider, is_active")
      .eq("organization_id", orgId),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId),
  ]);

  const k = latestKpi;
  const deals = allDeals ?? [];
  const contacts = allContacts ?? [];

  // ── Compute from deals ──
  const totalDeals = deals.length;
  const atRiskDeals = deals.filter((d) => d.is_at_risk).length;
  const wonDeals = deals.filter((d) => d.is_closed_won);
  const wonDealsCount = wonDeals.length;
  const wonAmount = wonDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const openDeals = deals.filter((d) => !d.is_closed_won && !d.is_closed_lost);
  const openDealsCount = openDeals.length;

  // ── Compute from contacts ──
  const contactTotal = contacts.length;
  const contactAssigned = contacts.filter((c) => c.company_id != null).length;
  const attributionRate = contactTotal > 0 ? Math.round((contactAssigned / contactTotal) * 100) : 0;
  const mqlCount = contacts.filter((c) => c.is_mql).length;
  const sqlCount = contacts.filter((c) => c.is_sql).length;
  const lifecycleConversion = mqlCount > 0 ? Math.round((sqlCount / mqlCount) * 100) : 0;

  // ── Scores ──
  const salesScore = Number(k?.sales_score) || 0;
  const marketingScore = Number(k?.marketing_score) || 0;
  const crmScore = Number(k?.crm_ops_score) || 0;

  const dataComp = Number(k?.data_completeness) || 0;
  const dupesPct = Number(k?.duplicate_contacts_pct) || 0;
  const orphansPct = Number(k?.orphan_contacts_pct) || 0;
  const donneesScore = k ? Math.round(
    dataComp * 0.5 +
    Math.max(0, 100 - dupesPct * 5) * 0.25 +
    Math.max(0, 100 - orphansPct * 3) * 0.25
  ) : 0;

  const inactivePct = Number(k?.inactive_deals_pct) || 0;
  const stagnationPct = Number(k?.deal_stagnation_rate) || 0;
  const actPerDeal = Number(k?.activities_per_deal) || 0;
  const cycleDays = Number(k?.sales_cycle_days) || 0;
  const processScore = k ? Math.round(
    Math.max(0, (1 - inactivePct / 50) * 100) * 0.30 +
    Math.max(0, (1 - stagnationPct / 40) * 100) * 0.30 +
    Math.min(100, (actPerDeal / 12) * 100) * 0.20 +
    Math.min(100, Math.max(0, (1 - (cycleDays - 30) / 90) * 100)) * 0.20
  ) : 0;

  const integrationScore = k ? Math.round(dataComp * 0.4 + crmScore * 0.6) : 0;

  const globalScore = k ? Math.round(
    donneesScore * 0.20 + processScore * 0.20 + salesScore * 0.25 +
    marketingScore * 0.20 + integrationScore * 0.15
  ) : 0;

  const averageScore = k ? Math.round(
    (donneesScore + processScore + salesScore + marketingScore + integrationScore) / 5
  ) : 0;

  const activeIntegrations = (integrations ?? []).filter((i) => i.is_active);
  const inactiveWorkflows = openDealsCount > 0 ? Math.round(openDealsCount * inactivePct / 100) : 0;

  const lastUpdated = k?.snapshot_date
    ? new Date(k.snapshot_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  const categories = [
    {
      label: "Donn\u00e9es",
      description: "Data Quality & Data Ops",
      score: donneesScore,
      href: "/dashboard/donnees",
      details: [
        { label: "Compl\u00e9tude donn\u00e9es", value: k?.data_completeness ? `${k.data_completeness}%` : "\u2014" },
        { label: "Doublons contacts", value: k?.duplicate_contacts_pct ? `${k.duplicate_contacts_pct}%` : "\u2014" },
        { label: "Contacts orphelins", value: k?.orphan_contacts_pct ? `${k.orphan_contacts_pct}%` : "\u2014" },
      ],
    },
    {
      label: "Process",
      description: "Workflows & Lifecycle",
      score: processScore,
      href: "/dashboard/process",
      details: [
        { label: "Workflows actifs", value: `${openDealsCount}` },
        { label: "Workflows inactifs", value: `${inactiveWorkflows}` },
        { label: "Attribution contacts", value: `${attributionRate}%` },
        { label: "Conversion lifecycle", value: `${lifecycleConversion}%` },
        { label: "Cr\u00e9ation transactions", value: `${totalDeals}` },
      ],
    },
    {
      label: "Performance Sales",
      description: "KPIs commerciaux",
      score: salesScore,
      href: "/dashboard/performance-commerciale",
      details: [
        { label: "Cycle de vente moyen", value: cycleDays > 0 ? `${cycleDays} jours` : "\u2014" },
        { label: "Transactions gagn\u00e9es", value: `${wonDealsCount}` },
        { label: "Montant gagn\u00e9", value: wonAmount > 0 ? `\u20ac${(wonAmount / 1000).toFixed(0)}K` : "\u2014" },
      ],
    },
    {
      label: "Performance Marketing",
      description: "KPIs marketing",
      score: marketingScore,
      href: "/dashboard/performance-marketing",
      details: [
        { label: "MQL \u2192 SQL", value: k?.mql_to_sql_rate ? `${k.mql_to_sql_rate}%` : "\u2014" },
        { label: "V\u00e9locit\u00e9 leads", value: k?.lead_velocity_rate ? `+${k.lead_velocity_rate}%` : "\u2014" },
        { label: "Fuite funnel", value: k?.funnel_leakage_rate ? `${k.funnel_leakage_rate}%` : "\u2014" },
      ],
    },
    {
      label: "Int\u00e9gration",
      description: "Outils & CRM",
      score: integrationScore,
      href: "/dashboard/integration",
      details: [
        { label: "Outils int\u00e9gr\u00e9s", value: `${activeIntegrations.length}` },
        { label: "Utilisateurs actifs", value: `${totalUsers ?? 0}` },
        { label: "Compl\u00e9tude CRM", value: k?.data_completeness ? `${k.data_completeness}%` : "\u2014" },
      ],
    },
  ];

  return (
    <section className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vue d&apos;ensemble</h1>
          <p className="mt-1 text-sm text-slate-500">
            Synth\u00e8se globale de la sant\u00e9 de votre RevOps.
            {lastUpdated && (
              <span className="ml-2 text-slate-400">Actualis\u00e9 le {lastUpdated}</span>
            )}
          </p>
        </div>
        {totalDeals > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-slate-600">
              {totalDeals} deals
            </span>
            <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-red-700">
              {atRiskDeals} \u00e0 risque
            </span>
          </div>
        )}
      </header>

      {/* Scorecards: Global + Moyen */}
      {k && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="card flex items-center gap-6 p-6">
            <ProgressScore label="Score global" score={globalScore} colorClass={
              globalScore >= 80 ? "stroke-emerald-500" : globalScore >= 50 ? "stroke-amber-500" : "stroke-red-500"
            } />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-slate-900">{globalScore}</span>
                <span className="text-sm text-slate-400">/100</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(globalScore).className}`}>
                  {getScoreLabel(globalScore).label}
                </span>
              </div>
              <p className="text-xs text-slate-500">Score pond\u00e9r\u00e9 (Data 20%, Process 20%, Sales 25%, Mktg 20%, Int\u00e9g. 15%)</p>
            </div>
          </div>

          <div className="card flex items-center gap-6 p-6">
            <ProgressScore label="Score moyen" score={averageScore} colorClass={
              averageScore >= 80 ? "stroke-emerald-500" : averageScore >= 50 ? "stroke-amber-500" : "stroke-red-500"
            } />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-slate-900">{averageScore}</span>
                <span className="text-sm text-slate-400">/100</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(averageScore).className}`}>
                  {getScoreLabel(averageScore).label}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <span key={cat.label} className={`rounded-full px-2 py-0.5 text-xs font-medium ${getScoreLabel(cat.score).className}`}>
                    {cat.label} {cat.score}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress bars */}
      {k && (
        <div className="card p-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-5">
            {categories.map((cat) => (
              <div key={cat.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{cat.label}</span>
                  <span className="font-medium text-slate-700">{cat.score}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className={`h-1.5 rounded-full ${getBarColor(cat.score)}`}
                    style={{ width: `${Math.min(100, cat.score)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => {
          const badge = getScoreLabel(cat.score);
          const wide = cat.details.length > 3;
          return (
            <Link
              key={cat.label}
              href={cat.href}
              className={`card group p-5 transition hover:shadow-md ${wide ? "md:col-span-2 lg:col-span-2" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-accent">{cat.label}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{cat.description}</p>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${
                    cat.score >= 80 ? "text-emerald-600" : cat.score >= 50 ? "text-amber-500" : "text-red-500"
                  }`}>{cat.score}</span>
                  <div className={`mt-1 rounded-full border px-2 py-0.5 text-center text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </div>
                </div>
              </div>
              <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100">
                <div className={`h-1.5 rounded-full transition-all ${getBarColor(cat.score)}`} style={{ width: `${Math.min(100, cat.score)}%` }} />
              </div>
              <div className={`mt-4 grid gap-2 ${wide ? "grid-cols-3 md:grid-cols-5" : "grid-cols-3"}`}>
                {cat.details.map((d) => (
                  <div key={d.label}>
                    <p className="text-xs text-slate-400">{d.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">{d.value}</p>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>

      {/* AI Insight */}
      {insight && (
        <section className="rounded-2xl border border-indigo-200 bg-accent-soft p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
            Insight Revold IA
            {insight.severity === "critical" && (
              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-red-700">Critique</span>
            )}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-indigo-950">{insight.title}</h2>
          <p className="mt-2 text-sm text-indigo-900/80">{insight.body}</p>
          {insight.recommendation && (
            <p className="mt-3 text-sm font-medium text-indigo-800">Recommandation : {insight.recommendation}</p>
          )}
        </section>
      )}

      {!latestKpi && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            Aucune donn\u00e9e KPI disponible. Les m\u00e9triques appara\u00eetront une fois les donn\u00e9es synchronis\u00e9es.
          </p>
        </div>
      )}
    </section>
  );
}
