/**
 * QuickBooks Online connector — pulls customers and invoices.
 */

import {
  refreshQbAccessToken,
  listQbCustomers,
  listQbInvoices,
} from "@/lib/integrations/sources/quickbooks";
import { resolveContact, upsertSourceLink } from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "quickbooks";

export const quickbooksConnector: SourceConnector = async (ctx) => {
  const companyId = (ctx.credentials.company_id || "").trim();
  const clientId = (ctx.credentials.client_id || "").trim();
  const clientSecret = (ctx.credentials.client_secret || "").trim();
  const refreshToken = (ctx.credentials.refresh_token || "").trim() || ctx.primaryToken;
  if (!companyId || !clientId || !clientSecret || !refreshToken) {
    return fail("Identifiants QuickBooks manquants (company_id, client_id, client_secret, refresh_token).");
  }

  let accessToken;
  try {
    accessToken = await refreshQbAccessToken(clientId, clientSecret, refreshToken);
  } catch (err) {
    return fail((err as Error).message);
  }

  let customers, invoices;
  try {
    [customers, invoices] = await Promise.all([
      listQbCustomers(companyId, accessToken),
      listQbInvoices(companyId, accessToken),
    ]);
  } catch (err) {
    return fail(`Erreur QuickBooks : ${(err as Error).message}`);
  }

  const customerIdToContact = new Map<string, string>();
  let contactsImported = 0;
  for (const c of customers) {
    const email = c.PrimaryEmailAddr?.Address;
    if (!email) continue;
    const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, c.Id, {
      email,
      fullName: c.DisplayName,
      phone: c.PrimaryPhone?.FreeFormNumber,
    });
    if (resolved) {
      customerIdToContact.set(c.Id, resolved.id);
      contactsImported++;
    }
  }

  let invoicesImported = 0;
  for (const inv of invoices) {
    const contactId = customerIdToContact.get(inv.CustomerRef?.value) ?? null;
    const total = Number(inv.TotalAmt) || 0;
    const balance = Number(inv.Balance) || 0;
    const paid = total - balance;
    const status = balance === 0 ? "paid" : "open";

    const { data: existingLink } = await ctx.supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "invoice")
      .eq("external_id", inv.Id)
      .maybeSingle();

    const payload = {
      organization_id: ctx.orgId,
      contact_id: contactId,
      number: inv.DocNumber,
      status,
      currency: inv.CurrencyRef?.value || "EUR",
      amount_total: total,
      amount_paid: paid,
      amount_due: balance,
      issued_at: inv.TxnDate,
      due_at: inv.DueDate,
      paid_at: status === "paid" ? inv.TxnDate : null,
      primary_source: PROVIDER,
      source_metadata: { qb_id: inv.Id },
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
      await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, inv.Id, "invoice", internalId);
      invoicesImported++;
    }
  }

  return ok("Synchronisation QuickBooks terminée.", {
    contacts: contactsImported,
    invoices: invoicesImported,
  });
};
