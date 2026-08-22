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
import { fetchDealsPipelines } from "@/lib/integrations/hubspot-snapshot";
import { loadIdentifierAccessor } from "@/lib/integrations/sync/field-mapping";
import { hubFetch } from "@/lib/integrations/hub-fetch";

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
      const res = await hubFetch(`${HS_API}${path}`, {
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
    // Dates d'ENTRÉE dans chaque lifecycle stage — socle de la page Alignement
    // (temps moyen par étape, délai MQL → deal). Sans elles, aucun calcul de
    // vélocité n'est possible : le snapshot ne donne que des stocks instantanés.
    "hs_v2_date_entered_lead",
    "hs_v2_date_entered_marketingqualifiedlead",
    "hs_v2_date_entered_salesqualifiedlead",
    "hs_v2_date_entered_opportunity",
    "hs_v2_date_entered_customer",
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
  extraProperties: string[] = [],
): Promise<{ records: Array<Record<string, unknown>>; latest: string | null }> {
  // Dédup par id : les fenêtres chaînées (voir plus bas) se recouvrent
  // volontairement sur la date frontière (GTE), l'upsert derrière est idempotent
  // mais on évite quand même les doublons dans le tableau retourné.
  const byId = new Map<string, Record<string, unknown>>();
  let latest = watermark;
  const properties = [...new Set([...getProperties(type), ...extraProperties])];

  // Filter delta : hs_lastmodifieddate > watermark (sinon full)
  const watermarkProp = type === "companies" || type === "deals" || type === "tickets"
    ? "hs_lastmodifieddate"
    : "lastmodifieddate";

  // ⚠ L'API Search HubSpot est PLAFONNÉE à 10 000 résultats par requête
  // (le paging s'arrête net à offset 10 000). Pour les portails plus gros,
  // on enchaîne des « fenêtres » triées par date de modif croissante :
  // quand une fenêtre sature, la suivante repart de la plus grande date vue
  // (GTE + dédup pour ne pas perdre les ex æquo à la frontière). Sans ça,
  // un full sync tronquait à 10 000 et la purge d'orphelins supprimait le
  // reste des enregistrements locaux.
  let windowFloor = watermark;
  let firstWindow = true;
  for (let window = 0; window < 50; window++) {
    let after: string | undefined;
    let capped = false;
    const sizeBefore = byId.size;

    for (let batch = 0; batch < 100; batch++) {
      const body: Record<string, unknown> = {
        filterGroups: windowFloor
          ? [{ filters: [{ propertyName: watermarkProp, operator: firstWindow ? "GT" : "GTE", value: new Date(windowFloor).getTime().toString() }] }]
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

      for (const r of results) {
        byId.set(r.id as string, r);
        const props = (r.properties as Record<string, string | null>) ?? {};
        const mod = props[watermarkProp];
        if (mod && (!latest || new Date(mod) > new Date(latest))) latest = mod;
      }

      after = data.paging?.next?.after;
      if (!after) break;
      if (Number(after) >= 10_000 - PAGE_SIZE + 1) {
        capped = true; // prochaine page franchirait le plafond → nouvelle fenêtre
        break;
      }
    }

    // Sortie de boucle avec de la pagination restante (plafond atteint ou
    // limite de batchs) → il reste des enregistrements : nouvelle fenêtre.
    if (after) capped = true;

    // Fenêtre épuisée naturellement → tout est lu. Sinon on repart de la
    // plus grande date vue ; si plus rien de neuf (ou pas de date exploitable),
    // on s'arrête pour éviter une boucle infinie.
    if (!capped) break;
    if (byId.size === sizeBefore || !latest || latest === windowFloor) break;
    windowFloor = latest;
    firstWindow = false;
  }

  return { records: [...byId.values()], latest };
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
  // Stages « atteints » pour dériver is_mql / is_sql même sans date d'entrée
  // (contact passé MQL avant l'activation du tracking des dates).
  const MQL_REACHED = new Set(["marketingqualifiedlead", "salesqualifiedlead", "opportunity", "customer", "evangelist"]);
  const SQL_REACHED = new Set(["salesqualifiedlead", "opportunity", "customer", "evangelist"]);

  const rowsRaw = records.map((r) => {
    const props = (r.properties as Record<string, string | null>) ?? {};
    const first = pStr(props, "firstname");
    const last = pStr(props, "lastname");
    const fullName = [first, last].filter(Boolean).join(" ").trim() || null;
    const stage = pStr(props, "lifecyclestage");
    const mqlDate = pDate(props, "hs_v2_date_entered_marketingqualifiedlead");
    const sqlDate = pDate(props, "hs_v2_date_entered_salesqualifiedlead");
    return {
      organization_id: orgId,
      hubspot_id: r.id as string,
      email: pStr(props, "email"),
      full_name: fullName,
      phone: pStr(props, "phone"),
      title: pStr(props, "jobtitle"),
      // Colonnes lifecycle (migration 20260725000001) — sémantique « a atteint
      // le stade » : la date d'entrée fait foi, le stage courant sert de repli.
      lifecycle_stage: stage,
      hs_created_at: pDate(props, "createdate"),
      lead_date: pDate(props, "hs_v2_date_entered_lead"),
      mql_date: mqlDate,
      sql_date: sqlDate,
      opportunity_date: pDate(props, "hs_v2_date_entered_opportunity"),
      customer_date: pDate(props, "hs_v2_date_entered_customer"),
      is_mql: Boolean(mqlDate) || (stage ? MQL_REACHED.has(stage) : false),
      is_sql: Boolean(sqlDate) || (stage ? SQL_REACHED.has(stage) : false),
      raw_data: r,
      hs_last_modified_at: pDate(props, "lastmodifieddate"),
    };
  });
  const rows = dedupeByKey(rowsRaw, (r) => r.hubspot_id);
  // Migration lifecycle pas encore appliquée → on retente sans ces colonnes
  // (la sync ne doit jamais casser sur un déploiement avant migration).
  const LIFECYCLE_COLS = ["lifecycle_stage", "hs_created_at", "lead_date", "mql_date", "sql_date", "opportunity_date", "customer_date"] as const;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    let { error, count } = await supabase
      .from("contacts")
      .upsert(chunk, { onConflict: "organization_id,hubspot_id", count: "exact" });
    if (error && /column/i.test(error.message)) {
      const bare = chunk.map((row) => {
        const copy: Record<string, unknown> = { ...row };
        for (const col of LIFECYCLE_COLS) delete copy[col];
        return copy;
      });
      ({ error, count } = await supabase
        .from("contacts")
        .upsert(bare, { onConflict: "organization_id,hubspot_id", count: "exact" }));
    }
    if (error) throw new Error(`Upsert contacts: ${error.message}`);
    upserted += count ?? chunk.length;
  }
  return upserted;
}

/**
 * Déduplique un lot par clé (garde la dernière occurrence). Évite l'erreur
 * Postgres « ON CONFLICT DO UPDATE command cannot affect row a second time »
 * quand HubSpot renvoie un même id deux fois dans un lot (pagination, doublons).
 */
function dedupeByKey<T>(rows: T[], key: (r: T) => string): T[] {
  const map = new Map<string, T>();
  for (const r of rows) map.set(key(r), r);
  return [...map.values()];
}

/**
 * Propriétés HubSpot mappées sur les « ID de rapprochement » (Paramètres →
 * Modèle de données). Le CRM peut en porter plusieurs — un par outil relié
 * (custom_id, custom_id_2…). Vide si rien n'est mappé ; seuls les noms
 * internes valides sont retenus.
 */
async function loadCustomIdProperties(supabase: SupabaseClient, orgId: string): Promise<string[]> {
  try {
    const accessor = await loadIdentifierAccessor(supabase, orgId, "hubspot");
    const props = Object.entries(accessor.paths)
      .filter(([field]) => /^custom_id(_\d+)?$/.test(field))
      .map(([, path]) => path)
      .filter((p): p is string => !!p && /^[a-z0-9_]+$/i.test(p));
    return [...new Set(props)];
  } catch {
    return [];
  }
}

/**
 * Propriétés des COHORTES mappées (Paramètres → Cohortes) portées par l'objet
 * SYNCHRONISÉ (companies / contacts / deals) : demandées à l'API pour que
 * leurs valeurs arrivent dans le raw_data de l'objet — c'est là que le filtre
 * et la dimension cohorte des rapports les lisent. Objet vide (legacy) →
 * companies.
 */
async function loadCohortProperties(supabase: SupabaseClient, orgId: string, type: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("cohort_mappings")
      .select("mappings")
      .eq("organization_id", orgId)
      .maybeSingle();
    const mappings = Array.isArray(data?.mappings)
      ? (data.mappings as Array<{ api_name?: string; object?: string }>)
      : [];
    const props = mappings
      .filter((m) => (m.object && ["companies", "contacts", "deals"].includes(m.object) ? m.object : "companies") === type)
      .map((m) => (m.api_name ?? "").trim())
      .filter((p) => p && /^[a-z0-9_]+$/i.test(p));
    return [...new Set(props)];
  } catch {
    return [];
  }
}

