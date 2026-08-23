import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Vue par ÉTABLISSEMENT (facette SIRET) — option (a) de la consolidation
 * multi-entités.
 *
 * On NE change PAS la résolution : une entité légale reste UNE entreprise dans
 * Revold (consolidée par SIREN). Mais on VENTILE ses factures par établissement
 * quand elles portent un SIRET (`invoices.siret`, capté à la synchro avant le
 * collapse SIREN). Un SIRET = SIREN (9) + NIC (5) ; deux factures d'une même
 * entité légale avec des NIC différents = deux établissements.
 *
 * Dérivé au read-time depuis les factures (aucune table dédiée, toujours frais,
 * s'allume dès que le billing distingue les établissements par SIRET).
 */

export type Establishment = {
  siret: string;
  /** NIC (5 derniers chiffres) — identifie l'établissement dans l'entité légale. */
  nic: string;
  invoices: number;
  total: number;
};

export type CompanyEstablishments = {
  /** true = la colonne invoices.siret existe (migration appliquée). */
  available: boolean;
  /** company_id → établissements (triés par CA décroissant). */
  byCompany: Map<string, Establishment[]>;
  /** Nom d'affichage par company_id (entités multi-établissements uniquement). */
  nameOf: Map<string, string>;
  /** company_id des entités légales ayant ≥ 2 établissements distincts. */
  multiSiret: Set<string>;
};

type InvRow = { company_id: string | null; siret: string | null; amount_total: number | null };

export async function loadCompanyEstablishments(
  sb: SupabaseClient,
  orgId: string,
): Promise<CompanyEstablishments> {
  const empty: CompanyEstablishments = {
    available: false,
    byCompany: new Map(),
    nameOf: new Map(),
    multiSiret: new Set(),
  };

  const rows: InvRow[] = [];
  for (let page = 0; page < 10; page++) {
    const { data, error } = await sb
      .from("invoices")
      .select("company_id, siret, amount_total")
      .eq("organization_id", orgId)
      .not("siret", "is", null)
      .range(page * 1000, page * 1000 + 999);
    // Colonne absente (migration non appliquée) → indisponible, pas d'erreur.
    if (error) {
      if (/siret/.test(error.message)) return empty;
      break;
    }
    const batch = (data ?? []) as InvRow[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  if (rows.length === 0) return { ...empty, available: true };

  // company_id → siret → agrégat.
  const acc = new Map<string, Map<string, { invoices: number; total: number }>>();
  for (const r of rows) {
    const cid = r.company_id;
    const siret = (r.siret ?? "").replace(/\D/g, "");
    if (!cid || siret.length !== 14) continue;
    const perCompany = acc.get(cid) ?? acc.set(cid, new Map()).get(cid)!;
    const cur = perCompany.get(siret) ?? { invoices: 0, total: 0 };
    cur.invoices += 1;
    cur.total += Number(r.amount_total) || 0;
    perCompany.set(siret, cur);
  }

  const byCompany = new Map<string, Establishment[]>();
  const multiSiret = new Set<string>();
  for (const [cid, perCompany] of acc) {
    if (perCompany.size < 2) continue; // pas d'intérêt : un seul établissement
    const ests: Establishment[] = [...perCompany.entries()]
      .map(([siret, v]) => ({ siret, nic: siret.slice(9), invoices: v.invoices, total: v.total }))
      .sort((a, b) => b.total - a.total);
    byCompany.set(cid, ests);
    multiSiret.add(cid);
  }

  const nameOf = new Map<string, string>();
  if (multiSiret.size > 0) {
    const { data } = await sb
      .from("companies")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("id", [...multiSiret]);
    for (const c of (data ?? []) as Array<{ id: string; name: string | null }>) {
      nameOf.set(c.id, c.name ?? "Entreprise sans nom");
    }
  }

  return { available: true, byCompany, nameOf, multiSiret };
}
