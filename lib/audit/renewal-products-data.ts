import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Données de RENOUVELLEMENT INDEXÉES SUR LES PRODUITS (line items HubSpot) :
 * la base renouvelable se lit produit par produit — CA récurrent vs one-shot,
 * fréquence de facturation dominante — pas seulement au global des abonnements.
 * Source : hubspot_objects/line_items (name, amount|price×quantity,
 * recurringbillingfrequency).
 */

export type RenewalProduct = {
  name: string;
  /** CA total du produit (somme des line items). */
  amount: number;
  /** Nombre de ventes (line items). */
  count: number;
  /** Line items récurrents (recurringbillingfrequency renseignée). */
  recurringCount: number;
  /** CA récurrent = base renouvelable du produit. */
  recurringAmount: number;
  /** Fréquence de facturation dominante (libellé FR) — null si one-shot. */
  frequency: string | null;
};

export type RenewalProductsData = {
  lineItemsTotal: number;
  distinctProducts: number;
  /** Produits avec au moins un line item récurrent (base renouvelable). */
  recurringProducts: number;
  oneShotProducts: number;
  totalAmount: number;
  recurringAmount: number;
  recurringPct: number | null;
  /** CA récurrent facturé en annuel — renouvellement critique 1× par an. */
  annualRecurringAmount: number;
  /** Produits triés par CA récurrent décroissant puis CA total. */
  products: RenewalProduct[];
};

type LineItemRow = { raw_data: { properties?: Record<string, string | null> } | null };

const FREQUENCY_LABELS: Array<{ match: RegExp; label: string }> = [
  { match: /month|mens/i, label: "Mensuelle" },
  { match: /quarter|trimes/i, label: "Trimestrielle" },
  { match: /semiannual|semestr|six_month/i, label: "Semestrielle" },
  { match: /annual|year|annu/i, label: "Annuelle" },
];

function frequencyLabel(raw: string): string {
  for (const f of FREQUENCY_LABELS) if (f.match.test(raw)) return f.label;
  return raw;
}

export async function fetchRenewalProductsData(
  supabase: SupabaseClient,
  orgId: string,
): Promise<RenewalProductsData> {
  const PAGE = 1000;
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

  type Acc = RenewalProduct & { freqCounts: Map<string, number> };
  const byProduct = new Map<string, Acc>();
  for (const it of items) {
    const p = it.raw_data?.properties ?? {};
    const name = (p.name ?? "").trim() || "Sans nom";
    const amount = Number(p.amount) || (Number(p.price) || 0) * (Number(p.quantity) || 1);
    const freq = (p.recurringbillingfrequency ?? "").trim();
    const cur = byProduct.get(name) ?? {
      name, amount: 0, count: 0, recurringCount: 0, recurringAmount: 0,
      frequency: null, freqCounts: new Map<string, number>(),
    };
    cur.amount += amount;
    cur.count += 1;
    if (freq) {
      cur.recurringCount += 1;
      cur.recurringAmount += amount;
      const label = frequencyLabel(freq);
      cur.freqCounts.set(label, (cur.freqCounts.get(label) ?? 0) + 1);
    }
    byProduct.set(name, cur);
  }

  let totalAmount = 0;
  let recurringAmount = 0;
  let annualRecurringAmount = 0;
  const products: RenewalProduct[] = [];
  for (const acc of byProduct.values()) {
    // Fréquence dominante = la plus fréquente parmi les line items récurrents.
    let frequency: string | null = null;
    let best = 0;
    for (const [label, n] of acc.freqCounts) {
      if (n > best) { best = n; frequency = label; }
    }
    totalAmount += acc.amount;
    recurringAmount += acc.recurringAmount;
    if (frequency === "Annuelle") annualRecurringAmount += acc.recurringAmount;
    products.push({
      name: acc.name,
      amount: Math.round(acc.amount),
      count: acc.count,
      recurringCount: acc.recurringCount,
      recurringAmount: Math.round(acc.recurringAmount),
      frequency,
    });
  }
  products.sort((a, b) => (b.recurringAmount - a.recurringAmount) || (b.amount - a.amount));

  const recurringProducts = products.filter((p) => p.recurringCount > 0).length;
  return {
    lineItemsTotal: items.length,
    distinctProducts: products.length,
    recurringProducts,
    oneShotProducts: products.length - recurringProducts,
    totalAmount: Math.round(totalAmount),
    recurringAmount: Math.round(recurringAmount),
    recurringPct: totalAmount > 0 ? Math.round((recurringAmount / totalAmount) * 100) : null,
    annualRecurringAmount: Math.round(annualRecurringAmount),
    products,
  };
}
