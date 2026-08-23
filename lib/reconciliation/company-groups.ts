import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Résolution des GROUPES d'entreprises (consolidation multi-entités).
 *
 * `companies.parent_company_id` forme une forêt (une entité → son parent /
 * groupe). La RACINE de chaque arbre est la tête de groupe ; toutes les entités
 * qui partagent la même racine appartiennent au même groupe. Ce helper résout,
 * pour chaque entreprise, l'id de sa racine de groupe (elle-même si elle n'a
 * pas de parent), en suivant la chaîne de parents avec protection anti-cycle.
 *
 * Sert à la réconciliation à DEUX NIVEAUX : agréger deal↔facture par entité ET
 * consolidé au niveau groupe, et à détecter les mismatches d'entité (deal sur
 * le groupe, facture sur une entité sœur).
 */

export type CompanyGroups = {
  /** true = la colonne parent_company_id existe (migration appliquée). */
  available: boolean;
  /** company_id → id de la racine de groupe (self si pas de parent). */
  rootOf: Map<string, string>;
  /** racine de groupe → toutes les entités du groupe (racine incluse). */
  membersOf: Map<string, string[]>;
  /** Nom d'affichage par company_id. */
  nameOf: Map<string, string>;
  /** Racines qui ont ≥ 2 entités (vrais groupes multi-entités). */
  groupRoots: Set<string>;
};

type Row = { id: string; parent_company_id: string | null; name: string | null };

/** Charge la forêt de hiérarchie de l'org et résout chaque racine de groupe. */
export async function loadCompanyGroups(sb: SupabaseClient, orgId: string): Promise<CompanyGroups> {
  const empty: CompanyGroups = {
    available: false,
    rootOf: new Map(),
    membersOf: new Map(),
    nameOf: new Map(),
    groupRoots: new Set(),
  };

  const rows: Row[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await sb
      .from("companies")
      .select("id, parent_company_id, name")
      .eq("organization_id", orgId)
      .range(page * 1000, page * 1000 + 999);
    // Colonne absente (migration non appliquée) → indisponible, pas d'erreur.
    if (error) {
      if (/parent_company_id/.test(error.message)) return empty;
      break;
    }
    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  if (rows.length === 0) return { ...empty, available: true };

  const parentOf = new Map<string, string | null>();
  const nameOf = new Map<string, string>();
  for (const r of rows) {
    parentOf.set(r.id, r.parent_company_id);
    nameOf.set(r.id, r.name ?? "Entreprise sans nom");
  }

  // Racine de chaque entité : on remonte les parents, protection anti-cycle
  // (parent inconnu ou boucle → on s'arrête sur le dernier id valide).
  const rootOf = new Map<string, string>();
  const resolveRoot = (start: string): string => {
    const cached = rootOf.get(start);
    if (cached) return cached;
    const seen = new Set<string>();
    let cur = start;
    while (true) {
      if (seen.has(cur)) break; // cycle → on garde `cur`
      seen.add(cur);
      const p = parentOf.get(cur);
      if (!p || !parentOf.has(p)) break; // pas de parent (ou parent hors org)
      cur = p;
    }
    for (const id of seen) rootOf.set(id, cur); // mémoïse toute la chaîne
    return cur;
  };
  for (const r of rows) resolveRoot(r.id);

  const membersOf = new Map<string, string[]>();
  for (const r of rows) {
    const root = rootOf.get(r.id)!;
    (membersOf.get(root) ?? membersOf.set(root, []).get(root))!.push(r.id);
  }
  const groupRoots = new Set<string>();
  for (const [root, members] of membersOf) if (members.length >= 2) groupRoots.add(root);

  return { available: true, rootOf, membersOf, nameOf, groupRoots };
}
