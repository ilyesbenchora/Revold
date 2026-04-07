import { describe, it, expect } from "vitest";
import {
  closingRate,
  pipelineCoverage,
  salesCycleDays,
  weightedForecast,
  mqlToSqlRate,
  inactiveDealsPct,
  dataCompleteness,
  dealStagnationRate,
  salesScore,
  marketingScore,
  crmOpsScore,
} from "@/lib/kpi/compute";

const baseDeal = {
  id: "1",
  amount: 50000,
  stage_probability: 50,
  is_closed_won: false,
  is_closed_lost: false,
  is_at_risk: false,
  close_date: "2026-06-01",
  created_date: "2026-01-01",
  days_in_stage: 5,
  last_activity_at: new Date().toISOString(),
};

describe("Sales KPIs", () => {
  it("calculates closing rate", () => {
    const deals = [
      { ...baseDeal, id: "1", is_closed_won: true },
      { ...baseDeal, id: "2", is_closed_lost: true },
      { ...baseDeal, id: "3", is_closed_won: true },
    ];
    expect(closingRate(deals)).toBe(66.67);
  });

  it("returns 0 for no closed deals", () => {
    expect(closingRate([baseDeal])).toBe(0);
  });

  it("calculates pipeline coverage", () => {
    const deals = [
      { ...baseDeal, amount: 500000 },
      { ...baseDeal, id: "2", amount: 300000 },
    ];
    expect(pipelineCoverage(deals, 200000)).toBe(4);
  });

  it("calculates weighted forecast", () => {
    const deals = [
      { ...baseDeal, amount: 100000, stage_probability: 50 },
      { ...baseDeal, id: "2", amount: 200000, stage_probability: 25 },
    ];
    expect(weightedForecast(deals)).toBe(100000);
  });

  it("calculates sales cycle days for won deals", () => {
    const deals = [
      { ...baseDeal, is_closed_won: true, created_date: "2026-01-01", close_date: "2026-02-10" },
      { ...baseDeal, id: "2", is_closed_won: true, created_date: "2026-01-01", close_date: "2026-03-02" },
    ];
    expect(salesCycleDays(deals)).toBe(50);
  });
});

describe("Marketing KPIs", () => {
  it("calculates MQL to SQL rate", () => {
    const contacts = [
      { id: "1", company_id: "c1", is_mql: true, is_sql: true },
      { id: "2", company_id: "c1", is_mql: true, is_sql: false },
      { id: "3", company_id: "c2", is_mql: true, is_sql: true },
      { id: "4", company_id: "c2", is_mql: false, is_sql: false },
    ];
    expect(mqlToSqlRate(contacts)).toBe(66.67);
  });
});

describe("CRM Ops KPIs", () => {
  it("calculates inactive deals percentage", () => {
    const now = new Date();
    const old = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const deals = [
      { ...baseDeal, id: "1", last_activity_at: old },
      { ...baseDeal, id: "2", last_activity_at: recent },
      { ...baseDeal, id: "3", last_activity_at: recent },
    ];
    expect(inactiveDealsPct(deals)).toBe(33.33);
  });

  it("calculates deal stagnation rate", () => {
    const deals = [
      { ...baseDeal, id: "1", days_in_stage: 25 },
      { ...baseDeal, id: "2", days_in_stage: 5 },
      { ...baseDeal, id: "3", days_in_stage: 30 },
      { ...baseDeal, id: "4", days_in_stage: 10 },
    ];
    expect(dealStagnationRate(deals)).toBe(50);
  });

  it("calculates data completeness", () => {
    const deals = [
      { ...baseDeal },  // all filled: amount>0, close_date, last_activity_at
      { ...baseDeal, id: "2", amount: 0, close_date: null, last_activity_at: null },
    ];
    expect(dataCompleteness(deals)).toBe(50);
  });
});

describe("Scoring", () => {
  it("calculates sales score", () => {
    const score = salesScore({ closing_rate: 28, pipeline_coverage: 2.1, sales_cycle_days: 47, deal_velocity: 12400 });
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("calculates marketing score", () => {
    const score = marketingScore({ mql_to_sql_rate: 22, lead_velocity_rate: 12, funnel_leakage_rate: 38 });
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("calculates CRM ops score", () => {
    const score = crmOpsScore({ data_completeness: 87, inactive_deals_pct: 34, deal_stagnation_rate: 24, activities_per_deal: 8 });
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });
});
