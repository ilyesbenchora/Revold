/**
 * Entity resolution: matches a record from an external source (Stripe customer,
 * Pipedrive contact, …) to an existing canonical Revold contact/company, or
 * creates a new one if no match is found.
 *
 * Strategy (V1, deterministic):
 *   1. exact email lowercase match
 *   2. company domain match (for company resolution)
 *   3. create a new canonical row
 *
 * Each call also writes/refreshes a `source_links` row so future syncs from
 * the same provider go straight to the canonical entity.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedEntity = {
  id: string;
  matchMethod: "exact_email" | "domain" | "created" | "existing_link";
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
};

function emailDomain(email?: string | null): string | null {
  if (!email) return null;
  const parts = email.toLowerCase().trim().split("@");
  return parts.length === 2 ? parts[1] : null;
}

/**
 * Resolve a contact from a provider record.
 * Looks up by source_links first, then by email, then creates.
 */
export async function resolveContact(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  externalId: string,
  input: ContactInput,
): Promise<ResolvedEntity | null> {
  // 1. Existing source link?
  const { data: link } = await supabase
    .from("source_links")
    .select("internal_id")
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .eq("entity_type", "contact")
    .eq("external_id", externalId)
    .maybeSingle();

  if (link?.internal_id) {
    return { id: link.internal_id, matchMethod: "existing_link", matchScore: 1 };
  }

  // 2. Match by email
  let resolvedId: string | null = null;
  let method: ResolvedEntity["matchMethod"] = "created";
  let score = 1;

  const normalizedEmail = input.email?.trim().toLowerCase() || null;
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
      score = 1;
    }
  }

  // 3. Create canonical contact (only if we have at least an email — contacts.email is NOT NULL)
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
    score = 1;
  }

  // 4. Upsert source_link so the next sync is O(1)
  await supabase.from("source_links").upsert(
    {
      organization_id: orgId,
      provider,
      external_id: externalId,
      entity_type: "contact",
      internal_id: resolvedId,
      match_method: method,
      match_score: score,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider,external_id,entity_type" },
  );

  return { id: resolvedId!, matchMethod: method, matchScore: score };
}

/**
 * Resolve a company by domain.
 * V1: domain-only matching (rock solid, low false-positive rate).
 */
export async function resolveCompany(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  externalId: string,
  input: CompanyInput,
): Promise<ResolvedEntity | null> {
  const { data: link } = await supabase
    .from("source_links")
    .select("internal_id")
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .eq("entity_type", "company")
    .eq("external_id", externalId)
    .maybeSingle();

  if (link?.internal_id) {
    return { id: link.internal_id, matchMethod: "existing_link", matchScore: 1 };
  }

  let resolvedId: string | null = null;
  let method: ResolvedEntity["matchMethod"] = "created";

  const domain = (input.domain || "").toLowerCase().trim() || null;
  if (domain) {
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
    }
  }

  if (!resolvedId) {
    if (!input.name && !domain) return null;
    const { data: created, error } = await supabase
      .from("companies")
      .insert({
        organization_id: orgId,
        name: input.name || domain || "Sans nom",
        domain: domain,
      })
      .select("id")
      .single();
    if (error || !created) return null;
    resolvedId = created.id;
    method = "created";
  }

  await supabase.from("source_links").upsert(
    {
      organization_id: orgId,
      provider,
      external_id: externalId,
      entity_type: "company",
      internal_id: resolvedId,
      match_method: method,
      match_score: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider,external_id,entity_type" },
  );

  return { id: resolvedId!, matchMethod: method, matchScore: 1 };
}

/**
 * Helper for callers that already know the canonical id and just want to make
 * sure a source_link exists (e.g. when ingesting an invoice that references a
 * customer we already resolved earlier in the same sync).
 */
export async function upsertSourceLink(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  externalId: string,
  entityType: string,
  internalId: string,
): Promise<void> {
  await supabase.from("source_links").upsert(
    {
      organization_id: orgId,
      provider,
      external_id: externalId,
      entity_type: entityType,
      internal_id: internalId,
      match_method: "created",
      match_score: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider,external_id,entity_type" },
  );
}

export { emailDomain };
