/**
 * Pennylane connector — pulls customers and invoices.
 */

import {
  listPennylaneCustomers,
  listPennylaneInvoices,
  listPennylaneSupplierInvoices,
  listPennylaneTransactions,
  listPennylaneBankAccounts,
} from "@/lib/integrations/sources/pennylane";
import { resolveContact, upsertSourceLink } from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "pennylane";

const STATUS_MAP: Record<string, string> = {
  draft: "draft",
  sent: "open",
  paid: "paid",
  partially_paid: "open",
  void: "void",
  cancelled: "void",
};

export const pennylaneConnector: SourceConnector = async (ctx) => {
  const token = ctx.primaryToken;
  if (!token) return fail("API token Pennylane manquant.");

  let customers, invoices, supplierInvoices, transactions, bankAccounts;
  try {
    [customers, invoices, supplierInvoices, transactions, bankAccounts] = await Promise.all([
      listPennylaneCustomers(token),
      listPennylaneInvoices(token),
      listPennylaneSupplierInvoices(token), // décaissements facturés (résout [] si indisponible)
      listPennylaneTransactions(token),     // flux bancaires v2 (résout [] si indisponible)
      listPennylaneBankAccounts(token),     // soldes réels v2 (résout [] si indisponible)
    ]);
  } catch (err) {
    return fail(`Erreur Pennylane : ${(err as Error).message}`);
  }

  // Customers → contacts
  const customerIdToContact = new Map<number, string>();
  let contactsImported = 0;
  for (const c of customers) {
    const email = c.emails?.[0] ?? null;
    if (!email) continue;
    const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, String(c.id), {
      email,
      fullName: c.name,
      phone: c.phone,
    });
    if (resolved) {
      customerIdToContact.set(c.id, resolved.id);
      contactsImported++;
    }
  }

  // Invoices
  let invoicesImported = 0;
  for (const inv of invoices) {
    const contactId = inv.customer?.id ? customerIdToContact.get(inv.customer.id) ?? null : null;
    const total = parseFloat(inv.amount) || 0;
    const remaining = parseFloat(inv.remaining_amount) || 0;
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
      number: inv.invoice_number,
      status,
      currency: (inv.currency || "EUR").toUpperCase(),
      amount_total: total,
      amount_paid: paid,
      amount_due: remaining,
      issued_at: inv.date,
      due_at: inv.deadline,
      paid_at: inv.paid_at,
      primary_source: PROVIDER,
      source_metadata: { pennylane_id: inv.id },
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

  // Factures FOURNISSEURS → décaissements (direction 'out'). Alimente les
  // blocs Trésorerie (balance, charges fixes, runway). entity_type distinct
  // pour éviter toute collision d'ID avec les factures clients.
  let supplierInvoicesImported = 0;
  for (const inv of supplierInvoices) {
    const total = parseFloat(inv.amount) || 0;
    const remaining = parseFloat(inv.remaining_amount) || 0;
    const status = STATUS_MAP[inv.status] || "open";

    const { data: existingLink } = await ctx.supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", ctx.orgId)
      .eq("provider", PROVIDER)
      .eq("entity_type", "supplier_invoice")
      .eq("external_id", String(inv.id))
      .maybeSingle();

    const payload: Record<string, unknown> = {
      organization_id: ctx.orgId,
      number: inv.invoice_number,
      status,
      currency: (inv.currency || "EUR").toUpperCase(),
      amount_total: total,
      amount_paid: total - remaining,
      amount_due: remaining,
      issued_at: inv.date,
      due_at: inv.deadline,
      paid_at: inv.paid_at,
      direction: "out",
      primary_source: PROVIDER,
      source_metadata: { pennylane_id: inv.id, kind: "supplier_invoice" },
      updated_at: new Date().toISOString(),
    };

    let internalId = existingLink?.internal_id ?? null;
    if (internalId) {
      const { error } = await ctx.supabase.from("invoices").update(payload).eq("id", internalId);
      // Migration `direction` pas encore appliquée → retente sans la colonne.
      if (error) {
        const { direction: _d, ...noDir } = payload;
        await ctx.supabase.from("invoices").update(noDir).eq("id", internalId);
      }
    } else {
      const first = await ctx.supabase.from("invoices").insert(payload).select("id").single();
      let created = first.data;
      if (first.error) {
        // Migration `direction` pas encore appliquée → retente sans la colonne.
        const { direction: _d, ...noDir } = payload;
        ({ data: created } = await ctx.supabase.from("invoices").insert(noDir).select("id").single());
      }
      internalId = created?.id ?? null;
    }
    if (internalId) {
      await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, String(inv.id), "supplier_invoice", internalId);
      supplierInvoicesImported++;
    }
  }

  // ── Transactions bancaires + comptes (v2) → tables bank_transactions /
  // bank_accounts. Upserts PAR LOTS (pas de N+1). Silencieux si la migration
  // 20260721000006_bank_transactions n'est pas encore appliquée.
  let transactionsImported = 0;
  if (transactions.length > 0) {
    const rows = transactions.map((t) => ({
      organization_id: ctx.orgId,
      primary_source: PROVIDER,
      external_id: String(t.id),
      label: t.label ?? null,
      amount: parseFloat(t.amount) || 0,
      fee: t.fee != null ? parseFloat(t.fee) || 0 : 0,
      currency: (t.currency || "EUR").toUpperCase(),
      date: t.date,
      bank_account_external_id: t.bank_account?.id != null ? String(t.bank_account.id) : null,
      updated_at: new Date().toISOString(),
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await ctx.supabase
        .from("bank_transactions")
        .upsert(rows.slice(i, i + 500), { onConflict: "organization_id,primary_source,external_id" });
      if (error) break; // table absente (migration non appliquée) → on n'insiste pas
      transactionsImported += Math.min(500, rows.length - i);
    }
  }
  if (bankAccounts.length > 0) {
    await ctx.supabase
      .from("bank_accounts")
      .upsert(
        bankAccounts.map((a) => ({
          organization_id: ctx.orgId,
          primary_source: PROVIDER,
          external_id: String(a.id),
          name: a.name ?? null,
          currency: (a.currency || "EUR").toUpperCase(),
          balance: parseFloat(a.balance) || 0,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "organization_id,primary_source,external_id" },
      );
  }

  return ok("Synchronisation Pennylane terminée.", {
    contacts: contactsImported,
    invoices: invoicesImported,
    supplier_invoices: supplierInvoicesImported,
    payments: transactionsImported,
  });
};
