/**
 * HubSpot ELT — coeur du moteur de synchronisation Revold.
 *
 * Responsabilités :
 *   - Pagination cursor-based des objets HubSpot (search + batch read)
 *   - Retry exponentiel sur 429 (lecture du header Retry-After)
 *   - Watermarking : checkpoint hs_lastmodifieddate par org × object_type
 *   - Upsert idempotent dans Supabase (raw_data jsonb + colonnes semantiques)
 *   - Mise à jour de hubspot_sync_state à chaque run
 *
 * Conçu pour tourner :
 *   - en bootstrap (full sync, 1× au connect ou hebdo)
 *   - en delta (toutes les 30 min via cron Vercel)
 *   - en webhook (push individuel, événement par événement)
 *
 * Toutes les fonctions exportées sont idempotentes : appel répété = même
 * état final. Aucune duplication possible (clés uniques au niveau DB).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const HS_API = "https://api.hubapi.com";
const PAGE_SIZE = 100;
const MAX_RETRY = 4;
const BASE_BACKOFF_MS = 500;

// ── Types ────────────────────────────────────────────────────────────────

export type HubspotObjectType =
  | "contacts"
  | "companies"
  | "deals"
  | "tickets"
  | "owners"
  | "pipelines"
  | "workflows"
  | "forms"
  | "lists"
  | "marketing_campaigns"
  | "marketing_events"
  | "invoices"
  | "subscriptions"
  | "quotes"
  | "line_items"
  | "leads"
  | "goals";

export type SyncResult = {
  ok: boolean;
  objectType: HubspotObjectType;
  upserted: number;
  scanned: number;
  /** Nouveau watermark écrit dans sync_state. */
  cursor: string | null;
  durationMs: number;
  /** Records locaux supprimés car absents de HubSpot (mode full uniquement). */
  cleaned?: number;
  error?: string;
};

// ── Fetch HubSpot avec retry exponentiel sur 429 ─────────────────────────

