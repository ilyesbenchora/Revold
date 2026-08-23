import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCompanyGroups } from "@/lib/reconciliation/company-groups";

/**
 * Rapprochement DEAL ↔ FACTURES — la réconciliation au niveau du deal.
 *
 * Le pont entre une facture (souvent émise dans Pennylane, sans référence au
 * deal HubSpot) et le deal, c'est l'ENTREPRISE CANONIQUE : la résolution
 * d'entité (SIREN/TVA) pose invoices.company_id à la synchro, donc une facture
 * Pennylane de « Dupont SAS » devient candidate pour tout deal gagné de Dupont.
 *
 * Ici on attribue, entreprise par entreprise, les factures aux bons deals :
 *  - candidates = factures de la MÊME entreprise, non rattachées, émises dans
 *    la fenêtre [close_date − 30 j ; close_date + 365 j] ;
 *  - correspondance EXACTE (une facture = montant du deal ± 1 %) → « high » ;
 *  - sinon on cherche le MEILLEUR SOUS-ENSEMBLE de factures dont la somme fait
 *    le montant du deal ± 1 % (échéancier : 3 factures + un avoir = le deal) →
 *    « combo » ; le sous-ensemble choisi est RETIRÉ du pool pour que le deal
 *    SUIVANT de la même entreprise ne réutilise pas les mêmes factures
 *    (désambiguïsation multi-deals) ;
 *  - sinon → choix MANUEL parmi les candidates.
 * Rien n'est écrit sans confirmation utilisateur (route deal-invoices).
 *
 * Une fois lié : écart par deal = montant signé − Σ factures liées (les
 * AVOIRS, factures à montant négatif, se déduisent naturellement ; une somme
 * SUPÉRIEURE au deal = « surfacturé », souvent un avenant non répercuté côté
 * CRM — exposé pour revue, jamais corrigé en silence).
 */

export type LinkedInvoice = {
  id: string;
  number: string | null;
  amountTotal: number;
  issuedAt: string | null;
  status: string | null;
  method: string | null;
  /** Nom de l'entreprise porteuse de la facture (≠ deal → entité sœur). */
  companyName?: string | null;
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
  /** GARDE-FOU : au moins une facture est sur une ENTITÉ SŒUR du même groupe. */
  crossEntity?: { groupName: string | null; entities: string[] };
};

export type DealInvoiceProposal = {
  dealId: string;
  dealName: string;
  companyName: string | null;
  amount: number;
  closeDate: string | null;
  confidence: "high" | "combo" | "manual";
  /** Au moins une candidate est sur une entité SŒUR (facturation groupe ?). */
  crossEntity?: boolean;
  candidates: Array<{
    id: string;
    number: string | null;
    amountTotal: number;
    issuedAt: string | null;
    /** Présélectionnée dans l'UI (correspondance exacte / combo). */
    preselected: boolean;
    /** Entreprise porteuse (affichée si ≠ deal → entité sœur du groupe). */
    companyName?: string | null;
    /** Facture d'une entité sœur (même groupe, société différente). */
    sisterEntity?: boolean;
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
    /** Nombre de deals dont la facturation touche une entité sœur du groupe. */
    crossEntity: number;
  };
};

const DAY = 86_400_000;
const WINDOW_BEFORE = 30 * DAY;
const WINDOW_AFTER = 365 * DAY;
/** Tolérance de correspondance de montant (arrondis, TVA au centime…). */
const TOLERANCE = 0.01;
/** Au-delà, la recherche de sous-ensemble devient trop coûteuse : on borne. */
const MAX_SUBSET_CANDIDATES = 14;

const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * TOLERANCE);

/**
 * MEILLEUR SOUS-ENSEMBLE de factures dont la somme ≈ montant du deal (± 1 %) —
 * gère l'échéancier (3 factures) et les avoirs (montants négatifs) : le bon
 * sous-ensemble peut mêler factures positives et avoirs. Recherche exhaustive
 * bornée (≤ 14 factures, triées par proximité de date) ; à égalité de somme,
 * on préfère MOINS de factures, puis les dates les plus proches du closing.
 * Retourne les ids du sous-ensemble, ou null si aucun ne tombe dans la tolérance.
 */
