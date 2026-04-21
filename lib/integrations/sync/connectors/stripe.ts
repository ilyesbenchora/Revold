/**
 * Stripe connector — pulls customers, invoices and subscriptions and writes
 * them to Revold's canonical tables (contacts, invoices, subscriptions),
 * with source_links so cross-source insights can join the data with HubSpot.
 *
 * Performances : la première version faisait 3 requêtes Supabase par invoice
 * et par subscription (SELECT existing source_link → INSERT/UPDATE → UPSERT
 * source_link). Sur un compte avec 1000 invoices + 200 subs, ça donnait
 * ~3600 requêtes en série, dépassait 60s, Vercel killait la fonction et
 * le UI restait bloqué sur "en cours…".
 *
 * Optimisations :
 *   1. Pré-fetch en bulk de TOUS les source_links Stripe en une seule
 *      requête pagéee → on évite N round-trips
 *   2. Traitement par chunks de 20 en parallèle (Promise.all)
 *   3. Les contacts utilisent toujours resolveContact (logique de matching
 *      complexe qui ne se factorise pas trivialement) mais traités en
 *      parallèle
 */

import { listCustomers, listInvoices, listSubscriptions, computeMrr } from "@/lib/integrations/sources/stripe";
import { resolveContact, upsertSourceLink } from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";
import type { SupabaseClient } from "@supabase/supabase-js";

const PROVIDER = "stripe";
const PARALLEL_CHUNK_SIZE = 20;

/** Charge tous les source_links Stripe pour cette org en une seule passe. */
async function loadStripeLinks(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Map<string, string>> {
  // Map: `${entity_type}:${external_id}` → internal_id
  const map = new Map<string, string>();
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("source_links")
      .select("entity_type, external_id, internal_id")
      .eq("organization_id", orgId)
      .eq("provider", PROVIDER)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      map.set(`${row.entity_type}:${row.external_id}`, row.internal_id as string);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

/** Itère un tableau par chunks et exécute les chunks en parallèle. */
async function processInChunks<T>(
  items: T[],
  chunkSize: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map(worker));
  }
}

export const stripeConnector: SourceConnector = async (ctx) => {
  const { supabase, orgId, primaryToken } = ctx;
  if (!primaryToken) return fail("Clé secrète Stripe manquante.");

  // ── 0. Charge en parallèle Stripe + source_links existants ────
  let customers, invoices, subs, links;
  try {
    [customers, invoices, subs, links] = await Promise.all([
      listCustomers(primaryToken, 1000),
      listInvoices(primaryToken, 2000),
      listSubscriptions(primaryToken, 1000),
      loadStripeLinks(supabase, orgId),
    ]);
  } catch (err) {
    return fail(`Erreur Stripe API : ${(err as Error).message}`);
  }

  // ── 1. Customers → contacts (parallèle par chunks) ────────────
  const customerToContact = new Map<string, string>();
  let contactsImported = 0;
  await processInChunks(customers, PARALLEL_CHUNK_SIZE, async (c) => {
    const resolved = await resolveContact(supabase, orgId, PROVIDER, c.id, {
      email: c.email,
      fullName: c.name,
      phone: c.phone,
    });
    if (resolved) {
      customerToContact.set(c.id, resolved.id);
      contactsImported++;
    }
  });

  // ── 2. Invoices (parallèle par chunks) ────────────────────────
  let invoicesImported = 0;
  await processInChunks(invoices, PARALLEL_CHUNK_SIZE, async (inv) => {
    const contactId = inv.customer ? customerToContact.get(inv.customer) ?? null : null;
    const paidAt = inv.status_transitions?.paid_at
      ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
      : null;
    const issuedAt = inv.created ? new Date(inv.created * 1000).toISOString() : null;
    const dueAt = inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null;

    const linkKey = `invoice:${inv.id}`;
    const existingId = links.get(linkKey) ?? null;

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

    let internalId = existingId;
    if (internalId) {
      await supabase.from("invoices").update(payload).eq("id", internalId);
    } else {
      const { data: created } = await supabase
        .from("invoices")
        .insert(payload)
        .select("id")
        .single();
      internalId = created?.id ?? null;
      if (internalId) {
        await upsertSourceLink(supabase, orgId, PROVIDER, inv.id, "invoice", internalId);
        links.set(linkKey, internalId);
      }
    }
    if (internalId) invoicesImported++;
  });

  // ── 3. Subscriptions (parallèle par chunks) ───────────────────
  let subsImported = 0;
  await processInChunks(subs, PARALLEL_CHUNK_SIZE, async (sub) => {
    const contactId = sub.customer ? customerToContact.get(sub.customer) ?? null : null;
    const mrr = computeMrr(sub);

    const linkKey = `subscription:${sub.id}`;
    const existingId = links.get(linkKey) ?? null;

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

    let internalId = existingId;
    if (internalId) {
      await supabase.from("subscriptions").update(payload).eq("id", internalId);
    } else {
      const { data: created } = await supabase
        .from("subscriptions")
        .insert(payload)
        .select("id")
        .single();
      internalId = created?.id ?? null;
      if (internalId) {
        await upsertSourceLink(supabase, orgId, PROVIDER, sub.id, "subscription", internalId);
        links.set(linkKey, internalId);
      }
    }
    if (internalId) subsImported++;
  });

  return ok("Synchronisation Stripe terminée.", {
    contacts: contactsImported,
    invoices: invoicesImported,
    subscriptions: subsImported,
  });
};
