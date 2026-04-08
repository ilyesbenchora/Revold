/**
 * Axonaut connector — pulls companies and invoices.
 */

import { listAxonautCompanies, listAxonautInvoices } from "@/lib/integrations/sources/axonaut";
import { resolveCompany, upsertSourceLink } from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "axonaut";

const STATUS_MAP: Record<string, string> = {
  draft: "draft",
  sent: "open",
  late: "open",
  paid: "paid",
  cancelled: "void",
};

export const axonautConnector: SourceConnector = async (ctx) => {
  const apiKey = ctx.primaryToken;
  if (!apiKey) return fail("API key Axonaut manquant.");

  let companies, invoices;
  try {
    [companies, invoices] = await Promise.all([
      listAxonautCompanies(apiKey),
      listAxonautInvoices(apiKey),
    ]);
  } catch (err) {
    return fail(`Erreur Axonaut : ${(err as Error).message}`);
  }

  const companyIdToInternal = new Map<number, string>();
  let companiesImported = 0;
  for (const c of companies) {
    const resolved = await resolveCompany(ctx.supabase, ctx.orgId, PROVIDER, String(c.id), {
      name: c.name,
      domain: c.website,
    });
    if (resolved) {
      companyIdToInternal.set(c.id, resolved.id);
      companiesImported++;
    }
  }

  let invoicesImported = 0;
  for (const inv of invoices) {
    const companyId = inv.company_id ? companyIdToInternal.get(inv.company_id) ?? null : null;
    const total = Number(inv.total_amount) || 0;
    const paid = Number(inv.paid_amount) || 0;
    const due = total - paid;
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
      company_id: companyId,
      number: inv.number,
      status,
      currency: (inv.currency || "EUR").toUpperCase(),
      amount_total: total,
      amount_paid: paid,
      amount_due: due,
      issued_at: inv.date,
      due_at: inv.due_date,
      paid_at: inv.paid_date,
      primary_source: PROVIDER,
      source_metadata: { axonaut_id: inv.id },
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

  return ok("Synchronisation Axonaut terminée.", {
    companies: companiesImported,
    invoices: invoicesImported,
  });
};
