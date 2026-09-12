import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Filtre « propriétaire de l'objet X » CROISÉ par association — partagé par tous
 * les moteurs qui ciblent par utilisateur CRM (alertes classiques & techniques,
 * objectifs, brief d'équipe).
 *
 * L'utilisateur choisit l'OBJET sur lequel le propriétaire est indexé
 * (`ownerObject`) ; on filtre l'ENTITÉ du KPI (`entity`) en conséquence :
 *  - ownerObject = entity → filtre direct (colonne owner de l'entité) ;
 *  - association DIRECTE (entity porte une FK vers ownerObject) → entity.<fk> ∈
 *    ids des fiches ownerObject possédées ;
 *  - association INVERSE (ownerObject porte une FK vers entity) → entity.id ∈
 *    valeurs de FK des fiches ownerObject possédées.
 * Combinaison sans lien connu (ex. ticket ↔ deal) → null (repli côté appelant).
 */

export type OwnerObject = "deals" | "contacts" | "companies" | "tickets";
export const OWNER_OBJECTS: OwnerObject[] = ["deals", "contacts", "companies", "tickets"];
export function isOwnerObject(v: unknown): v is OwnerObject {
  return v === "deals" || v === "contacts" || v === "companies" || v === "tickets";
}

/** Colonne portant l'id owner HubSpot sur chaque objet (remplie par l'ETL). */
const OWNER_COL: Record<OwnerObject, string> = {
  deals: "hs_owner_id",
  contacts: "hs_owner_id",
  companies: "hs_owner_id",
  tickets: "owner_id",
};

/** FK[child][parent] = colonne de `child` pointant vers `parent`.id. */
const FK: Partial<Record<OwnerObject, Partial<Record<OwnerObject, string>>>> = {
  deals: { companies: "company_id", contacts: "contact_id" },
  contacts: { companies: "company_id" },
  tickets: { companies: "company_id", contacts: "contact_id" },
};

/**
 * Entités de KPI SANS colonne owner (facturation / paiement) mais rattachées au
 * CRM par FK : le ciblage passe forcément par l'objet du propriétaire
 * (entreprise ou contact possédés par l'utilisateur). L'ordre des clés fixe
 * l'objet par défaut (entreprise d'abord — le rattachement le plus fiable).
 * bank_transactions n'a AUCUN lien CRM → volontairement absent.
 */
const BILLING_FK: Record<string, Array<{ object: OwnerObject; col: string }>> = {
  invoices: [{ object: "companies", col: "company_id" }, { object: "contacts", col: "contact_id" }],
  supplier_invoices: [{ object: "companies", col: "company_id" }, { object: "contacts", col: "contact_id" }],
  subscriptions: [{ object: "companies", col: "company_id" }, { object: "contacts", col: "contact_id" }],
  payments: [{ object: "companies", col: "company_id" }, { object: "contacts", col: "contact_id" }],
};

export const OWNER_OBJECT_LABEL: Record<OwnerObject, string> = {
  deals: "Deal",
  contacts: "Contact",
  companies: "Entreprise",
  tickets: "Ticket",
};

/** Uuid impossible : force « aucun résultat » quand la liste d'ids est vide. */
const NO_MATCH_UUID = "00000000-0000-0000-0000-000000000000";

/** Objets « propriétaire » pris en charge pour une entité de KPI (direct + associations). */
export function supportedOwnerObjects(entity: string): OwnerObject[] {
  // Entités de facturation : pas d'owner direct, ciblage croisé uniquement.
  if (!isOwnerObject(entity)) return (BILLING_FK[entity] ?? []).map((f) => f.object);
  const out: OwnerObject[] = [entity];
  for (const o of OWNER_OBJECTS) {
    if (o === entity) continue;
    const forward = FK[entity]?.[o];
    const reverse = FK[o]?.[entity];
    if (forward || reverse) out.push(o);
  }
  return out;
}

/** Descriptif de filtre à appliquer sur la requête de l'entité. */
export type OwnerScope =
  | { mode: "eq"; col: string; value: string }
  | { mode: "in"; col: string; ids: string[] };

/** Ids/valeurs d'une colonne des fiches d'un objet possédées par l'utilisateur. */
async function ownedValues(
  supabase: SupabaseClient,
  orgId: string,
  object: OwnerObject,
  ownerId: string,
  column: string,
): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  const PAGE = 1000;
  try {
    for (let from = 0; from < 50000; from += PAGE) {
      const { data, error } = await supabase
        .from(object)
        .select(column)
        .eq("organization_id", orgId)
        .eq(OWNER_COL[object], ownerId)
        .range(from, from + PAGE - 1);
      if (error || !data) break;
      for (const r of data as unknown as Array<Record<string, unknown>>) {
        const v = r[column];
        if (v != null && !seen.has(String(v))) {
          seen.add(String(v));
          out.push(String(v));
        }
      }
      if (data.length < PAGE) break;
    }
  } catch { /* pas de fiches rapprochées → aucun résultat */ }
  return out;
}

/**
 * Résout le filtre propriétaire pour (entité du KPI, objet du propriétaire).
 * Retourne null si le ciblage n'est pas possible (combinaison sans lien connu).
 */
export async function resolveOwnerScope(
  supabase: SupabaseClient,
  orgId: string,
  entity: string,
  ownerObject: string | null | undefined,
  ownerId: string | null | undefined,
): Promise<OwnerScope | null> {
  if (!ownerId) return null;

  // Entité de facturation (invoices, subscriptions, payments…) : filtre par la
  // FK vers l'objet du propriétaire — objet demandé si câblé, sinon le défaut
  // (entreprise). Aucun lien CRM (bank_transactions) → null.
  if (!isOwnerObject(entity)) {
    const fks = BILLING_FK[entity] ?? [];
    if (fks.length === 0) return null;
    const fk = fks.find((f) => f.object === ownerObject) ?? fks[0];
    const ids = await ownedValues(supabase, orgId, fk.object, ownerId, "id");
    return { mode: "in", col: fk.col, ids };
  }
  const obj: OwnerObject = isOwnerObject(ownerObject) ? ownerObject : entity;

  // Direct : propriétaire de l'entité elle-même.
  if (obj === entity) return { mode: "eq", col: OWNER_COL[entity], value: ownerId };

  // Association DIRECTE : l'entité porte une FK vers l'objet du propriétaire.
  const forward = FK[entity]?.[obj];
  if (forward) {
    const ids = await ownedValues(supabase, orgId, obj, ownerId, "id");
    return { mode: "in", col: forward, ids };
  }

  // Association INVERSE : l'objet du propriétaire porte une FK vers l'entité.
  const reverse = FK[obj]?.[entity];
  if (reverse) {
    const ids = await ownedValues(supabase, orgId, obj, ownerId, reverse);
    return { mode: "in", col: "id", ids };
  }

  return null; // lien inconnu (ex. ticket ↔ deal) — l'appelant décide du repli.
}

/** Applique un OwnerScope à un query-builder Supabase (chaînable). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyOwnerScope(query: any, scope: OwnerScope | null): any {
  if (!scope) return query;
  if (scope.mode === "eq") return query.eq(scope.col, scope.value);
  return query.in(scope.col, scope.ids.length ? scope.ids : [NO_MATCH_UUID]);
}
