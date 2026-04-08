/**
 * Crisp connector — pulls people profiles and conversations.
 */

import { listCrispProfiles, listCrispConversations } from "@/lib/integrations/sources/crisp";
import { resolveContact, upsertSourceLink } from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "crisp";

export const crispConnector: SourceConnector = async (ctx) => {
  const websiteId = (ctx.credentials.website_id || "").trim();
  const identifier = (ctx.credentials.identifier || "").trim();
  const key = ctx.primaryToken;
  if (!websiteId || !identifier || !key) {
    return fail("Website ID, identifier ou key Crisp manquant.");
  }

  let profiles, conversations;
  try {
    [profiles, conversations] = await Promise.all([
      listCrispProfiles(websiteId, identifier, key),
      listCrispConversations(websiteId, identifier, key),
    ]);
  } catch (err) {
    return fail(`Erreur Crisp : ${(err as Error).message}`);
  }

  // Profiles → contacts
  const emailToContact = new Map<string, string>();
  let contactsImported = 0;
  for (const p of profiles) {
    if (!p.email) continue;
    const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, p.people_id, {
      email: p.email,
      fullName: p.person?.nickname,
      phone: p.person?.phone,
    });
    if (resolved) {
      emailToContact.set(p.email.toLowerCase(), resolved.id);
      contactsImported++;
    }
  }

  // Conversations → tickets
  let ticketsImported = 0;
  for (const conv of conversations) {
    const email = conv.meta?.email?.toLowerCase();
    const contactId = email ? emailToContact.get(email) ?? null : null;

    const { data: existingLink } = await ctx.supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "ticket")
      .eq("external_id", conv.session_id)
      .maybeSingle();

    const status = conv.state === "resolved" ? "closed" : conv.state === "pending" ? "pending" : "open";
    const payload = {
      organization_id: ctx.orgId,
      contact_id: contactId,
      external_number: conv.session_id,
      subject: conv.meta?.subject || null,
      status,
      priority: "normal",
      channel: "chat",
      opened_at: new Date(conv.created_at).toISOString(),
      resolved_at: status === "closed" ? new Date(conv.updated_at).toISOString() : null,
      primary_source: PROVIDER,
      source_metadata: { crisp_session_id: conv.session_id },
      updated_at: new Date().toISOString(),
    };

    let internalId = existingLink?.internal_id ?? null;
    if (internalId) {
      await ctx.supabase.from("tickets").update(payload).eq("id", internalId);
    } else {
      const { data: created } = await ctx.supabase.from("tickets").insert(payload).select("id").single();
      internalId = created?.id ?? null;
    }
    if (internalId) {
      await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, conv.session_id, "ticket", internalId);
      ticketsImported++;
    }
  }

  return ok("Synchronisation Crisp terminée.", {
    contacts: contactsImported,
    tickets: ticketsImported,
  });
};
