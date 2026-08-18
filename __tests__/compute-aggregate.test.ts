import { describe, it, expect } from "vitest";
import { computeAggregate } from "@/lib/ai/agents/tool-library";
import { fakeSupabase } from "./helpers/fake-supabase";

/**
 * Moteur d'agrégation déterministe — LE producteur des chiffres montrés aux
 * clients (tables, tuiles, alertes, briefs). Jeux de données connus → valeurs
 * exactes attendues : toute dérive du moteur casse ces tests.
 */

const ORG = "org-1";

type Rows = { group: string; value: number }[];
const rowsOf = (res: Record<string, unknown>) => res.rows as Rows;
const groupValue = (res: Record<string, unknown>, group: string) =>
  rowsOf(res).find((r) => r.group === group)?.value;

describe("computeAggregate", () => {
  it("count de deals par mois de création — axe continu, mois vides inclus", async () => {
    const sb = fakeSupabase({
      deals: [
        { organization_id: ORG, created_date: "2026-01-10", amount: 100 },
        { organization_id: ORG, created_date: "2026-01-25", amount: 200 },
        { organization_id: ORG, created_date: "2026-03-05", amount: 300 },
        // Hors période : exclu par le filtre de dates
        { organization_id: ORG, created_date: "2025-12-31", amount: 999 },
      ],
    });
    const res = await computeAggregate(sb, ORG, [], null, {
      entity: "deals",
      groupBy: "month_created",
      measure: "count",
      date_from: "2026-01-01",
      date_to: "2026-03-31",
    });
    expect(res.hasData).toBe(true);
    expect(rowsOf(res)).toEqual([
      { group: "2026-01", value: 2 },
      { group: "2026-02", value: 0 }, // mois vide présent (axe continu)
      { group: "2026-03", value: 1 },
    ]);
    expect(res.totalRows).toBe(3);
  });

  it("sum de factures par statut — montants exacts", async () => {
    const sb = fakeSupabase({
      invoices: [
        { organization_id: ORG, status: "paid", amount_total: 1000 },
        { organization_id: ORG, status: "paid", amount_total: 250.4 },
        { organization_id: ORG, status: "open", amount_total: 500 },
      ],
    });
    const res = await computeAggregate(sb, ORG, [], null, {
      entity: "invoices",
      groupBy: "status",
      measure: "sum",
      field: "amount_total",
    });
    expect(groupValue(res, "paid")).toBe(1250); // 1250,4 arrondi
    expect(groupValue(res, "open")).toBe(500);
  });

  it("avg arrondi (somme / effectif)", async () => {
    const sb = fakeSupabase({
      invoices: [
        { organization_id: ORG, status: "paid", amount_total: 100 },
        { organization_id: ORG, status: "paid", amount_total: 201 },
      ],
    });
    const res = await computeAggregate(sb, ORG, [], null, {
      entity: "invoices",
      groupBy: "status",
      measure: "avg",
      field: "amount_total",
    });
    expect(groupValue(res, "paid")).toBe(Math.round(301 / 2));
  });

  it("weighted (projection pondérée) = Σ montant × probabilité d'étape", async () => {
    const sb = fakeSupabase({
      deals: [
        { organization_id: ORG, amount: 1000, stage_external_id: "s1", pipeline_stages: { name: "Négociation", probability: 50 } },
        { organization_id: ORG, amount: 2000, stage_external_id: "s2", pipeline_stages: { name: "Découverte", probability: 25 } },
      ],
    });
    const res = await computeAggregate(sb, ORG, [], null, {
      entity: "deals",
      groupBy: "stage",
      measure: "weighted",
      field: "amount",
    });
    expect(groupValue(res, "Négociation")).toBe(500); // 1000 × 0,5
    expect(groupValue(res, "Découverte")).toBe(500); // 2000 × 0,25
  });

  it("weighted refusé hors deals (jamais de chiffre trompeur)", async () => {
    const res = await computeAggregate(fakeSupabase({}), ORG, [], null, {
      entity: "invoices",
      groupBy: "status",
      measure: "weighted",
      field: "amount_total",
    });
    expect(String(res.error)).toContain("weighted");
  });

  it("filtre de sources : seules les lignes des outils sélectionnés comptent (hubspot ignoré)", async () => {
    const sb = fakeSupabase({
      invoices: [
        { organization_id: ORG, status: "paid", amount_total: 100, primary_source: "stripe" },
        { organization_id: ORG, status: "paid", amount_total: 900, primary_source: "pennylane" },
      ],
    });
    const res = await computeAggregate(sb, ORG, ["hubspot", "stripe"], null, {
      entity: "invoices",
      groupBy: "status",
      measure: "sum",
      field: "amount_total",
    });
    expect(groupValue(res, "paid")).toBe(100);
    expect(res.sources_used).toEqual(["stripe"]);
  });

  it("transactions : direction et encaissements/décaissements séparés", async () => {
    const sb = fakeSupabase({
      bank_transactions: [
        { organization_id: ORG, amount: 300, date: "2026-02-01" },
        { organization_id: ORG, amount: -120, date: "2026-02-02" },
        { organization_id: ORG, amount: 50, date: "2026-02-03" },
      ],
    });
    const byDir = await computeAggregate(sb, ORG, [], null, {
      entity: "transactions",
      groupBy: "direction",
      measure: "sum",
      field: "amount_in",
    });
    expect(groupValue(byDir, "Encaissements")).toBe(350);
    const out = await computeAggregate(sb, ORG, [], null, {
      entity: "transactions",
      groupBy: "direction",
      measure: "sum",
      field: "amount_out",
    });
    expect(groupValue(out, "Décaissements")).toBe(120);
  });

  it("entité ou dimension inconnue → erreur explicite, pas de throw", async () => {
    const bad = await computeAggregate(fakeSupabase({}), ORG, [], null, { entity: "nope", groupBy: "x" });
    expect(String(bad.error)).toContain("Entité non supportée");
    const badDim = await computeAggregate(fakeSupabase({}), ORG, [], null, { entity: "deals", groupBy: "nope" });
    expect(String(badDim.error)).toContain("Dimension non supportée");
  });

  it("sum sans champ numérique → erreur explicite", async () => {
    const res = await computeAggregate(fakeSupabase({}), ORG, [], null, {
      entity: "deals",
      groupBy: "month_created",
      measure: "sum",
    });
    expect(String(res.error)).toContain("Champ numérique requis");
  });

  // ── Dims statut/résultat/close date des deals (KPIs « par pipeline » de la
  //    page Ventes) : libellés exacts attendus par les presets (target). ──
  const dealOf = (over: Record<string, unknown>, stage: Record<string, unknown>) => ({
    organization_id: ORG,
    amount: 100,
    created_date: "2026-01-15",
    stage_external_id: "ext-1",
    pipeline_stages: { name: "Étape", pipeline_name: "Pipeline A", pipeline_external_id: "pa", probability: 50, ...stage },
    ...over,
  });
  const DEALS_STATUS = [
    dealOf({ amount: 1000, close_date: "2020-01-01" }, {}), // en cours, close date dépassée
    dealOf({ amount: 500, close_date: "2999-01-01" }, {}), // en cours, close date à jour
    dealOf({ amount: 2000, close_date: "2026-02-01" }, { is_closed_won: true, probability: 100 }), // gagné
    dealOf({ amount: 300, close_date: "2026-02-01" }, { is_closed_lost: true, probability: 0 }), // perdu
    // Autre pipeline : doit disparaître avec le filtre pipeline "pa".
    dealOf({ amount: 9000, close_date: "2026-02-01" }, { pipeline_name: "Pipeline B", pipeline_external_id: "pb", is_closed_won: true }),
  ];

  it("status : En cours / Gagnés / Perdus, restreint au pipeline ciblé", async () => {
    const res = await computeAggregate(fakeSupabase({ deals: DEALS_STATUS }), ORG, [], null, {
      entity: "deals",
      groupBy: "status",
      measure: "sum",
      field: "amount",
      pipeline: "pa",
    });
    expect(groupValue(res, "En cours")).toBe(1500);
    expect(groupValue(res, "Gagnés")).toBe(2000); // le deal du pipeline B est exclu
    expect(groupValue(res, "Perdus")).toBe(300);
  });

  it("outcome : deals clôturés uniquement (les en-cours sont ignorés)", async () => {
    const res = await computeAggregate(fakeSupabase({ deals: DEALS_STATUS }), ORG, [], null, {
      entity: "deals",
      groupBy: "outcome",
      measure: "count",
      pipeline: "pa",
    });
    expect(rowsOf(res)).toHaveLength(2);
    expect(groupValue(res, "Gagnés")).toBe(1);
    expect(groupValue(res, "Perdus")).toBe(1);
  });

  it("close_date_state : dépassée vs à jour, deals EN COURS seulement", async () => {
    const res = await computeAggregate(fakeSupabase({ deals: DEALS_STATUS }), ORG, [], null, {
      entity: "deals",
      groupBy: "close_date_state",
      measure: "count",
      pipeline: "pa",
    });
    expect(groupValue(res, "Dépassée")).toBe(1);
    expect(groupValue(res, "À jour")).toBe(1);
    expect(rowsOf(res)).toHaveLength(2); // aucun deal clôturé compté
  });

  it("weighted + status : montant pondéré des deals en cours du pipeline", async () => {
    const res = await computeAggregate(fakeSupabase({ deals: DEALS_STATUS }), ORG, [], null, {
      entity: "deals",
      groupBy: "status",
      measure: "weighted",
      field: "amount",
      pipeline: "pa",
    });
    expect(groupValue(res, "En cours")).toBe(750); // (1000 + 500) × 0,5
  });

  it("aucune ligne → hasData false", async () => {
    const res = await computeAggregate(fakeSupabase({}), ORG, [], null, {
      entity: "deals",
      groupBy: "month_created",
      date_from: "2026-01-01",
      date_to: "2026-02-28",
    });
    expect(res.hasData).toBe(false);
  });
});
