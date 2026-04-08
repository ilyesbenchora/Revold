/**
 * Intercom connector — pulls contacts, companies and conversations and writes
 * them to Revold's canonical tables (contacts, companies, tickets).
 */

import {
  listIntercomContacts,
  listIntercomCompanies,
  listIntercomConversations,
} from "@/lib/integrations/sources/intercom";
import {
  resolveContact,
  resolveCompany,
  upsertSourceLink,
} from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "intercom";

export const intercomConnector: SourceConnector = async (ctx) => {
  const token = ctx.primaryToken;
  if (!token) return fail("Access token Intercom manquant.");

  let contacts, companies, conversations;
  try {
    [contacts, companies, conversations] = await Promise.all([
      listIntercomContacts(token),
      listIntercomCompanies(token),
      listIntercomConversations(token),
    ]);
  } catch (err) {
    return fail(`Erreur Intercom : ${(err as Error).message}`);
  }

  // ── Companies ─────────────────────────────────────────────────
  const companyIdToInternal = new Map<string, string>();
  let companiesImported = 0;
  for (const c of companies) {
    const resolved = await resolveCompany(ctx.supabase, ctx.orgId, PROVIDER, c.id, {
      name: c.name,
      domain: c.website,
    });
    if (resolved) {
      companyIdToInternal.set(c.id, resolved.id);
      companiesImported++;
    }
  }

  // ── Contacts ──────────────────────────────────────────────────
  const contactIdToInternal = new Map<string, string>();
  let contactsImported = 0;
  for (const c of contacts) {
    if (!c.email) continue;
    const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, c.id, {
      email: c.email,
      fullName: c.name,
      phone: c.phone,
    });
    if (!resolved) continue;
    contactIdToInternal.set(c.id, resolved.id);
    contactsImported++;

    // Link contact to its first Intercom company if known
    const firstCompanyId = c.companies?.data?.[0]?.id;
    if (firstCompanyId && companyIdToInternal.has(firstCompanyId)) {
      await ctx.supabase
        .from("contacts")
        .update({ company_id: companyIdToInternal.get(firstCompanyId) })
        .eq("id", resolved.id)
        .is("company_id", null);
    }
  }

  // ── Conversations → tickets ───────────────────────────────────
  let ticketsImported = 0;
  for (const conv of conversations) {
    const intercomContactId = conv.contacts?.contacts?.[0]?.id;
    const contactId = intercomContactId ? contactIdToInternal.get(intercomContactId) ?? null : null;

    const { data: existingLink } = await ctx.supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "ticket")
      .eq("external_id", conv.id)
      .maybeSingle();

    const status =
      conv.state === "closed" ? "closed" :
      conv.state === "snoozed" ? "pending" :
      "open";

    const payload = {
      organization_id: ctx.orgId,
      contact_id: contactId,
      external_number: conv.id,
      subject: conv.source?.subject || null,
      status,
      priority: conv.priority === "priority" ? "high" : "normal",
      channel: conv.source?.type || "chat",
      opened_at: new Date(conv.created_at * 1000).toISOString(),
      first_response_at: conv.statistics?.first_admin_reply_at
        ? new Date(conv.statistics.first_admin_reply_at * 1000).toISOString()
        : null,
      primary_source: PROVIDER,
      source_metadata: { intercom_id: conv.id },
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
      await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, conv.id, "ticket", internalId);
      ticketsImported++;
    }
  }

  return ok("Synchronisation Intercom terminée.", {
    contacts: contactsImported,
    companies: companiesImported,
    tickets: ticketsImported,
  });
};
