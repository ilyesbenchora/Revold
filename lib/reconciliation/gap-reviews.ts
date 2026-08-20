import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * File d'APUREMENT des écarts CA signé ↔ facturé, entreprise par entreprise.
 * Le calcul rejoue les jointures company_id du moteur (deals gagnés ×
 * factures) puis attache le statut de traitement (recon_gap_reviews) : à
 * traiter / justifié / à corriger / corrigé — le dossier de réconciliation
 * que l'on présente à l'expert-comptable.
 *
 * Les AVOIRS (factures à montant négatif) sont comptés dans le facturé (ils
 * réduisent le total) ET exposés séparément (creditTotal) : un écart couvert
 * par un avoir se justifie en un clic.
 */

export type GapReviewStatus = "open" | "justified" | "to_fix" | "fixed";
export const GAP_REVIEW_STATUSES: GapReviewStatus[] = ["open", "justified", "to_fix", "fixed"];

export type CompanyGapRow = {
  companyId: string;
  companyName: string;
  /** CA des deals gagnés de l'entreprise. */
  wonTotal: number;
  /** Total facturé (avoirs déduits). */
  billedTotal: number;
  /** Somme des avoirs (montants négatifs, renvoyée positive). */
  creditTotal: number;
  gap: number;
  dealCount: number;
  invoiceCount: number;
  status: GapReviewStatus;
  note: string | null;
};

export type PeriodGapRow = {
  /** Trimestre « 2026-T1 ». */
  period: string;
  won: number;
  billed: number;
  /** Avoirs émis sur le trimestre (positif). */
  credits: number;
  gap: number;
};

type DealRow = { amount: number | null; company_id: string | null };
type InvRow = { amount_total: number | null; company_id: string | null };

