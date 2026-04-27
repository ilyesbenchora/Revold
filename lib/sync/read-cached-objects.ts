/**
 * Helpers de lecture des objets HubSpot mirrorés dans Supabase.
 *
 * Tous les `raw_data jsonb` sont disponibles : on peut lire n'importe
 * quelle propriété HubSpot (native ou custom) sans appel live.
 *
 * Pattern d'utilisation :
 *   const deals = await readDealsFromCache(supabase, orgId);
 *   const owners = await readOwnersMap(supabase, orgId); // hubspot_objects
 *   const stage = readDealProperty(d, "dealstage");
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Type minimal partagé pour tous les objets cache. raw_data est l'objet
 *  complet HubSpot, properties est extraction shortcut. */
export type CachedRow = {
  hubspot_id: string;
  raw_data: { properties?: Record<string, string | null> } & Record<string, unknown>;
};

export function readProp(row: CachedRow, key: string): string | null {
  return row.raw_data?.properties?.[key] ?? null;
}

export function readPropNum(row: CachedRow, key: string): number {
  const v = readProp(row, key);
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function readPropBool(row: CachedRow, key: string): boolean {
  return readProp(row, key) === "true";
}

export function readPropDate(row: CachedRow, key: string): Date | null {
  const v = readProp(row, key);
  if (!v) return null;
  // Soit timestamp ms ("1734567890123"), soit ISO
  if (/^\d+$/.test(v)) return new Date(parseInt(v, 10));
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  orgId: string,
  select: string,
): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq("organization_id", orgId)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    out.push(...(data as unknown as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

// ── CRM objects (contacts / companies / deals / tickets) ────────────────

export type DealCached = CachedRow & {
  amount: number | null;
  is_closed_won: boolean | null;
  is_closed_lost: boolean | null;
  pipeline_external_id: string | null;
  stage_external_id: string | null;
  close_date: string | null;
  hs_last_modified_at: string | null;
};

export async function readDealsFromCache(
  supabase: SupabaseClient,
  orgId: string,
): Promise<DealCached[]> {
  return fetchAll<DealCached>(
    supabase,
    "deals",
    orgId,
    "hubspot_id, raw_data, amount, is_closed_won, is_closed_lost, pipeline_external_id, stage_external_id, close_date, hs_last_modified_at",
  );
}

export type ContactCached = CachedRow & {
  email: string | null;
  full_name: string | null;
  phone: string | null;
  title: string | null;
};

export async function readContactsFromCache(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ContactCached[]> {
  return fetchAll<ContactCached>(
    supabase,
    "contacts",
    orgId,
    "hubspot_id, raw_data, email, full_name, phone, title",
  );
}

export type CompanyCached = CachedRow & {
  name: string | null;
  domain: string | null;
  industry: string | null;
  annual_revenue: number | null;
};

export async function readCompaniesFromCache(
  supabase: SupabaseClient,
  orgId: string,
): Promise<CompanyCached[]> {
  return fetchAll<CompanyCached>(
    supabase,
    "companies",
    orgId,
    "hubspot_id, raw_data, name, domain, industry, annual_revenue",
  );
}

export type TicketCached = CachedRow & {
  subject: string | null;
  priority: string | null;
  closed_at: string | null;
  owner_id: string | null;
};

export async function readTicketsFromCache(
  supabase: SupabaseClient,
  orgId: string,
): Promise<TicketCached[]> {
  return fetchAll<TicketCached>(
    supabase,
    "tickets",
    orgId,
    "hubspot_id, raw_data, subject, priority, closed_at, owner_id",
  );
}

// ── Generic objects (owners, pipelines, workflows, forms, lists, ...) ──

export async function readGenericFromCache(
  supabase: SupabaseClient,
  orgId: string,
  objectType: string,
): Promise<CachedRow[]> {
  const { data } = await supabase
    .from("hubspot_objects")
    .select("hubspot_id, raw_data")
    .eq("organization_id", orgId)
    .eq("object_type", objectType);
  return (data ?? []) as unknown as CachedRow[];
}

export type OwnerInfo = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  teams: string[];
  userId: number | null;
};

export async function readOwnersFromCache(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OwnerInfo[]> {
  const rows = await readGenericFromCache(supabase, orgId, "owners");
  return rows.map((r) => {
    const o = r.raw_data as Record<string, unknown>;
    const firstName = (o.firstName as string) || "";
    const lastName = (o.lastName as string) || "";
    const email = (o.email as string) || "";
    return {
      id: String(o.id ?? r.hubspot_id),
      email,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim() || email || r.hubspot_id,
      teams: ((o.teams as Array<{ name: string }>) ?? []).map((t) => t.name),
      userId: typeof o.userId === "number" ? o.userId : null,
    };
  });
}

export async function readOwnersMapFromCache(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Map<string, string>> {
  const owners = await readOwnersFromCache(supabase, orgId);
  return new Map(owners.map((o) => [o.id, o.fullName]));
}
