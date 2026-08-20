import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rapprochement DEAL ↔ FACTURES — la réconciliation au niveau du deal.
 *
 * Le moteur company_id (engine.ts) relie au niveau ENTREPRISE ; ici on relie
 * chaque deal GAGNÉ aux factures qui le concernent :
 *  - candidates = factures de la MÊME entreprise, non rattachées, émises dans
 *    la fenêtre [close_date − 30 j ; close_date + 365 j] ;
 *  - correspondance EXACTE (une facture = montant du deal ± 1 %) et unique →
 *    proposition « high » (liable en un clic, méthode auto_exact) ;
 *  - somme des candidates = montant du deal ± 1 % → proposition « combo » ;
 *  - sinon → choix MANUEL parmi les candidates.
 * Rien n'est écrit sans confirmation utilisateur (route deal-invoices).
 *
 * Une fois lié : écart par deal = montant signé − Σ factures liées (les
 * AVOIRS, factures à montant négatif, se déduisent naturellement).
 */

export type LinkedInvoice = {
  id: string;
  number: string | null;
  amountTotal: number;
  issuedAt: string | null;
  status: string | null;
  method: string | null;
};

export type DealBillingRow = {
  dealId: string;
  dealName: string;
  companyName: string | null;
  amount: number;
  closeDate: string | null;
  billed: number;
  gap: number;
  /** solde | partiel | surfacture | non_facture */
  state: "solde" | "partiel" | "surfacture" | "non_facture";
  invoices: LinkedInvoice[];
};

export type DealInvoiceProposal = {
  dealId: string;
  dealName: string;
  companyName: string | null;
  amount: number;
  closeDate: string | null;
  confidence: "high" | "combo" | "manual";
  candidates: Array<{
    id: string;
    number: string | null;
    amountTotal: number;
    issuedAt: string | null;
    /** Présélectionnée dans l'UI (correspondance exacte / combo). */
    preselected: boolean;
  }>;
};

export type DealInvoiceState = {
  available: boolean;
  rows: DealBillingRow[];
  proposals: DealInvoiceProposal[];
  stats: {
    wonDeals: number;
    linkedDeals: number;
    solde: number;
    gapTotal: number;
    leakTotal: number;
  };
};

const DAY = 86_400_000;
const WINDOW_BEFORE = 30 * DAY;
const WINDOW_AFTER = 365 * DAY;
/** Tolérance de correspondance de montant (arrondis, TVA au centime…). */
const TOLERANCE = 0.01;

const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * TOLERANCE);

type DealRow = {
  id: string;
  name: string | null;
  amount: number | null;
  close_date: string | null;
  company_id: string | null;
  companies: { name: string | null } | { name: string | null }[] | null;
};
type InvRow = {
  id: string;
  number: string | null;
  amount_total: number | null;
  issued_at: string | null;
  status: string | null;
  company_id: string | null;
  deal_id: string | null;
  deal_link_method: string | null;
};

function companyNameOf(rel: DealRow["companies"]): string | null {
  const o = Array.isArray(rel) ? rel[0] : rel;
  return o?.name ?? null;
}

