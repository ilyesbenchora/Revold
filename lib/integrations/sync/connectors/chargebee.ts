/**
 * Chargebee connector — customers, invoices, subscriptions → tables canoniques.
 *
 * Premier connecteur écrit « mapping-first » : tous les identifiants passent
 * par loadIdentifierAccessor (catalogue + overrides Paramètres → Modèle de
 * données). Un compte Chargebee jamais testé chez Revold reste donc mappable
 * en corrigeant les chemins de champs dans les paramètres, sans toucher au code.
 */

import {
  listChargebeeCustomers,
  listChargebeeInvoices,
  listChargebeeSubscriptions,
  computeChargebeeMrr,
} from "@/lib/integrations/sources/chargebee";
import { resolveContact, resolveCompany, upsertSourceLink, emailDomain } from "@/lib/integrations/entity-resolution";
import { loadIdentifierAccessor, newAuditCounters, recordConnectorAudit } from "../field-mapping";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "chargebee";

const STATUS_MAP: Record<string, string> = {
  paid: "paid",
  posted: "open",
  payment_due: "open",
  not_paid: "open",
  pending: "draft",
  voided: "void",
};

export const chargebeeConnector: SourceConnector = async (ctx) => {
  const site = ctx.credentials.site;
  const apiKey = ctx.credentials.api_key ?? ctx.primaryToken;
  if (!site || !apiKey) return fail("Site ou API key Chargebee manquant.");

  let customers, invoices, subs;
  try {
    [customers, invoices, subs] = await Promise.all([
      listChargebeeCustomers(site, apiKey),
      listChargebeeInvoices(site, apiKey),
      listChargebeeSubscriptions(site, apiKey),
    ]);
  } catch (err) {
    return fail(`Erreur Chargebee : ${(err as Error).message}`);
  }

  const accessor = await loadIdentifierAccessor(ctx.supabase, ctx.orgId, PROVIDER);
  const audit = newAuditCounters();

  // Customers → contacts + companies
  const customerToContact = new Map<string, string>();
  const customerToCompany = new Map<string, string>();
  let contactsImported = 0;
  for (const c of customers) {
    const ids = accessor.extract(c);
    const email = ids.email ?? c.email ?? null;
    const companyName = ids.company_name ?? c.company ?? c.billing_address?.company ?? null;
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ") || companyName;

    if (email) {
      const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, c.id, {
        email,
        fullName,
        phone: c.phone,
      });
      if (resolved) {
        customerToContact.set(c.id, resolved.id);
        contactsImported++;
        audit.bumpContact(resolved.matchMethod);
      }
    } else {
      audit.bumpUnmatched("customer_sans_email");
    }

    if (ids.siren || ids.siret || ids.vat_number || companyName) {
      const company = await resolveCompany(ctx.supabase, ctx.orgId, PROVIDER, c.id, {
        name: companyName,
        domain: ids.domain ?? emailDomain(email),
        siren: ids.siren,
        siret: ids.siret,
        vatNumber: ids.vat_number ?? c.vat_number,
      });
      if (company) {
        customerToCompany.set(c.id, company.id);
        audit.bumpCompany(company.matchMethod);
      }
    } else {
      audit.bumpUnmatched("customer_sans_identifiant_company");
    }
  }

  const companyFor = (customerId: string | null | undefined): string | null =>
    customerId ? customerToCompany.get(customerId) ?? null : null;
  const contactFor = (customerId: string | null | undefined): string | null =>
    customerId ? customerToContact.get(customerId) ?? null : null;

  const toIso = (epoch: number | null | undefined): string | null =>
    epoch ? new Date(epoch * 1000).toISOString() : null;

  // Invoices
  const invoiceLinks = new Map<string, string>();
  {
    const { data } = await ctx.supabase
      .from("source_links")
      .select("external_id, internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "invoice");
    for (const l of (data ?? []) as Array<{ external_id: string; internal_id: string }>) {
      invoiceLinks.set(l.external_id, l.internal_id);
    }
  }

  let invoicesImported = 0;
  for (const inv of invoices) {
    const payload = {
      organization_id: ctx.orgId,
      contact_id: contactFor(inv.customer_id),
      company_id: companyFor(inv.customer_id),
      number: inv.id,
      status: STATUS_MAP[inv.status ?? ""] ?? "open",
      currency: (inv.currency_code ?? "EUR").toUpperCase(),
      amount_total: (inv.total ?? 0) / 100,
      amount_paid: (inv.amount_paid ?? 0) / 100,
      amount_due: (inv.amount_due ?? 0) / 100,
      issued_at: toIso(inv.date),
      due_at: toIso(inv.due_date),
      paid_at: toIso(inv.paid_at),
      primary_source: PROVIDER,
      source_metadata: { chargebee_id: inv.id },
      updated_at: new Date().toISOString(),
    };
    const known = invoiceLinks.get(inv.id) ?? null;
    if (known) {
      await ctx.supabase.from("invoices").update(payload).eq("id", known);
      invoicesImported++;
    } else {
      const { data: created } = await ctx.supabase.from("invoices").insert(payload).select("id").single();
      if (created?.id) {
        await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, inv.id, "invoice", created.id);
        invoicesImported++;
      }
    }
  }

  // Subscriptions
  const subLinks = new Map<string, string>();
  {
    const { data } = await ctx.supabase
      .from("source_links")
      .select("external_id, internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "subscription");
    for (const l of (data ?? []) as Array<{ external_id: string; internal_id: string }>) {
      subLinks.set(l.external_id, l.internal_id);
    }
  }

  let subsImported = 0;
  for (const sub of subs) {
    const payload = {
      organization_id: ctx.orgId,
      contact_id: contactFor(sub.customer_id),
      company_id: companyFor(sub.customer_id),
      status: sub.status ?? "active",
      currency: (sub.currency_code ?? "EUR").toUpperCase(),
      mrr: computeChargebeeMrr(sub),
      current_period_start: toIso(sub.current_term_start),
      current_period_end: toIso(sub.current_term_end),
      started_at: toIso(sub.started_at),
      canceled_at: toIso(sub.cancelled_at),
      primary_source: PROVIDER,
      source_metadata: { chargebee_id: sub.id },
      updated_at: new Date().toISOString(),
    };
    const known = subLinks.get(sub.id) ?? null;
    if (known) {
      await ctx.supabase.from("subscriptions").update(payload).eq("id", known);
      subsImported++;
    } else {
      const { data: created } = await ctx.supabase.from("subscriptions").insert(payload).select("id").single();
      if (created?.id) {
        await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, sub.id, "subscription", created.id);
        subsImported++;
      }
    }
  }

  await recordConnectorAudit(ctx.supabase, ctx.orgId, PROVIDER, {
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

  return ok("Synchronisation Chargebee terminée.", {
    contacts: contactsImported,
    invoices: invoicesImported,
    subscriptions: subsImported,
  });
};
