/**
 * KPI Computation Engine
 * Pure functions that compute all KPI metrics from raw deal/activity/contact data.
 * Used by the daily cron API route to populate kpi_snapshots.
 */

type Deal = {
  id: string;
  amount: number;
  stage_probability: number;
  is_closed_won: boolean;
  is_closed_lost: boolean;
  is_at_risk: boolean;
  close_date: string | null;
  created_date: string;
  days_in_stage: number;
  last_activity_at: string | null;
};

type Contact = {
  id: string;
  company_id: string | null;
  is_mql: boolean;
  is_sql: boolean;
};

type Activity = {
  id: string;
  deal_id: string | null;
};

type ComputedKpis = {
  // Sales
  closing_rate: number;
  pipeline_coverage: number;
  sales_cycle_days: number;
  weighted_forecast: number;
  deal_velocity: number;
  // Marketing
  mql_to_sql_rate: number;
  lead_velocity_rate: number;
  funnel_leakage_rate: number;
  // CRM Ops
  inactive_deals_pct: number;
  data_completeness: number;
  deal_stagnation_rate: number;
  duplicate_contacts_pct: number;
  orphan_contacts_pct: number;
  activities_per_deal: number;
  // Scores
  sales_score: number;
  marketing_score: number;
  crm_ops_score: number;
};

// ── Sales KPIs ──

export function closingRate(deals: Deal[]): number {
  const closed = deals.filter((d) => d.is_closed_won || d.is_closed_lost);
  if (closed.length === 0) return 0;
  const won = closed.filter((d) => d.is_closed_won).length;
  return round((won / closed.length) * 100);
}

export function pipelineCoverage(deals: Deal[], quarterlyTarget: number): number {
  if (quarterlyTarget <= 0) return 0;
  const openPipeline = deals
    .filter((d) => !d.is_closed_won && !d.is_closed_lost)
    .reduce((sum, d) => sum + d.amount, 0);
  return round(openPipeline / quarterlyTarget);
}

export function salesCycleDays(deals: Deal[]): number {
  const wonDeals = deals.filter((d) => d.is_closed_won && d.close_date);
  if (wonDeals.length === 0) return 0;
  const totalDays = wonDeals.reduce((sum, d) => {
    const created = new Date(d.created_date).getTime();
    const closed = new Date(d.close_date!).getTime();
    return sum + Math.max(0, (closed - created) / (1000 * 60 * 60 * 24));
  }, 0);
  return Math.round(totalDays / wonDeals.length);
}

export function weightedForecast(deals: Deal[]): number {
  return round(
    deals
      .filter((d) => !d.is_closed_won && !d.is_closed_lost)
      .reduce((sum, d) => sum + d.amount * (d.stage_probability / 100), 0),
  );
}

export function dealVelocity(deals: Deal[]): number {
  const openDeals = deals.filter((d) => !d.is_closed_won && !d.is_closed_lost);
  if (openDeals.length === 0) return 0;
  const totalWeightedAmount = openDeals.reduce(
    (sum, d) => sum + d.amount * (d.stage_probability / 100),
    0,
  );
  const avgCycle = salesCycleDays(deals) || 45;
  return round(totalWeightedAmount / openDeals.length / avgCycle);
}

// ── Marketing KPIs ──

export function mqlToSqlRate(contacts: Contact[]): number {
  const mqls = contacts.filter((c) => c.is_mql);
  if (mqls.length === 0) return 0;
  const sqls = mqls.filter((c) => c.is_sql).length;
  return round((sqls / mqls.length) * 100);
}

export function leadVelocityRate(currentMqls: number, previousMqls: number): number {
  if (previousMqls <= 0) return 0;
  return round(((currentMqls - previousMqls) / previousMqls) * 100);
}

export function funnelLeakageRate(contacts: Contact[], deals: Deal[]): number {
  const sqls = contacts.filter((c) => c.is_sql).length;
  if (sqls === 0) return 0;
  const dealsFromContacts = deals.filter((d) => !d.is_closed_lost).length;
  return round(((sqls - dealsFromContacts) / sqls) * 100);
}

// ── CRM Ops KPIs ──

