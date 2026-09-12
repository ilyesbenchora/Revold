import { describe, it, expect } from "vitest";
import { computeAggregate } from "@/lib/ai/agents/tool-library";
import { fakeSupabase } from "./helpers/fake-supabase";

/**
 * Factures CLIENTS vs FOURNISSEURS (Pennylane synchronise les deux dans la
 * même table, direction 'in' / 'out') : le moteur ne doit jamais les
 * mélanger — le CA facturé n'inclut pas les charges fournisseurs, l'entité
 * supplier_invoices ne voit que les factures reçues, et seules la dimension
 * « direction » et les champs signés net_* combinent les deux sens.
 */
const ORG = "org-1";
const rows = (r: Record<string, unknown>) =>
  Object.fromEntries(((r.rows as { group: string; value: number }[]) ?? []).map((x) => [x.group, x.value]));

const sb = () =>
  fakeSupabase({
    invoices: [
      // Clients : direction 'in' (Pennylane) ou null (Stripe, connecteurs sans colonne).
      { organization_id: ORG, status: "paid", direction: "in", amount_total: 1000, amount_paid: 1000, amount_due: 0, issued_at: "2026-08-10" },
      { organization_id: ORG, status: "open", direction: null, amount_total: 500, amount_paid: 0, amount_due: 500, issued_at: "2026-09-10" },
      // Fournisseurs : direction 'out'.
      { organization_id: ORG, status: "open", direction: "out", amount_total: 300, amount_paid: 100, amount_due: 200, issued_at: "2026-09-15" },
      { organization_id: ORG, status: "paid", direction: "out", amount_total: 120, amount_paid: 120, amount_due: 0, issued_at: "2026-08-01" },
    ],
  });

describe("factures clients / fournisseurs", () => {
  it("invoices = factures clients uniquement (null ou 'in')", async () => {
    const res = await computeAggregate(sb(), ORG, [], null, { entity: "invoices", groupBy: "status", measure: "sum", field: "amount_total" });
    expect(rows(res)).toEqual({ paid: 1000, open: 500 });
  });

  it("supplier_invoices = factures fournisseurs uniquement", async () => {
    const res = await computeAggregate(sb(), ORG, [], null, { entity: "supplier_invoices", groupBy: "status", measure: "sum", field: "amount_due" });
    expect(rows(res)).toEqual({ open: 200, paid: 0 });
  });

  it("dimension direction : les deux sens côte à côte", async () => {
    const res = await computeAggregate(sb(), ORG, [], null, { entity: "invoices", groupBy: "direction", measure: "sum", field: "amount_total" });
    expect(rows(res)).toEqual({ Clients: 1500, Fournisseurs: 420 });
  });

  it("champ net_* : solde clients − fournisseurs, y compris par mois", async () => {
    const total = await computeAggregate(sb(), ORG, [], null, { entity: "invoices", groupBy: "direction", measure: "sum", field: "net_total" });
    expect(rows(total)).toEqual({ Clients: 1500, Fournisseurs: -420 });
    const byMonth = await computeAggregate(sb(), ORG, [], null, { entity: "invoices", groupBy: "month_issued", measure: "sum", field: "net_total", months: 3 });
    const m = rows(byMonth);
    expect(m["2026-09"]).toBe(200); // 500 clients − 300 fournisseurs
    expect(m["2026-08"]).toBe(880); // 1 000 clients − 120 fournisseurs
  });

  it("count clients / fournisseurs : jamais confondus", async () => {
    const clients = await computeAggregate(sb(), ORG, [], null, { entity: "invoices", groupBy: "status", measure: "count" });
    const suppliers = await computeAggregate(sb(), ORG, [], null, { entity: "supplier_invoices", groupBy: "status", measure: "count" });
    expect(Object.values(rows(clients)).reduce((a, b) => a + b, 0)).toBe(2);
    expect(Object.values(rows(suppliers)).reduce((a, b) => a + b, 0)).toBe(2);
  });
});