type ContractProps = { start: string | null; end: string | null };

/**
 * Propriétés de DATES DE CONTRAT mappées (Paramètres → Modèle de données) —
 * multi-objet : le nom de la propriété custom diffère chez chaque client, et
 * la date peut vivre sur la Company ET/OU le Deal. Alimente le radar de
 * facturation Trésorerie. Vide si rien n'est mappé.
 */
async function loadContractProperties(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ company: ContractProps; deal: ContractProps }> {
  const empty = { company: { start: null, end: null }, deal: { start: null, end: null } };
  try {
    type Row = { canonical_field: string; provider_field: string; object_type?: string | null };
    const fields = ["contract_start", "contract_end", "deal_contract_start", "deal_contract_end"];
    const first = await supabase
      .from("identifier_field_mapping")
      .select("canonical_field, provider_field, object_type")
      .eq("organization_id", orgId)
      .eq("provider", "hubspot")
      .in("canonical_field", fields);
    let raw: unknown = first.data;
    // Migration object_type pas encore appliquée : re-lecture sans la colonne.
    if (first.error && /object_type/.test(first.error.message)) {
      const fallback = await supabase
        .from("identifier_field_mapping")
        .select("canonical_field, provider_field")
        .eq("organization_id", orgId)
        .eq("provider", "hubspot")
        .in("canonical_field", fields);
      raw = fallback.data;
    }
    const out: { company: ContractProps; deal: ContractProps } = {
      company: { start: null, end: null },
      deal: { start: null, end: null },
    };
    for (const r of (raw ?? []) as Row[]) {
      const prop = r.provider_field?.trim();
      if (!prop || !/^[a-z0-9_]+$/i.test(prop)) continue;
      // L'objet CHOISI (sélecteur) décide du porteur ; les anciens mappings
      // deal_contract_* restent lus comme des dates de deal.
      const isDeal = r.object_type === "deals" || r.canonical_field.startsWith("deal_");
      const bucket = isDeal ? out.deal : out.company;
      if (r.canonical_field.endsWith("contract_start")) bucket.start = prop;
      else bucket.end = prop;
    }
    return out;
  } catch {
    return empty;
  }
}

