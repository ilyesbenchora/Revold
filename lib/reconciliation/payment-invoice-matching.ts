import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rapprochement FACTURE ↔ PAIEMENTS — le dernier maillon du lignage
 * deal → facture → ENCAISSEMENT.
 *
 * L'« encaissé » lu jusqu'ici sur invoices.amount_paid est un TOTAL déclaré par
 * l'outil de facturation ; il ne dit pas QUEL paiement a soldé QUELLE facture.
 * Ici on relie chaque facture aux enregistrements de paiement réels (Stripe,
 * GoCardless…) : le pont est l'ENTREPRISE canonique (payments.company_id posé
 * par la résolution SIREN/TVA), pas une référence de facture — un paiement
 * GoCardless de « Dupont SAS » devient candidat pour toute facture ouverte de
 * Dupont.
 *
 *  - candidates = paiements RÉUSSIS de la même entreprise, non rattachés,
 *    encaissés dans [issued_at − 5 j ; issued_at + 365 j] ;
 *  - un paiement = montant de la facture ± 1 % → « high » ;
 *  - meilleur SOUS-ENSEMBLE de paiements = montant de la facture (paiement
 *    partiel / échéancier prélevé) → « combo », retiré du pool de l'entreprise
 *    (désambiguïsation quand plusieurs factures ouvertes) ;
 *  - sinon → choix MANUEL. Rien n'est écrit sans confirmation utilisateur.
 *
 * Une fois lié : reste dû réel = montant facture − Σ paiements liés ; un
 * paiement sans facture (surplus) ou une facture « payée » sans aucun paiement
 * rapproché deviennent des exceptions visibles.
 */

export type LinkedPayment = {
  id: string;
  amount: number;
  paidAt: string | null;
  status: string | null;
  source: string | null;
};

export type InvoicePaymentRow = {
  invoiceId: string;
  number: string | null;
  companyName: string | null;
  amountTotal: number;
  issuedAt: string | null;
  paid: number;
  due: number;
  /** solde | partiel | non_encaisse | surpaye */
  state: "solde" | "partiel" | "non_encaisse" | "surpaye";
  payments: LinkedPayment[];
};

export type InvoicePaymentProposal = {
  invoiceId: string;
  number: string | null;
  companyName: string | null;
  amountTotal: number;
  issuedAt: string | null;
  confidence: "high" | "combo" | "manual";
  candidates: Array<{
    id: string;
    amount: number;
    paidAt: string | null;
    source: string | null;
    preselected: boolean;
  }>;
};

export type InvoicePaymentState = {
  available: boolean;
  rows: InvoicePaymentRow[];
  proposals: InvoicePaymentProposal[];
  stats: {
    invoices: number;
    linkedInvoices: number;
    solde: number;
    dueTotal: number;
    unmatchedPaymentsTotal: number;
  };
};

const DAY = 86_400_000;
const WINDOW_BEFORE = 5 * DAY;
const WINDOW_AFTER = 365 * DAY;
const TOLERANCE = 0.01;
const MAX_SUBSET_CANDIDATES = 14;

const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * TOLERANCE);

/** Meilleur sous-ensemble de paiements dont la somme ≈ montant de la facture. */
function bestSubset(cands: Array<{ id: string; amount: number; dist: number }>, target: number): string[] | null {
  const pool = cands.slice(0, MAX_SUBSET_CANDIDATES);
  const n = pool.length;
  if (n === 0) return null;
  let best: { ids: string[]; err: number; size: number; dist: number } | null = null;
  for (let mask = 1; mask < 1 << n; mask++) {
    let sum = 0;
    let size = 0;
    let dist = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += pool[i].amount;
        dist += pool[i].dist;
        size++;
      }
    }
    if (Math.abs(sum - target) > Math.max(1, Math.abs(target) * TOLERANCE)) continue;
    const err = Math.abs(sum - target);
    if (
      !best ||
      err < best.err - 0.5 ||
      (Math.abs(err - best.err) <= 0.5 && (size < best.size || (size === best.size && dist < best.dist)))
    ) {
      const ids: string[] = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) ids.push(pool[i].id);
      best = { ids, err, size, dist };
    }
  }
  return best?.ids ?? null;
}

