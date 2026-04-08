/**
 * Sellsy connector — pulls companies, individuals and invoices.
 */

import {
  getSellsyAccessToken,
  listSellsyCompanies,
  listSellsyIndividuals,
  listSellsyInvoices,
} from "@/lib/integrations/sources/sellsy";
import {
  resolveContact,
  resolveCompany,
  upsertSourceLink,
} from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "sellsy";

const STATUS_MAP: Record<string, string> = {
  draft: "draft",
  due: "open",
  paid: "paid",
  cancelled: "void",
  partially_paid: "open",
};

export const sellsyConnector: SourceConnector = async (ctx) => {
  const clientId = (ctx.credentials.client_id || "").trim();
  const clientSecret = (ctx.credentials.client_secret || "").trim() || ctx.primaryToken;
  if (!clientId || !clientSecret) {
    return fail("Identifiants OAuth Sellsy manquants (client_id, client_secret).");
  }

  let token;
  try {
    token = await getSellsyAccessToken(clientId, clientSecret);
  } catch (err) {
    return fail((err as Error).message);
  }

  let companies, individuals, invoices;
  try {
    [companies, individuals, invoices] = await Promise.all([
      listSellsyCompanies(token),
      listSellsyIndividuals(token),
      listSellsyInvoices(token),
    ]);
  } catch (err) {
    return fail(`Erreur Sellsy : ${(err as Error).message}`);
  }

  const companyIdToInternal = new Map<number, string>();
  let companiesImported = 0;
  for (const c of companies) {
    const resolved = await resolveCompany(ctx.supabase, ctx.orgId, PROVIDER, String(c.id), {
      name: c.name,
      domain: c.website || null,
    });
    if (resolved) {
      companyIdToInternal.set(c.id, resolved.id);
      companiesImported++;
    }
  }

  const individualIdToContact = new Map<number, string>();
  let contactsImported = 0;
  for (const i of individuals) {
    if (!i.email) continue;
    const fullName = `${i.first_name ?? ""} ${i.last_name ?? ""}`.trim() || i.email;
    const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, String(i.id), {
      email: i.email,
      fullName,
      phone: i.mobile_number,
    });
    if (resolved) {
      individualIdToContact.set(i.id, resolved.id);
      contactsImported++;
    }
  }

  let invoicesImported = 0;
  for (const inv of invoices) {
    const companyRef = inv.related?.find((r) => r.type === "company");
    const individualRef = inv.related?.find((r) => r.type === "individual");
    const companyId = companyRef ? companyIdToInternal.get(companyRef.id) ?? null : null;
    const contactId = individualRef ? individualIdToContact.get(individualRef.id) ?? null : null;

    const total = parseFloat(inv.amounts?.total_incl_tax || "0") || 0;
    const remaining = parseFloat(inv.amounts?.remaining_to_pay_incl_tax || "0") || 0;
    const paid = total - remaining;
    const status = STATUS_MAP[inv.status] || "open";

    const { data: existingLink } = await ctx.supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "invoice")
      .eq("external_id", String(inv.id))
      .maybeSingle();

    const payload = {
      organization_id: ctx.orgId,
      contact_id: contactId,
      company_id: companyId,
      number: inv.number,
      status,
      currency: (inv.currency || "EUR").toUpperCase(),
      amount_total: total,
      amount_paid: paid,
      amount_due: remaining,
      issued_at: inv.date,
      due_at: inv.due_date,
      paid_at: inv.paid_at,
      primary_source: PROVIDER,
      source_metadata: { sellsy_id: inv.id },
      updated_at: new Date().toISOString(),
    };

    let internalId = existingLink?.internal_id ?? null;
    if (internalId) {
      await ctx.supabase.from("invoices").update(payload).eq("id", internalId);
    } else {
      const { data: created } = await ctx.supabase.from("invoices").insert(payload).select("id").single();
      internalId = created?.id ?? null;
    }
    if (internalId) {
      await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, String(inv.id), "invoice", internalId);
      invoicesImported++;
    }
  }

  return ok("Synchronisation Sellsy terminée.", {
    contacts: contactsImported,
    companies: companiesImported,
    invoices: invoicesImported,
  });
};
