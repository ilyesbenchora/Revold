/**
 * Entity resolution: matches a record from an external source (Stripe customer,
 * Pipedrive contact, …) to an existing canonical Revold contact/company, or
 * creates a new one if no match is found.
 *
 * PILOTÉ PAR LA CONFIG : l'ordre et l'activation des règles de matching sont
 * lus depuis `entity_resolution_config` (page Paramètres → Modèle de données).
 * Si aucune config n'existe pour l'org, on retombe sur un ordre par défaut sûr
 * (SIREN → VAT → domaine) pour ne jamais casser la synchro.
 *
 * Règles disponibles :
 *   Company : siren_match, vat_match, siret_match, domain_match, name_match
 *   Contact : exact_email
 *   (external_id_match = source_links, toujours actif via existing_link)
 *
 * Chaque call écrit une ligne `source_links` → les syncs suivantes sont O(1).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sourceWinsField } from "./field-authority";

export type MatchMethod =
  | "existing_link"
  | "siren"
  | "siret"
  | "vat_number"
  | "exact_email"
  | "domain"
  | "name"
  | "created";

export type ResolvedEntity = {
  id: string;
  matchMethod: MatchMethod;
  matchScore: number; // 0–1
};

type ContactInput = {
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
};

type CompanyInput = {
  name?: string | null;
  domain?: string | null;
  siren?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
};

// ── Normalizers ────────────────────────────────────────────────────────────

function normalizeSiren(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 14) return digits.slice(0, 9);
  if (digits.length === 9) return digits;
  return null;
}

function normalizeVat(raw?: string | null): string | null {
  if (!raw) return null;
  return raw.replace(/[\s\-\.]/g, "").toUpperCase() || null;
}

function normalizeDomain(raw?: string | null): string | null {
  if (!raw) return null;
  let d = raw.toLowerCase().trim();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  return d || null;
}

const LEGAL_SUFFIXES =
  /\b(sasu|sas|sarl|eurl|sci|snc|selarl|scop|sa|gmbh|ltd|llc|inc|corp|co|sl|srl|bv|ab|oy|plc)\b/gi;

/** Nom d'entreprise normalisé (minuscules, sans accents/forme juridique/ponctuation). */
function normalizeName(raw?: string | null): string | null {
  if (!raw) return null;
  const n = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return n || null;
}

export function emailDomain(email?: string | null): string | null {
  if (!email) return null;
  const parts = email.toLowerCase().trim().split("@");
  return parts.length === 2 ? parts[1] : null;
}

const PERSONAL_DOMAINS = new Set([
  "gmail.com", "hotmail.com", "hotmail.fr", "yahoo.com", "yahoo.fr",
  "outlook.com", "outlook.fr", "live.com", "live.fr", "orange.fr",
  "free.fr", "sfr.fr", "wanadoo.fr", "laposte.net", "icloud.com",
  "protonmail.com", "aol.com",
]);

// ── Lookup helpers ─────────────────────────────────────────────────────────

async function findBySourceLink(sb: SupabaseClient, orgId: string, provider: string, externalId: string, entityType: string): Promise<string | null> {
  const { data } = await sb
    .from("source_links")
    .select("internal_id")
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .eq("entity_type", entityType)
    .eq("external_id", externalId)
    .maybeSingle();
  return data?.internal_id ?? null;
}

