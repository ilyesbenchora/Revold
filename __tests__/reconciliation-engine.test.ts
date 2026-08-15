import { describe, it, expect } from "vitest";
import { computeReconciledMetric, RECON_RECIPES } from "@/lib/reconciliation/engine";
import { fakeSupabase } from "./helpers/fake-supabase";

/**
 * Moteur de réconciliation cross-source — jointures ligne-à-ligne sur
 * company_id, avec couverture (gate anti-faux-zéro des alertes). Jeux de
 * données connus → valeurs ET couvertures exactes.
 */

const ORG = "org-1";

describe("moteur de réconciliation", () => {
  it("crm_vs_billed_gap : CA signé − CA facturé, couverture = entreprises gagnées AVEC facture", async () => {
    const sb = fakeSupabase({
      deals: [
        { organization_id: ORG, is_closed_won: true, amount: 10000, company_id: "c1" },
        { organization_id: ORG, is_closed_won: true, amount: 5000, company_id: "c2" },
        { organization_id: ORG, is_closed_won: false, amount: 99999, company_id: "c3" }, // pas gagné → exclu
      ],
      invoices: [{ organization_id: ORG, amount_total: 8000, company_id: "c1" }],
    });
    const res = await computeReconciledMetric(sb, ORG, "crm_vs_billed_gap");
    expect(res).toEqual({ value: 7000, coverage: 0.5, hasData: true }); // 15000 − 8000 ; c1 facturée / {c1,c2}
  });

  it("revenue_leakage : montant des deals gagnés dont l'entreprise n'a AUCUNE facture", async () => {
    const sb = fakeSupabase({
      deals: [
        { organization_id: ORG, is_closed_won: true, amount: 10000, company_id: "c1" },
        { organization_id: ORG, is_closed_won: true, amount: 5000, company_id: "c2" },
        { organization_id: ORG, is_closed_won: true, amount: 3000, company_id: null }, // non relié → hors fuite, baisse la couverture
      ],
      invoices: [{ organization_id: ORG, amount_total: 8000, company_id: "c1" }],
    });
    const res = await computeReconciledMetric(sb, ORG, "revenue_leakage");
    expect(res?.value).toBe(5000); // c2 gagnée, jamais facturée
    expect(res?.coverage).toBeCloseTo(2 / 3, 5); // 2 deals reliés sur 3
  });

  it("unpaid_amount : somme des montants dus (statuts impayés OU reste dû)", async () => {
    const sb = fakeSupabase({
      invoices: [
        { organization_id: ORG, status: "open", amount_due: 400, amount_total: 400, company_id: "c1" },
        { organization_id: ORG, status: "past_due", amount_due: 600, amount_total: 600, company_id: "c2" },
        { organization_id: ORG, status: "paid", amount_due: 0, amount_total: 1000, company_id: "c3" },
      ],
    });
    const res = await computeReconciledMetric(sb, ORG, "unpaid_amount");
    expect(res?.value).toBe(1000);
    expect(res?.coverage).toBe(1);
  });

  it("mrr_reconciled / arr_reconciled : abonnements actifs uniquement, ARR = MRR × 12", async () => {
    const sb = fakeSupabase({
      subscriptions: [
        { organization_id: ORG, status: "active", mrr: 100, company_id: "c1" },
        { organization_id: ORG, status: "trialing", mrr: 50, company_id: null },
        { organization_id: ORG, status: "canceled", mrr: 999, company_id: "c2" }, // exclu
      ],
    });
    const mrr = await computeReconciledMetric(sb, ORG, "mrr_reconciled");
    expect(mrr?.value).toBe(150);
    expect(mrr?.coverage).toBe(0.5); // 1 abonnement relié sur 2 actifs
    const arr = await computeReconciledMetric(sb, ORG, "arr_reconciled");
    expect(arr?.value).toBe(1800);
  });

  it("mrr_at_risk : MRR des comptes avec ticket support ouvert (jointure company_id)", async () => {
    const sb = fakeSupabase({
      subscriptions: [
        { organization_id: ORG, status: "active", mrr: 100, company_id: "c1" },
        { organization_id: ORG, status: "active", mrr: 200, company_id: "c2" },
      ],
      tickets: [
        { organization_id: ORG, company_id: "c2", closed_at: null }, // ouvert
        { organization_id: ORG, company_id: "c1", closed_at: "2026-01-01" }, // fermé → pas de risque
      ],
    });
    const res = await computeReconciledMetric(sb, ORG, "mrr_at_risk");
    expect(res?.value).toBe(200);
  });

  it("invoice_to_payment : délai MÉDIAN facture → encaissement en jours", async () => {
    const sb = fakeSupabase({
      invoices: [
        { organization_id: ORG, issued_at: "2026-01-01", paid_at: "2026-01-11" }, // 10 j
        { organization_id: ORG, issued_at: "2026-01-01", paid_at: "2026-01-31" }, // 30 j
        { organization_id: ORG, issued_at: "2026-01-01", paid_at: "2026-01-15" }, // 14 j
        { organization_id: ORG, issued_at: null, paid_at: "2026-02-01" }, // non mesurable
      ],
    });
    const res = await computeReconciledMetric(sb, ORG, "invoice_to_payment");
    expect(res?.value).toBe(14); // médiane de [10, 14, 30]
    expect(res?.sample).toBe(3);
    expect(res?.coverage).toBeCloseTo(3 / 4, 5);
  });

  it("mql_to_deal_created : jours médians MQL → premier deal de l'entreprise (deals antérieurs ignorés)", async () => {
    const sb = fakeSupabase({
      contacts: [
        { organization_id: ORG, mql_date: "2026-01-01", company_id: "c1" },
        { organization_id: ORG, mql_date: "2026-01-01", company_id: "c2" }, // aucun deal → non mesuré
      ],
      deals: [
        { organization_id: ORG, created_date: "2025-12-01", company_id: "c1" }, // AVANT le MQL → ignoré
        { organization_id: ORG, created_date: "2026-01-08", company_id: "c1" }, // +7 j
        { organization_id: ORG, created_date: "2026-02-01", company_id: "c1" },
      ],
    });
    const res = await computeReconciledMetric(sb, ORG, "mql_to_deal_created");
    expect(res?.value).toBe(7);
    expect(res?.sample).toBe(1);
    expect(res?.denominator).toBe(2);
    expect(res?.coverage).toBe(0.5);
  });

  it("reconciled_pct : part des entités reliées à ≥ 2 outils", async () => {
    const sb = fakeSupabase({
      source_links: [
        { organization_id: ORG, internal_id: "e1", provider: "hubspot" },
        { organization_id: ORG, internal_id: "e1", provider: "stripe" },
        { organization_id: ORG, internal_id: "e2", provider: "hubspot" },
      ],
    });
    const res = await computeReconciledMetric(sb, ORG, "reconciled_pct");
    expect(res?.value).toBe(50);
    expect(res?.coverage).toBe(1);
  });

  it("aucune donnée → hasData false et couverture 0 (le gate des alertes doit bloquer)", async () => {
    const res = await computeReconciledMetric(fakeSupabase({}), ORG, "crm_vs_billed_gap");
    expect(res?.hasData).toBe(false);
    expect(res?.coverage).toBe(0);
  });

  it("recette inconnue → null ; chaque recette du catalogue a un id cohérent", async () => {
    expect(await computeReconciledMetric(fakeSupabase({}), ORG, "nope")).toBeNull();
    for (const [key, recipe] of Object.entries(RECON_RECIPES)) expect(recipe.id).toBe(key);
  });
});
