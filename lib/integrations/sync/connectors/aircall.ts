/**
 * Aircall connector — appels (90 jours) → table canonique `activities`
 * (type "call"), alimentant la page Appels et les KPIs de phoning.
 *
 * Rattachement contact : email du contact Aircall via resolveContact
 * (mapping-first), sinon matching par numéro de téléphone sur les contacts
 * existants (jamais de création à partir d'un simple numéro).
 */

import { listAircallCalls, type AircallCall } from "@/lib/integrations/sources/aircall";
import { resolveContact, upsertSourceLink } from "@/lib/integrations/entity-resolution";
import { loadIdentifierAccessor, newAuditCounters, recordConnectorAudit } from "../field-mapping";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "aircall";

/** Derniers 9 chiffres — suffit à matcher un numéro FR quel que soit le format (+33/0). */
function phoneKey(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.slice(-9);
}

function callSubject(c: AircallCall): string {
  const dir = c.direction === "inbound" ? "entrant" : "sortant";
  const missed = c.status !== "done" && !c.answered_at;
  const who = [c.contact?.first_name, c.contact?.last_name].filter(Boolean).join(" ") || c.raw_digits || "";
  return `Appel ${dir}${missed ? " manqué" : ""}${who ? ` — ${who}` : ""}`;
}

export const aircallConnector: SourceConnector = async (ctx) => {
  const apiId = (ctx.credentials.api_id || "").trim();
  const apiToken = (ctx.credentials.api_token || "").trim() || ctx.primaryToken;
  if (!apiId || !apiToken) return fail("Identifiants API Aircall manquants (API ID, API Token).");

  let calls: AircallCall[];
  try {
    calls = await listAircallCalls(apiId, apiToken);
  } catch (err) {
    return fail(`Erreur Aircall : ${(err as Error).message}`);
  }

  const accessor = await loadIdentifierAccessor(ctx.supabase, ctx.orgId, PROVIDER);
  const audit = newAuditCounters();

  // Index téléphone → contact existant (matching sans création).
  const phoneToContact = new Map<string, string>();
  {
    const { data } = await ctx.supabase
      .from("contacts")
      .select("id, phone")
      .eq("organization_id", ctx.orgId)
      .not("phone", "is", null);
    for (const row of (data ?? []) as Array<{ id: string; phone: string }>) {
      const key = phoneKey(row.phone);
      if (key) phoneToContact.set(key, row.id);
    }
  }

  // Activités déjà importées (source_links) → update au lieu d'insert.
  const activityLinks = new Map<string, string>();
  {
    const { data } = await ctx.supabase
      .from("source_links")
      .select("external_id, internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "activity");
    for (const l of (data ?? []) as Array<{ external_id: string; internal_id: string }>) {
      activityLinks.set(l.external_id, l.internal_id);
    }
  }

  let callsImported = 0;
  let contactsMatched = 0;
  for (const call of calls) {
    // 1) Contact : email Aircall (mapping-first) sinon numéro de téléphone.
    let contactId: string | null = null;
    const ids = accessor.extract(call);
    const email = ids.email ?? call.contact?.emails?.[0]?.value ?? null;
    if (email) {
      const fullName =
        [call.contact?.first_name, call.contact?.last_name].filter(Boolean).join(" ") || null;
      const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, String(call.contact?.id ?? call.id), {
        email,
        fullName,
        phone: call.contact?.phone_numbers?.[0]?.value ?? call.raw_digits ?? null,
      });
      if (resolved) {
        contactId = resolved.id;
        contactsMatched++;
        audit.bumpContact(resolved.matchMethod);
      }
    } else {
      const key = phoneKey(call.contact?.phone_numbers?.[0]?.value ?? call.raw_digits);
      if (key && phoneToContact.has(key)) {
        contactId = phoneToContact.get(key)!;
        contactsMatched++;
      } else {
        audit.bumpUnmatched("appel_sans_email_ni_numero_connu");
      }
    }

    // 2) Appel → activities (type "call").
    const payload = {
      organization_id: ctx.orgId,
      contact_id: contactId,
      type: "call",
      subject: callSubject(call),
      body: [
        call.user?.name ? `Par ${call.user.name}` : null,
        call.raw_digits ? `Numéro : ${call.raw_digits}` : null,
        call.missed_call_reason ? `Manqué : ${call.missed_call_reason}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
      occurred_at: new Date(call.started_at * 1000).toISOString(),
      duration_minutes: call.duration ? Math.max(1, Math.round(call.duration / 60)) : null,
    };

    const externalId = String(call.id);
    const known = activityLinks.get(externalId) ?? null;
    if (known) {
      await ctx.supabase.from("activities").update(payload).eq("id", known);
      callsImported++;
    } else {
      const { data: created } = await ctx.supabase.from("activities").insert(payload).select("id").single();
      if (created?.id) {
        await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, externalId, "activity", created.id);
        callsImported++;
      }
    }
  }

  await recordConnectorAudit(ctx.supabase, ctx.orgId, PROVIDER, {
    ran_at: new Date().toISOString(),
    totals: { contacts: contactsMatched, calls: callsImported },
    contact_match: audit.contact_match,
    company_match: audit.company_match,
    unmatched: audit.unmatched,
    identifier_coverage: accessor.coverage(),
  });

  return ok("Synchronisation Aircall terminée.", {
    contacts: contactsMatched,
    calls: callsImported,
  });
};
