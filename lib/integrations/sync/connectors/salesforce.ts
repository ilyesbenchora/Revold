/**
 * Salesforce connector — pulls Accounts, Contacts and Opportunities.
 */

import {
  listSfAccounts,
  listSfContacts,
  listSfOpportunities,
  extractDomain,
} from "@/lib/integrations/sources/salesforce";
import {
  resolveContact,
  resolveCompany,
  upsertSourceLink,
} from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "salesforce";

export const salesforceConnector: SourceConnector = async (ctx) => {
  const instanceUrl = (ctx.credentials.instance_url || "").trim();
  const token = ctx.primaryToken;
  if (!instanceUrl || !token) {
    return fail("Instance URL ou security token Salesforce manquant.");
  }

  let accounts, contacts, opps;
  try {
    [accounts, contacts, opps] = await Promise.all([
      listSfAccounts(instanceUrl, token),
      listSfContacts(instanceUrl, token),
      listSfOpportunities(instanceUrl, token),
    ]);
  } catch (err) {
    return fail(`Erreur Salesforce : ${(err as Error).message}`);
  }

  // Accounts → companies
  const acctIdToCompany = new Map<string, string>();
  let companiesImported = 0;
  for (const a of accounts) {
    const resolved = await resolveCompany(ctx.supabase, ctx.orgId, PROVIDER, a.Id, {
      name: a.Name,
      domain: extractDomain(a.Website),
    });
    if (resolved) {
      acctIdToCompany.set(a.Id, resolved.id);
      companiesImported++;
    }
  }

  // Contacts → contacts
  const sfContactIdToInternal = new Map<string, string>();
  let contactsImported = 0;
  for (const c of contacts) {
    if (!c.Email) continue;
    const fullName = `${c.FirstName ?? ""} ${c.LastName ?? ""}`.trim() || c.Email;
    const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, c.Id, {
      email: c.Email,
      fullName,
      phone: c.Phone,
    });
    if (!resolved) continue;
    sfContactIdToInternal.set(c.Id, resolved.id);
    contactsImported++;
    if (c.AccountId && acctIdToCompany.has(c.AccountId)) {
      await ctx.supabase
        .from("contacts")
        .update({ company_id: acctIdToCompany.get(c.AccountId) })
        .eq("id", resolved.id)
        .is("company_id", null);
    }
  }

  // Opportunities → deals
  let dealsImported = 0;
  for (const o of opps) {
    const companyId = o.AccountId ? acctIdToCompany.get(o.AccountId) ?? null : null;
    const { data: existingLink } = await ctx.supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "deal")
      .eq("external_id", o.Id)
      .maybeSingle();

    const payload = {
      organization_id: ctx.orgId,
      company_id: companyId,
      name: o.Name,
      amount: Number(o.Amount) || 0,
      currency: "EUR",
      close_date: o.CloseDate,
      is_closed_won: o.IsClosed && o.IsWon,
      is_closed_lost: o.IsClosed && !o.IsWon,
      updated_at: new Date().toISOString(),
    };

    let internalId = existingLink?.internal_id ?? null;
    if (internalId) {
      await ctx.supabase.from("deals").update(payload).eq("id", internalId);
    } else {
      const { data: created } = await ctx.supabase.from("deals").insert(payload).select("id").single();
      internalId = created?.id ?? null;
    }
    if (internalId) {
      await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, o.Id, "deal", internalId);
      dealsImported++;
    }
  }

  return ok("Synchronisation Salesforce terminée.", {
    contacts: contactsImported,
    companies: companiesImported,
    deals: dealsImported,
  });
};
