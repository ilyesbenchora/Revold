import { describe, it, expect } from "vitest";
import { valueFromAggSpec } from "@/lib/alerts/agg-value";
import { fakeSupabase } from "./helpers/fake-supabase";

/**
 * valueFromAggSpec — la valeur RÉELLE derrière chaque tuile KPI ajoutée,
 * alerte de table et brief : total (ou ligne ciblée) d'une spec d'agrégat,
 * avec multiplicateur linéaire (ex : ARR = MRR × 12).
 */

const ORG = "org-1";

const SUBS = [
  { organization_id: ORG, status: "active", mrr: 100, primary_source: "stripe" },
  { organization_id: ORG, status: "active", mrr: 150, primary_source: "stripe" },
  { organization_id: ORG, status: "canceled", mrr: 50, primary_source: "stripe" },
];

describe("valueFromAggSpec", () => {
  it("total = somme de toutes les lignes du groupement", async () => {
    const v = await valueFromAggSpec(fakeSupabase({ subscriptions: SUBS }), ORG, null, {
      entity: "subscriptions",
      groupBy: "status",
      measure: "sum",
      field: "mrr",
    });
    expect(v).toBe(300); // 100 + 150 + 50, tous statuts
  });

  it("target isole UNE ligne du groupement", async () => {
    const v = await valueFromAggSpec(fakeSupabase({ subscriptions: SUBS }), ORG, null, {
      entity: "subscriptions",
      groupBy: "status",
      measure: "sum",
      field: "mrr",
      target: "active",
    });
    expect(v).toBe(250);
  });

  it("target absent du résultat → 0 (pas de chiffre inventé)", async () => {
    const v = await valueFromAggSpec(fakeSupabase({ subscriptions: SUBS }), ORG, null, {
      entity: "subscriptions",
      groupBy: "status",
      measure: "sum",
      field: "mrr",
      target: "inexistant",
    });
    expect(v).toBe(0);
  });

  it("multiplier : conversion linéaire (ARR = MRR actif × 12)", async () => {
    const v = await valueFromAggSpec(fakeSupabase({ subscriptions: SUBS }), ORG, null, {
      entity: "subscriptions",
      groupBy: "status",
      measure: "sum",
      field: "mrr",
      target: "active",
      multiplier: 12,
    });
    expect(v).toBe(3000);
  });

  it("sources : le filtre de la table d'origine s'applique au recalcul", async () => {
    const mixed = [
      ...SUBS,
      { organization_id: ORG, status: "active", mrr: 999, primary_source: "chargebee" },
    ];
    const v = await valueFromAggSpec(fakeSupabase({ subscriptions: mixed }), ORG, null, {
      entity: "subscriptions",
      groupBy: "status",
      measure: "sum",
      field: "mrr",
      target: "active",
      sources: ["stripe"],
    });
    expect(v).toBe(250); // chargebee exclu
  });

  it("spec incomplète ou entité inconnue → null (jamais un faux 0 déclencheur d'alerte)", async () => {
    expect(await valueFromAggSpec(fakeSupabase({}), ORG, null, {})).toBeNull();
    expect(await valueFromAggSpec(fakeSupabase({}), ORG, null, { entity: "subscriptions" })).toBeNull();
    expect(
      await valueFromAggSpec(fakeSupabase({}), ORG, null, { entity: "nope", groupBy: "status" }),
    ).toBeNull();
  });
});