async function writeSourceLink(sb: SupabaseClient, orgId: string, provider: string, externalId: string, entityType: string, internalId: string, method: MatchMethod, score: number) {
  await sb.from("source_links").upsert(
    {
      organization_id: orgId,
      provider,
      external_id: externalId,
      entity_type: entityType,
      internal_id: internalId,
      match_method: method,
      match_score: score,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider,external_id,entity_type" },
  );
}

// ── Config-driven resolution ───────────────────────────────────────────────

type ResolutionConfig = { company: string[]; contact: string[]; hasConfig: boolean };

const COMPANY_RULE_IDS = ["siren_match", "vat_match", "siret_match", "domain_match", "name_match"];
const CONTACT_RULE_IDS = ["exact_email"];

// Cache mémoire court (60 s) : une sync traite les entités en rafale, on évite
// de requêter la config à chaque entité.
const _cfgCache = new Map<string, { cfg: ResolutionConfig; at: number }>();

async function loadResolutionConfig(sb: SupabaseClient, orgId: string): Promise<ResolutionConfig> {
  const cached = _cfgCache.get(orgId);
  if (cached && Date.now() - cached.at < 60_000) return cached.cfg;
  const empty: ResolutionConfig = { company: [], contact: [], hasConfig: false };
  try {
    const { data } = await sb
      .from("entity_resolution_config")
      .select("rule_id, enabled, priority")
      .eq("organization_id", orgId);
    const rows = ((data ?? []) as { rule_id: string; enabled: boolean; priority: number | null }[]).filter(
      (r) => typeof r.rule_id === "string" && !r.rule_id.startsWith("dedup_"),
    );
    if (rows.length === 0) {
      _cfgCache.set(orgId, { cfg: empty, at: Date.now() });
      return empty;
    }
    // Ordre = priorité configurée, tiebreak par rang canonique (fiable d'abord).
    const RANK: Record<string, number> = {
      siren_match: 1, vat_match: 2, siret_match: 3, domain_match: 4, name_match: 5, exact_email: 1,
    };
    const enabled = rows
      .filter((r) => r.enabled)
      .sort((a, b) => (a.priority ?? RANK[a.rule_id] ?? 999) - (b.priority ?? RANK[b.rule_id] ?? 999));
    const cfg: ResolutionConfig = {
      company: enabled.map((r) => r.rule_id).filter((id) => COMPANY_RULE_IDS.includes(id)),
      contact: enabled.map((r) => r.rule_id).filter((id) => CONTACT_RULE_IDS.includes(id)),
      hasConfig: true,
    };
    _cfgCache.set(orgId, { cfg, at: Date.now() });
    return cfg;
  } catch {
    return empty;
  }
}

type Match = { id: string; method: MatchMethod; score: number };

async function runCompanyRule(sb: SupabaseClient, orgId: string, ruleId: string, input: CompanyInput): Promise<Match | null> {
  const findExact = async (col: string, val: string): Promise<string | null> => {
    const { data } = await sb.from("companies").select("id").eq("organization_id", orgId).eq(col, val).limit(1).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  };
  switch (ruleId) {
    case "siren_match": {
      const siren = normalizeSiren(input.siren) ?? normalizeSiren(input.siret);
      if (!siren) return null;
      const id = await findExact("siren", siren);
      return id ? { id, method: "siren", score: 0.99 } : null;
    }
    case "vat_match": {
      const vat = normalizeVat(input.vatNumber);
      if (!vat) return null;
      const id = await findExact("vat_number", vat);
      return id ? { id, method: "vat_number", score: 0.97 } : null;
    }
    case "siret_match": {
      const siret = input.siret?.replace(/\D/g, "") ?? "";
      if (siret.length !== 14) return null;
      const id = await findExact("siret", siret);
      return id ? { id, method: "siret", score: 0.9 } : null;
    }
    case "domain_match": {
      const domain = normalizeDomain(input.domain);
      if (!domain || PERSONAL_DOMAINS.has(domain)) return null;
      const { data } = await sb.from("companies").select("id").eq("organization_id", orgId).ilike("domain", domain).limit(1).maybeSingle();
      const id = (data?.id as string | undefined) ?? null;
      return id ? { id, method: "domain", score: 0.75 } : null;
    }
    case "name_match": {
      const core = normalizeName(input.name);
      if (!core || core.length < 4) return null; // garde-fou anti-faux-match (noms courts/génériques)
      const { data } = await sb
        .from("companies")
        .select("id, name")
        .eq("organization_id", orgId)
        .ilike("name", `%${core}%`)
        .limit(25);
      for (const c of (data ?? []) as { id: string; name: string }[]) {
        if (normalizeName(c.name) === core) return { id: c.id, method: "name", score: 0.65 };
      }
      return null;
    }
    default:
      return null;
  }
}

// ── Public: resolve contact ─────────────────────────────────────────────

export async function resolveContact(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  externalId: string,
  input: ContactInput,
): Promise<ResolvedEntity | null> {
  // 1. Existing source link (external_id) — toujours actif
  const linked = await findBySourceLink(supabase, orgId, provider, externalId, "contact");
  if (linked) return { id: linked, matchMethod: "existing_link", matchScore: 1 };

  const cfg = await loadResolutionConfig(supabase, orgId);
  // Sécurité : email = seul matching contact ; on le garde actif par défaut
  // (un set vide ne doit pas créer de doublons de contacts).
  const emailEnabled = !cfg.hasConfig || cfg.contact.length === 0 || cfg.contact.includes("exact_email");

  const normalizedEmail = input.email?.trim().toLowerCase() || null;
  let resolvedId: string | null = null;
  let method: MatchMethod = "created";

  // 2. Match par email (si activé)
  if (emailEnabled && normalizedEmail) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      resolvedId = existing.id;
      method = "exact_email";
    }
  }

  // 3. Create
  if (!resolvedId) {
    if (!normalizedEmail) return null;
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({
        organization_id: orgId,
        email: normalizedEmail,
        full_name: input.fullName || normalizedEmail,
        phone: input.phone ?? null,
      })
      .select("id")
      .single();
    if (error || !created) return null;
    resolvedId = created.id;
    method = "created";
  }

  await writeSourceLink(supabase, orgId, provider, externalId, "contact", resolvedId!, method, 1);
  return { id: resolvedId!, matchMethod: method, matchScore: 1 };
}

