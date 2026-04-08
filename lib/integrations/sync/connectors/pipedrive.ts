/**
 * Pipedrive connector — pulls organizations, persons and deals and writes
 * them to Revold's canonical tables (companies, contacts, deals) via
 * source_links so cross-source insights can join with HubSpot / Stripe.
 */

import {
  listPersons,
  listOrganizations,
  listDeals,
  extractPrimaryEmail,
  extractPrimaryPhone,
  extractOrgId,
  extractDomainFromUrl,
} from "@/lib/integrations/sources/pipedrive";
import {
  resolveContact,
  resolveCompany,
  upsertSourceLink,
} from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "pipedrive";

export const pipedriveConnector: SourceConnector = async (ctx) => {
  const domain = (ctx.credentials.company_domain || "").trim();
  const token = ctx.primaryToken;
  if (!domain || !token) {
    return fail("Sous-domaine ou API token Pipedrive manquant.");
  }

  let persons, orgs, deals;
  try {
    [orgs, persons, deals] = await Promise.all([
      listOrganizations(domain, token),
      listPersons(domain, token),
      listDeals(domain, token),
    ]);
  } catch (err) {
    return fail(`Erreur API Pipedrive : ${(err as Error).message}`);
  }

  // ── 1. Organizations → companies ──────────────────────────────
  const orgIdToCompany = new Map<number, string>();
  let companiesImported = 0;
  for (const o of orgs) {
    const resolved = await resolveCompany(ctx.supabase, ctx.orgId, PROVIDER, String(o.id), {
      name: o.name,
      domain: extractDomainFromUrl(o.web_url),
    });
    if (resolved) {
      orgIdToCompany.set(o.id, resolved.id);
      companiesImported++;
    }
  }

  // ── 2. Persons → contacts ─────────────────────────────────────
  let contactsImported = 0;
  for (const p of persons) {
    const email = extractPrimaryEmail(p);
    if (!email) continue; // contacts.email is NOT NULL — skip emailless persons
    const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, String(p.id), {
      email,
      fullName: p.name,
      phone: extractPrimaryPhone(p),
    });
    if (!resolved) continue;
    contactsImported++;

    // Link contact to its Pipedrive organization if we resolved one
    const pdOrgId = extractOrgId(p.org_id);
    if (pdOrgId && orgIdToCompany.has(pdOrgId)) {
      await ctx.supabase
        .from("contacts")
        .update({ company_id: orgIdToCompany.get(pdOrgId) })
        .eq("id", resolved.id)
        .is("company_id", null); // only set if not already linked
    }
  }

  // ── 3. Deals → deals (canonical) ──────────────────────────────
  let dealsImported = 0;
  for (const d of deals) {
    const pdOrgId = extractOrgId(d.org_id);
    const companyId = pdOrgId ? orgIdToCompany.get(pdOrgId) ?? null : null;
    const isWon = d.status === "won";
    const isLost = d.status === "lost";
    const closeDate =
      d.close_time || d.won_time || d.lost_time
        ? new Date((d.close_time || d.won_time || d.lost_time)!).toISOString().slice(0, 10)
        : null;

    // Look up existing source_link to upsert
    const { data: existingLink } = await ctx.supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "deal")
      .eq("external_id", String(d.id))
      .maybeSingle();

    const payload = {
      organization_id: ctx.orgId,
      company_id: companyId,
      name: d.title || `Pipedrive deal ${d.id}`,
      amount: d.value || 0,
      currency: d.currency || "EUR",
      close_date: closeDate,
      is_closed_won: isWon,
      is_closed_lost: isLost,
      updated_at: new Date().toISOString(),
    };

    let internalId = existingLink?.internal_id ?? null;
    if (internalId) {
      await ctx.supabase.from("deals").update(payload).eq("id", internalId);
    } else {
      const { data: created } = await ctx.supabase
        .from("deals")
        .insert(payload)
        .select("id")
        .single();
      internalId = created?.id ?? null;
    }
    if (internalId) {
      await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, String(d.id), "deal", internalId);
      dealsImported++;
    }
  }

  return ok("Synchronisation Pipedrive terminée.", {
    contacts: contactsImported,
    companies: companiesImported,
    deals: dealsImported,
  });
};
