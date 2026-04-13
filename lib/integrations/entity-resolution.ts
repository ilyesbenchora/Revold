/**
 * Entity resolution: matches a record from an external source (Stripe customer,
 * Pipedrive contact, …) to an existing canonical Revold contact/company, or
 * creates a new one if no match is found.
 *
 * Resolution strategy (by priority):
 *   Company: source_link → SIREN → VAT → domain → create
 *   Contact: source_link → exact email → create
 *
 * Each call writes a `source_links` row so future syncs are O(1).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type MatchMethod = "existing_link" | "siren" | "vat_number" | "exact_email" | "domain" | "created";

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
  // SIREN = 9 digits, SIRET = 14 digits (extract SIREN from first 9)
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

// ── Public: resolve contact ─────────────────────────────────────────────

export async function resolveContact(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  externalId: string,
  input: ContactInput,
): Promise<ResolvedEntity | null> {
  // 1. Existing source link?
  const linked = await findBySourceLink(supabase, orgId, provider, externalId, "contact");
  if (linked) return { id: linked, matchMethod: "existing_link", matchScore: 1 };

  // 2. Match by email
  const normalizedEmail = input.email?.trim().toLowerCase() || null;
  let resolvedId: string | null = null;
  let method: MatchMethod = "created";

  if (normalizedEmail) {
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
  // 1. Existing source link?
  const linked = await findBySourceLink(supabase, orgId, provider, externalId, "company");
  if (linked) return { id: linked, matchMethod: "existing_link", matchScore: 1 };

  let resolvedId: string | null = null;
  let method: MatchMethod = "created";
  let score = 1;

  // 2. Match by SIREN (99% confidence — best identifier for French B2B)
  const siren = normalizeSiren(input.siren) ?? normalizeSiren(input.siret);
  if (siren) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("organization_id", orgId)
      .eq("siren", siren)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      resolvedId = existing.id;
      method = "siren";
      score = 0.99;
    }
  }

  // 3. Match by VAT number (97% confidence)
  if (!resolvedId) {
    const vat = normalizeVat(input.vatNumber);
    if (vat) {
      const { data: existing } = await supabase
        .from("companies")
        .select("id")
        .eq("organization_id", orgId)
        .eq("vat_number", vat)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        resolvedId = existing.id;
        method = "vat_number";
        score = 0.97;
      }
    }
  }

  // 4. Match by domain (75% confidence)
  if (!resolvedId) {
    const domain = normalizeDomain(input.domain);
    if (domain && !PERSONAL_DOMAINS.has(domain)) {
      const { data: existing } = await supabase
        .from("companies")
        .select("id")
        .eq("organization_id", orgId)
        .ilike("domain", domain)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        resolvedId = existing.id;
        method = "domain";
        score = 0.75;
      }
    }
  }

  // 5. Create canonical company
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
    // Update identifiers on matched company if we have new data
    const updates: Record<string, string> = {};
    if (siren) updates.siren = siren;
    if (input.siret) updates.siret = input.siret.replace(/\D/g, "");
    if (input.vatNumber) updates.vat_number = normalizeVat(input.vatNumber)!;
    if (Object.keys(updates).length > 0) {
      await supabase
        .from("companies")
        .update(updates)
        .eq("id", resolvedId)
        .eq("organization_id", orgId);
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
