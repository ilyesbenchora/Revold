/**
 * Zendesk connector — pulls users, organizations and tickets.
 */

import {
  listZendeskUsers,
  listZendeskOrganizations,
  listZendeskTickets,
} from "@/lib/integrations/sources/zendesk";
import {
  resolveContact,
  resolveCompany,
  upsertSourceLink,
} from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "zendesk";

export const zendeskConnector: SourceConnector = async (ctx) => {
  const subdomain = (ctx.credentials.subdomain || "").trim();
  const email = (ctx.credentials.email || "").trim();
  const token = ctx.primaryToken;
  if (!subdomain || !email || !token) {
    return fail("Sous-domaine, email ou API token Zendesk manquant.");
  }

  let users, orgs, tickets;
  try {
    [orgs, users, tickets] = await Promise.all([
      listZendeskOrganizations(subdomain, email, token),
      listZendeskUsers(subdomain, email, token),
      listZendeskTickets(subdomain, email, token),
    ]);
  } catch (err) {
    return fail(`Erreur Zendesk : ${(err as Error).message}`);
  }

  // ── Organizations ─────────────────────────────────────────────
  const orgIdToInternal = new Map<number, string>();
  let companiesImported = 0;
  for (const o of orgs) {
    const resolved = await resolveCompany(ctx.supabase, ctx.orgId, PROVIDER, String(o.id), {
      name: o.name,
      domain: o.domain_names?.[0] ?? null,
    });
    if (resolved) {
      orgIdToInternal.set(o.id, resolved.id);
      companiesImported++;
    }
  }

  // ── Users → contacts (filter out agents) ──────────────────────
  const userIdToContact = new Map<number, string>();
  let contactsImported = 0;
  for (const u of users) {
    if (u.role !== "end-user" || !u.email) continue;
    const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, String(u.id), {
      email: u.email,
      fullName: u.name,
      phone: u.phone,
    });
    if (!resolved) continue;
    userIdToContact.set(u.id, resolved.id);
    contactsImported++;

    if (u.organization_id && orgIdToInternal.has(u.organization_id)) {
      await ctx.supabase
        .from("contacts")
        .update({ company_id: orgIdToInternal.get(u.organization_id) })
        .eq("id", resolved.id)
        .is("company_id", null);
    }
  }

  // ── Tickets ───────────────────────────────────────────────────
  let ticketsImported = 0;
  for (const t of tickets) {
    const contactId = t.requester_id ? userIdToContact.get(t.requester_id) ?? null : null;
    const companyId = t.organization_id ? orgIdToInternal.get(t.organization_id) ?? null : null;

    const status =
      t.status === "closed" || t.status === "solved" ? "closed" :
      t.status === "pending" || t.status === "hold" ? "pending" :
      "open";

    const { data: existingLink } = await ctx.supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "ticket")
      .eq("external_id", String(t.id))
      .maybeSingle();

    const payload = {
      organization_id: ctx.orgId,
      contact_id: contactId,
      company_id: companyId,
      external_number: String(t.id),
      subject: t.subject,
      status,
      priority: t.priority,
      channel: t.via?.channel || null,
      opened_at: t.created_at,
      resolved_at: t.status === "solved" || t.status === "closed" ? t.updated_at : null,
      primary_source: PROVIDER,
      source_metadata: { zendesk_id: t.id },
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

  return ok("Synchronisation Zendesk terminée.", {
    contacts: contactsImported,
    companies: companiesImported,
    tickets: ticketsImported,
  });
};
