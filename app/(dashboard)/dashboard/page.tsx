import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getLatestKpi } from "@/lib/supabase/cached";
import Link from "next/link";
import { getScoreLabel } from "@/lib/score-utils";
import { InsightLockedBlock } from "@/components/insight-locked-block";

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
      .select("id, amount, is_closed_won, is_closed_lost, is_at_risk, next_activity_date, sales_activities_count")
      .eq("organization_id", orgId),
    supabase
      .from("contacts")
      .select("id, company_id, is_mql, is_sql, phone")
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
  const lostDealsCount = deals.filter((d) => d.is_closed_lost).length;
  const wonAmount = wonDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const openDeals = deals.filter((d) => !d.is_closed_won && !d.is_closed_lost);
  const openDealsCount = openDeals.length;
  const openAmount = openDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const dealsWithNextActivity = openDeals.filter((d) => d.next_activity_date != null).length;
  const followUpRate = openDealsCount > 0 ? Math.round((dealsWithNextActivity / openDealsCount) * 100) : 0;
  const closingRateComputed = (wonDealsCount + lostDealsCount) > 0
    ? Math.round((wonDealsCount / (wonDealsCount + lostDealsCount)) * 100)
    : 0;

  // ── Compute from contacts ──
  const contactTotal = contacts.length;
  const contactAssigned = contacts.filter((c) => c.company_id != null).length;
  const attributionRate = contactTotal > 0 ? Math.round((contactAssigned / contactTotal) * 100) : 0;
  const orphansCount = contactTotal - contactAssigned;
  const opportunityCount = contacts.filter((c) => c.is_sql).length;
  const leadsCount = contactTotal - opportunityCount;
  const conversionLeadOpp = contactTotal > 0 ? Math.round((opportunityCount / contactTotal) * 100) : 0;
  const contactsWithPhone = contacts.filter((c) => c.phone != null).length;
  const phoneFilledRate = contactTotal > 0 ? Math.round((contactsWithPhone / contactTotal) * 100) : 0;

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

  // Conduite du changement — adoption des outils par l'équipe.
  // Proxy basé sur le taux d'attribution (50 pts), le nombre d'intégrations
  // actives (25 pts) et le nombre d'utilisateurs Revold (25 pts).
  const conduiteScore = Math.round(
    Math.min(50, attributionRate * 0.5) +
    Math.min(25, ((integrations ?? []).filter((i) => i.is_active).length) * 5) +
    Math.min(25, (totalUsers ?? 0) * 5)
  );

  const globalScore = k ? Math.round(
    donneesScore * 0.20 + processScore * 0.20 + salesScore * 0.25 +
    marketingScore * 0.20 + integrationScore * 0.15
  ) : 0;

  const activeIntegrations = (integrations ?? []).filter((i) => i.is_active);
  const inactiveWorkflows = openDealsCount > 0 ? Math.round(openDealsCount * inactivePct / 100) : 0;

  const lastUpdated = k?.snapshot_date
    ? new Date(k.snapshot_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  const categories = [
    {
      label: "Données",
      description: "Qualité et enrichissement",
      score: donneesScore,
      href: "/dashboard/donnees",
      details: [
        { label: "Téléphone renseigné", value: contactTotal > 0 ? `${phoneFilledRate}%` : "—" },
        { label: "Contacts attribués", value: contactTotal > 0 ? `${attributionRate}%` : "—" },
        { label: "Contacts orphelins", value: `${orphansCount.toLocaleString("fr-FR")}` },
      ],
    },
    {
      label: "Process & Alignement",
      description: "Workflows & Lifecycle",
      score: processScore,
      href: "/dashboard/process",
      details: [
        { label: "Contacts", value: `${contactTotal.toLocaleString("fr-FR")}` },
        { label: "Conversion Lead → Opp.", value: `${conversionLeadOpp}%` },
        { label: "Opportunités", value: `${opportunityCount.toLocaleString("fr-FR")}` },
      ],
    },
    {
      label: "Performance Sales",
      description: "Pipeline & Closing",
      score: salesScore,
      href: "/dashboard/performances/commerciale",
      details: [
        { label: "Taux de closing", value: (wonDealsCount + lostDealsCount) > 0 ? `${closingRateComputed}%` : "—" },
        { label: "Pipeline en cours", value: openAmount > 0 ? `€${Math.round(openAmount / 1000)}K` : "—" },
        { label: "Taux de suivi", value: openDealsCount > 0 ? `${followUpRate}%` : "—" },
      ],
    },
    {
      label: "Performance Marketing",
      description: "Funnel & Attribution",
      score: marketingScore,
      href: "/dashboard/performances/marketing",
      details: [
        { label: "Leads", value: `${leadsCount.toLocaleString("fr-FR")}` },
        { label: "Opportunités", value: `${opportunityCount.toLocaleString("fr-FR")}` },
        { label: "Conversion Lead → Opp.", value: `${conversionLeadOpp}%` },
      ],
    },
    {
      label: "Intégration",
      description: "Outils & utilisateurs",
      score: integrationScore,
      href: "/dashboard/integration",
      details: [
        { label: "Intégrations actives", value: `${activeIntegrations.length}` },
        { label: "Utilisateurs CRM", value: `${totalUsers ?? 0}` },
        { label: "Données synchronisées", value: `${(totalDeals + contactTotal).toLocaleString("fr-FR")}` },
      ],
    },
    {
      label: "Conduite du changement",
      description: "Adoption & engagement équipe",
      score: conduiteScore,
      href: "/dashboard/conduite-changement",
      details: [
        { label: "Contacts attribués", value: contactTotal > 0 ? `${attributionRate}%` : "—" },
        { label: "Utilisateurs Revold", value: `${totalUsers ?? 0}` },
        { label: "Intégrations actives", value: `${activeIntegrations.length}` },
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
            Synthèse globale de la santé de votre HubSpot.
            {lastUpdated && (
              <span className="ml-2 text-slate-400">Actualisé le {lastUpdated}</span>
            )}
          </p>
        </div>
      </header>

      {/* Hero — Revenue intelligence at a glance */}
      <div className="card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-indigo-500 to-fuchsia-500" />
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Contacts CRM</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{contactTotal.toLocaleString("fr-FR")}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Deals ouverts</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{openDealsCount.toLocaleString("fr-FR")}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Pipeline en cours</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{openAmount > 0 ? `${Math.round(openAmount / 1000).toLocaleString("fr-FR")}K€` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">CA Closed Won</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 tabular-nums">{wonAmount > 0 ? `${Math.round(wonAmount / 1000).toLocaleString("fr-FR")}K€` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Taux de closing</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{(wonDealsCount + lostDealsCount) > 0 ? `${closingRateComputed}%` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Outils connectés</p>
              <p className="mt-1 text-2xl font-bold text-accent tabular-nums">{activeIntegrations.length}</p>
            </div>
          </div>
          {lastUpdated && (
            <p className="mt-4 text-[10px] text-slate-400">Dernière synchronisation le {lastUpdated}</p>
          )}
        </div>
      </div>

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
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900 group-hover:text-accent">{cat.label}</h3>
                <div className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </div>
              </div>
              <div className={`mt-5 grid gap-2 ${wide ? "grid-cols-3 md:grid-cols-5" : "grid-cols-3"}`}>
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

      {/* AI Insight — Locked / Upgrade required */}
      <InsightLockedBlock
        previewTitle={insight?.title || "Analyse stratégique de votre pipeline RevOps"}
        previewBody={insight?.body || "L'IA Revold analyse en continu vos données CRM pour identifier les opportunités cachées, les risques émergents et les actions prioritaires à mener."}
      />


      {!latestKpi && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            Aucune donnée KPI disponible. Les métriques apparaîtront une fois les données synchronisées.
          </p>
        </div>
      )}
    </section>
  );
}
