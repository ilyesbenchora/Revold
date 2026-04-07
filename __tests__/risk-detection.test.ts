import { describe, it, expect } from "vitest";
import { detectRisks } from "@/lib/kpi/risk-detection";

const baseDeal = {
  id: "1",
  name: "Test Deal",
  amount: 50000,
  days_in_stage: 5,
  last_activity_at: new Date().toISOString(),
  close_date: "2026-12-01",
  is_closed_won: false,
  is_closed_lost: false,
};

describe("Risk Detection", () => {
  it("flags inactive deals (>14 days)", () => {
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const results = detectRisks([{ ...baseDeal, last_activity_at: old }]);
    expect(results[0].is_at_risk).toBe(true);
    expect(results[0].risk_reasons[0]).toContain("Inactivité");
  });

  it("flags stagnant deals (>21 days in stage)", () => {
    const results = detectRisks([{ ...baseDeal, days_in_stage: 25 }]);
    expect(results[0].is_at_risk).toBe(true);
    expect(results[0].risk_reasons[0]).toContain("Stagnation");
  });

  it("flags overdue close dates", () => {
    const results = detectRisks([{ ...baseDeal, close_date: "2025-01-01" }]);
    expect(results[0].is_at_risk).toBe(true);
    expect(results[0].risk_reasons[0]).toContain("dépassée");
  });

  it("does not flag healthy deals", () => {
    const results = detectRisks([baseDeal]);
    expect(results[0].is_at_risk).toBe(false);
    expect(results[0].risk_reasons).toHaveLength(0);
  });

  it("skips closed deals", () => {
    const results = detectRisks([
      { ...baseDeal, is_closed_won: true },
      { ...baseDeal, id: "2", is_closed_lost: true },
    ]);
    expect(results).toHaveLength(0);
  });

  it("flags deals with no activity at all", () => {
    const results = detectRisks([{ ...baseDeal, last_activity_at: null }]);
    expect(results[0].is_at_risk).toBe(true);
    expect(results[0].risk_reasons[0]).toContain("Aucune activité");
  });
});
