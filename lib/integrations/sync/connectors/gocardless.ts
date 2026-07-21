/**
 * GoCardless connector — customers, mandats, paiements → tables canoniques.
 *
 * Mapping-first (loadIdentifierAccessor) : un compte GoCardless non testé
 * reste mappable depuis les paramètres. Les paiements sont rattachés au
 * customer via son mandat (payment.links.mandate → mandate.links.customer).
 */

import {
  listGoCardlessCustomers,
  listGoCardlessMandates,
  listGoCardlessPayments,
} from "@/lib/integrations/sources/gocardless";
import { resolveContact, resolveCompany, upsertSourceLink, emailDomain } from "@/lib/integrations/entity-resolution";
import { loadIdentifierAccessor, newAuditCounters, recordConnectorAudit } from "../field-mapping";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "gocardless";

const STATUS_MAP: Record<string, string> = {
  pending_submission: "pending",
  pending_customer_approval: "pending",
  submitted: "pending",
  confirmed: "succeeded",
  paid_out: "succeeded",
  failed: "failed",
  cancelled: "failed",
  charged_back: "refunded",
  customer_approval_denied: "failed",
};

export const gocardlessConnector: SourceConnector = async (ctx) => {
  const token = ctx.credentials.access_token ?? ctx.primaryToken;
  const environment = ctx.credentials.environment;
  if (!token) return fail("Access token GoCardless manquant.");

  let customers, mandates, payments;
  try {
    [customers, mandates, payments] = await Promise.all([
      listGoCardlessCustomers(token, environment),
      listGoCardlessMandates(token, environment),
      listGoCardlessPayments(token, environment),
    ]);
  } catch (err) {
    return fail(`Erreur GoCardless : ${(err as Error).message}`);
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
    const companyName = ids.company_name ?? c.company_name ?? null;
    const fullName = [c.given_name, c.family_name].filter(Boolean).join(" ") || companyName;

    if (email) {
      const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, c.id, {
        email,
        fullName,
        phone: c.phone_number,
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
        vatNumber: ids.vat_number,
      });
      if (company) {
        customerToCompany.set(c.id, company.id);
        audit.bumpCompany(company.matchMethod);
      }
    } else {
      audit.bumpUnmatched("customer_sans_identifiant_company");
    }
  }

  // Mandat → customer (pour rattacher les paiements)
  const mandateToCustomer = new Map<string, string>();
  for (const m of mandates) {
    if (m.links?.customer) mandateToCustomer.set(m.id, m.links.customer);
  }

  // Paiements → table payments canonique
  const paymentLinks = new Map<string, string>();
  {
    const { data } = await ctx.supabase
      .from("source_links")
      .select("external_id, internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "payment");
    for (const l of (data ?? []) as Array<{ external_id: string; internal_id: string }>) {
      paymentLinks.set(l.external_id, l.internal_id);
    }
  }

  let paymentsImported = 0;
  for (const p of payments) {
    const customerId = p.links?.mandate ? mandateToCustomer.get(p.links.mandate) ?? null : null;
    const contactId = customerId ? customerToContact.get(customerId) ?? null : null;
    const payload = {
      organization_id: ctx.orgId,
      contact_id: contactId,
      company_id: customerId ? customerToCompany.get(customerId) ?? null : null,
      status: STATUS_MAP[p.status ?? ""] ?? "pending",
      amount: (p.amount ?? 0) / 100,
      currency: (p.currency ?? "EUR").toUpperCase(),
      paid_at: p.charge_date ? new Date(p.charge_date).toISOString() : null,
      primary_source: PROVIDER,
      source_metadata: { gocardless_id: p.id, mandate: p.links?.mandate ?? null },
    };
    const known = paymentLinks.get(p.id) ?? null;
    if (known) {
      await ctx.supabase.from("payments").update(payload).eq("id", known);
      paymentsImported++;
    } else {
      const { data: created } = await ctx.supabase.from("payments").insert(payload).select("id").single();
      if (created?.id) {
        await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, p.id, "payment", created.id);
        paymentsImported++;
      }
    }
  }

  await recordConnectorAudit(ctx.supabase, ctx.orgId, PROVIDER, {
    ran_at: new Date().toISOString(),
    totals: {
      contacts: contactsImported,
      companies: customerToCompany.size,
      payments: paymentsImported,
    },
    contact_match: audit.contact_match,
    company_match: audit.company_match,
    unmatched: audit.unmatched,
    identifier_coverage: accessor.coverage(),
  });

  return ok("Synchronisation GoCardless terminée.", {
    contacts: contactsImported,
    payments: paymentsImported,
  });
};
