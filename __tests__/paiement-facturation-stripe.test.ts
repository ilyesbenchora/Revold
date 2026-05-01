import { describe, it, expect } from "vitest";
import { fetchPaiementFacturationFromStripe } from "@/lib/audit/paiement-facturation-stripe";

describe("paiement-facturation-stripe", () => {
  it("returns empty data when no Stripe key", async () => {
    const result = await fetchPaiementFacturationFromStripe(null);
    expect(result.hasData).toBe(false);
    expect(result.invoices).toEqual([]);
    expect(result.subscriptions).toEqual([]);
    expect(result.mrr).toBe(0);
    expect(result.arr).toBe(0);
    expect(result.churnRate).toBeNull();
    expect(result.score).toBe(0);
  });

  it("returns same shape as HubSpot fetch (PaiementFacturationData)", async () => {
    const result = await fetchPaiementFacturationFromStripe(null);
    // Vérifie le contrat : toutes les clés du type PaiementFacturationData doivent être présentes
    expect(result).toHaveProperty("invoices");
    expect(result).toHaveProperty("subscriptions");
    expect(result).toHaveProperty("hasData");
    expect(result).toHaveProperty("activeSubsCount");
    expect(result).toHaveProperty("canceledSubsCount");
    expect(result).toHaveProperty("mrr");
    expect(result).toHaveProperty("arr");
    expect(result).toHaveProperty("churnRate");
    expect(result).toHaveProperty("paidInvoicesCount");
    expect(result).toHaveProperty("unpaidInvoicesCount");
    expect(result).toHaveProperty("totalPaid");
    expect(result).toHaveProperty("totalUnpaidAmount");
    expect(result).toHaveProperty("avgInvoice");
    expect(result).toHaveProperty("score");
  });
});