export function inactiveDealsPct(deals: Deal[], inactiveDays: number = 14): number {
  const open = deals.filter((d) => !d.is_closed_won && !d.is_closed_lost);
  if (open.length === 0) return 0;
  const now = Date.now();
  const inactive = open.filter((d) => {
    if (!d.last_activity_at) return true;
    const daysSince = (now - new Date(d.last_activity_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > inactiveDays;
  }).length;
  return round((inactive / open.length) * 100);
}

export function dataCompleteness(deals: Deal[]): number {
  if (deals.length === 0) return 100;
  const fields = (d: Deal) => [d.amount > 0, d.close_date, d.last_activity_at];
  const totalFields = deals.length * 3;
  const filledFields = deals.reduce((sum, d) => sum + fields(d).filter(Boolean).length, 0);
  return round((filledFields / totalFields) * 100);
}

export function dealStagnationRate(deals: Deal[], stagnationDays: number = 14): number {
  const open = deals.filter((d) => !d.is_closed_won && !d.is_closed_lost);
  if (open.length === 0) return 0;
  const stagnant = open.filter((d) => d.days_in_stage > stagnationDays).length;
  return round((stagnant / open.length) * 100);
}

export function duplicateContactsPct(contacts: Contact[]): number {
  if (contacts.length === 0) return 0;
  // Simplified: count contacts sharing the same company_id (proxy for duplicates)
  const byCompany = new Map<string, number>();
  contacts.forEach((c) => {
    if (c.company_id) {
      byCompany.set(c.company_id, (byCompany.get(c.company_id) || 0) + 1);
    }
  });
  const dupes = Array.from(byCompany.values()).reduce(
    (sum, count) => sum + Math.max(0, count - 2),
    0,
  );
  return round((dupes / contacts.length) * 100);
}

export function orphanContactsPct(contacts: Contact[]): number {
  if (contacts.length === 0) return 0;
  const orphans = contacts.filter((c) => !c.company_id).length;
  return round((orphans / contacts.length) * 100);
}

export function activitiesPerDeal(activities: Activity[], deals: Deal[]): number {
  const openDeals = deals.filter((d) => !d.is_closed_won && !d.is_closed_lost);
  if (openDeals.length === 0) return 0;
  const dealActivities = activities.filter((a) =>
    a.deal_id && openDeals.some((d) => d.id === a.deal_id),
  ).length;
  return round(dealActivities / openDeals.length, 1);
}

// ── Scoring ──

export function salesScore(kpis: {
  closing_rate: number;
  pipeline_coverage: number;
  sales_cycle_days: number;
  deal_velocity: number;
}): number {
  // Weighted composite: closing rate (30%), coverage (25%), cycle (25%), velocity (20%)
  const closingScore = Math.min(100, (kpis.closing_rate / 35) * 100);
  const coverageScore = Math.min(100, (kpis.pipeline_coverage / 4) * 100);
  const cycleScore = Math.min(100, Math.max(0, (1 - (kpis.sales_cycle_days - 30) / 90) * 100));
  const velocityScore = Math.min(100, (kpis.deal_velocity / 15000) * 100);
  return clamp(Math.round(closingScore * 0.3 + coverageScore * 0.25 + cycleScore * 0.25 + velocityScore * 0.2));
}

export function marketingScore(kpis: {
  mql_to_sql_rate: number;
  lead_velocity_rate: number;
  funnel_leakage_rate: number;
}): number {
  // MQL→SQL (40%), lead velocity (30%), funnel leakage inverted (30%)
  const mqlScore = Math.min(100, (kpis.mql_to_sql_rate / 30) * 100);
  const velocityScore = Math.min(100, Math.max(0, (kpis.lead_velocity_rate / 20) * 100));
  const leakageScore = Math.min(100, Math.max(0, (1 - kpis.funnel_leakage_rate / 60) * 100));
  return clamp(Math.round(mqlScore * 0.4 + velocityScore * 0.3 + leakageScore * 0.3));
}

export function crmOpsScore(kpis: {
  data_completeness: number;
  inactive_deals_pct: number;
  deal_stagnation_rate: number;
  activities_per_deal: number;
}): number {
  // Completeness (30%), inactive inverted (25%), stagnation inverted (25%), activities (20%)
  const completenessScore = kpis.data_completeness;
  const inactiveScore = Math.max(0, (1 - kpis.inactive_deals_pct / 50) * 100);
  const stagnationScore = Math.max(0, (1 - kpis.deal_stagnation_rate / 40) * 100);
  const activityScore = Math.min(100, (kpis.activities_per_deal / 12) * 100);
  return clamp(Math.round(completenessScore * 0.3 + inactiveScore * 0.25 + stagnationScore * 0.25 + activityScore * 0.2));
}

// ── Main ──

export function computeAllKpis(
  deals: Deal[],
  contacts: Contact[],
  activities: Activity[],
  quarterlyTarget: number,
  previousMqls: number = 0,
): ComputedKpis {
  const cr = closingRate(deals);
  const pc = pipelineCoverage(deals, quarterlyTarget);
  const scd = salesCycleDays(deals);
  const wf = weightedForecast(deals);
  const dv = dealVelocity(deals);

  const mql = mqlToSqlRate(contacts);
  const lvr = leadVelocityRate(contacts.filter((c) => c.is_mql).length, previousMqls);
  const fl = funnelLeakageRate(contacts, deals);

  const idp = inactiveDealsPct(deals);
  const dc = dataCompleteness(deals);
  const dsr = dealStagnationRate(deals);
  const dcp = duplicateContactsPct(contacts);
  const ocp = orphanContactsPct(contacts);
  const apd = activitiesPerDeal(activities, deals);

  return {
    closing_rate: cr,
    pipeline_coverage: pc,
    sales_cycle_days: scd,
    weighted_forecast: wf,
    deal_velocity: dv,
    mql_to_sql_rate: mql,
    lead_velocity_rate: lvr,
    funnel_leakage_rate: fl,
    inactive_deals_pct: idp,
    data_completeness: dc,
    deal_stagnation_rate: dsr,
    duplicate_contacts_pct: dcp,
    orphan_contacts_pct: ocp,
    activities_per_deal: apd,
    sales_score: salesScore({ closing_rate: cr, pipeline_coverage: pc, sales_cycle_days: scd, deal_velocity: dv }),
    marketing_score: marketingScore({ mql_to_sql_rate: mql, lead_velocity_rate: lvr, funnel_leakage_rate: fl }),
    crm_ops_score: crmOpsScore({ data_completeness: dc, inactive_deals_pct: idp, deal_stagnation_rate: dsr, activities_per_deal: apd }),
  };
}

// ── Helpers ──

function round(n: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, score));
}