async function hsFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await fetch(`${HS_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
      // 429 → backoff exponentiel + Retry-After si fourni
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const wait = retryAfter
          ? Math.min(parseInt(retryAfter, 10) * 1000, 30_000)
          : BASE_BACKOFF_MS * Math.pow(2, attempt);
        if (attempt < MAX_RETRY) {
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
      }
      // Autres 5xx → backoff aussi
      if (res.status >= 500 && res.status < 600 && attempt < MAX_RETRY) {
        await new Promise((r) => setTimeout(r, BASE_BACKOFF_MS * Math.pow(2, attempt)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err as Error;
      if (attempt < MAX_RETRY) {
        await new Promise((r) => setTimeout(r, BASE_BACKOFF_MS * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr ?? new Error("HubSpot fetch failed after retries");
}

// ── Liste des propriétés à puller par object type ────────────────────────
// On stocke TOUJOURS la totalité du record dans raw_data jsonb (pas de perte).
// Les colonnes semantiques exposées plus bas sont juste pour les queries
// rapides depuis Postgres.

const PROPERTIES_BY_TYPE: Record<string, string[]> = {
  contacts: [
    "firstname",
    "lastname",
    "email",
    "phone",
    "jobtitle",
    "company",
    "lifecyclestage",
    "hs_lead_status",
    "associatedcompanyid",
    "hubspot_owner_id",
    "createdate",
    "lastmodifieddate",
    "hs_object_source",
    "hs_object_source_detail_1",
  ],
  companies: [
    "name",
    "domain",
    "industry",
    "annualrevenue",
    "numberofemployees",
    "hubspot_owner_id",
    "lifecyclestage",
    "createdate",
    "hs_lastmodifieddate",
  ],
  deals: [
    "dealname",
    "pipeline",
    "dealstage",
    "amount",
    "closedate",
    "hubspot_owner_id",
    "hs_is_closed",
    "hs_is_closed_won",
    "hs_time_in_latest_deal_stage",
    "hs_lastmodifieddate",
    "createdate",
    "notes_last_contacted",
    "notes_next_activity_date",
    "num_notes",
    "num_associated_contacts",
  ],
  tickets: [
    "subject",
    "content",
    "hs_pipeline",
    "hs_pipeline_stage",
    "hs_ticket_priority",
    "hubspot_owner_id",
    "createdate",
    "hs_lastmodifieddate",
    "hs_lastclosedate",
  ],
};

function getProperties(type: string): string[] {
  return PROPERTIES_BY_TYPE[type] ?? [];
}

// ── Sync : Search API (contacts/companies/deals/tickets) avec watermark ──

async function syncViaSearch(
  token: string,
  type: "contacts" | "companies" | "deals" | "tickets",
  watermark: string | null,
): Promise<{ records: Array<Record<string, unknown>>; latest: string | null }> {
  const all: Array<Record<string, unknown>> = [];
  let after: string | undefined;
  let latest = watermark;
  const properties = getProperties(type);

  // Filter delta : hs_lastmodifieddate > watermark (sinon full)
  const watermarkProp = type === "companies" || type === "deals" || type === "tickets"
    ? "hs_lastmodifieddate"
    : "lastmodifieddate";

  for (let batch = 0; batch < 100; batch++) {
    const body: Record<string, unknown> = {
      filterGroups: watermark
        ? [{ filters: [{ propertyName: watermarkProp, operator: "GT", value: new Date(watermark).getTime().toString() }] }]
        : [],
      properties,
      sorts: [{ propertyName: watermarkProp, direction: "ASCENDING" }],
      limit: PAGE_SIZE,
    };
    if (after) body.after = after;

    const res = await hsFetch(token, `/crm/v3/objects/${type}/search`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HubSpot ${type} search ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const results = (data.results ?? []) as Array<Record<string, unknown>>;
    if (results.length === 0) break;
    all.push(...results);

    // Update watermark = max hs_lastmodifieddate vu
    for (const r of results) {
      const props = (r.properties as Record<string, string | null>) ?? {};
      const mod = props[watermarkProp];
      if (mod && (!latest || new Date(mod) > new Date(latest))) latest = mod;
    }

    after = data.paging?.next?.after;
    if (!after) break;
  }

  return { records: all, latest };
}

// ── Helpers d'extraction de propriétés ───────────────────────────────────

function pStr(props: Record<string, string | null>, key: string): string | null {
  const v = props[key];
  return v ? v : null;
}
function pNum(props: Record<string, string | null>, key: string): number {
  const v = props[key];
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function pDate(props: Record<string, string | null>, key: string): string | null {
  const v = props[key];
  if (!v) return null;
  // Soit timestamp ms ("1734567890123"), soit ISO
  if (/^\d+$/.test(v)) return new Date(parseInt(v, 10)).toISOString();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Upsert : contacts / companies / deals / tickets ──────────────────────

async function upsertContacts(
  supabase: SupabaseClient,
  orgId: string,
  records: Array<Record<string, unknown>>,
): Promise<number> {
  if (records.length === 0) return 0;
  const rows = records.map((r) => {
    const props = (r.properties as Record<string, string | null>) ?? {};
    const first = pStr(props, "firstname");
    const last = pStr(props, "lastname");
    const fullName = [first, last].filter(Boolean).join(" ").trim() || null;
    return {
      organization_id: orgId,
      hubspot_id: r.id as string,
      email: pStr(props, "email"),
      full_name: fullName,
      phone: pStr(props, "phone"),
      title: pStr(props, "jobtitle"),
      raw_data: r,
      hs_last_modified_at: pDate(props, "lastmodifieddate"),
    };
  });
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error, count } = await supabase
      .from("contacts")
      .upsert(chunk, { onConflict: "organization_id,hubspot_id", count: "exact" });
    if (error) throw new Error(`Upsert contacts: ${error.message}`);
    upserted += count ?? chunk.length;
  }
  return upserted;
}

async function upsertCompanies(
  supabase: SupabaseClient,
  orgId: string,
  records: Array<Record<string, unknown>>,
): Promise<number> {
  if (records.length === 0) return 0;
  const rows = records.map((r) => {
    const props = (r.properties as Record<string, string | null>) ?? {};
    const employees = pNum(props, "numberofemployees");
    return {
      organization_id: orgId,
      hubspot_id: r.id as string,
      name: pStr(props, "name"),
      domain: pStr(props, "domain"),
      industry: pStr(props, "industry"),
      annual_revenue: pNum(props, "annualrevenue") || null,
      employee_count: employees > 0 ? Math.round(employees) : null,
      raw_data: r,
      hs_last_modified_at: pDate(props, "hs_lastmodifieddate"),
      updated_at: new Date().toISOString(),
    };
  });
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error, count } = await supabase
      .from("companies")
      .upsert(chunk, { onConflict: "organization_id,hubspot_id", count: "exact" });
    if (error) throw new Error(`Upsert companies: ${error.message}`);
    upserted += count ?? chunk.length;
  }
  return upserted;
}

async function upsertDeals(
  supabase: SupabaseClient,
  orgId: string,
  records: Array<Record<string, unknown>>,
): Promise<number> {
  if (records.length === 0) return 0;
  const rows = records.map((r) => {
    const props = (r.properties as Record<string, string | null>) ?? {};
    const isClosed = pStr(props, "hs_is_closed") === "true";
    const isWon = pStr(props, "hs_is_closed_won") === "true";
    const closeDate = pDate(props, "closedate");
    return {
      organization_id: orgId,
      hubspot_id: r.id as string,
      name: pStr(props, "dealname"),
      pipeline_external_id: pStr(props, "pipeline"),
      stage_external_id: pStr(props, "dealstage"),
      amount: pNum(props, "amount") || null,
      close_date: closeDate ? closeDate.split("T")[0] : null, // date only
      is_closed_won: isWon,
      is_closed_lost: isClosed && !isWon,
      last_contacted_at: pDate(props, "notes_last_contacted"),
      next_activity_date: pDate(props, "notes_next_activity_date"),
      sales_activities_count: pNum(props, "num_notes") || null,
      associated_contacts_count: pNum(props, "num_associated_contacts") || null,
      raw_data: r,
      hs_last_modified_at: pDate(props, "hs_lastmodifieddate"),
      updated_at: new Date().toISOString(),
    };
  });
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error, count } = await supabase
      .from("deals")
      .upsert(chunk, { onConflict: "organization_id,hubspot_id", count: "exact" });
    if (error) throw new Error(`Upsert deals: ${error.message}`);
    upserted += count ?? chunk.length;
  }
  return upserted;
}

async function upsertTickets(
  supabase: SupabaseClient,
  orgId: string,
  records: Array<Record<string, unknown>>,
): Promise<number> {
  if (records.length === 0) return 0;
  const rows = records.map((r) => {
    const props = (r.properties as Record<string, string | null>) ?? {};
    return {
      organization_id: orgId,
      hubspot_id: r.id as string,
      subject: pStr(props, "subject"),
      priority: pStr(props, "hs_ticket_priority"),
      owner_id: pStr(props, "hubspot_owner_id"),
      closed_at: pDate(props, "hs_lastclosedate"),
      raw_data: r,
      hs_last_modified_at: pDate(props, "hs_lastmodifieddate"),
      updated_at: new Date().toISOString(),
    };
  });
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error, count } = await supabase
      .from("tickets")
      .upsert(chunk, { onConflict: "organization_id,hubspot_id", count: "exact" });
    if (error) throw new Error(`Upsert tickets: ${error.message}`);
    upserted += count ?? chunk.length;
  }
  return upserted;
}

// ── Sync générique pour pipelines / owners / workflows / forms / lists ──
// Stocke dans hubspot_objects (jsonb generic).
//
// Routing HTTP :
//   - /search dans le path → POST (avec body adapté au type)
//   - sinon → GET
// Routing du response shape :
//   - /crm/v3/lists/search → data.lists
//   - sinon → data.results

async function syncGenericList(
  token: string,
  endpoint: string,
  type: HubspotObjectType,
): Promise<Array<Record<string, unknown>>> {
  const isSearchEndpoint = endpoint.includes("/search");
  const isListsEndpoint = endpoint.includes("/lists/search");

  let body: string | undefined;
  if (isSearchEndpoint) {
    if (isListsEndpoint) {
      // Endpoint Lists v3 attend un body spécifique (count + processingTypes)
      body = JSON.stringify({
        count: 100,
        processingTypes: ["MANUAL", "DYNAMIC", "SNAPSHOT"],
      });
    } else {
      // Search standard CRM (invoices, subscriptions, quotes, ...)
      body = JSON.stringify({ filterGroups: [], limit: 100 });
    }
  }

  const res = await hsFetch(token, endpoint, {
    method: isSearchEndpoint ? "POST" : "GET",
    body,
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return []; // scope manquant → skip
    if (res.status === 404 || res.status === 405) return []; // endpoint indisponible → skip
    throw new Error(`HubSpot ${type} ${res.status}`);
  }
  const data = await res.json();
  // Lists endpoint renvoie data.lists, tous les autres data.results
  const records = (isListsEndpoint ? data.lists : data.results) ?? [];
  return records as Array<Record<string, unknown>>;
}

async function upsertGeneric(
  supabase: SupabaseClient,
  orgId: string,
  type: HubspotObjectType,
  records: Array<Record<string, unknown>>,
  idKey = "id",
): Promise<number> {
  if (records.length === 0) return 0;
  const rows = records.map((r) => ({
    organization_id: orgId,
    object_type: type,
    hubspot_id: String(r[idKey] ?? r.id ?? r.pipelineId ?? r.flowId ?? r.workflowId ?? ""),
    raw_data: r,
    hs_last_modified_at: r.updatedAt ? new Date(r.updatedAt as string).toISOString() : null,
    updated_at: new Date().toISOString(),
  })).filter((row) => row.hubspot_id !== "");
  if (rows.length === 0) return 0;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error, count } = await supabase
      .from("hubspot_objects")
      .upsert(chunk, { onConflict: "organization_id,object_type,hubspot_id", count: "exact" });
    if (error) throw new Error(`Upsert ${type}: ${error.message}`);
    upserted += count ?? chunk.length;
  }
  return upserted;
}

// ── État de synchro : helpers ────────────────────────────────────────────

async function getWatermark(
  supabase: SupabaseClient,
  orgId: string,
  type: HubspotObjectType,
): Promise<string | null> {
  const { data } = await supabase
    .from("hubspot_sync_state")
    .select("last_modified_cursor")
    .eq("organization_id", orgId)
    .eq("object_type", type)
    .maybeSingle();
  return (data?.last_modified_cursor as string | null) ?? null;
}

async function writeSyncState(
  supabase: SupabaseClient,
  orgId: string,
  type: HubspotObjectType,
  patch: {
    cursor?: string | null;
    isFullSync?: boolean;
    recordsInSupabase?: number;
    recordsInHubspot?: number;
    parityStatus?: "ok" | "drift" | "syncing" | "error" | "no_scope";
    error?: string | null;
  },
): Promise<void> {
  const row: Record<string, unknown> = {
    organization_id: orgId,
    object_type: type,
    updated_at: new Date().toISOString(),
  };
  if (patch.cursor !== undefined) row.last_modified_cursor = patch.cursor;
  if (patch.isFullSync) row.last_full_sync_at = new Date().toISOString();
  row.last_delta_sync_at = new Date().toISOString();
  if (patch.recordsInSupabase !== undefined) row.records_in_supabase = patch.recordsInSupabase;
  if (patch.recordsInHubspot !== undefined) row.records_in_hubspot = patch.recordsInHubspot;
  if (patch.parityStatus) row.parity_status = patch.parityStatus;
  if (patch.error !== undefined) row.last_error = patch.error;

  await supabase
    .from("hubspot_sync_state")
    .upsert(row, { onConflict: "organization_id,object_type" });
}

async function countLocal(
  supabase: SupabaseClient,
  orgId: string,
  type: HubspotObjectType,
): Promise<number> {
  const tables: Record<string, string> = {
    contacts: "contacts",
    companies: "companies",
    deals: "deals",
    tickets: "tickets",
  };
  const table = tables[type];
  if (table) {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);
    return count ?? 0;
  }
  // Pour les types stockés dans hubspot_objects
  const { count } = await supabase
    .from("hubspot_objects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("object_type", type);
  return count ?? 0;
}

async function countHubspot(
  token: string,
  type: HubspotObjectType,
): Promise<number | null> {
  // Search?limit=1 renvoie .total fiable pour les objets CRM
  const searchable = ["contacts", "companies", "deals", "tickets"];
  if (searchable.includes(type)) {
    try {
      const res = await hsFetch(token, `/crm/v3/objects/${type}/search`, {
        method: "POST",
        body: JSON.stringify({ filterGroups: [], limit: 1 }),
      });
      if (!res.ok) return null;
      const d = await res.json();
      return typeof d.total === "number" ? d.total : null;
    } catch {
      return null;
    }
  }
  return null;
}

// ── Cleanup des orphelins locaux (mode full uniquement) ─────────────────
//
// La full sync HubSpot ramène l'intégralité des records existants. Tout
// record local avec hubspot_id non-null absent de cette liste = supprimé
// ou mergé côté HubSpot → on doit le purger localement (sinon parity drift
// permanent : delta sync ne ramène jamais les deletions).
//
// Les rows sans hubspot_id (seed/démo) sont préservées.
//
// Avant DELETE on nullifie les FK sortantes des autres tables, car le
// schéma initial (initial_schema.sql) n'a pas d'ON DELETE SET NULL sur
// contacts.company_id / deals.company_id / activities.deal_id /
// activities.contact_id / ai_insights.deal_id.

async function cleanupCrmOrphans(
  supabase: SupabaseClient,
  orgId: string,
  type: "contacts" | "companies" | "deals" | "tickets",
  hubspotRecords: Array<Record<string, unknown>>,
): Promise<number> {
  const tables: Record<typeof type, string> = {
    contacts: "contacts",
    companies: "companies",
    deals: "deals",
    tickets: "tickets",
  };
  const table = tables[type];
  const seenIds = new Set(hubspotRecords.map((r) => r.id as string));

  // Pagination obligatoire : Supabase JS limite à 1000 rows par requête
  // (sinon on rate seulement les 1000 premiers contacts pour les gros CRMs)
  const PAGE = 1000;
  const allLocalRows: Array<{ id: string; hubspot_id: string }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("id, hubspot_id")
      .eq("organization_id", orgId)
      .not("hubspot_id", "is", null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Select orphans ${type}: ${error.message}`);
    if (!data || data.length === 0) break;
    allLocalRows.push(...(data as Array<{ id: string; hubspot_id: string }>));
    if (data.length < PAGE) break;
  }

  if (allLocalRows.length === 0) return 0;

  const orphans = allLocalRows.filter(
    (r) => r.hubspot_id && !seenIds.has(r.hubspot_id),
  );
  if (orphans.length === 0) return 0;

  const orphanIds = orphans.map((r) => r.id);

  // Nullifie les FK entrantes (tables qui référencent celle-ci)
  const nullifyFk = async (refTable: string, fkCol: string) => {
    for (let i = 0; i < orphanIds.length; i += 200) {
      const chunk = orphanIds.slice(i, i + 200);
      const { error } = await supabase
        .from(refTable)
        .update({ [fkCol]: null })
        .eq("organization_id", orgId)
        .in(fkCol, chunk);
      if (error) {
        // On continue même si une table optionnelle n'existe pas
        console.warn(`[cleanup ${type}] nullify ${refTable}.${fkCol}: ${error.message}`);
      }
    }
  };

  if (type === "companies") {
    await nullifyFk("contacts", "company_id");
    await nullifyFk("deals", "company_id");
  } else if (type === "contacts") {
    await nullifyFk("activities", "contact_id");
  } else if (type === "deals") {
    await nullifyFk("activities", "deal_id");
    await nullifyFk("ai_insights", "deal_id");
  }

  // Delete par chunks
  let totalDeleted = 0;
  for (let i = 0; i < orphanIds.length; i += 500) {
    const chunk = orphanIds.slice(i, i + 500);
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("organization_id", orgId)
      .in("id", chunk);
    if (error) throw new Error(`Delete orphans ${type}: ${error.message}`);
    totalDeleted += count ?? chunk.length;
  }

  return totalDeleted;
}