/**
 * Écrit les dates de contrat mappées — à part, résilient : uniquement les
 * records où la propriété est renseignée (jamais d'écrasement par du vide),
 * et une migration non appliquée ne casse pas la sync.
 */
async function upsertContractDates(
  supabase: SupabaseClient,
  orgId: string,
  table: "companies" | "deals",
  records: Array<Record<string, unknown>>,
  contract: ContractProps,
): Promise<void> {
  if (!contract.start && !contract.end) return;
  const rows = dedupeByKey(records, (r) => r.id as string)
    .map((r) => {
      const props = (r.properties as Record<string, string | null>) ?? {};
      const start = contract.start ? pDate(props, contract.start) : null;
      const end = contract.end ? pDate(props, contract.end) : null;
      return {
        organization_id: orgId,
        hubspot_id: r.id as string,
        ...(start ? { contract_start: start.split("T")[0] } : {}),
        ...(end ? { contract_end: end.split("T")[0] } : {}),
      };
    })
    .filter((r) => "contract_start" in r || "contract_end" in r);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(i, i + 500), { onConflict: "organization_id,hubspot_id" });
    if (error) return; // colonnes absentes (migration non appliquée) → on n'insiste pas
  }
}

async function upsertCompanies(
  supabase: SupabaseClient,
  orgId: string,
  records: Array<Record<string, unknown>>,
  customIdProps: string[] = [],
): Promise<number> {
  if (records.length === 0) return 0;
  const rowsRaw = records.map((r) => {
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
  const rows = dedupeByKey(rowsRaw, (r) => r.hubspot_id);
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error, count } = await supabase
      .from("companies")
      .upsert(chunk, { onConflict: "organization_id,hubspot_id", count: "exact" });
    if (error) throw new Error(`Upsert companies: ${error.message}`);
    upserted += count ?? chunk.length;
  }

  // IDs de rapprochement : écrits à part, uniquement pour les records où au
  // moins une propriété mappée est renseignée — jamais d'écrasement par du
  // vide, et un échec (migration non appliquée) ne casse pas la sync.
  // custom_id garde la première valeur (compat mono-ID) ; custom_ids porte
  // toutes les valeurs normalisées (lowercase) pour le match multi-outils.
  if (customIdProps.length > 0) {
    const cidRows = dedupeByKey(records, (r) => r.id as string)
      .map((r) => {
        const props = (r.properties as Record<string, string | null>) ?? {};
        const vals = customIdProps
          .map((p) => pStr(props, p))
          .filter((v): v is string => !!v);
        return {
          organization_id: orgId,
          hubspot_id: r.id as string,
          custom_id: vals[0] ?? null,
          custom_ids: [...new Set(vals.map((v) => v.trim().toLowerCase()))],
        };
      })
      .filter((r) => r.custom_id);
    for (let i = 0; i < cidRows.length; i += 500) {
      const chunk = cidRows.slice(i, i + 500);
      const { error } = await supabase
        .from("companies")
        .upsert(chunk, { onConflict: "organization_id,hubspot_id" });
      // Migration companies.custom_ids pas encore appliquée → retente sans la colonne.
      if (error) {
        await supabase
          .from("companies")
          .upsert(chunk.map(({ custom_ids: _c, ...rest }) => rest), { onConflict: "organization_id,hubspot_id" });
      }
    }
  }
  return upserted;
}