async function pageAll<T>(
  sb: SupabaseClient,
  table: string,
  columns: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply: (q: any) => any,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 15; page++) {
    const { data, error } = await apply(
      sb.from(table).select(columns).range(page * 1000, page * 1000 + 999),
    );
    if (error) break;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/** Trimestre « YYYY-Tn » d'une date ISO (null si invalide). */
function quarterOf(iso: string | null): string | null {
  const s = String(iso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m] = s.split("-").map(Number);
  return `${y}-T${Math.ceil(m / 3)}`;
}

/**
 * PÉRIODISATION de l'écart : CA signé (close_date) vs facturé (issued_at)
 * trimestre par trimestre — la question du DAF « les deals gagnés en T1
 * ont-ils été facturés ? », par période de rattachement, avoirs exposés.
 * Renvoie les `quarters` derniers trimestres, du plus ancien au plus récent.
 */
export async function computePeriodizedGap(
  sb: SupabaseClient,
  orgId: string,
  quarters = 6,
): Promise<PeriodGapRow[]> {
  const [deals, invoices] = await Promise.all([
    pageAll<{ amount: number | null; close_date: string | null }>(sb, "deals", "amount, close_date", (q) =>
      q.eq("organization_id", orgId).eq("is_closed_won", true)),
    pageAll<{ amount_total: number | null; issued_at: string | null }>(sb, "invoices", "amount_total, issued_at", (q) =>
      q.eq("organization_id", orgId)),
  ]);

  const acc = new Map<string, { won: number; billed: number; credits: number }>();
  const bucket = (key: string) => {
    let b = acc.get(key);
    if (!b) {
      b = { won: 0, billed: 0, credits: 0 };
      acc.set(key, b);
    }
    return b;
  };
  for (const d of deals) {
    const q = quarterOf(d.close_date);
    if (q) bucket(q).won += d.amount ?? 0;
  }
  for (const i of invoices) {
    const q = quarterOf(i.issued_at);
    if (!q) continue;
    const v = i.amount_total ?? 0;
    const b = bucket(q);
    b.billed += v;
    if (v < 0) b.credits += -v;
  }

  // Les N derniers trimestres jusqu'au trimestre COURANT (axes continus,
  // trimestres vides inclus) — un trimestre sans activité reste visible.
  const now = new Date();
  const rows: PeriodGapRow[] = [];
  let y = now.getFullYear();
  let q = Math.ceil((now.getMonth() + 1) / 3);
  for (let i = 0; i < quarters; i++) {
    const key = `${y}-T${q}`;
    const b = acc.get(key) ?? { won: 0, billed: 0, credits: 0 };
    rows.unshift({
      period: key,
      won: Math.round(b.won),
      billed: Math.round(b.billed),
      credits: Math.round(b.credits),
      gap: Math.round(b.won - b.billed),
    });
    q--;
    if (q === 0) { q = 4; y--; }
  }
  return rows;
}

/** Écarts par entreprise + statut d'apurement. Résilient (table absente → statuts open). */
export async function computeCompanyGaps(
  sb: SupabaseClient,
  orgId: string,
): Promise<{ rows: CompanyGapRow[]; reviewsAvailable: boolean }> {
  const [deals, invoices] = await Promise.all([
    pageAll<DealRow>(sb, "deals", "amount, company_id", (q) =>
      q.eq("organization_id", orgId).eq("is_closed_won", true)),
    pageAll<InvRow>(sb, "invoices", "amount_total, company_id", (q) =>
      q.eq("organization_id", orgId)),
  ]);

  type Acc = { won: number; billed: number; credits: number; dealCount: number; invoiceCount: number };
  const byCompany = new Map<string, Acc>();
  const acc = (id: string): Acc => {
    let a = byCompany.get(id);
    if (!a) {
      a = { won: 0, billed: 0, credits: 0, dealCount: 0, invoiceCount: 0 };
      byCompany.set(id, a);
    }
    return a;
  };
  for (const d of deals) {
    if (!d.company_id) continue;
    const a = acc(d.company_id);
    a.won += d.amount ?? 0;
    a.dealCount++;
  }
  for (const i of invoices) {
    if (!i.company_id) continue;
    const a = acc(i.company_id);
    const v = i.amount_total ?? 0;
    a.billed += v;
    a.invoiceCount++;
    if (v < 0) a.credits += -v;
  }

  // Seules les entreprises EN ÉCART entrent dans la file (tolérance 1 € /
  // 1 % : les arrondis ne polluent pas le dossier).
  const inGap = [...byCompany.entries()].filter(([, a]) => {
    const gap = a.won - a.billed;
    return Math.abs(gap) > Math.max(1, Math.abs(a.won) * 0.01) && (a.dealCount > 0 || a.invoiceCount > 0);
  });
  if (inGap.length === 0) return { rows: [], reviewsAvailable: true };

  // Noms des entreprises concernées.
  const ids = inGap.map(([id]) => id);
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb
      .from("companies")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("id", ids.slice(i, i + 200));
    for (const c of (data ?? []) as Array<{ id: string; name: string | null }>) {
      names.set(c.id, c.name ?? "Entreprise sans nom");
    }
  }

  // Statuts d'apurement (table d'une migration récente → repli open).
  const reviews = new Map<string, { status: GapReviewStatus; note: string | null }>();
  let reviewsAvailable = true;
  try {
    const { data, error } = await sb
      .from("recon_gap_reviews")
      .select("company_id, status, note")
      .eq("organization_id", orgId);
    if (error) reviewsAvailable = false;
    else {
      for (const r of (data ?? []) as Array<{ company_id: string; status: GapReviewStatus; note: string | null }>) {
        reviews.set(r.company_id, { status: r.status, note: r.note });
      }
    }
  } catch {
    reviewsAvailable = false;
  }

  const rows: CompanyGapRow[] = inGap
    .map(([id, a]) => ({
      companyId: id,
      companyName: names.get(id) ?? "Entreprise sans nom",
      wonTotal: Math.round(a.won),
      billedTotal: Math.round(a.billed),
      creditTotal: Math.round(a.credits),
      gap: Math.round(a.won - a.billed),
      dealCount: a.dealCount,
      invoiceCount: a.invoiceCount,
      status: reviews.get(id)?.status ?? "open",
      note: reviews.get(id)?.note ?? null,
    }))
    // Les écarts à traiter d'abord, puis par ampleur décroissante.
    .sort((x, y) => (x.status === "open" ? 0 : 1) - (y.status === "open" ? 0 : 1) || Math.abs(y.gap) - Math.abs(x.gap));

  return { rows, reviewsAvailable };
}