type InvRow = {
  id: string;
  number: string | null;
  amount_total: number | null;
  issued_at: string | null;
  company_id: string | null;
  companies: { name: string | null } | { name: string | null }[] | null;
};
type PayRow = {
  id: string;
  amount: number | null;
  paid_at: string | null;
  status: string | null;
  company_id: string | null;
  invoice_id: string | null;
  primary_source: string | null;
};

function companyNameOf(rel: InvRow["companies"]): string | null {
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
  for (let page = 0; page < 12; page++) {
    const { data, error } = await apply(sb.from(table).select(columns).range(page * 1000, page * 1000 + 999));
    if (error) return { rows: out, error: error.message as string };
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return { rows: out, error: null };
}

/** État complet du rapprochement facture ↔ paiements d'une org. */
export async function computeInvoicePaymentState(sb: SupabaseClient, orgId: string): Promise<InvoicePaymentState> {
  const empty: InvoicePaymentState = {
    available: true,
    rows: [],
    proposals: [],
    stats: { invoices: 0, linkedInvoices: 0, solde: 0, dueTotal: 0, unmatchedPaymentsTotal: 0 },
  };

  const invRes = await pageAll<InvRow>(
    sb,
    "invoices",
    "id, number, amount_total, issued_at, company_id, companies(name)",
    (q) => q.eq("organization_id", orgId).gt("amount_total", 0),
  );
  const payRes = await pageAll<PayRow>(
    sb,
    "payments",
    "id, amount, paid_at, status, company_id, invoice_id, primary_source",
    (q) => q.eq("organization_id", orgId),
  );
  // Table payments absente (org sans connecteur paiement) → indisponible, pas d'erreur.
  if (payRes.error) return { ...empty, available: false };
  if (invRes.error) return empty;

  const invoices = invRes.rows;
  // Paiements RÉUSSIS uniquement (un échec/annulation ne solde rien).
  const succeeded = payRes.rows.filter((p) => !p.status || /succ|paid|réuss|reussi|complete/i.test(p.status));

  // Paiements déjà liés, groupés par facture.
  const linkedByInvoice = new Map<string, PayRow[]>();
  for (const p of succeeded) {
    if (!p.invoice_id) continue;
    (linkedByInvoice.get(p.invoice_id) ?? linkedByInvoice.set(p.invoice_id, []).get(p.invoice_id))!.push(p);
  }
  // Pool MUTABLE de paiements libres par entreprise.
  const freeByCompany = new Map<string, PayRow[]>();
  for (const p of succeeded) {
    if (p.invoice_id || !p.company_id) continue;
    (freeByCompany.get(p.company_id) ?? freeByCompany.set(p.company_id, []).get(p.company_id))!.push(p);
  }

  const rows: InvoicePaymentRow[] = [];
  const proposals: InvoicePaymentProposal[] = [];
  let dueTotal = 0;
  let solde = 0;

  // ── 1) Factures déjà rapprochées à des paiements. ──
  for (const inv of invoices) {
    const linked = linkedByInvoice.get(inv.id);
    if (!linked || linked.length === 0) continue;
    const total = inv.amount_total ?? 0;
    const paid = linked.reduce((s, p) => s + (p.amount ?? 0), 0);
    const due = Math.round(total - paid);
    const state: InvoicePaymentRow["state"] = near(paid, total)
      ? "solde"
      : paid > total
        ? "surpaye"
        : paid > 0
          ? "partiel"
          : "non_encaisse";
    if (state === "solde") solde++;
    else if (due > 0) dueTotal += due;
    rows.push({
      invoiceId: inv.id,
      number: inv.number,
      companyName: companyNameOf(inv.companies),
      amountTotal: Math.round(total),
      issuedAt: inv.issued_at,
      paid: Math.round(paid),
      due,
      state,
      payments: linked.map((p) => ({
        id: p.id,
        amount: Math.round(p.amount ?? 0),
        paidAt: p.paid_at,
        status: p.status,
        source: p.primary_source,
      })),
    });
  }

  // ── 2) Factures non rapprochées : attribution par entreprise, grosses d'abord. ──
  const unlinked = invoices
    .filter((inv) => !(linkedByInvoice.get(inv.id)?.length) && inv.company_id)
    .sort((a, b) => (b.amount_total ?? 0) - (a.amount_total ?? 0));

  for (const inv of unlinked) {
    const total = inv.amount_total ?? 0;
    const pool = freeByCompany.get(inv.company_id!) ?? [];
    const issMs = inv.issued_at ? Date.parse(inv.issued_at) : NaN;
    const inWindow = pool.filter((p) => {
      if (Number.isNaN(issMs) || !p.paid_at) return true;
      const t = Date.parse(p.paid_at);
      return t >= issMs - WINDOW_BEFORE && t <= issMs + WINDOW_AFTER;
    });
    if (inWindow.length === 0) continue;

    const withDist = inWindow.map((p) => ({
      pay: p,
      dist: Number.isNaN(issMs) || !p.paid_at ? Number.MAX_SAFE_INTEGER : Math.abs(Date.parse(p.paid_at) - issMs),
    }));
    withDist.sort((a, b) => a.dist - b.dist);

    const exact = withDist.filter((x) => near(x.pay.amount ?? 0, total));
    let confidence: InvoicePaymentProposal["confidence"];
    let chosenIds: Set<string>;
    if (exact.length >= 1) {
      confidence = "high";
      chosenIds = new Set([exact[0].pay.id]);
    } else {
      const subset = bestSubset(withDist.map((x) => ({ id: x.pay.id, amount: x.pay.amount ?? 0, dist: x.dist })), total);
      if (subset) {
        confidence = "combo";
        chosenIds = new Set(subset);
      } else {
        confidence = "manual";
        chosenIds = new Set();
      }
    }
    if (chosenIds.size > 0) {
      freeByCompany.set(inv.company_id!, pool.filter((p) => !chosenIds.has(p.id)));
    }
    proposals.push({
      invoiceId: inv.id,
      number: inv.number,
      companyName: companyNameOf(inv.companies),
      amountTotal: Math.round(total),
      issuedAt: inv.issued_at,
      confidence,
      candidates: withDist.slice(0, 8).map((x) => ({
        id: x.pay.id,
        amount: Math.round(x.pay.amount ?? 0),
        paidAt: x.pay.paid_at,
        source: x.pay.primary_source,
        preselected: chosenIds.has(x.pay.id),
      })),
    });
  }

  // Paiements jamais rattachés (surplus / trop-perçu) — exception à surveiller.
  let unmatchedPaymentsTotal = 0;
  for (const list of freeByCompany.values()) unmatchedPaymentsTotal += list.reduce((s, p) => s + (p.amount ?? 0), 0);

  rows.sort((a, b) => (a.state === "solde" ? 1 : 0) - (b.state === "solde" ? 1 : 0) || Math.abs(b.due) - Math.abs(a.due));
  const rank = { high: 0, combo: 1, manual: 2 } as const;
  proposals.sort((a, b) => rank[a.confidence] - rank[b.confidence] || b.amountTotal - a.amountTotal);

  return {
    available: true,
    rows,
    proposals,
    stats: {
      invoices: invoices.length,
      linkedInvoices: rows.length,
      solde,
      dueTotal: Math.round(dueTotal),
      unmatchedPaymentsTotal: Math.round(unmatchedPaymentsTotal),
    },
  };
}