/**
 * Synchronise la table de correspondance RÉELLE des étapes de pipeline depuis
 * HubSpot (pipeline_stages enrichi avec external_id), et renvoie la map
 * external_id → stage_id (uuid) pour lier les deals. Résilient : si la migration
 * n'est pas appliquée, renvoie une map vide (aucune régression).
 */
async function syncPipelineStages(
  token: string,
  supabase: SupabaseClient,
  orgId: string,
): Promise<Record<string, string>> {
  try {
    const pipelines = await fetchDealsPipelines(token);
    const rows = dedupeByKey(
      pipelines.flatMap((p) =>
        p.stages.map((s) => ({
          organization_id: orgId,
          external_id: s.id,
          pipeline_external_id: p.id,
          pipeline_name: p.label,
          name: s.label,
          position: s.displayOrder,
          probability: s.probability,
          is_closed_won: s.closedWon,
          is_closed_lost: s.closedLost,
        })),
      ),
      (r) => r.external_id,
    );
    if (rows.length > 0) {
      const { error } = await supabase
        .from("pipeline_stages")
        .upsert(rows, { onConflict: "organization_id,external_id" });
      // On reste résilient (pas de régression du sync deals), mais on ne fait
      // PLUS disparaître l'échec : un mapping vide dégrade silencieusement tout
      // ce qui dépend des étapes/pipelines réels (alertes chirurgicales, KPI).
      // Cas déjà vu en prod : 42P10 quand l'index unique est partiel.
      if (error) {
        console.error(
          `[etl] syncPipelineStages: upsert pipeline_stages impossible (org ${orgId}) — ` +
            `mapping des étapes NON écrit, deals.stage_id restera null. ` +
            `${error.code ?? ""} ${error.message}`,
        );
        return {};
      }
    }
    const { data } = await supabase
      .from("pipeline_stages")
      .select("id, external_id")
      .eq("organization_id", orgId);
    const map: Record<string, string> = {};
    for (const r of (data ?? []) as Array<{ id: string; external_id: string | null }>) {
      if (r.external_id) map[r.external_id] = r.id;
    }
    return map;
  } catch (e) {
    console.error(
      `[etl] syncPipelineStages: échec inattendu (org ${orgId}) — mapping des étapes NON écrit. ` +
        (e instanceof Error ? e.message : String(e)),
    );
    return {};
  }
}

