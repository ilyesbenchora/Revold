import { describe, it, expect, beforeEach } from "vitest";
import { PLANS, planHasFeature, planFromPriceId, getStripePriceId } from "@/lib/billing/plans";

describe("billing/plans", () => {
  describe("PLANS catalogue", () => {
    it("contains exactly 3 plans", () => {
      expect(Object.keys(PLANS)).toEqual(["starter", "growth", "scale"]);
    });

    it("yearly price ≈ 10× monthly (≈17% discount)", () => {
      for (const plan of Object.values(PLANS)) {
        expect(plan.yearlyPrice).toBe(plan.monthlyPrice * 10);
      }
    });

    it("higher plan strictly includes lower plan features", () => {
      for (const f of PLANS.starter.features) {
        expect(PLANS.growth.features).toContain(f);
      }
      for (const f of PLANS.growth.features) {
        expect(PLANS.scale.features).toContain(f);
      }
    });

    it("scale has unlimited connectors, others are bounded", () => {
      expect(PLANS.scale.maxConnectors).toBeNull();
      expect(PLANS.starter.maxConnectors).toBeGreaterThan(0);
      expect(PLANS.growth.maxConnectors).toBeGreaterThan(PLANS.starter.maxConnectors!);
    });
  });

  describe("planHasFeature", () => {
    it("rejects null/undefined plans", () => {
      expect(planHasFeature(null, "weekly_pulse")).toBe(false);
      expect(planHasFeature(undefined, "weekly_pulse")).toBe(false);
    });

    it("starter has weekly_pulse but not advanced features", () => {
      expect(planHasFeature("starter", "weekly_pulse")).toBe(true);
      expect(planHasFeature("starter", "ai_diagnostic")).toBe(false);
      expect(planHasFeature("starter", "advisor_revops")).toBe(false);
    });

    it("growth includes ai_diagnostic but not advisor_revops", () => {
      expect(planHasFeature("growth", "ai_diagnostic")).toBe(true);
      expect(planHasFeature("growth", "advisor_revops")).toBe(false);
    });

    it("scale has all features", () => {
      const allFeatures = PLANS.scale.features;
      for (const f of allFeatures) {
        expect(planHasFeature("scale", f)).toBe(true);
      }
    });
  });

  describe("getStripePriceId / planFromPriceId", () => {
    beforeEach(() => {
      process.env.STRIPE_PRICE_ID_STARTER_MONTHLY = "price_test_starter_m";
      process.env.STRIPE_PRICE_ID_GROWTH_YEARLY = "price_test_growth_y";
    });

    it("reads price ID from env", () => {
      expect(getStripePriceId("starter", "monthly")).toBe("price_test_starter_m");
      expect(getStripePriceId("growth", "yearly")).toBe("price_test_growth_y");
    });

    it("returns null when env var is missing", () => {
      delete process.env.STRIPE_PRICE_ID_SCALE_MONTHLY;
      expect(getStripePriceId("scale", "monthly")).toBeNull();
    });

    it("planFromPriceId is the inverse of getStripePriceId", () => {
      expect(planFromPriceId("price_test_starter_m")).toEqual({ plan: "starter", period: "monthly" });
      expect(planFromPriceId("price_test_growth_y")).toEqual({ plan: "growth", period: "yearly" });
    });

    it("returns null for unknown price IDs", () => {
      expect(planFromPriceId("price_unknown")).toBeNull();
    });
  });
});
