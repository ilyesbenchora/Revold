import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Poste clients / fournisseurs — créances & dettes ouvertes + balance âgée.
 *
 * Adapté du template Lomed Cockpit avec ses « pièges connus » intégrés :
 *  - montants d'avoirs négatifs → valeur absolue ;
 *  - statuts clos/annulés (paid, void) exclus des restes dus ;
 *  - brouillons comptés À PART (engagé mais pas encore exigible).
 */

export type AgedBucket = { label: string; amount: number; count: number };
export type OpenInvoiceRow = {
  number: string | null;
  company: string | null;
  dueAt: string | null;
  daysOverdue: number | null; // null = pas encore échue
  amount: number;
};

export type AgedSide = {
  total: number;
  count: number;
  draftTotal: number;
  draftCount: number;
  buckets: AgedBucket[]; // Non échu · 0-30 j · 31-60 j · 61-90 j · +90 j
  top: OpenInvoiceRow[];
};

export type ReceivablesData = {
  hasData: boolean;
  clients: AgedSide;
  fournisseurs: AgedSide;
};

const BUCKETS: Array<{ label: string; min: number; max: number | null }> = [
  { label: "Non échu", min: -Infinity, max: 0 },
  { label: "0–30 j", min: 1, max: 30 },
  { label: "31–60 j", min: 31, max: 60 },
  { label: "61–90 j", min: 61, max: 90 },
  { label: "+90 j", min: 91, max: null },
];

type Row = {
  number: string | null;
  status: string;
  amount_due: number;
  due_at: string | null;
  issued_at: string | null;
  direction: string;
  companies: { name: string | null } | Array<{ name: string | null }> | null;
};

function companyName(rel: Row["companies"]): string | null {
  if (!rel) return null;
  const o = Array.isArray(rel) ? rel[0] : rel;
  return o?.name ?? null;
}

function buildSide(rows: Row[], now: number): AgedSide {
  const open = rows.filter((r) => r.status === "open" || r.status === "uncollectible");
  const drafts = rows.filter((r) => r.status === "draft");

  const buckets: AgedBucket[] = BUCKETS.map((b) => ({ label: b.label, amount: 0, count: 0 }));
  const detail: OpenInvoiceRow[] = [];
  for (const r of open) {
    // Piège template : avoirs → reste dû négatif. Valeur absolue.
    const amount = Math.abs(Number(r.amount_due) || 0);
    if (amount === 0) continue;
    const due = r.due_at ? new Date(r.due_at).getTime() : null;
    const daysOverdue = due !== null ? Math.floor((now - due) / 86_400_000) : null;
    const idx = BUCKETS.findIndex((b) => {
      const d = daysOverdue ?? 0; // sans échéance → considérée non échue
      return d >= b.min && (b.max === null || d <= b.max);
    });
    const bucket = buckets[Math.max(0, idx)];
    bucket.amount += amount;
    bucket.count += 1;
    detail.push({
      number: r.number,
      company: companyName(r.companies),
      dueAt: r.due_at ? String(r.due_at).slice(0, 10) : null,
      daysOverdue: daysOverdue !== null && daysOverdue > 0 ? daysOverdue : null,
      amount: Math.round(amount),
    });
  }
  for (const b of buckets) b.amount = Math.round(b.amount);

  return {
    total: buckets.reduce((s, b) => s + b.amount, 0),
    count: detail.length,
    draftTotal: Math.round(drafts.reduce((s, r) => s + Math.abs(Number(r.amount_due) || 0), 0)),
    draftCount: drafts.length,
    buckets,
    top: detail.sort((a, b) => b.amount - a.amount).slice(0, 15),
  };
}

export async function computeReceivables(supabase: SupabaseClient, orgId: string): Promise<ReceivablesData> {
  const { data } = await supabase
    .from("invoices")
    .select("number, status, amount_due, due_at, issued_at, direction, companies(name)")
    .eq("organization_id", orgId)
    .in("status", ["open", "uncollectible", "draft"])
    .limit(5000);
  const rows = (data ?? []) as unknown as Row[];
  const now = Date.now();

  const clients = buildSide(rows.filter((r) => r.direction !== "out"), now);
  const fournisseurs = buildSide(rows.filter((r) => r.direction === "out"), now);
  return {
    hasData: clients.count + clients.draftCount + fournisseurs.count + fournisseurs.draftCount > 0,
    clients,
    fournisseurs,
  };
}