async function upsertDeals(
  supabase: SupabaseClient,
  orgId: string,
  records: Array<Record<string, unknown>>,
  stageIdByExternal: Record<string, string> = {},
): Promise<number> {
  if (records.length === 0) return 0;
  const rowsRaw = records.map((r) => {
    const props = (r.properties as Record<string, string | null>) ?? {};
    const isClosed = pStr(props, "hs_is_closed") === "true";
    const isWon = pStr(props, "hs_is_closed_won") === "true";
    const closeDate = pDate(props, "closedate");
    const stageExt = pStr(props, "dealstage");
    return {
      organization_id: orgId,
      hubspot_id: r.id as string,
      name: pStr(props, "dealname"),
      pipeline_external_id: pStr(props, "pipeline"),
      stage_external_id: stageExt,
      // Correspondance RÉELLE (jamais devinée) vers pipeline_stages.
      stage_id: stageExt && stageIdByExternal[stageExt] ? stageIdByExternal[stageExt] : null,
      amount: pNum(props, "amount") || null,
      close_date: closeDate ? closeDate.split("T")[0] : null, // date only
      // VRAIE date de création HubSpot (avant : created_date restait au défaut
      // CURRENT_DATE du premier sync → cycle de vente faussé).
      created_date: pDate(props, "createdate")?.split("T")[0] ?? null,
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
  const rows = dedupeByKey(rowsRaw, (r) => r.hubspot_id);
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
  const rowsRaw = records.map((r) => {
    const props = (r.properties as Record<string, string | null>) ?? {};
    return {
      organization_id: orgId,
      hubspot_id: r.id as string,
      subject: pStr(props, "subject"),
      // status + primary_source NOT NULL : status dérivé de la date de
      // fermeture (hs_pipeline_stage n'est qu'un id numérique, illisible dans
      // les regroupements) ; la source est hubspot par définition ici.
      status: pDate(props, "hs_lastclosedate") ? "closed" : "open",
      primary_source: "hubspot",
      priority: pStr(props, "hs_ticket_priority"),
      owner_id: pStr(props, "hubspot_owner_id"),
      closed_at: pDate(props, "hs_lastclosedate"),
      raw_data: r,
      hs_last_modified_at: pDate(props, "hs_lastmodifieddate"),
      updated_at: new Date().toISOString(),
    };
  });
  const rows = dedupeByKey(rowsRaw, (r) => r.hubspot_id);
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
    // Ne compte QUE les rows HubSpot-sourced (avec hubspot_id) pour matcher la
    // sémantique de countHubspot. Sinon les seed/démo sans hubspot_id polluent
    // le drift sur des orgs qui mélangent données seed + sync HubSpot.
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("hubspot_id", "is", null);
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
    // IDs de rapprochement mappés (companies) + dates de contrat mappées
    // (companies/deals) : les propriétés doivent être demandées à l'API
    // HubSpot pour apparaître dans les payloads.
    const customIdProps = type === "companies" ? await loadCustomIdProperties(supabase, orgId) : [];
    // Cohortes mappées : valeurs embarquées dans le raw_data de LEUR objet
    // (companies, contacts, deals) — filtres/dimensions cohorte des rapports.
    const cohortProps = ["companies", "contacts", "deals"].includes(type)
      ? await loadCohortProperties(supabase, orgId, type)
      : [];
    const contractProps = type === "companies" || type === "deals"
      ? await loadContractProperties(supabase, orgId)
      : null;
    const contractForType: ContractProps = type === "companies"
      ? contractProps?.company ?? { start: null, end: null }
      : type === "deals"
        ? contractProps?.deal ?? { start: null, end: null }
        : { start: null, end: null };
    const contractExtra = [contractForType.start, contractForType.end].filter((p): p is string => !!p);
    const { records, latest } = await syncViaSearch(token, type, watermark, [...customIdProps, ...cohortProps, ...contractExtra]);

    let upserted = 0;
    if (type === "contacts") upserted = await upsertContacts(supabase, orgId, records);
    else if (type === "companies") {
      upserted = await upsertCompanies(supabase, orgId, records, customIdProps);
      await upsertContractDates(supabase, orgId, "companies", records, contractForType);
    } else if (type === "deals") {
      // On rafraîchit d'abord la table de correspondance des étapes (pipeline_stages)
      // pour lier deals.stage_id sur des noms d'étapes RÉELS, jamais devinés.
      const stageMap = await syncPipelineStages(token, supabase, orgId);
      upserted = await upsertDeals(supabase, orgId, records, stageMap);
      await upsertContractDates(supabase, orgId, "deals", records, contractForType);
    } else if (type === "tickets") upserted = await upsertTickets(supabase, orgId, records);

    // Cleanup orphans : uniquement en full sync, où `records` contient tout HubSpot
    let cleaned = 0;
    const hubspotCount = await countHubspot(token, type);
    if (mode === "full") {
      // Garde-fou : ne JAMAIS purger sur un import incomplet (plafond API,
      // erreur partielle…) — sinon on supprime des enregistrements légitimes.
      // Tolérance : total HubSpot qui bouge pendant la lecture (max 1 %, min 10).
      const slack = hubspotCount === null ? 0 : Math.max(10, Math.ceil(hubspotCount * 0.01));
      if (hubspotCount !== null && records.length >= hubspotCount - slack) {
        cleaned = await cleanupCrmOrphans(supabase, orgId, type, records);
      } else {
        console.warn(
          `[sync ${type}] cleanup ignoré : import ${records.length}/${hubspotCount ?? "?"} incomplet`,
        );
      }
    }

    // Recalcule la parité (après cleanup pour être exact)
    const localCount = await countLocal(supabase, orgId, type);
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

// ── Passe de LIAISON : remplit deals.company_id et contacts.company_id ───────
// Sans elle, toute réconciliation CRM↔facturation (jointure sur company_id) est
// morte. Contacts : via la propriété associatedcompanyid. Deals : via l'API
// associations HubSpot v4 (deals → companies). Idempotent, résilient.

/** hubspot_id source → hubspot_id cible (association v4 primaire, batch). */
async function fetchAssociations(
  token: string,
  path: string,
  fromHsIds: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < fromHsIds.length; i += 100) {
    const chunk = fromHsIds.slice(i, i + 100);
    try {
      const res = await hsFetch(token, path, {
        method: "POST",
        body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of (data.results ?? []) as Array<Record<string, unknown>>) {
        const from = (r.from as { id?: string } | undefined)?.id;
        const toArr = (r.to as Array<{ toObjectId?: string | number; id?: string | number }> | undefined) ?? [];
        const to = toArr[0]?.toObjectId ?? toArr[0]?.id;
        if (from && to != null) out[String(from)] = String(to);
      }
    } catch { /* lot ignoré */ }
  }
  return out;
}

/** deal hubspot_id → company hubspot_id (association primaire). */
async function fetchDealCompanyAssociations(token: string, dealHsIds: string[]): Promise<Record<string, string>> {
  return fetchAssociations(token, "/crm/v4/associations/deals/companies/batch/read", dealHsIds);
}

/** deal hubspot_id → contact hubspot_id (association primaire). */
async function fetchDealContactAssociations(token: string, dealHsIds: string[]): Promise<Record<string, string>> {
  return fetchAssociations(token, "/crm/v4/associations/deals/contacts/batch/read", dealHsIds);
}

/** Met à jour company_id par lots, groupés par company canonique. */
async function applyCompanyLinks(
  supabase: SupabaseClient,
  orgId: string,
  table: "contacts" | "deals",
  linkByRowId: Map<string, string>, // rowId (uuid) → canonical company_id
): Promise<number> {
  const byCompany = new Map<string, string[]>();
  for (const [rowId, companyId] of linkByRowId) {
    if (!byCompany.has(companyId)) byCompany.set(companyId, []);
    byCompany.get(companyId)!.push(rowId);
  }
  let updated = 0;
  for (const [companyId, rowIds] of byCompany) {
    for (let i = 0; i < rowIds.length; i += 200) {
      const ids = rowIds.slice(i, i + 200);
      const { error, count } = await supabase
        .from(table)
        .update({ company_id: companyId }, { count: "exact" })
        .eq("organization_id", orgId)
        .in("id", ids);
      if (!error) updated += count ?? ids.length;
    }
  }
  return updated;
}

/**
 * Relie contacts + deals à leur company canonique (company_id). À lancer après
 * la sync CRM (companies déjà en base). Traite les lignes non encore reliées.
 */
export async function linkCompaniesForOrg(
  supabase: SupabaseClient,
  orgId: string,
  token: string,
): Promise<{ contactsLinked: number; dealsLinked: number }> {
  // Map company hubspot_id → uuid canonique.
  const { data: comps } = await supabase.from("companies").select("id, hubspot_id").eq("organization_id", orgId);
  const compByHs = new Map<string, string>();
  for (const c of (comps ?? []) as Array<{ id: string; hubspot_id: string | null }>) {
    if (c.hubspot_id) compByHs.set(String(c.hubspot_id), c.id);
  }
  if (compByHs.size === 0) return { contactsLinked: 0, dealsLinked: 0 };

  // ── Contacts : associatedcompanyid (dans raw_data) → company_id ──
  let contactsLinked = 0;
  for (let page = 0; page < 100; page++) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, acid:raw_data->properties->>associatedcompanyid")
      .eq("organization_id", orgId)
      .is("company_id", null)
      .range(page * 1000, page * 1000 + 999);
    if (error) break;
    const rows = (data ?? []) as Array<{ id: string; acid: string | null }>;
    if (rows.length === 0) break;
    const links = new Map<string, string>();
    for (const r of rows) {
      const cid = r.acid ? compByHs.get(String(r.acid)) : undefined;
      if (cid) links.set(r.id, cid);
    }
    if (links.size > 0) contactsLinked += await applyCompanyLinks(supabase, orgId, "contacts", links);
    if (rows.length < 1000) break;
  }

  // ── Repli ASSOCIATIONS v4 (contacts → companies) : certains portails ne
  // remplissent pas associatedcompanyid alors que l'association « Primary »
  // existe. On collecte d'abord TOUS les contacts non reliés (lecture paginée
  // stable), puis batch v4 par 100 — converge en un run. ──
  const unlinkedContacts: Array<{ id: string; hubspot_id: string }> = [];
  for (let page = 0; page < 100; page++) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, hubspot_id")
      .eq("organization_id", orgId)
      .is("company_id", null)
      .not("hubspot_id", "is", null)
      .order("id")
      .range(page * 1000, page * 1000 + 999);
    if (error) break;
    const rows = (data ?? []) as Array<{ id: string; hubspot_id: string }>;
    unlinkedContacts.push(...rows);
    if (rows.length < 1000) break;
  }
  for (let i = 0; i < unlinkedContacts.length; i += 1000) {
    const slice = unlinkedContacts.slice(i, i + 1000);
    const assoc = await fetchAssociations(
      token,
      "/crm/v4/associations/contacts/companies/batch/read",
      slice.map((r) => r.hubspot_id),
    );
    const links = new Map<string, string>();
    for (const r of slice) {
      const companyHs = assoc[String(r.hubspot_id)];
      const cid = companyHs ? compByHs.get(companyHs) : undefined;
      if (cid) links.set(r.id, cid);
    }
    if (links.size > 0) contactsLinked += await applyCompanyLinks(supabase, orgId, "contacts", links);
  }

  // ── Deals : associations HubSpot → company_id, avec REPLI PAR LE CONTACT ──
  // Certains portails n'associent pas les deals aux entreprises : la chaîne
  // réelle est deal → contact (association v4) → entreprise du contact. On
  // pose aussi deals.contact_id (contact primaire) — c'est lui qui permet
  // d'appliquer les cohortes CONTACT aux tables de deals.
  // Map contact hubspot_id → { id canonique, company_id } (repli + cohortes).
  const contactByHs = new Map<string, { id: string; company_id: string | null }>();
  for (let page = 0; page < 100; page++) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, hubspot_id, company_id")
      .eq("organization_id", orgId)
      .not("hubspot_id", "is", null)
      .range(page * 1000, page * 1000 + 999);
    if (error) break;
    const rows = (data ?? []) as Array<{ id: string; hubspot_id: string; company_id: string | null }>;
    for (const c of rows) contactByHs.set(String(c.hubspot_id), { id: c.id, company_id: c.company_id });
    if (rows.length < 1000) break;
  }

  let dealsLinked = 0;
  // Colonne contact_id récente (migration 20260820000001) : repli sans elle.
  let hasContactCol = true;
  for (let page = 0; page < 100; page++) {
    const { data, error } = await supabase
      .from("deals")
      .select(hasContactCol ? "id, hubspot_id, company_id, contact_id" : "id, hubspot_id, company_id")
      .eq("organization_id", orgId)
      .not("hubspot_id", "is", null)
      .range(page * 500, page * 500 + 499);
    if (error && /contact_id/.test(error.message) && hasContactCol) {
      hasContactCol = false;
      page--;
      continue;
    }
    if (error) break;
    const rows = (data ?? []) as unknown as Array<{ id: string; hubspot_id: string; company_id: string | null; contact_id?: string | null }>;
    if (rows.length === 0) break;
    const todo = rows.filter((r) => !r.company_id || (hasContactCol && !r.contact_id));
    if (todo.length > 0) {
      const hsIds = todo.map((r) => r.hubspot_id);
      const [companyAssoc, contactAssoc] = await Promise.all([
        fetchDealCompanyAssociations(token, todo.filter((r) => !r.company_id).map((r) => r.hubspot_id)),
        hasContactCol ? fetchDealContactAssociations(token, hsIds) : Promise.resolve({} as Record<string, string>),
      ]);
      const companyLinks = new Map<string, string>();
      const contactLinks = new Map<string, string>();
      for (const r of todo) {
        const contact = contactAssoc[String(r.hubspot_id)] ? contactByHs.get(contactAssoc[String(r.hubspot_id)]) : undefined;
        if (hasContactCol && !r.contact_id && contact) contactLinks.set(r.id, contact.id);
        if (!r.company_id) {
          // Association company directe, sinon l'entreprise du contact associé.
          const companyHs = companyAssoc[String(r.hubspot_id)];
          const cid = (companyHs ? compByHs.get(companyHs) : undefined) ?? contact?.company_id ?? undefined;
          if (cid) companyLinks.set(r.id, cid);
        }
      }
      if (companyLinks.size > 0) dealsLinked += await applyCompanyLinks(supabase, orgId, "deals", companyLinks);
      if (contactLinks.size > 0) {
        // Batch par contact (même pattern que applyCompanyLinks).
        const byContact = new Map<string, string[]>();
        for (const [rowId, contactId] of contactLinks) {
          if (!byContact.has(contactId)) byContact.set(contactId, []);
          byContact.get(contactId)!.push(rowId);
        }
        for (const [contactId, rowIds] of byContact) {
          await supabase.from("deals").update({ contact_id: contactId }).eq("organization_id", orgId).in("id", rowIds);
        }
      }
    }
    if (rows.length < 500) break;
  }

  return { contactsLinked, dealsLinked };
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

  // ── AUTO-RÉALIGNEMENT : le delta ne voit jamais les suppressions/fusions
  // faites dans HubSpot (l'API search ne renvoie que les vivants modifiés) —
  // la parité dérive (+N local). Dès qu'un type CRM affiche un drift, on
  // relance IMMÉDIATEMENT sa sync COMPLÈTE (ré-import + purge des orphelins),
  // sans attendre le full hebdomadaire. Auto-limitant : après la purge le
  // drift revient à 0, donc pas de re-déclenchement au run suivant. ──
  if (mode === "delta") {
    try {
      const { data: states } = await supabase
        .from("hubspot_sync_state")
        .select("object_type, parity_drift, last_full_sync_at")
        .eq("organization_id", orgId)
        .in("object_type", crmTypes);
      // Amortisseur : certains portails ont un drift RÉSIDUEL stable (une
      // poignée d'enregistrements invisibles à l'API Search, ex. sans date de
      // modif) qu'aucun full ne résorbera — sans ce garde, on relancerait un
      // full toutes les 30 min pour rien. Un full auto max toutes les 6 h.
      const FULL_COOLDOWN_MS = 6 * 60 * 60 * 1000;
      const drifted = ((states ?? []) as Array<{ object_type: string; parity_drift: number | null; last_full_sync_at: string | null }>)
        .filter((s) => (s.parity_drift ?? 0) !== 0)
        .filter((s) => !s.last_full_sync_at || Date.now() - new Date(s.last_full_sync_at).getTime() > FULL_COOLDOWN_MS)
        .map((s) => s.object_type as "contacts" | "companies" | "deals" | "tickets");
      for (const t of drifted) {
        const idx = crmTypes.indexOf(t);
        const res = await syncCrmObject(token, supabase, orgId, t, "full");
        if (idx >= 0) crmResults[idx] = res;
      }
    } catch {
      /* non bloquant — le full hebdomadaire reste le filet */
    }
  }

  // Passe de liaison : relie contacts + deals à leur company canonique
  // (company_id) — socle de toute réconciliation CRM ↔ facturation.
  try { await linkCompaniesForOrg(supabase, orgId, token); } catch { /* non bloquant */ }

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