async function pageAll<T>(
  sb: SupabaseClient,
  table: string,
  columns: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply: (q: any) => any,
): Promise<{ rows: T[]; error: string | null }> {
  const out: T[] = [];
  for (let page = 0; page < 10; page++) {
    const { data, error } = await apply(
      sb.from(table).select(columns).range(page * 1000, page * 1000 + 999),
    );
    if (error) return { rows: out, error: error.message as string };
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return { rows: out, error: null };
}

/** État complet du rapprochement deal ↔ factures d'une org. */
export async function computeDealInvoiceState(
  sb: SupabaseClient,
  orgId: string,
): Promise<DealInvoiceState> {
  const empty: DealInvoiceState = {
    available: true,
    rows: [],
    proposals: [],
    stats: { wonDeals: 0, linkedDeals: 0, solde: 0, gapTotal: 0, leakTotal: 0 },
  };

  const dealsRes = await pageAll<DealRow>(
    sb,
    "deals",
    "id, name, amount, close_date, company_id, companies(name)",
    (q) => q.eq("organization_id", orgId).eq("is_closed_won", true).not("amount", "is", null),
  );
  const invRes = await pageAll<InvRow>(
    sb,
    "invoices",
    "id, number, amount_total, issued_at, status, company_id, deal_id, deal_link_method",
    (q) => q.eq("organization_id", orgId),
  );
  // Colonne deal_id absente (migration non appliquée) → fonctionnalité indisponible.
  if (invRes.error && /deal_id|deal_link_method/.test(invRes.error)) return { ...empty, available: false };
  if (dealsRes.error) return empty;

  const deals = dealsRes.rows.filter((d) => (d.amount ?? 0) > 0);
  const invoices = invRes.rows;

  // Factures liées, groupées par deal.
  const linkedByDeal = new Map<string, InvRow[]>();
  for (const inv of invoices) {
    if (!inv.deal_id) continue;
    (linkedByDeal.get(inv.deal_id) ?? linkedByDeal.set(inv.deal_id, []).get(inv.deal_id))!.push(inv);
  }
  // Factures LIBRES par entreprise (candidates au rapprochement).
  const freeByCompany = new Map<string, InvRow[]>();
  for (const inv of invoices) {
    if (inv.deal_id || !inv.company_id) continue;
    (freeByCompany.get(inv.company_id) ?? freeByCompany.set(inv.company_id, []).get(inv.company_id))!.push(inv);
  }

  const rows: DealBillingRow[] = [];
  const proposals: DealInvoiceProposal[] = [];
  let gapTotal = 0;
  let leakTotal = 0;
  let solde = 0;

  for (const d of deals) {
    const amount = d.amount ?? 0;
    const linked = linkedByDeal.get(d.id) ?? [];

    if (linked.length > 0) {
      const billed = linked.reduce((s, i) => s + (i.amount_total ?? 0), 0);
      const gap = Math.round(amount - billed);
      const state: DealBillingRow["state"] = near(billed, amount)
        ? "solde"
        : billed > amount
          ? "surfacture"
          : billed > 0
            ? "partiel"
            : "non_facture";
      if (state === "solde") solde++;
      else gapTotal += gap;
      rows.push({
        dealId: d.id,
        dealName: d.name ?? "Deal sans nom",
        companyName: companyNameOf(d.companies),
        amount,
        closeDate: d.close_date,
        billed: Math.round(billed),
        gap,
        state,
        invoices: linked.map((i) => ({
          id: i.id,
          number: i.number,
          amountTotal: Math.round(i.amount_total ?? 0),
          issuedAt: i.issued_at,
          status: i.status,
          method: i.deal_link_method,
        })),
      });
      continue;
    }

    // ── Deal non rattaché : candidates de la même entreprise, dans la fenêtre. ──
    if (!d.company_id) continue;
    const closeMs = d.close_date ? Date.parse(d.close_date) : NaN;
    const candidates = (freeByCompany.get(d.company_id) ?? []).filter((i) => {
      if (Number.isNaN(closeMs) || !i.issued_at) return true; // sans dates : on laisse juger
      const t = Date.parse(i.issued_at);
      return t >= closeMs - WINDOW_BEFORE && t <= closeMs + WINDOW_AFTER;
    });
    if (candidates.length === 0) {
      leakTotal += amount;
      continue;
    }

    const exact = candidates.filter((i) => near(i.amount_total ?? 0, amount));
    const sumAll = candidates.reduce((s, i) => s + (i.amount_total ?? 0), 0);
    const confidence: DealInvoiceProposal["confidence"] =
      exact.length === 1 ? "high" : near(sumAll, amount) ? "combo" : "manual";
    const preselectedIds = new Set(
      confidence === "high" ? [exact[0].id] : confidence === "combo" ? candidates.map((i) => i.id) : [],
    );
    proposals.push({
      dealId: d.id,
      dealName: d.name ?? "Deal sans nom",
      companyName: companyNameOf(d.companies),
      amount,
      closeDate: d.close_date,
      confidence,
      candidates: candidates.slice(0, 8).map((i) => ({
        id: i.id,
        number: i.number,
        amountTotal: Math.round(i.amount_total ?? 0),
        issuedAt: i.issued_at,
        preselected: preselectedIds.has(i.id),
      })),
    });
  }

  // Écarts d'abord (les plus gros en tête), soldés à la fin.
  rows.sort((a, b) => (a.state === "solde" ? 1 : 0) - (b.state === "solde" ? 1 : 0) || Math.abs(b.gap) - Math.abs(a.gap));
  // Propositions sûres en tête.
  const rank = { high: 0, combo: 1, manual: 2 } as const;
  proposals.sort((a, b) => rank[a.confidence] - rank[b.confidence] || b.amount - a.amount);

  return {
    available: true,
    rows,
    proposals,
    stats: {
      wonDeals: deals.length,
      linkedDeals: rows.length,
      solde,
      gapTotal: Math.round(gapTotal),
      leakTotal: Math.round(leakTotal),
    },
  };
}
