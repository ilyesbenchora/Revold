/**
 * Stripe connector — pulls customers, invoices and subscriptions and writes
 * them to Revold's canonical tables (contacts, invoices, subscriptions),
 * with source_links so cross-source insights can join the data with HubSpot.
 */

import { listCustomers, listInvoices, listSubscriptions, computeMrr } from "@/lib/integrations/sources/stripe";
import { resolveContact, upsertSourceLink } from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "stripe";

export const stripeConnector: SourceConnector = async (ctx) => {
  const { supabase, orgId, primaryToken } = ctx;
  if (!primaryToken) return fail("Clé secrète Stripe manquante.");

  let customers, invoices, subs;
  try {
    [customers, invoices, subs] = await Promise.all([
      listCustomers(primaryToken, 1000),
      listInvoices(primaryToken, 2000),
      listSubscriptions(primaryToken, 1000),
    ]);
  } catch (err) {
    return fail(`Erreur Stripe API : ${(err as Error).message}`);
  }

  // ── 1. Customers → contacts ───────────────────────────────────
  // Map Stripe customer.id → canonical contact.id for downstream linking
  const customerToContact = new Map<string, string>();
  let contactsImported = 0;
  for (const c of customers) {
    const resolved = await resolveContact(supabase, orgId, PROVIDER, c.id, {
      email: c.email,
      fullName: c.name,
      phone: c.phone,
    });
    if (resolved) {
      customerToContact.set(c.id, resolved.id);
      contactsImported++;
    }
  }

  // ── 2. Invoices ───────────────────────────────────────────────
  let invoicesImported = 0;
  for (const inv of invoices) {
    const contactId = inv.customer ? customerToContact.get(inv.customer) ?? null : null;
    const paidAt = inv.status_transitions?.paid_at
      ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
      : null;
    const issuedAt = inv.created ? new Date(inv.created * 1000).toISOString() : null;
    const dueAt = inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null;

    // Look up existing canonical invoice via source_links to avoid duplicates
    const { data: existingLink } = await supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "invoice")
      .eq("external_id", inv.id)
      .maybeSingle();

    const payload = {
      organization_id: orgId,
      contact_id: contactId,
      number: inv.number,
      status: inv.status,
      currency: inv.currency.toUpperCase(),
      amount_total: inv.total / 100,
      amount_paid: inv.amount_paid / 100,
      amount_due: inv.amount_due / 100,
      issued_at: issuedAt,
      due_at: dueAt,
      paid_at: paidAt,
      primary_source: PROVIDER,
      source_metadata: { stripe_id: inv.id },
      updated_at: new Date().toISOString(),
    };

    let internalId = existingLink?.internal_id ?? null;
    if (internalId) {
      await supabase.from("invoices").update(payload).eq("id", internalId);
    } else {
      const { data: created } = await supabase
        .from("invoices")
        .insert(payload)
        .select("id")
        .single();
      internalId = created?.id ?? null;
    }
    if (internalId) {
      await upsertSourceLink(supabase, orgId, PROVIDER, inv.id, "invoice", internalId);
      invoicesImported++;
    }
  }

  // ── 3. Subscriptions ──────────────────────────────────────────
  let subsImported = 0;
  for (const sub of subs) {
    const contactId = sub.customer ? customerToContact.get(sub.customer) ?? null : null;
    const mrr = computeMrr(sub);

    const { data: existingLink } = await supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "subscription")
      .eq("external_id", sub.id)
      .maybeSingle();

    const payload = {
      organization_id: orgId,
      contact_id: contactId,
      status: sub.status,
      currency: sub.currency.toUpperCase(),
      mrr,
      current_period_start: sub.current_period_start
        ? new Date(sub.current_period_start * 1000).toISOString()
        : null,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      started_at: sub.start_date ? new Date(sub.start_date * 1000).toISOString() : null,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      primary_source: PROVIDER,
      source_metadata: { stripe_id: sub.id },
      updated_at: new Date().toISOString(),
    };

    let internalId = existingLink?.internal_id ?? null;
    if (internalId) {
      await supabase.from("subscriptions").update(payload).eq("id", internalId);
    } else {
      const { data: created } = await supabase
        .from("subscriptions")
        .insert(payload)
        .select("id")
        .single();
      internalId = created?.id ?? null;
    }
    if (internalId) {
      await upsertSourceLink(supabase, orgId, PROVIDER, sub.id, "subscription", internalId);
      subsImported++;
    }
  }

  return ok("Synchronisation Stripe terminée.", {
    contacts: contactsImported,
    invoices: invoicesImported,
    subscriptions: subsImported,
  });
};