function bestSubset(
  cands: Array<{ id: string; amount: number; dist: number }>,
  target: number,
): string[] | null {
  const pool = cands.slice(0, MAX_SUBSET_CANDIDATES);
  const n = pool.length;
  if (n === 0) return null;
  let best: { ids: string[]; err: number; size: number; dist: number } | null = null;
  // 2^n combinaisons (n ≤ 14 → ≤ 16384) : parcours des masques de bits.
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
    const err = Math.abs(sum - target);
    if (err > Math.max(1, Math.abs(target) * TOLERANCE)) continue;
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
    stats: { wonDeals: 0, linkedDeals: 0, solde: 0, gapTotal: 0, leakTotal: 0, crossEntity: 0 },
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

  // GROUPES (multi-entités, cas générique) : racine de groupe par entreprise +
  // noms. Une facture d'une entité SŒUR (même groupe) est candidate pour un
  // deal — mais toujours signalée « entité sœur » pour revue (garde-fou : la
  // facturation groupe est une décision, pas une évidence).
  const groups = await loadCompanyGroups(sb, orgId);
  const rootOf = (companyId: string | null): string | null =>
    companyId ? groups.rootOf.get(companyId) ?? companyId : null;

  // Factures liées, groupées par deal.
  const linkedByDeal = new Map<string, InvRow[]>();
  for (const inv of invoices) {
    if (!inv.deal_id) continue;
    (linkedByDeal.get(inv.deal_id) ?? linkedByDeal.set(inv.deal_id, []).get(inv.deal_id))!.push(inv);
  }
  // Pool MUTABLE de factures libres par RACINE DE GROUPE : chaque proposition
  // retire ses factures (désambiguïsation multi-deals), et une facture d'une
  // entité sœur reste candidate pour les deals du groupe.
  const freeByGroup = new Map<string, InvRow[]>();
  for (const inv of invoices) {
    if (inv.deal_id || !inv.company_id) continue;
    const root = rootOf(inv.company_id)!;
    (freeByGroup.get(root) ?? freeByGroup.set(root, []).get(root))!.push(inv);
  }

  const rows: DealBillingRow[] = [];
  const proposals: DealInvoiceProposal[] = [];
  let gapTotal = 0;
  let leakTotal = 0;
  let solde = 0;
  let crossEntityCount = 0;

  // ── 1) Deals DÉJÀ liés : état + écart par deal. ──
  for (const d of deals) {
    const linked = linkedByDeal.get(d.id);
    if (!linked || linked.length === 0) continue;
    const amount = d.amount ?? 0;
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
    // GARDE-FOU : des factures liées sont-elles sur une entité SŒUR du groupe ?
    const sisterNames = new Set<string>();
    for (const i of linked) {
      if (i.company_id && d.company_id && i.company_id !== d.company_id && rootOf(i.company_id) === rootOf(d.company_id)) {
        sisterNames.add(groups.nameOf.get(i.company_id) ?? "Entité sœur");
      }
    }
    const crossEntity = sisterNames.size > 0
      ? { groupName: d.company_id ? groups.nameOf.get(rootOf(d.company_id)!) ?? null : null, entities: [...sisterNames] }
      : undefined;
    if (crossEntity) crossEntityCount++;
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
        companyName: i.company_id ? groups.nameOf.get(i.company_id) ?? null : null,
      })),
      crossEntity,
    });
  }

  // ── 2) Deals NON liés : attribution par entreprise, gros deals d'abord, en
  //       consommant le pool de factures libres de l'entreprise. ──
  const unlinked = deals
    .filter((d) => !(linkedByDeal.get(d.id)?.length) && d.company_id)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));

  for (const d of unlinked) {
    const amount = d.amount ?? 0;
    const groupRoot = rootOf(d.company_id)!;
    const pool = freeByGroup.get(groupRoot) ?? [];
    const closeMs = d.close_date ? Date.parse(d.close_date) : NaN;
    // Candidates = factures libres du GROUPE (entité + entités sœurs) dans la
    // fenêtre temporelle.
    const inWindow = pool.filter((i) => {
      if (Number.isNaN(closeMs) || !i.issued_at) return true; // sans dates : on laisse juger
      const t = Date.parse(i.issued_at);
      return t >= closeMs - WINDOW_BEFORE && t <= closeMs + WINDOW_AFTER;
    });
    if (inWindow.length === 0) {
      leakTotal += amount;
      continue;
    }

    const sameEntity = (i: InvRow) => i.company_id === d.company_id;
    // Tri : même entité d'abord, puis proximité de date (préfère la propre
    // entité du deal ; les entités sœurs ne servent qu'à défaut).
    const withDist = inWindow.map((i) => ({
      inv: i,
      dist: Number.isNaN(closeMs) || !i.issued_at ? Number.MAX_SAFE_INTEGER : Math.abs(Date.parse(i.issued_at) - closeMs),
    }));
    withDist.sort((a, b) => (Number(sameEntity(b.inv)) - Number(sameEntity(a.inv))) || a.dist - b.dist);

    const exact = withDist.filter((x) => near(x.inv.amount_total ?? 0, amount));
    let confidence: DealInvoiceProposal["confidence"];
    let chosenIds: Set<string>;

    if (exact.length >= 1) {
      // Correspondance exacte : même entité en priorité, sinon la plus proche.
      confidence = "high";
      chosenIds = new Set([exact[0].inv.id]);
    } else {
      // Meilleur SOUS-ENSEMBLE (échéancier + avoirs) — pas la somme de tout.
      const subset = bestSubset(
        withDist.map((x) => ({ id: x.inv.id, amount: x.inv.amount_total ?? 0, dist: x.dist })),
        amount,
      );
      if (subset) {
        confidence = "combo";
        chosenIds = new Set(subset);
      } else {
        confidence = "manual";
        chosenIds = new Set();
      }
    }

    // Consomme les factures présélectionnées du pool du GROUPE.
    if (chosenIds.size > 0) {
      freeByGroup.set(groupRoot, pool.filter((i) => !chosenIds.has(i.id)));
    }
    // GARDE-FOU : au moins une présélection est-elle sur une entité sœur ?
    const crossEntity = [...chosenIds].some((id) => {
      const inv = inWindow.find((i) => i.id === id);
      return inv && inv.company_id !== d.company_id;
    });
    if (crossEntity) crossEntityCount++;

    proposals.push({
      dealId: d.id,
      dealName: d.name ?? "Deal sans nom",
      companyName: companyNameOf(d.companies),
      amount,
      closeDate: d.close_date,
      crossEntity: crossEntity || undefined,
      confidence,
      candidates: withDist.slice(0, 8).map((x) => ({
        id: x.inv.id,
        number: x.inv.number,
        amountTotal: Math.round(x.inv.amount_total ?? 0),
        issuedAt: x.inv.issued_at,
        preselected: chosenIds.has(x.inv.id),
        companyName: x.inv.company_id ? groups.nameOf.get(x.inv.company_id) ?? null : null,
        sisterEntity: x.inv.company_id !== d.company_id || undefined,
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
      crossEntity: crossEntityCount,
    },
  };
}
