import type { SupabaseClient } from "@supabase/supabase-js";
import { hubFetch } from "@/lib/integrations/hub-fetch";
import { readOwnersMapFromCache } from "@/lib/sync/read-cached-objects";
import {
  BRIEF_TEAMS,
  TEAM_BLOCKS,
  periodWindow,
  periodSpoken,
  briefTeamLabel,
  type BriefTeamId,
  type BriefTeamConfig,
  type BriefTeamSettings,
  type BriefPeriod,
  type BriefCustomSuggestion,
  type BriefCrmObject,
} from "@/lib/voice/brief-team";

/**
 * Moteur du brief PERSONNALISÉ par équipe — 100 % DÉTERMINISTE (aucun LLM) :
 * lit les tables canoniques synchronisées (deals, contacts, tickets, factures,
 * abonnements — raw_data pour les propriétés HubSpot natives ou personnalisées)
 * et produit les phrases du brief. Une propriété personnalisée pas encore
 * embarquée par la synchro est lue EN DIRECT dans HubSpot (repli), pour que la
 * validation (« rapprochement ») et le brief donnent des chiffres réels dès la
 * configuration.
 */

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtN = (v: number) => new Intl.NumberFormat("fr-FR").format(v);
const plural = (n: number, s: string, p?: string) => (n > 1 ? (p ?? `${s}s`) : s);
const iso = (d: Date) => d.toISOString();
const isoDay = (d: Date) => {
  // Jour local (YYYY-MM-DD) — les colonnes `date` se comparent en jour.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const NAME_RE = /^[a-z0-9_]+$/i;

type Ctx = {
  supabase: SupabaseClient;
  orgId: string;
  token: string | null;
  now: Date;
  crmLabel: string | null;
  owners: Map<string, string> | null;
  /** Focus sur un utilisateur du CRM (propriétaire) : filtre l'objet indexé. */
  ownerId: string | null;
  /** Objet sur lequel le propriétaire est indexé (le filtre owner ne s'y applique qu'à lui). */
  ownerObject: BriefCrmObject | null;
};

async function ownersOf(ctx: Ctx): Promise<Map<string, string>> {
  if (ctx.owners) return ctx.owners;
  try {
    ctx.owners = await readOwnersMapFromCache(ctx.supabase, ctx.orgId);
  } catch {
    ctx.owners = new Map();
  }
  return ctx.owners;
}
const ownerName = (owners: Map<string, string>, id: string | null | undefined) =>
  (id && owners.get(String(id))) || (id ? "propriétaire inconnu" : "sans propriétaire");

/** Valeur brute d'une propriété HubSpot → Date (timestamp ms ou ISO/jour). */
function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const s = String(v);
  const d = /^\d{10,}$/.test(s) ? new Date(Number(s)) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
const inWindow = (d: Date | null, w: { from: Date; to: Date }) => !!d && d >= w.from && d < w.to;

// ── Pipelines (noms + probabilités d'étape) ─────────────────────────────────
type PipelineMeta = { names: Map<string, string>; stageProb: Map<string, number>; stageClosed: Set<string> };
async function pipelineMeta(ctx: Ctx): Promise<PipelineMeta> {
  const out: PipelineMeta = { names: new Map(), stageProb: new Map(), stageClosed: new Set() };
  try {
    const { data } = await ctx.supabase
      .from("pipeline_stages")
      .select("external_id, pipeline_external_id, pipeline_name, probability, is_closed_won, is_closed_lost")
      .eq("organization_id", ctx.orgId)
      .limit(1000);
    for (const r of (data ?? []) as Array<{
      external_id: string | null; pipeline_external_id: string | null; pipeline_name: string | null;
      probability: number | null; is_closed_won: boolean | null; is_closed_lost: boolean | null;
    }>) {
      if (r.pipeline_external_id && !out.names.has(r.pipeline_external_id)) {
        out.names.set(r.pipeline_external_id, r.pipeline_name || r.pipeline_external_id);
      }
      if (r.external_id) {
        const p = Number(r.probability);
        out.stageProb.set(r.external_id, Number.isFinite(p) ? (p <= 1 ? p * 100 : p) : 0);
        if (r.is_closed_won || r.is_closed_lost) out.stageClosed.add(r.external_id);
      }
    }
  } catch {}
  return out;
}
const pipelineName = (meta: PipelineMeta, id: string | null) => (id && meta.names.get(id)) || "pipeline principal";

// ── Lignes d'entité avec propriétés brutes (raw_data.properties) ────────────
type Row = {
  id: string;
  name: string | null;
  amount: number;
  created: Date | null;
  pipeline: string | null;
  stage: string | null;
  owner: string | null;
  props: Record<string, string | null>;
  /** Colonnes canoniques utiles (close_date, days_in_stage, modified…). */
  closeDate: Date | null;
  daysInStage: number;
  modified: Date | null;
  status: string | null;
  priority: string | null;
};

const ENTITY_TABLE: Record<BriefCrmObject, string> = { deals: "deals", contacts: "contacts", companies: "companies", tickets: "tickets" };
const NATIVE_PROPS: Record<BriefCrmObject, string[]> = {
  deals: ["hubspot_owner_id", "hs_time_in_latest_deal_stage", "dealname"],
  contacts: ["hs_object_source", "lifecyclestage"],
  companies: [],
  tickets: ["hs_time_to_close_sla_status", "hs_time_to_first_response_sla_status", "hs_last_csat_rating", "hubspot_owner_id"],
};

/**
 * Lit les lignes d'un objet CRM (stock ouvert pour deals/tickets ; filtres
 * optionnels) avec les propriétés brutes demandées. Paginé, borné à `max`.
 */
async function fetchRows(
  ctx: Ctx,
  object: BriefCrmObject,
  opts: {
    props?: string[];
    pipelines?: string[];
    openOnly?: boolean;
    /** Filtre jour sur une colonne canonique ([from, to)). */
    dateCol?: { col: string; from: Date; to: Date; asDay?: boolean } | null;
    /** Filtre sur une propriété brute ([from, to) en texte ISO ; ou non nulle). */
    propFilter?: { prop: string; from?: Date; to?: Date; notNull?: boolean } | null;
    /** Colonne `.in(...)`. */
    inCol?: { col: string; values: string[] } | null;
    /** Égalités strictes (colonnes booléennes/texte). */
    eq?: Record<string, string | boolean | number> | null;
    /** Colonne « is null » / « not null ». */
    nullCol?: { col: string; isNull: boolean } | null;
    /** false = ne PAS appliquer le focus « utilisateur » (ctx.ownerId) à cette requête. */
    ownerScope?: boolean;
    max?: number;
  } = {},
): Promise<Row[]> {
  const props = [...new Set([...(opts.props ?? []), ...NATIVE_PROPS[object]])].filter((p) => NAME_RE.test(p));
  const aliases = props.map((p) => `p_${p}:raw_data->properties->>${p}`);
  const base: Record<BriefCrmObject, string> = {
    deals: "id, name, amount, close_date, created_date, pipeline_external_id, stage_external_id, days_in_stage, hs_last_modified_at, is_closed_won, is_closed_lost",
    contacts: "id, full_name, hs_created_at, created_at, lifecycle_stage",
    companies: "id, name, created_at",
    tickets: "id, subject, status, priority, owner_id, opened_at, resolved_at, hs_last_modified_at, updated_at, assignee_email",
  };
  const select = [base[object], ...aliases].join(", ");
  const max = opts.max ?? 4000;
  const out: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; from < max; from += PAGE) {
    let q = ctx.supabase.from(ENTITY_TABLE[object]).select(select).eq("organization_id", ctx.orgId);
    if (object === "deals" && opts.openOnly !== false) q = q.eq("is_closed_won", false).eq("is_closed_lost", false);
    if (object === "tickets" && opts.openOnly !== false) q = q.not("status", "in", "(closed,resolved)");
    if (object === "deals" && opts.pipelines && opts.pipelines.length > 0) q = q.in("pipeline_external_id", opts.pipelines);
    if (opts.dateCol) {
      const f = opts.dateCol.asDay ? isoDay(opts.dateCol.from) : iso(opts.dateCol.from);
      const t = opts.dateCol.asDay ? isoDay(opts.dateCol.to) : iso(opts.dateCol.to);
      q = q.gte(opts.dateCol.col, f).lt(opts.dateCol.col, t);
    }
    if (opts.propFilter && NAME_RE.test(opts.propFilter.prop)) {
      const col = `raw_data->properties->>${opts.propFilter.prop}`;
      if (opts.propFilter.notNull) q = q.not(col, "is", null);
      // Comparaison texte : les dates HubSpot sont ISO (jour ou horodatage),
      // donc l'ordre lexicographique suit l'ordre chronologique.
      if (opts.propFilter.from) q = q.gte(col, isoDay(opts.propFilter.from));
      if (opts.propFilter.to) q = q.lt(col, isoDay(opts.propFilter.to));
    }
    if (opts.inCol) q = q.in(opts.inCol.col, opts.inCol.values);
    if (opts.eq) for (const [k, v] of Object.entries(opts.eq)) q = q.eq(k, v);
    if (opts.nullCol) q = opts.nullCol.isNull ? q.is(opts.nullCol.col, null) : q.not(opts.nullCol.col, "is", null);
    // Focus « utilisateur » : filtre par propriétaire, UNIQUEMENT sur l'objet
    // sur lequel le owner est indexé (tickets via colonne, deals/contacts via
    // la propriété HubSpot).
    if (ctx.ownerId && ctx.ownerObject === object && opts.ownerScope !== false) {
      if (object === "tickets") q = q.eq("owner_id", ctx.ownerId);
      else if (object === "deals" || object === "contacts") q = q.eq("raw_data->properties->>hubspot_owner_id", ctx.ownerId);
    }
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const r of data as unknown as Array<Record<string, unknown>>) {
      const p: Record<string, string | null> = {};
      for (const k of props) p[k] = (r[`p_${k}`] as string | null | undefined) ?? null;
      out.push({
        id: String(r.id),
        name: (r.name as string) ?? (r.full_name as string) ?? (r.subject as string) ?? null,
        amount: Number(r.amount) || 0,
        created: toDate(r.created_date ?? r.hs_created_at ?? r.opened_at ?? r.created_at),
        pipeline: (r.pipeline_external_id as string) ?? null,
        stage: (r.stage_external_id as string) ?? null,
        owner: (r.owner_id as string) ?? p.hubspot_owner_id ?? null,
        props: p,
        closeDate: toDate(r.close_date),
        daysInStage: Number(r.days_in_stage) || 0,
        modified: toDate(r.hs_last_modified_at ?? r.updated_at),
        status: (r.status as string) ?? null,
        priority: (r.priority as string) ?? null,
      });
    }
    if (data.length < PAGE) break;
  }
  return out;
}