// ── Public: resolve company ─────────────────────────────────────────────

export async function resolveCompany(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  externalId: string,
  input: CompanyInput,
): Promise<ResolvedEntity | null> {
  // 1. Existing source link (external_id) — toujours actif
  const linked = await findBySourceLink(supabase, orgId, provider, externalId, "company");
  if (linked) return { id: linked, matchMethod: "existing_link", matchScore: 1 };

  let resolvedId: string | null = null;
  let method: MatchMethod = "created";
  let score = 1;

  // 2. Matching piloté par la config (ordre = priorité configurée),
  //    fallback sûr si aucune config n'existe pour l'org.
  const cfg = await loadResolutionConfig(supabase, orgId);
  // Sécurité : jamais de matching à zéro (créerait des doublons). Un set vide
  // retombe sur l'ordre par défaut sûr.
  const order = cfg.hasConfig && cfg.company.length > 0 ? cfg.company : ["siren_match", "vat_match", "domain_match"];
  for (const ruleId of order) {
    const m = await runCompanyRule(supabase, orgId, ruleId, input);
    if (m) {
      resolvedId = m.id;
      method = m.method;
      score = m.score;
      break;
    }
  }

  const siren = normalizeSiren(input.siren) ?? normalizeSiren(input.siret);

  // 3. Create canonical company (ou enrichit les identifiants si match)
  if (!resolvedId) {
    if (!input.name && !input.domain) return null;
    const domain = normalizeDomain(input.domain);
    const { data: created, error } = await supabase
      .from("companies")
      .insert({
        organization_id: orgId,
        name: input.name || domain || "Sans nom",
        domain: domain,
        siren: siren ?? null,
        siret: input.siret?.replace(/\D/g, "") || null,
        vat_number: normalizeVat(input.vatNumber),
      })
      .select("id")
      .single();
    if (error || !created) return null;
    resolvedId = created.id;
    method = "created";
    score = 1;
  } else {
    // Merge par AUTORITÉ DE CHAMP : la source n'écrase un champ que si elle en a
    // l'autorité (matrice configurée) ; sinon elle ne remplit que les trous.
    const { data: cur } = await supabase
      .from("companies")
      .select("name, domain, siren, siret, vat_number")
      .eq("id", resolvedId)
      .maybeSingle();
    const updates: Record<string, string> = {};
    const consider = async (field: string, value: string | null, curVal: unknown) => {
      if (!value) return;
      const empty = curVal == null || String(curVal).trim() === "";
      if (empty || (await sourceWinsField(supabase, orgId, "Company", field, provider))) {
        updates[field] = value;
      }
    };
    await consider("name", input.name?.trim() || null, cur?.name);
    await consider("domain", normalizeDomain(input.domain), cur?.domain);
    await consider("siren", siren, cur?.siren);
    await consider("siret", input.siret?.replace(/\D/g, "") || null, cur?.siret);
    await consider("vat_number", normalizeVat(input.vatNumber), cur?.vat_number);
    if (Object.keys(updates).length > 0) {
      await supabase.from("companies").update(updates).eq("id", resolvedId).eq("organization_id", orgId);
    }
  }

  await writeSourceLink(supabase, orgId, provider, externalId, "company", resolvedId!, method, score);
  return { id: resolvedId!, matchMethod: method, matchScore: score };
}

/**
 * Ensure a source_link exists (for callers that already know the canonical id).
 */
export async function upsertSourceLink(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  externalId: string,
  entityType: string,
  internalId: string,
): Promise<void> {
  await writeSourceLink(supabase, orgId, provider, externalId, entityType, internalId, "created", 1);
}
