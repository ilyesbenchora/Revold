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
import { resolveContact, resolveCompany, upsertSourceLink, emailDomain } from "@/lib/integrations/entity-resolution";
import { loadIdentifierAccessor, newAuditCounters, recordConnectorAudit } from "../field-mapping";
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

  // Mapping des identifiants : défauts catalogue + overrides de la page
  // Paramètres → Modèle de données. Les champs source ne sont plus en dur.
  const accessor = await loadIdentifierAccessor(supabase, orgId, PROVIDER);
  const audit = newAuditCounters();

  // ── 1. Customers → contacts + companies (parallèle par chunks) ─
  // Le rapprochement company se fait DIRECTEMENT sur les identifiants du
  // customer (SIREN via metadata, TVA, nom, domaine d'email pro) : les règles
  // de matching configurées sont enfin exercées par le billing, au lieu de
  // dépendre uniquement de la company CRM héritée du contact.
  const customerToContact = new Map<string, string>();
  const customerToCompany = new Map<string, string>();
  let contactsImported = 0;
  await processInChunks(customers, PARALLEL_CHUNK_SIZE, async (c) => {
    const ids = accessor.extract(c);
    const email = ids.email ?? c.email;
    const resolved = await resolveContact(supabase, orgId, PROVIDER, c.id, {
      email,
      fullName: ids.company_name ?? c.name,
      phone: c.phone,
    });
    if (resolved) {
      customerToContact.set(c.id, resolved.id);
      contactsImported++;
      audit.bumpContact(resolved.matchMethod);
    } else {
      audit.bumpUnmatched("customer_sans_email");
    }

    const hasCompanySignal = ids.siren || ids.siret || ids.vat_number || ids.company_name || ids.domain;
    if (hasCompanySignal) {
      const company = await resolveCompany(supabase, orgId, PROVIDER, c.id, {
        name: ids.company_name ?? c.name,
        domain: ids.domain ?? emailDomain(email),
        siren: ids.siren,
        siret: ids.siret,
        vatNumber: ids.vat_number,
      });
      if (company) {
        customerToCompany.set(c.id, company.id);
        audit.bumpCompany(company.matchMethod);
      }
    } else {
      audit.bumpUnmatched("customer_sans_identifiant_company");
    }
  });

  // ── 1b. Repli : contact → company_id via le CRM, pour les customers sans
  // identifiant company exploitable. La facture/abonnement héritera alors de
  // la company du contact.
  const contactToCompany = new Map<string, string>();
  const contactIds = [...new Set([...customerToContact.values()])];
  for (let i = 0; i < contactIds.length; i += 300) {
    const chunk = contactIds.slice(i, i + 300);
    const { data } = await supabase.from("contacts").select("id, company_id").in("id", chunk);
    for (const row of (data ?? []) as Array<{ id: string; company_id: string | null }>) {
      if (row.company_id) contactToCompany.set(row.id, row.company_id);
    }
  }
  const companyFor = (customerId: string | null, contactId: string | null): string | null => {
    if (customerId) {
      const direct = customerToCompany.get(customerId);
      if (direct) return direct;
    }
    return contactId ? contactToCompany.get(contactId) ?? null : null;
  };

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
      company_id: companyFor(inv.customer, contactId),
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
      company_id: companyFor(sub.customer, contactId),
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

  // Rapport d'audit (couverture des identifiants + méthodes de match) —
  // affiché dans Audit qualité → Audit onboarding.
  await recordConnectorAudit(supabase, orgId, PROVIDER, {
    ran_at: new Date().toISOString(),
    totals: {
      contacts: contactsImported,
      companies: customerToCompany.size,
      invoices: invoicesImported,
      subscriptions: subsImported,
    },
    contact_match: audit.contact_match,
    company_match: audit.company_match,
    unmatched: audit.unmatched,
    identifier_coverage: accessor.coverage(),
  });

  return ok("Synchronisation Stripe terminée.", {
    contacts: contactsImported,
    invoices: invoicesImported,
    subscriptions: subsImported,
  });
};