// ── Sync principal pour CRM objects (contacts/companies/deals/tickets) ──

export async function syncCrmObject(
  token: string,
  supabase: SupabaseClient,
  orgId: string,
  type: "contacts" | "companies" | "deals" | "tickets",
  mode: "full" | "delta" = "delta",
): Promise<SyncResult> {
  const start = Date.now();
  await writeSyncState(supabase, orgId, type, { parityStatus: "syncing" });

  try {
    const watermark = mode === "full" ? null : await getWatermark(supabase, orgId, type);
    const { records, latest } = await syncViaSearch(token, type, watermark);

    let upserted = 0;
    if (type === "contacts") upserted = await upsertContacts(supabase, orgId, records);
    else if (type === "companies") upserted = await upsertCompanies(supabase, orgId, records);
    else if (type === "deals") upserted = await upsertDeals(supabase, orgId, records);
    else if (type === "tickets") upserted = await upsertTickets(supabase, orgId, records);

    // Cleanup orphans : uniquement en full sync, où `records` contient tout HubSpot
    let cleaned = 0;
    if (mode === "full") {
      cleaned = await cleanupCrmOrphans(supabase, orgId, type, records);
    }

    // Recalcule la parité (après cleanup pour être exact)
    const [localCount, hubspotCount] = await Promise.all([
      countLocal(supabase, orgId, type),
      countHubspot(token, type),
    ]);
    const drift = hubspotCount !== null ? Math.abs(hubspotCount - localCount) : 0;
    const parity = hubspotCount === null ? "unknown" : drift === 0 ? "ok" : "drift";

    await writeSyncState(supabase, orgId, type, {
      cursor: latest,
      isFullSync: mode === "full",
      recordsInSupabase: localCount,
      recordsInHubspot: hubspotCount ?? undefined,
      parityStatus: parity as "ok" | "drift",
      error: null,
    });

    return {
      ok: true,
      objectType: type,
      upserted,
      scanned: records.length,
      cursor: latest,
      durationMs: Date.now() - start,
      cleaned,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isNoScope = /401|403/.test(message);
    await writeSyncState(supabase, orgId, type, {
      parityStatus: isNoScope ? "no_scope" : "error",
      error: message.slice(0, 500),
    });
    return {
      ok: false,
      objectType: type,
      upserted: 0,
      scanned: 0,
      cursor: null,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}

// ── Sync pour les listes "génériques" (pipelines, owners, workflows, forms, lists) ──

export async function syncGenericObject(
  token: string,
  supabase: SupabaseClient,
  orgId: string,
  type: HubspotObjectType,
  endpoint: string,
  options: { idKey?: string } = {},
): Promise<SyncResult> {
  const start = Date.now();
  await writeSyncState(supabase, orgId, type, { parityStatus: "syncing" });
  try {
    const records = await syncGenericList(token, endpoint, type);
    const upserted = await upsertGeneric(supabase, orgId, type, records, options.idKey);
    const localCount = await countLocal(supabase, orgId, type);
    await writeSyncState(supabase, orgId, type, {
      cursor: new Date().toISOString(),
      isFullSync: true,
      recordsInSupabase: localCount,
      recordsInHubspot: records.length,
      parityStatus: records.length === localCount ? "ok" : "drift",
      error: null,
    });
    return {
      ok: true,
      objectType: type,
      upserted,
      scanned: records.length,
      cursor: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isNoScope = /401|403|404/.test(message);
    await writeSyncState(supabase, orgId, type, {
      parityStatus: isNoScope ? "no_scope" : "error",
      error: message.slice(0, 500),
    });
    return {
      ok: false,
      objectType: type,
      upserted: 0,
      scanned: 0,
      cursor: null,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}

// ── Sync workflows AVEC enrichissement détail per-id ─────────────────────
// Stratégie :
//   1. List /automation/v4/flows → tous les workflows (id, name, etc.)
//   2. Pour CHAQUE workflow : tente /v4/flows/{id} puis fallback /v3/workflows/{id}
//   3. Si détail dispo, merge dans raw_data (sinon raw_data garde juste la liste)
//   4. Stocke tout dans hubspot_objects
// Conséquence : la page /process voit tout (33 workflows) avec un maximum
// de détail dispo, sans appel HubSpot live à l'affichage.

async function fetchWorkflowDetail(
  token: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  // Tentative v4 d'abord (Workflows 2.0)
  let detail: Record<string, unknown> | null = null;
  try {
    const res = await hsFetch(token, `/automation/v4/flows/${id}`);
    if (res.ok) {
      const data = await res.json();
      detail = { ...data, _detail_source: "v4" };
    }
  } catch {}
  // Fallback v3 (Classic) si v4 a raté
  if (!detail) {
    try {
      const res = await hsFetch(token, `/automation/v3/workflows/${id}`);
      if (res.ok) {
        const data = await res.json();
        detail = { ...data, _detail_source: "v3" };
      }
    } catch {}
  }
  // Best-effort : on enrichit avec /performance (errors / success counts)
  // Endpoint v3 = /automation/v3/performance/{workflowId} retourne :
  //   { success: number, error: number, queued: number, ... }
  // Marche sur la plupart des workflows (v3 et v4) mais peut renvoyer 404
  // sur certains types custom — on swallow.
  if (detail) {
    try {
      const perfRes = await hsFetch(token, `/automation/v3/performance/${id}`);
      if (perfRes.ok) {
        const perf = await perfRes.json();
        detail._performance = perf;
      }
    } catch {}
  }
  return detail;
}

async function syncWorkflowsEnriched(
  token: string,
  supabase: SupabaseClient,
  orgId: string,
): Promise<SyncResult> {
  const start = Date.now();
  await writeSyncState(supabase, orgId, "workflows", { parityStatus: "syncing" });

  try {
    // 1. List tous les workflows
    const listRes = await hsFetch(token, "/automation/v4/flows?limit=100");
    if (!listRes.ok) {
      throw new Error(`HubSpot workflows list ${listRes.status}`);
    }
    const listData = await listRes.json();
    const baseRecords = (listData.results ?? []) as Array<Record<string, unknown>>;

    // 2. Fetch détail per workflow en parallèle batches de 5 (rate limit safe)
    const enriched: Array<Record<string, unknown>> = [];
    const BATCH = 5;
    for (let i = 0; i < baseRecords.length; i += BATCH) {
      const chunk = baseRecords.slice(i, i + BATCH);
      const details = await Promise.all(
        chunk.map(async (w) => {
          const id = String(w.id ?? "");
          if (!id) return w;
          const detail = await fetchWorkflowDetail(token, id);
          return detail ? { ...w, ...detail } : w;
        }),
      );
      enriched.push(...details);
    }

    // 3. Upsert dans hubspot_objects
    const upserted = await upsertGeneric(supabase, orgId, "workflows", enriched, "id");
    const localCount = await countLocal(supabase, orgId, "workflows");

    await writeSyncState(supabase, orgId, "workflows", {
      cursor: new Date().toISOString(),
      isFullSync: true,
      recordsInSupabase: localCount,
      recordsInHubspot: enriched.length,
      parityStatus: enriched.length === localCount ? "ok" : "drift",
      error: null,
    });

    return {
      ok: true,
      objectType: "workflows",
      upserted,
      scanned: enriched.length,
      cursor: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isNoScope = /401|403|404/.test(message);
    await writeSyncState(supabase, orgId, "workflows", {
      parityStatus: isNoScope ? "no_scope" : "error",
      error: message.slice(0, 500),
    });
    return {
      ok: false,
      objectType: "workflows",
      upserted: 0,
      scanned: 0,
      cursor: null,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}

// ── Orchestration : sync ALL pour une org ────────────────────────────────

export async function syncAllForOrg(
  token: string,
  supabase: SupabaseClient,
  orgId: string,
  mode: "full" | "delta" = "delta",
): Promise<SyncResult[]> {
  // CRM objects (search-based, watermarked)
  const crmTypes: Array<"contacts" | "companies" | "deals" | "tickets"> = [
    "contacts",
    "companies",
    "deals",
    "tickets",
  ];
  const crmResults = await Promise.all(
    crmTypes.map((t) => syncCrmObject(token, supabase, orgId, t, mode)),
  );

  // Workflows : sync enrichi spécifique (list + détail per id)
  const workflowsResult = await syncWorkflowsEnriched(token, supabase, orgId);

  // Generic lists (full chaque fois car généralement < 100 items)
  const generic: Array<{ type: HubspotObjectType; endpoint: string; idKey?: string }> = [
    { type: "pipelines", endpoint: "/crm/v3/pipelines/deals", idKey: "id" },
    { type: "owners", endpoint: "/crm/v3/owners?limit=100", idKey: "id" },
    { type: "forms", endpoint: "/marketing/v3/forms?limit=100", idKey: "id" },
    { type: "lists", endpoint: "/crm/v3/lists/search", idKey: "listId" },
    { type: "marketing_campaigns", endpoint: "/marketing/v3/campaigns?limit=100", idKey: "id" },
    { type: "marketing_events", endpoint: "/marketing/v3/marketing-events?limit=100", idKey: "id" },
    { type: "goals", endpoint: "/crm/v3/objects/goal_targets/search", idKey: "id" },
    { type: "leads", endpoint: "/crm/v3/objects/leads/search", idKey: "id" },
    { type: "invoices", endpoint: "/crm/v3/objects/invoices/search", idKey: "id" },
    { type: "subscriptions", endpoint: "/crm/v3/objects/subscriptions/search", idKey: "id" },
    { type: "quotes", endpoint: "/crm/v3/objects/quotes/search", idKey: "id" },
    { type: "line_items", endpoint: "/crm/v3/objects/line_items/search", idKey: "id" },
  ];

  const genericResults = await Promise.all(
    generic.map((g) => syncGenericObject(token, supabase, orgId, g.type, g.endpoint, { idKey: g.idKey })),
  );

  return [...crmResults, workflowsResult, ...genericResults];
}
