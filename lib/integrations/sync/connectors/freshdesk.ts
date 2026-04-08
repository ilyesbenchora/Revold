/**
 * Freshdesk connector — pulls contacts, companies and tickets.
 */

import {
  listFreshdeskContacts,
  listFreshdeskCompanies,
  listFreshdeskTickets,
  PRIORITY_MAP,
  STATUS_MAP,
  SOURCE_MAP,
} from "@/lib/integrations/sources/freshdesk";
import {
  resolveContact,
  resolveCompany,
  upsertSourceLink,
} from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "freshdesk";

export const freshdeskConnector: SourceConnector = async (ctx) => {
  const subdomain = (ctx.credentials.subdomain || "").trim();
  const apiKey = ctx.primaryToken;
  if (!subdomain || !apiKey) {
    return fail("Sous-domaine ou API key Freshdesk manquant.");
  }

  let contacts, companies, tickets;
  try {
    [companies, contacts, tickets] = await Promise.all([
      listFreshdeskCompanies(subdomain, apiKey),
      listFreshdeskContacts(subdomain, apiKey),
      listFreshdeskTickets(subdomain, apiKey),
    ]);
  } catch (err) {
    return fail(`Erreur Freshdesk : ${(err as Error).message}`);
  }

  // Companies
  const companyIdToInternal = new Map<number, string>();
  let companiesImported = 0;
  for (const c of companies) {
    const resolved = await resolveCompany(ctx.supabase, ctx.orgId, PROVIDER, String(c.id), {
      name: c.name,
      domain: c.domains?.[0] ?? null,
    });
    if (resolved) {
      companyIdToInternal.set(c.id, resolved.id);
      companiesImported++;
    }
  }

  // Contacts
  const contactIdToInternal = new Map<number, string>();
  let contactsImported = 0;
  for (const c of contacts) {
    if (!c.email) continue;
    const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, String(c.id), {
      email: c.email,
      fullName: c.name,
      phone: c.phone,
    });
    if (!resolved) continue;
    contactIdToInternal.set(c.id, resolved.id);
    contactsImported++;
    if (c.company_id && companyIdToInternal.has(c.company_id)) {
      await ctx.supabase
        .from("contacts")
        .update({ company_id: companyIdToInternal.get(c.company_id) })
        .eq("id", resolved.id)
        .is("company_id", null);
    }
  }

  // Tickets
  let ticketsImported = 0;
  for (const t of tickets) {
    const contactId = contactIdToInternal.get(t.requester_id) ?? null;
    const companyId = t.company_id ? companyIdToInternal.get(t.company_id) ?? null : null;

    const { data: existingLink } = await ctx.supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "ticket")
      .eq("external_id", String(t.id))
      .maybeSingle();

    const status = STATUS_MAP[t.status] || "open";
    const payload = {
      organization_id: ctx.orgId,
      contact_id: contactId,
      company_id: companyId,
      external_number: String(t.id),
      subject: t.subject,
      status,
      priority: PRIORITY_MAP[t.priority] || "normal",
      channel: SOURCE_MAP[t.source] || null,
      opened_at: t.created_at,
      resolved_at: status === "closed" ? t.updated_at : null,
      primary_source: PROVIDER,
      source_metadata: { freshdesk_id: t.id },
      updated_at: new Date().toISOString(),
    };

    let internalId = existingLink?.internal_id ?? null;
    if (internalId) {
      await ctx.supabase.from("tickets").update(payload).eq("id", internalId);
    } else {
      const { data: created } = await ctx.supabase
        .from("tickets")
        .insert(payload)
        .select("id")
        .single();
      internalId = created?.id ?? null;
    }
    if (internalId) {
      await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, String(t.id), "ticket", internalId);
      ticketsImported++;
    }
  }

  return ok("Synchronisation Freshdesk terminée.", {
    contacts: contactsImported,
    companies: companiesImported,
    tickets: ticketsImported,
  });
};
