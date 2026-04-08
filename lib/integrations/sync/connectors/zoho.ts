/**
 * Zoho CRM connector — pulls Accounts, Contacts and Deals.
 */

import {
  refreshAccessToken,
  listZohoAccounts,
  listZohoContacts,
  listZohoDeals,
  extractDomain,
} from "@/lib/integrations/sources/zoho";
import {
  resolveContact,
  resolveCompany,
  upsertSourceLink,
} from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "zoho";
const WON_STAGES = /closed.?won/i;
const LOST_STAGES = /closed.?lost/i;

export const zohoConnector: SourceConnector = async (ctx) => {
  const dc = (ctx.credentials.data_center || "com").trim();
  const clientId = (ctx.credentials.client_id || "").trim();
  const clientSecret = (ctx.credentials.client_secret || "").trim();
  const refreshToken = (ctx.credentials.refresh_token || "").trim() || ctx.primaryToken;
  if (!clientId || !clientSecret || !refreshToken) {
    return fail("Identifiants OAuth Zoho manquants (client_id, client_secret, refresh_token).");
  }

  let accessToken;
  try {
    accessToken = await refreshAccessToken(dc, clientId, clientSecret, refreshToken);
  } catch (err) {
    return fail((err as Error).message);
  }

  let accounts, contacts, deals;
  try {
    [accounts, contacts, deals] = await Promise.all([
      listZohoAccounts(dc, accessToken),
      listZohoContacts(dc, accessToken),
      listZohoDeals(dc, accessToken),
    ]);
  } catch (err) {
    return fail(`Erreur Zoho : ${(err as Error).message}`);
  }

  const acctIdToCompany = new Map<string, string>();
  let companiesImported = 0;
  for (const a of accounts) {
    const resolved = await resolveCompany(ctx.supabase, ctx.orgId, PROVIDER, a.id, {
      name: a.Account_Name,
      domain: extractDomain(a.Website),
    });
    if (resolved) {
      acctIdToCompany.set(a.id, resolved.id);
      companiesImported++;
    }
  }

  let contactsImported = 0;
  for (const c of contacts) {
    if (!c.Email) continue;
    const fullName = `${c.First_Name ?? ""} ${c.Last_Name ?? ""}`.trim() || c.Email;
    const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, c.id, {
      email: c.Email,
      fullName,
      phone: c.Phone,
    });
    if (!resolved) continue;
    contactsImported++;
    if (c.Account_Name?.id && acctIdToCompany.has(c.Account_Name.id)) {
      await ctx.supabase
        .from("contacts")
        .update({ company_id: acctIdToCompany.get(c.Account_Name.id) })
        .eq("id", resolved.id)
        .is("company_id", null);
    }
  }

  let dealsImported = 0;
  for (const d of deals) {
    const companyId = d.Account_Name?.id ? acctIdToCompany.get(d.Account_Name.id) ?? null : null;
    const { data: existingLink } = await ctx.supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "deal")
      .eq("external_id", d.id)
      .maybeSingle();

    const payload = {
      organization_id: ctx.orgId,
      company_id: companyId,
      name: d.Deal_Name,
      amount: Number(d.Amount) || 0,
      currency: "EUR",
      close_date: d.Closing_Date,
      is_closed_won: WON_STAGES.test(d.Stage),
      is_closed_lost: LOST_STAGES.test(d.Stage),
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
      await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, d.id, "deal", internalId);
      dealsImported++;
    }
  }

  return ok("Synchronisation Zoho CRM terminée.", {
    contacts: contactsImported,
    companies: companiesImported,
    deals: dealsImported,
  });
};
