import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Données cross-sell / upsell indexées sur les PRODUITS ASSOCIÉS AUX DEALS
 * (line items HubSpot) — pas sur les abonnements : quand l'outil connecté est
 * HubSpot, le « multi-produit » réel se lit sur les line items des deals
 * (deals.raw_data.hs_num_of_associated_line_items + hubspot_objects/line_items).
 */

export type TopProduct = { name: string; amount: number; count: number };

export type DealProductsData = {
  // Deals gagnés (référentiel revenue)
  wonDeals: number;
  wonAmount: number;
  avgWonAmount: number | null;
  // Équipement produit par deal (hs_num_of_associated_line_items)
  dealsWithProducts: number;
  monoProductDeals: number;
  multiProductDeals: number;
  multiProductPct: number | null;
  avgProductsPerDeal: number | null;
  // Line items (catalogue vendu)
  lineItemsTotal: number;
  distinctProducts: number;
  recurringLineItems: number;
  topProducts: TopProduct[];
};

type DealRow = { amount: number | null; won: string | null; num_products: string | null };
type LineItemRow = { raw_data: { properties?: Record<string, string | null> } | null };

export async function fetchDealProductsData(
  supabase: SupabaseClient,
  orgId: string,
): Promise<DealProductsData> {
  // ── Deals : montant, gagné, nb de produits associés (paginé — gros CRMs) ──
  const PAGE = 1000;
  const deals: DealRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("deals")
      .select("amount, won:raw_data->properties->>hs_is_closed_won, num_products:raw_data->properties->>hs_num_of_associated_line_items")
      .eq("organization_id", orgId)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    deals.push(...(data as unknown as DealRow[]));
    if (data.length < PAGE) break;
  }

  const won = deals.filter((d) => d.won === "true");
  const wonAmount = won.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const avgWonAmount = won.length > 0 ? Math.round(wonAmount / won.length) : null;

  const productCounts = deals
    .map((d) => parseInt(d.num_products ?? "", 10))
    .filter((n) => !isNaN(n) && n > 0);
  const dealsWithProducts = productCounts.length;
  const multiProductDeals = productCounts.filter((n) => n >= 2).length;
  const monoProductDeals = dealsWithProducts - multiProductDeals;
  const multiProductPct = dealsWithProducts > 0
    ? Math.round((multiProductDeals / dealsWithProducts) * 100)
    : null;
  const avgProductsPerDeal = dealsWithProducts > 0
    ? Math.round((productCounts.reduce((s, n) => s + n, 0) / dealsWithProducts) * 10) / 10
    : null;

  // ── Line items : top produits vendus (nom + CA), mix récurrent ──
  const items: LineItemRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("hubspot_objects")
      .select("raw_data")
      .eq("organization_id", orgId)
      .eq("object_type", "line_items")
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    items.push(...(data as unknown as LineItemRow[]));
    if (data.length < PAGE) break;
  }

  const byProduct = new Map<string, { amount: number; count: number }>();
  let recurringLineItems = 0;
  for (const it of items) {
    const p = it.raw_data?.properties ?? {};
    const name = (p.name ?? "").trim() || "Sans nom";
    const amount = Number(p.amount) || (Number(p.price) || 0) * (Number(p.quantity) || 1);
    const cur = byProduct.get(name) ?? { amount: 0, count: 0 };
    cur.amount += amount;
    cur.count += 1;
    byProduct.set(name, cur);
    if (p.recurringbillingfrequency) recurringLineItems += 1;
  }
  const topProducts: TopProduct[] = [...byProduct.entries()]
    .map(([name, v]) => ({ name, amount: Math.round(v.amount), count: v.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return {
    wonDeals: won.length,
    wonAmount: Math.round(wonAmount),
    avgWonAmount,
    dealsWithProducts,
    monoProductDeals,
    multiProductDeals,
    multiProductPct,
    avgProductsPerDeal,
    lineItemsTotal: items.length,
    distinctProducts: byProduct.size,
    recurringLineItems,
    topProducts,
  };
}
