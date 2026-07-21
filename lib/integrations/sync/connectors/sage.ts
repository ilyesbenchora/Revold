/**
 * Sage Accounting connector — contacts et factures de vente → tables canoniques.
 *
 * Mapping-first (loadIdentifierAccessor) : registered_number (SIREN/SIRET) et
 * tax_number (TVA) sont les identifiants natifs Sage, surchargeables dans
 * Paramètres → Modèle de données.
 *
 * Limite connue : les access tokens Sage expirent en ~5 min. En cas de 401 la
 * sync échoue avec un message explicite (regénérer le token puis relancer) —
 * le refresh OAuth automatique viendra avec le connect OAuth Sage complet.
 */

import { listSageContacts, listSageSalesInvoices } from "@/lib/integrations/sources/sage";
import { resolveContact, resolveCompany, upsertSourceLink, emailDomain } from "@/lib/integrations/entity-resolution";
import { loadIdentifierAccessor, newAuditCounters, recordConnectorAudit } from "../field-mapping";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "sage";

const STATUS_MAP: Record<string, string> = {
  PAID: "paid",
  UNPAID: "open",
  PART_PAID: "open",
  VOID: "void",
  DRAFT: "draft",
};

export const sageConnector: SourceConnector = async (ctx) => {
  const token = ctx.credentials.access_token ?? ctx.primaryToken;
  if (!token) return fail("Access token Sage manquant.");

  let contacts, invoices;
  try {
    [contacts, invoices] = await Promise.all([
      listSageContacts(token),
      listSageSalesInvoices(token),
    ]);
  } catch (err) {
    return fail(`Erreur Sage : ${(err as Error).message}`);
  }

  const accessor = await loadIdentifierAccessor(ctx.supabase, ctx.orgId, PROVIDER);
  const audit = newAuditCounters();

  // Contacts Sage → contacts + companies canoniques
  const sageToContact = new Map<string, string>();
  const sageToCompany = new Map<string, string>();
  let contactsImported = 0;
  for (const c of contacts) {
    const ids = accessor.extract(c);
    const name = ids.company_name ?? c.name ?? c.displayed_as ?? null;
    const email = ids.email ?? c.email ?? c.main_contact_person?.email ?? null;

    if (email) {
      const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, c.id, {
        email,
        fullName: name,
      });
      if (resolved) {
        sageToContact.set(c.id, resolved.id);
        contactsImported++;
        audit.bumpContact(resolved.matchMethod);
      }
    } else {
      audit.bumpUnmatched("contact_sans_email");
    }

    if (ids.siren || ids.siret || ids.vat_number || name) {
      const company = await resolveCompany(ctx.supabase, ctx.orgId, PROVIDER, c.id, {
        name,
        domain: ids.domain ?? emailDomain(email),
        siren: ids.siren ?? c.registered_number,
        siret: ids.siret,
        vatNumber: ids.vat_number ?? c.tax_number,
      });
      if (company) {
        sageToCompany.set(c.id, company.id);
        audit.bumpCompany(company.matchMethod);
      }
    } else {
      audit.bumpUnmatched("contact_sans_identifiant_company");
    }
  }

  // Factures de vente → invoices canoniques
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
    const sageContactId = inv.contact?.id ?? null;
    const total = Number(inv.total_amount) || 0;
    const due = Number(inv.outstanding_amount) || 0;
    const payload = {
      organization_id: ctx.orgId,
      contact_id: sageContactId ? sageToContact.get(sageContactId) ?? null : null,
      company_id: sageContactId ? sageToCompany.get(sageContactId) ?? null : null,
      number: inv.invoice_number ?? inv.displayed_as,
      status: STATUS_MAP[inv.status?.id ?? ""] ?? "open",
      currency: (inv.currency?.id ?? "EUR").toUpperCase(),
      amount_total: total,
      amount_paid: Math.max(0, total - due),
      amount_due: due,
      issued_at: inv.date,
      due_at: inv.due_date,
      paid_at: null,
      primary_source: PROVIDER,
      source_metadata: { sage_id: inv.id },
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

  await recordConnectorAudit(ctx.supabase, ctx.orgId, PROVIDER, {
    ran_at: new Date().toISOString(),
    totals: {
      contacts: contactsImported,
      companies: sageToCompany.size,
      invoices: invoicesImported,
    },
    contact_match: audit.contact_match,
    company_match: audit.company_match,
    unmatched: audit.unmatched,
    identifier_coverage: accessor.coverage(),
  });

  return ok("Synchronisation Sage terminée.", {
    contacts: contactsImported,
    invoices: invoicesImported,
  });
};
