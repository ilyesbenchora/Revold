/**
 * Matrice d'autorité des champs : décide, lors de la synchro, quelle source a
 * le droit d'ÉCRIRE un champ donné quand plusieurs outils le renseignent.
 *
 * Config lue depuis `field_authority_config` (page Paramètres → Modèle de
 * données → Matrice d'autorité). `priority` est une liste ordonnée de LABELS
 * d'outils (ex: ["HubSpot","Stripe","Pennylane"]).
 *
 * Règle : une source peut écrire un champ si elle est la mieux classée PARMI
 * les sources connectées pour ce champ. Sinon l'appelant ne doit écrire que si
 * le champ courant est vide (remplissage de trou). Sans règle → dernier-écrit-gagne.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const PROVIDER_LABELS: Record<string, string> = {
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  pipedrive: "Pipedrive",
  zoho: "Zoho",
  monday: "monday",
  stripe: "Stripe",
  pennylane: "Pennylane",
  sellsy: "Sellsy",
  axonaut: "Axonaut",
  quickbooks: "QuickBooks",
  zendesk: "Zendesk",
  intercom: "Intercom",
  freshdesk: "Freshdesk",
  crisp: "Crisp",
};

export function providerLabel(key: string): string {
  return PROVIDER_LABELS[key] ?? key;
}

type Loaded = { authority: Map<string, string[]>; connectedLabels: Set<string> };
const _cache = new Map<string, { value: Loaded; at: number }>();

async function load(sb: SupabaseClient, orgId: string): Promise<Loaded> {
  const cached = _cache.get(orgId);
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  const authority = new Map<string, string[]>();
  const connectedLabels = new Set<string>();
  try {
    const [{ data: auth }, { data: integ }] = await Promise.all([
      sb.from("field_authority_config").select("entity, field, priority").eq("organization_id", orgId),
      sb.from("integrations").select("provider").eq("organization_id", orgId).eq("is_active", true),
    ]);
    for (const r of (auth ?? []) as { entity: string; field: string; priority: string[] }[]) {
      authority.set(`${r.entity}.${r.field}`, Array.isArray(r.priority) ? r.priority : []);
    }
    for (const i of (integ ?? []) as { provider: string }[]) connectedLabels.add(providerLabel(i.provider));
  } catch {
    /* table absente / erreur → autorité vide (comportement dernier-écrit-gagne) */
  }
  const value: Loaded = { authority, connectedLabels };
  _cache.set(orgId, { value, at: Date.now() });
  return value;
}

/**
 * `true` si `sourceKey` peut écraser (entity.field). `false` = ne remplir que
 * si le champ est vide. Cached 60 s par org.
 */
export async function sourceWinsField(
  sb: SupabaseClient,
  orgId: string,
  entity: string,
  field: string,
  sourceKey: string,
): Promise<boolean> {
  const { authority, connectedLabels } = await load(sb, orgId);
  const order = authority.get(`${entity}.${field}`);
  if (!order || order.length === 0) return true; // pas de règle → écrase
  const srcLabel = providerLabel(sourceKey);
  const rankedConnected = order.filter((l) => connectedLabels.has(l));
  const top = rankedConnected[0] ?? order[0];
  return srcLabel === top;
}