// ── Repli EN DIRECT (HubSpot Search) : propriété pas encore synchronisée ────
type LiveFilter = { propertyName: string; operator: string; value?: string; highValue?: string; values?: string[] };
async function liveSearch(
  ctx: Ctx,
  object: BriefCrmObject,
  filters: LiveFilter[],
  properties: string[],
  max = 200,
): Promise<{ total: number; rows: Row[] }> {
  if (!ctx.token) return { total: 0, rows: [] };
  const rows: Row[] = [];
  let total = 0;
  let after: string | undefined;
  try {
    while (rows.length < max) {
      const res = await hubFetch(`https://api.hubapi.com/crm/v3/objects/${object}/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters }],
          properties: [...new Set([...properties, "amount", "dealname", "subject", "firstname", "lastname", "name", "createdate", "closedate", "pipeline", "dealstage"])],
          limit: Math.min(100, max - rows.length),
          ...(after ? { after } : {}),
        }),
      });
      if (!res.ok) break;
      const d = await res.json();
      total = Number(d.total) || 0;
      for (const r of (d.results ?? []) as Array<{ id: string; properties?: Record<string, string | null> }>) {
        const p = r.properties ?? {};
        rows.push({
          id: r.id,
          name: p.dealname ?? p.subject ?? p.name ?? [p.firstname, p.lastname].filter(Boolean).join(" ") ?? null,
          amount: Number(p.amount) || 0,
          created: toDate(p.createdate),
          pipeline: p.pipeline ?? null,
          stage: p.dealstage ?? null,
          owner: p.hubspot_owner_id ?? null,
          props: p,
          closeDate: toDate(p.closedate),
          daysInStage: 0,
          modified: null,
          status: null,
          priority: null,
        });
      }
      after = d.paging?.next?.after;
      if (!after) break;
    }
  } catch {}
  return { total, rows };
}

/** Filtres « stock ouvert » côté HubSpot (+ focus propriétaire optionnel). */
function liveOpenFilters(object: BriefCrmObject, pipelines: string[], ownerId?: string | null): LiveFilter[] {
  const f: LiveFilter[] = [];
  if (object === "deals") {
    f.push({ propertyName: "hs_is_closed", operator: "EQ", value: "false" });
    if (pipelines.length > 0) f.push({ propertyName: "pipeline", operator: "IN", values: pipelines });
  }
  if (object === "tickets") f.push({ propertyName: "closed_date", operator: "NOT_HAS_PROPERTY" });
  if (ownerId && (object === "deals" || object === "contacts" || object === "tickets")) {
    f.push({ propertyName: "hubspot_owner_id", operator: "EQ", value: ownerId });
  }
  return f;
}

/**
 * Rapprochement d'une propriété : fiches qui la renseignent / total, EN DIRECT
 * dans HubSpot (la synchro n'a peut-être pas encore embarqué la propriété).
 */
export async function propertyCoverage(
  token: string | null,
  object: BriefCrmObject,
  name: string,
): Promise<{ withValue: number; total: number } | null> {
  if (!token || !NAME_RE.test(name)) return null;
  const ctx: Ctx = { supabase: null as unknown as SupabaseClient, orgId: "", token, now: new Date(), crmLabel: null, owners: null, ownerId: null, ownerObject: null };
  const [withValue, all] = await Promise.all([
    liveSearch(ctx, object, [{ propertyName: name, operator: "HAS_PROPERTY" }], [name], 1),
    liveSearch(ctx, object, [{ propertyName: "hs_object_id", operator: "HAS_PROPERTY" }], [], 1),
  ]);
  return { withValue: withValue.total, total: all.total };
}

// ── Blocs VENTES ────────────────────────────────────────────────────────────
function stagnationDays(r: Row, now: Date): number {
  const ms = Number(r.props.hs_time_in_latest_deal_stage ?? 0);
  if (ms > 0) return Math.floor(ms / 86_400_000);
  if (r.daysInStage > 0) return r.daysInStage;
  if (r.modified) return Math.max(0, Math.floor((now.getTime() - r.modified.getTime()) / 86_400_000));
  return 0;
}

/** Date de « fermeture » d'un deal selon la propriété choisie (closedate par défaut). */
function dealCloseDate(r: Row, prop: string | null | undefined): Date | null {
  if (!prop || prop === "closedate") return r.closeDate;
  return toDate(r.props[prop]);
}

/**
 * Clause « — par propriétaire : … » ajoutée à un bloc quand l'option de
 * ventilation est activée. `valueFn` = montant (deals) ou null (comptage seul).
 * Rien si un seul propriétaire (ou aucun) : la ventilation n'apporte rien.
 */
function ownerBreakdownClause(rows: Row[], owners: Map<string, string>, valueFn: ((r: Row) => number) | null): string {
  const by = new Map<string, { n: number; v: number }>();
  for (const r of rows) {
    const k = ownerName(owners, r.owner);
    const cur = by.get(k) ?? { n: 0, v: 0 };
    cur.n += 1;
    cur.v += valueFn ? valueFn(r) : 0;
    by.set(k, cur);
  }
  if (by.size <= 1) return "";
  const top = [...by.entries()].sort((a, b) => (valueFn ? b[1].v - a[1].v : b[1].n - a[1].n)).slice(0, 3);
  const seg = top.map(([k, v]) => (valueFn ? `${k} : ${v.n} pour ${fmtEur(v.v)}` : `${k} : ${v.n}`)).join(" ; ");
  return ` — par propriétaire : ${seg}${by.size > 3 ? ` ; et ${by.size - 3} ${plural(by.size - 3, "autre propriétaire")}` : ""}`;
}

async function salesParts(ctx: Ctx, cfg: BriefTeamConfig): Promise<string[]> {
  const parts: string[] = [];
  const meta = await pipelineMeta(ctx);
  const blocks = cfg.blocks;
  const dateProps = [
    ...new Set(
      Object.values(blocks)
        .map((b) => b.dateProperty)
        .filter((p): p is string => !!p && p !== "closedate"),
    ),
  ];
  const open = await fetchRows(ctx, "deals", { props: dateProps, pipelines: cfg.pipelines, openOnly: true });
  // Table des propriétaires si un bloc doit être ventilé, ou pour « signés par
  // propriétaire ». Cache dans le ctx (un seul accès).
  const ownerBlocks = ["deals_open", "deals_stagnant", "deals_ready", "forecast_weighted"] as const;
  const needOwners = !!blocks.deals_won_by_owner?.enabled || ownerBlocks.some((id) => blocks[id]?.enabled && blocks[id]?.byOwner);
  const owners = needOwners ? await ownersOf(ctx) : new Map<string, string>();
  const where = ctx.crmLabel ? ` dans ${ctx.crmLabel}` : "";
  const scope =
    cfg.pipelines.length === 1
      ? ` sur le pipeline ${pipelineName(meta, cfg.pipelines[0])}`
      : cfg.pipelines.length > 1
        ? ` sur ${cfg.pipelines.length} pipelines`
        : "";

  if (blocks.deals_open?.enabled) {
    const total = open.reduce((s, r) => s + r.amount, 0);
    const byPipe = new Map<string, { n: number; amt: number }>();
    for (const r of open) {
      const k = r.pipeline ?? "";
      const cur = byPipe.get(k) ?? { n: 0, amt: 0 };
      cur.n += 1;
      cur.amt += r.amount;
      byPipe.set(k, cur);
    }
    const detail =
      byPipe.size > 1
        ? ` — ${[...byPipe.entries()]
            .sort((a, b) => b[1].amt - a[1].amt)
            .slice(0, 3)
            .map(([k, v]) => `${pipelineName(meta, k || null)} : ${v.n} pour ${fmtEur(v.amt)}`)
            .join(" ; ")}`
        : "";
    const oc = blocks.deals_open?.byOwner ? ownerBreakdownClause(open, owners, (r) => r.amount) : "";
    parts.push(`${fmtN(open.length)} ${plural(open.length, "deal")} en cours${scope}${where}, ${fmtEur(total)} de pipeline${detail}${oc}.`);
  }

  if (blocks.deals_won_by_owner?.enabled && blocks.deals_won_by_owner.periods.length > 0) {
    for (const period of blocks.deals_won_by_owner.periods) {
      const w = periodWindow(period, ctx.now);
      const won = await fetchRows(ctx, "deals", {
        pipelines: cfg.pipelines,
        openOnly: false,
        eq: { is_closed_won: true },
        dateCol: { col: "close_date", from: w.from, to: w.to, asDay: true },
      });
      if (won.length === 0) {
        parts.push(`Aucun deal signé ${periodSpoken(period)}${scope}.`);
        continue;
      }
      const byOwner = new Map<string, { n: number; amt: number }>();
      for (const r of won) {
        const k = ownerName(owners, r.owner);
        const cur = byOwner.get(k) ?? { n: 0, amt: 0 };
        cur.n += 1;
        cur.amt += r.amount;
        byOwner.set(k, cur);
      }
      const total = won.reduce((s, r) => s + r.amount, 0);
      const top = [...byOwner.entries()].sort((a, b) => b[1].amt - a[1].amt).slice(0, 3);
      parts.push(
        `Signés ${periodSpoken(period)}${scope} : ${won.length} ${plural(won.length, "deal")} pour ${fmtEur(total)} — ${top
          .map(([k, v]) => `${k} : ${v.n} pour ${fmtEur(v.amt)}`)
          .join(" ; ")}${byOwner.size > 3 ? ` ; et ${byOwner.size - 3} ${plural(byOwner.size - 3, "autre propriétaire")}` : ""}.`,
      );
    }
  }

  if (blocks.deals_stagnant?.enabled) {
    const days = blocks.deals_stagnant.days ?? 14;
    const stuck = open
      .map((r) => ({ r, d: stagnationDays(r, ctx.now) }))
      .filter((x) => x.d >= days)
      .sort((a, b) => b.r.amount - a.r.amount);
    if (stuck.length > 0) {
      const amt = stuck.reduce((s, x) => s + x.r.amount, 0);
      const top = stuck.slice(0, 2).map((x) => `${x.r.name ?? "deal sans nom"} (${x.d} jours${x.r.amount ? `, ${fmtEur(x.r.amount)}` : ""})`);
      const oc = blocks.deals_stagnant?.byOwner ? ownerBreakdownClause(stuck.map((x) => x.r), owners, (r) => r.amount) : "";
      parts.push(
        `${stuck.length} ${plural(stuck.length, "deal stagnant")}${scope} : dans la même phase depuis plus de ${days} jours, ${fmtEur(amt)} immobilisés — en premier ${top.join(" et ")}${oc}.`,
      );
    } else {
      parts.push(`Aucun deal stagnant au-delà de ${days} jours dans la même phase${scope}.`);
    }
  }

  const readyLike = async (
    block: "deals_ready" | "forecast_weighted",
    render: (period: BriefPeriod, rows: Row[], live: boolean) => string,
  ) => {
    const b = blocks[block];
    if (!b?.enabled || b.periods.length === 0) return;
    const prop = b.dateProperty ?? null;
    // Propriété personnalisée absente de la synchro → repli direct HubSpot.
    const synced = !prop || prop === "closedate" || open.some((r) => r.props[prop] != null);
    for (const period of b.periods) {
      const w = periodWindow(period, ctx.now);
      let rows: Row[];
      let live = false;
      if (synced) {
        rows = open.filter((r) => inWindow(dealCloseDate(r, prop), w));
      } else {
        live = true;
        const res = await liveSearch(
          ctx,
          "deals",
          [
            ...liveOpenFilters("deals", cfg.pipelines, ctx.ownerObject === "deals" ? ctx.ownerId : null),
            { propertyName: prop!, operator: "BETWEEN", value: String(w.from.getTime()), highValue: String(w.to.getTime() - 1) },
          ],
          [prop!, "hubspot_owner_id"],
          300,
        );
        rows = res.rows;
      }
      parts.push(render(period, rows, live));
    }
  };

  await readyLike("deals_ready", (period, rows) => {
    const prop = blocks.deals_ready?.dateProperty;
    const propLabel = prop && prop !== "closedate" ? cfg.customProperties.find((p) => p.name === prop)?.label ?? prop : "date de fermeture";
    if (rows.length === 0) return `Aucun deal prêt à signer ${periodSpoken(period)}${scope} (${propLabel}).`;
    const amt = rows.reduce((s, r) => s + r.amount, 0);
    const top = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 2).map((r) => `${r.name ?? "deal sans nom"}${r.amount ? ` (${fmtEur(r.amount)})` : ""}`);
    const oc = blocks.deals_ready?.byOwner ? ownerBreakdownClause(rows, owners, (r) => r.amount) : "";
    return `Prêts à signer ${periodSpoken(period)}${scope}, d'après ${propLabel} : ${rows.length} ${plural(rows.length, "deal")} pour ${fmtEur(amt)} — en premier ${top.join(" et ")}${oc}.`;
  });

  await readyLike("forecast_weighted", (period, rows) => {
    const prop = blocks.forecast_weighted?.dateProperty;
    const propLabel = prop && prop !== "closedate" ? cfg.customProperties.find((p) => p.name === prop)?.label ?? prop : "date de fermeture";
    const weighted = rows.reduce((s, r) => s + (r.amount * (r.stage ? meta.stageProb.get(r.stage) ?? 0 : 0)) / 100, 0);
    const gross = rows.reduce((s, r) => s + r.amount, 0);
    if (rows.length === 0) return `Prévision ${periodSpoken(period)}${scope} : aucun deal en cours sur l'échéance (${propLabel}).`;
    const oc = blocks.forecast_weighted?.byOwner
      ? ownerBreakdownClause(rows, owners, (r) => (r.amount * (r.stage ? meta.stageProb.get(r.stage) ?? 0 : 0)) / 100)
      : "";
    return `Prévision pondérée ${periodSpoken(period)}${scope}, d'après ${propLabel} : ${fmtEur(weighted)} attendus sur ${fmtEur(gross)} en jeu (${rows.length} ${plural(rows.length, "deal")}, pondérés par la probabilité d'étape)${oc}.`;
  });

  return parts;
}

// ── Blocs MARKETING ─────────────────────────────────────────────────────────
const SOURCE_LABELS: Record<string, string> = {
  FORM: "formulaires", IMPORT: "imports", API: "API", CRM_UI: "saisie manuelle", INTEGRATION: "intégrations",
  EMAIL_INTEGRATION: "emails", CONVERSATIONS: "conversations", AUTOMATION: "automatisations", MEETINGS: "réunions",
  OFFLINE: "hors ligne", SALES: "ventes", MARKETING: "marketing", WORKFLOWS: "workflows", CHAT: "chat", BOT: "bot",
};
const LIFECYCLE_LABELS: Record<string, string> = {
  subscriber: "abonnés", lead: "leads", marketingqualifiedlead: "MQL", salesqualifiedlead: "SQL",
  opportunity: "opportunités", customer: "clients", evangelist: "ambassadeurs", other: "autres",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countWhere(ctx: Ctx, table: string, apply: (q: any) => any): Promise<number> {
  try {
    let q = apply(ctx.supabase.from(table).select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId));
    // Focus « utilisateur » : uniquement sur l'objet indexé (comme fetchRows).
    if (ctx.ownerId && ctx.ownerObject === table) {
      if (table === "tickets") q = q.eq("owner_id", ctx.ownerId);
      else if (table === "contacts" || table === "deals") q = q.eq("raw_data->properties->>hubspot_owner_id", ctx.ownerId);
    }
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function marketingParts(ctx: Ctx, cfg: BriefTeamConfig): Promise<string[]> {
  const parts: string[] = [];
  const b = cfg.blocks;
  const where = ctx.crmLabel ? ` dans ${ctx.crmLabel}` : "";
  const periodCounts = async (col: string, periods: BriefPeriod[]) =>
    Promise.all(periods.map(async (p) => {
      const w = periodWindow(p, ctx.now);
      return { p, n: await countWhere(ctx, "contacts", (q) => q.gte(col, iso(w.from)).lt(col, iso(w.to))) };
    }));

  if (b.contacts_new?.enabled && b.contacts_new.periods.length > 0) {
    const c = await periodCounts("hs_created_at", b.contacts_new.periods);
    parts.push(`Nouveaux contacts${where} : ${c.map((x) => `${fmtN(x.n)} ${periodSpoken(x.p)}`).join(", ")}.`);
  }
  if (b.mql_new?.enabled && b.mql_new.periods.length > 0) {
    const c = await periodCounts("mql_date", b.mql_new.periods);
    parts.push(`Nouveaux MQL${where} : ${c.map((x) => `${fmtN(x.n)} ${periodSpoken(x.p)}`).join(", ")}.`);
  }
  if (b.sql_new?.enabled && b.sql_new.periods.length > 0) {
    const c = await periodCounts("sql_date", b.sql_new.periods);
    parts.push(`Passages en SQL${where} : ${c.map((x) => `${fmtN(x.n)} ${periodSpoken(x.p)}`).join(", ")}.`);
  }
  if (b.contacts_by_source?.enabled && b.contacts_by_source.periods.length > 0) {
    for (const p of b.contacts_by_source.periods) {
      const w = periodWindow(p, ctx.now);
      const rows = await fetchRows(ctx, "contacts", { dateCol: { col: "hs_created_at", from: w.from, to: w.to }, max: 3000 });
      if (rows.length === 0) {
        parts.push(`Aucun contact créé ${periodSpoken(p)}${where}.`);
        continue;
      }
      const by = new Map<string, number>();
      for (const r of rows) {
        const k = r.props.hs_object_source ?? "";
        by.set(k, (by.get(k) ?? 0) + 1);
      }
      const top = [...by.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 3)
        .map(([k, n]) => `${SOURCE_LABELS[k] ?? (k ? k.toLowerCase() : "source inconnue")} : ${fmtN(n)}`);
      parts.push(`Origine des ${fmtN(rows.length)} contacts créés ${periodSpoken(p)}${where} — ${top.join(" ; ")}.`);
    }
  }
  if (b.lifecycle_stock?.enabled) {
    const stages = ["lead", "marketingqualifiedlead", "salesqualifiedlead", "opportunity", "customer"];
    const counts = await Promise.all(stages.map(async (s) => ({ s, n: await countWhere(ctx, "contacts", (q) => q.eq("lifecycle_stage", s)) })));
    const nonZero = counts.filter((c) => c.n > 0);
    if (nonZero.length > 0) {
      parts.push(`Cycle de vie${where} : ${nonZero.map((c) => `${fmtN(c.n)} ${LIFECYCLE_LABELS[c.s] ?? c.s}`).join(", ")}.`);
    }
  }
  return parts;
}

// ── Blocs SERVICE CLIENT ────────────────────────────────────────────────────
const PRIORITY_LABELS: Record<string, string> = { urgent: "urgents", high: "haute priorité", medium: "priorité moyenne", normal: "priorité normale", low: "basse priorité" };

async function csParts(ctx: Ctx, cfg: BriefTeamConfig): Promise<string[]> {
  const parts: string[] = [];
  const b = cfg.blocks;
  const open = await fetchRows(ctx, "tickets", { openOnly: true, max: 3000 });
  // Outil source des tickets (Zendesk, Intercom, HubSpot…) : nommé dans le brief.
  let toolTxt = "";
  try {
    const { data } = await ctx.supabase.from("tickets").select("primary_source").eq("organization_id", ctx.orgId).limit(200);
    const srcs = [...new Set((data ?? []).map((r) => r.primary_source as string).filter(Boolean))];
    if (srcs.length > 0) toolTxt = ` dans ${srcs.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" et ")}`;
  } catch {}

  if (b.tickets_open?.enabled) {
    if (open.length === 0) parts.push(`Aucun ticket ouvert${toolTxt}.`);
    else {
      const by = new Map<string, number>();
      for (const r of open) by.set((r.priority ?? "").toLowerCase(), (by.get((r.priority ?? "").toLowerCase()) ?? 0) + 1);
      const detail = [...by.entries()].filter(([k]) => k).sort((a, c) => c[1] - a[1]).slice(0, 3)
        .map(([k, n]) => `${n} ${PRIORITY_LABELS[k] ?? k}`).join(", ");
      parts.push(`${fmtN(open.length)} ${plural(open.length, "ticket ouvert")}${toolTxt}${detail ? ` — ${detail}` : ""}.`);
    }
  }
  if (b.tickets_new?.enabled && b.tickets_new.periods.length > 0) {
    const c = await Promise.all(b.tickets_new.periods.map(async (p) => {
      const w = periodWindow(p, ctx.now);
      return { p, n: await countWhere(ctx, "tickets", (q) => q.gte("opened_at", iso(w.from)).lt("opened_at", iso(w.to))) };
    }));
    parts.push(`Nouveaux tickets${toolTxt} : ${c.map((x) => `${fmtN(x.n)} ${periodSpoken(x.p)}`).join(", ")}.`);
  }
  if (b.tickets_resolved_by_owner?.enabled && b.tickets_resolved_by_owner.periods.length > 0) {
    const owners = await ownersOf(ctx);
    for (const p of b.tickets_resolved_by_owner.periods) {
      const w = periodWindow(p, ctx.now);
      const rows = await fetchRows(ctx, "tickets", { openOnly: false, dateCol: { col: "resolved_at", from: w.from, to: w.to }, max: 3000 });
      if (rows.length === 0) {
        parts.push(`Aucun ticket résolu ${periodSpoken(p)}${toolTxt}.`);
        continue;
      }
      const by = new Map<string, number>();
      for (const r of rows) {
        const k = r.owner ? ownerName(owners, r.owner) : "sans propriétaire";
        by.set(k, (by.get(k) ?? 0) + 1);
      }
      const top = [...by.entries()].sort((a, c) => c[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} : ${n}`);
      parts.push(`${fmtN(rows.length)} ${plural(rows.length, "ticket résolu")} ${periodSpoken(p)}${toolTxt} — ${top.join(" ; ")}.`);
    }
  }
  if (b.tickets_stagnant?.enabled) {
    const days = b.tickets_stagnant.days ?? 3;
    const limit = ctx.now.getTime() - days * 86_400_000;
    const stale = open.filter((r) => r.modified && r.modified.getTime() < limit);
    if (stale.length > 0) {
      const top = stale.slice(0, 2).map((r) => r.name ?? "ticket sans objet");
      parts.push(`${stale.length} ${plural(stale.length, "ticket ouvert")} sans mise à jour depuis plus de ${days} jours${toolTxt} — par exemple ${top.join(" et ")}.`);
    } else {
      parts.push(`Aucun ticket ouvert sans mise à jour depuis plus de ${days} jours${toolTxt}.`);
    }
  }
  if (b.tickets_sla?.enabled) {
    const isLate = (v: string | null) => !!v && /OVERDUE|LATE/i.test(v);
    const late = open.filter((r) => isLate(r.props.hs_time_to_close_sla_status) || isLate(r.props.hs_time_to_first_response_sla_status));
    const hasSla = open.some((r) => r.props.hs_time_to_close_sla_status || r.props.hs_time_to_first_response_sla_status);
    if (late.length > 0) parts.push(`${late.length} ${plural(late.length, "ticket ouvert")} hors SLA${toolTxt} (première réponse ou clôture en retard).`);
    else if (hasSla) parts.push(`Aucun ticket ouvert hors SLA${toolTxt}.`);
  }
  if (b.csat?.enabled && b.csat.periods.length > 0) {
    for (const p of b.csat.periods) {
      const w = periodWindow(p, ctx.now);
      const rows = await fetchRows(ctx, "tickets", { openOnly: false, dateCol: { col: "resolved_at", from: w.from, to: w.to }, max: 3000 });
      const rated = rows.map((r) => Number(r.props.hs_last_csat_rating)).filter((n) => Number.isFinite(n) && n > 0);
      if (rated.length > 0) {
        const avg = rated.reduce((s, n) => s + n, 0) / rated.length;
        parts.push(`Satisfaction ${periodSpoken(p)}${toolTxt} : ${avg.toFixed(1).replace(".", ",")} de moyenne sur ${rated.length} ${plural(rated.length, "avis")}.`);
      }
    }
  }
  return parts;
}

// ── Blocs COMPTABILITÉ ──────────────────────────────────────────────────────
async function financeParts(ctx: Ctx, cfg: BriefTeamConfig): Promise<string[]> {
  const parts: string[] = [];
  const b = cfg.blocks;
  type Inv = { amount_total: number; amount_paid: number; amount_due: number; due_at: string | null; primary_source: string | null; status: string | null; deal_id: string | null; companies: { name: string | null } | { name: string | null }[] | null };
  const invoices = async (apply: (q: any) => any, max = 3000): Promise<Inv[]> => { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      const { data } = await apply(
        ctx.supabase.from("invoices").select("amount_total, amount_paid, amount_due, due_at, primary_source, status, deal_id, companies(name)").eq("organization_id", ctx.orgId),
      ).limit(max);
      return (data ?? []) as Inv[];
    } catch {
      return [];
    }
  };
  const srcOf = (rows: Inv[]) => {
    const s = [...new Set(rows.map((r) => r.primary_source).filter((x): x is string => !!x))];
    return s.length > 0 ? ` via ${s.map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(" et ")}` : "";
  };
  const companyName = (r: Inv) => {
    const c = Array.isArray(r.companies) ? r.companies[0] : r.companies;
    return c?.name ?? null;
  };
  const sum = (rows: Inv[], f: (r: Inv) => number) => rows.reduce((s, r) => s + (Number(f(r)) || 0), 0);

  if (b.invoices_issued?.enabled && b.invoices_issued.periods.length > 0) {
    for (const p of b.invoices_issued.periods) {
      const w = periodWindow(p, ctx.now);
      const rows = await invoices((q) => q.gte("issued_at", iso(w.from)).lt("issued_at", iso(w.to)).not("status", "in", "(draft,void)"));
      parts.push(rows.length === 0
        ? `Aucune facture émise ${periodSpoken(p)}.`
        : `Facturé ${periodSpoken(p)}${srcOf(rows)} : ${rows.length} ${plural(rows.length, "facture")} pour ${fmtEur(sum(rows, (r) => r.amount_total))}.`);
    }
  }
  if (b.invoices_paid?.enabled && b.invoices_paid.periods.length > 0) {
    for (const p of b.invoices_paid.periods) {
      const w = periodWindow(p, ctx.now);
      const rows = await invoices((q) => q.gte("paid_at", iso(w.from)).lt("paid_at", iso(w.to)));
      parts.push(rows.length === 0
        ? `Aucun encaissement ${periodSpoken(p)}.`
        : `Encaissé ${periodSpoken(p)}${srcOf(rows)} : ${fmtEur(sum(rows, (r) => r.amount_paid || r.amount_total))} sur ${rows.length} ${plural(rows.length, "facture")}.`);
    }
  }
  if (b.invoices_overdue?.enabled) {
    const rows = await invoices((q) => q.lt("due_at", iso(ctx.now)).gt("amount_due", 0).not("status", "in", "(draft,void,paid)"));
    if (rows.length === 0) parts.push("Aucune facture en retard de paiement.");
    else {
      const byCompany = new Map<string, number>();
      for (const r of rows) {
        const k = companyName(r) ?? "client inconnu";
        byCompany.set(k, (byCompany.get(k) ?? 0) + (Number(r.amount_due) || 0));
      }
      const top = [...byCompany.entries()].sort((a, c) => c[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} (${fmtEur(v)})`);
      parts.push(`${rows.length} ${plural(rows.length, "facture")} en retard${srcOf(rows)}, ${fmtEur(sum(rows, (r) => r.amount_due))} à recouvrer — en premier ${top.join(" et ")}.`);
    }
  }
  if (b.invoices_due?.enabled && b.invoices_due.periods.length > 0) {
    for (const p of b.invoices_due.periods) {
      const w = periodWindow(p, ctx.now);
      const rows = await invoices((q) => q.gte("due_at", iso(w.from)).lt("due_at", iso(w.to)).gt("amount_due", 0).not("status", "in", "(draft,void,paid)"));
      parts.push(rows.length === 0
        ? `Aucune échéance de facture ${periodSpoken(p)}.`
        : `Échéances ${periodSpoken(p)}${srcOf(rows)} : ${rows.length} ${plural(rows.length, "facture")} à encaisser, ${fmtEur(sum(rows, (r) => r.amount_due))}.`);
    }
  }
  if (b.mrr?.enabled) {
    try {
      const { data } = await ctx.supabase.from("subscriptions").select("mrr, primary_source").eq("organization_id", ctx.orgId).eq("status", "active").limit(5000);
      const rows = (data ?? []) as Array<{ mrr: number; primary_source: string | null }>;
      if (rows.length > 0) {
        const mrr = rows.reduce((s, r) => s + (Number(r.mrr) || 0), 0);
        const srcs = [...new Set(rows.map((r) => r.primary_source).filter((x): x is string => !!x))].map((x) => x.charAt(0).toUpperCase() + x.slice(1));
        parts.push(`MRR actif${srcs.length > 0 ? ` via ${srcs.join(" et ")}` : ""} : ${fmtEur(mrr)} sur ${rows.length} ${plural(rows.length, "abonnement")}.`);
      }
    } catch {}
  }
  if (b.deals_won_to_invoice?.enabled && b.deals_won_to_invoice.periods.length > 0) {
    for (const p of b.deals_won_to_invoice.periods) {
      const w = periodWindow(p, ctx.now);
      const won = await fetchRows(ctx, "deals", { openOnly: false, eq: { is_closed_won: true }, dateCol: { col: "close_date", from: w.from, to: w.to, asDay: true } });
      if (won.length === 0) continue;
      let linked = new Set<string>();
      try {
        const { data } = await ctx.supabase.from("invoices").select("deal_id").eq("organization_id", ctx.orgId).in("deal_id", won.map((r) => r.id));
        linked = new Set((data ?? []).map((r) => r.deal_id as string));
      } catch {}
      const missing = won.filter((r) => !linked.has(r.id));
      const amt = missing.reduce((s, r) => s + r.amount, 0);
      parts.push(missing.length === 0
        ? `Tous les deals signés ${periodSpoken(p)} ont une facture rattachée.`
        : `${missing.length} ${plural(missing.length, "deal signé")} ${periodSpoken(p)} sans facture rattachée${ctx.crmLabel ? ` (${ctx.crmLabel})` : ""}, ${fmtEur(amt)} à facturer.`);
    }
  }
  return parts;
}

// ── Suggestions PERSONNALISÉES (propriétés CRM) ─────────────────────────────
export type SuggestionPreview = { sentences: string[]; count: number; total: number | null; live: boolean };

const ENTITY_WORD: Record<BriefCrmObject, [string, string]> = {
  deals: ["deal", "deals"],
  contacts: ["contact", "contacts"],
  companies: ["entreprise", "entreprises"],
  tickets: ["ticket", "tickets"],
};

async function suggestionPreview(ctx: Ctx, cfg: BriefTeamConfig, s: BriefCustomSuggestion): Promise<SuggestionPreview> {
  const [one, many] = ENTITY_WORD[s.object];
  const stock = s.object === "deals" ? "en cours" : s.object === "tickets" ? "ouverts" : "";
  const where = ctx.crmLabel ? ` dans ${ctx.crmLabel}` : "";
  const sentences: string[] = [];
  let count = 0;
  let total: number | null = null;
  let live = false;
  const pipelines = s.object === "deals" ? cfg.pipelines : [];

  /** Lignes porteuses de la propriété (synchro, sinon direct HubSpot). */
  const rowsWith = async (extra: { from?: Date; to?: Date } = {}): Promise<Row[]> => {
    const synced = await fetchRows(ctx, s.object, {
      props: [s.property],
      pipelines,
      openOnly: s.object === "deals" || s.object === "tickets",
      propFilter: { prop: s.property, notNull: true, from: extra.from, to: extra.to },
      max: 3000,
    });
    if (synced.length > 0) return synced;
    // Rien de synchronisé avec cette propriété → lecture directe.
    live = true;
    const filters: LiveFilter[] = [...liveOpenFilters(s.object, pipelines, ctx.ownerObject === s.object ? ctx.ownerId : null)];
    if (extra.from && extra.to) {
      filters.push({ propertyName: s.property, operator: "BETWEEN", value: String(extra.from.getTime()), highValue: String(extra.to.getTime() - 1) });
    } else {
      filters.push({ propertyName: s.property, operator: "HAS_PROPERTY" });
    }
    const res = await liveSearch(ctx, s.object, filters, [s.property, "hubspot_owner_id"], 300);
    total = res.total;
    return res.rows;
  };

  if (s.kind === "date_window") {
    const periods = s.periods.length > 0 ? s.periods : (["this_month"] as BriefPeriod[]);
    for (const p of periods) {
      const w = periodWindow(p, ctx.now);
      const rows = (await rowsWith({ from: w.from, to: w.to })).filter((r) => inWindow(toDate(r.props[s.property]), w));
      count += rows.length;
      if (rows.length === 0) {
        sentences.push(`Aucun ${one} ${stock ? `${stock} ` : ""}dont « ${s.propertyLabel} » tombe ${periodSpoken(p)}${where}.`);
        continue;
      }
      const amt = s.object === "deals" ? rows.reduce((x, r) => x + r.amount, 0) : 0;
      const top = [...rows].sort((a, c) => c.amount - a.amount).slice(0, 2).map((r) => r.name ?? `${one} sans nom`);
      sentences.push(
        `${rows.length} ${rows.length > 1 ? many : one} ${stock ? `${stock} ` : ""}dont « ${s.propertyLabel} » tombe ${periodSpoken(p)}${where}${amt > 0 ? `, ${fmtEur(amt)}` : ""} — en premier ${top.join(" et ")}.`,
      );
    }
    return { sentences, count, total, live };
  }

  const rows = await rowsWith();
  if (s.kind === "breakdown") {
    const by = new Map<string, number>();
    for (const r of rows) {
      const v = (r.props[s.property] ?? "").trim();
      if (v) by.set(v, (by.get(v) ?? 0) + 1);
    }
    count = rows.length;
    if (by.size === 0) sentences.push(`Aucun ${one} ${stock ? `${stock} ` : ""}ne renseigne « ${s.propertyLabel} »${where}.`);
    else {
      const top = [...by.entries()].sort((a, c) => c[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} : ${n}`);
      sentences.push(`${many.charAt(0).toUpperCase() + many.slice(1)} ${stock ? `${stock} ` : ""}par « ${s.propertyLabel} »${where} — ${top.join(" ; ")}${by.size > 4 ? ` ; et ${by.size - 4} autres valeurs` : ""}.`);
    }
  } else if (s.kind === "sum") {
    const vals = rows.map((r) => Number(r.props[s.property])).filter((n) => Number.isFinite(n));
    count = vals.length;
    const totalV = vals.reduce((x, n) => x + n, 0);
    sentences.push(count === 0
      ? `Aucun ${one} ${stock ? `${stock} ` : ""}ne renseigne « ${s.propertyLabel} »${where}.`
      : `Total « ${s.propertyLabel} » des ${many} ${stock ? `${stock} ` : ""}${where} : ${fmtN(Math.round(totalV * 100) / 100)} sur ${count} ${count > 1 ? many : one}.`);
  } else {
    const flagged = rows.filter((r) => r.props[s.property] === "true");
    count = flagged.length;
    sentences.push(count === 0
      ? `Aucun ${one} ${stock ? `${stock} ` : ""}avec « ${s.propertyLabel} » coché${where}.`
      : `${count} ${count > 1 ? many : one} ${stock ? `${stock} ` : ""}avec « ${s.propertyLabel} » coché${where}${s.object === "deals" ? `, ${fmtEur(flagged.reduce((x, r) => x + r.amount, 0))}` : ""}.`);
  }
  return { sentences, count, total, live };
}

// ── Point d'entrée : brief d'équipe ─────────────────────────────────────────
export type TeamBriefResult = { team: BriefTeamId; parts: string[]; label: string };

export function makeCtx(
  supabase: SupabaseClient,
  orgId: string,
  token: string | null,
  crmLabel: string | null,
  now = new Date(),
  ownerId: string | null = null,
  ownerObject: BriefCrmObject | null = null,
): Ctx {
  return { supabase, orgId, token, now, crmLabel, owners: null, ownerId, ownerObject };
}

/** Phrases du brief d'équipe (config de l'équipe active des réglages). */
export async function computeTeamBrief(
  supabase: SupabaseClient,
  orgId: string,
  token: string | null,
  settings: BriefTeamSettings,
  crmLabel: string | null,
  now = new Date(),
): Promise<TeamBriefResult | null> {
  if (!settings.enabled) return null;
  const team = settings.team;
  const cfg = settings.configs[team];
  if (!cfg) return null;
  const ctx = makeCtx(supabase, orgId, token, crmLabel, now, cfg.ownerId ?? null, cfg.ownerObject ?? null);
  let parts: string[] = [];
  try {
    if (team === "sales") parts = await salesParts(ctx, cfg);
    else if (team === "marketing") parts = await marketingParts(ctx, cfg);
    else if (team === "cs") parts = await csParts(ctx, cfg);
    else parts = await financeParts(ctx, cfg);
  } catch {
    parts = [];
  }
  for (const s of cfg.customSuggestions.filter((x) => x.enabled)) {
    try {
      const pv = await suggestionPreview(ctx, cfg, s);
      parts.push(...pv.sentences);
    } catch {}
  }
  // Focus sur un utilisateur : le signaler en tête (une seule fois).
  if (cfg.ownerId && cfg.ownerName && parts.length > 0) {
    parts.unshift(`Brief centré sur ${cfg.ownerName}.`);
  }
  return { team, parts, label: briefTeamLabel(team) };
}

/** Rapprochement d'une suggestion personnalisée : calcul réel AVANT validation. */
export async function previewSuggestion(
  supabase: SupabaseClient,
  orgId: string,
  token: string | null,
  cfg: BriefTeamConfig,
  suggestion: BriefCustomSuggestion,
  crmLabel: string | null,
): Promise<SuggestionPreview> {
  return suggestionPreview(makeCtx(supabase, orgId, token, crmLabel), cfg, suggestion);
}

/** Aperçu complet du brief d'équipe (Paramètres : « Écouter un aperçu »). */
export async function previewTeamBrief(
  supabase: SupabaseClient,
  orgId: string,
  token: string | null,
  settings: BriefTeamSettings,
  crmLabel: string | null,
): Promise<string[]> {
  const res = await computeTeamBrief(supabase, orgId, token, { ...settings, enabled: true }, crmLabel);
  return res?.parts ?? [];
}

/** Libellés utilitaires exportés pour les routes. */
export const TEAM_IDS = BRIEF_TEAMS.map((t) => t.id);
export const BLOCK_DEFS = TEAM_BLOCKS;
