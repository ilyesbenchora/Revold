/**
 * Pennylane connector — pulls customers and invoices.
 */

import {
  listPennylaneCustomers,
  listPennylaneInvoices,
  listPennylaneSupplierInvoices,
  listPennylaneTransactions,
  listPennylaneBankAccounts,
  listPennylaneLedgerLines,
  listPennylaneLedgerAccounts,
} from "@/lib/integrations/sources/pennylane";
import { resolveContact, resolveCompany, upsertSourceLink, emailDomain } from "@/lib/integrations/entity-resolution";
import { loadIdentifierAccessor, newAuditCounters, recordConnectorAudit } from "../field-mapping";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "pennylane";

/**
 * Charge en UNE requête la table de correspondance external_id → internal_id
 * pour un type d'entité Pennylane. Évite le N+1 (un SELECT source_links par
 * facture) qui rendait la re-synchronisation interminable sur les gros comptes.
 */
async function loadLinkMap(
  ctx: Parameters<SourceConnector>[0],
  entityType: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data } = await ctx.supabase
    .from("source_links")
    .select("external_id, internal_id")
    .eq("organization_id", ctx.orgId)
    .eq("provider", PROVIDER)
    .eq("entity_type", entityType);
  for (const l of (data ?? []) as Array<{ external_id: string; internal_id: string }>) {
    map.set(String(l.external_id), l.internal_id);
  }
  return map;
}

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

  let customers, invoices, supplierInvoices, transactions, bankAccounts, ledgerLines, ledgerAccounts;
  try {
    [customers, invoices, supplierInvoices, transactions, bankAccounts, ledgerLines, ledgerAccounts] = await Promise.all([
      listPennylaneCustomers(token),
      listPennylaneInvoices(token),
      listPennylaneSupplierInvoices(token), // décaissements facturés (résout [] si indisponible)
      listPennylaneTransactions(token),     // flux bancaires v2 (résout [] si indisponible)
      listPennylaneBankAccounts(token),     // soldes réels v2 (résout [] si indisponible)
      listPennylaneLedgerLines(token),      // écritures comptables v2 → balance/P&L reconstruits
      listPennylaneLedgerAccounts(token),   // plan de comptes v2 (libellés)
    ]);
  } catch (err) {
    return fail(`Erreur Pennylane : ${(err as Error).message}`);
  }

  // Mapping des identifiants : défauts catalogue (SIREN natif Pennylane =
  // registration_number) + overrides de Paramètres → Modèle de données.
  const accessor = await loadIdentifierAccessor(ctx.supabase, ctx.orgId, PROVIDER);
  const audit = newAuditCounters();

  // Customers → contacts + companies. Le rapprochement company utilise les
  // identifiants forts du client Pennylane (SIREN, TVA) : c'est le cas idéal
  // des règles de matching configurées — plus fiable que l'héritage CRM.
  const customerIdToContact = new Map<number, string>();
  const customerIdToCompany = new Map<number, string>();
  let contactsImported = 0;
  for (const c of customers) {
    const ids = accessor.extract(c);
    const email = ids.email ?? c.emails?.[0] ?? null;
    if (email) {
      const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, String(c.id), {
        email,
        fullName: c.name,
        phone: c.phone,
      });
      if (resolved) {
        customerIdToContact.set(c.id, resolved.id);
        contactsImported++;
        audit.bumpContact(resolved.matchMethod);
      }
    } else {
      audit.bumpUnmatched("client_sans_email");
    }

    if (ids.siren || ids.siret || ids.vat_number || ids.company_name || c.name) {
      const company = await resolveCompany(ctx.supabase, ctx.orgId, PROVIDER, String(c.id), {
        name: ids.company_name ?? c.name,
        domain: ids.domain ?? emailDomain(email),
        siren: ids.siren,
        siret: ids.siret,
        vatNumber: ids.vat_number,
      });
      if (company) {
        customerIdToCompany.set(c.id, company.id);
        audit.bumpCompany(company.matchMethod);
      }
    }
  }

  // Repli CRM : company du contact quand le client Pennylane n'a pas pu être
  // rapproché directement (aucun identifiant exploitable).
  const contactToCompany = new Map<string, string>();
  const contactIdList = [...new Set([...customerIdToContact.values()])];
  for (let i = 0; i < contactIdList.length; i += 300) {
    const chunk = contactIdList.slice(i, i + 300);
    const { data } = await ctx.supabase.from("contacts").select("id, company_id").in("id", chunk);
    for (const row of (data ?? []) as Array<{ id: string; company_id: string | null }>) {
      if (row.company_id) contactToCompany.set(row.id, row.company_id);
    }
  }
  const companyFor = (customerId: number | null | undefined, contactId: string | null): string | null => {
    if (customerId != null) {
      const direct = customerIdToCompany.get(customerId);
      if (direct) return direct;
    }
    return contactId ? contactToCompany.get(contactId) ?? null : null;
  };

  // Pré-charge en UNE requête le mapping external_id → internal_id des factures
  // déjà importées (évite un SELECT source_links par facture : le N+1 qui faisait
  // exploser le temps de sync — voire dépasser le timeout — sur les gros comptes).
  const invoiceLinks = await loadLinkMap(ctx, "invoice");

  // Invoices
  let invoicesImported = 0;
  for (const inv of invoices) {
    const contactId = inv.customer?.id ? customerIdToContact.get(inv.customer.id) ?? null : null;
    const total = parseFloat(inv.amount) || 0;
    // Pièges connus (template Lomed) : un avoir a un reste dû NÉGATIF → valeur
    // absolue ; une facture ARCHIVÉE garde un reste dû fantôme → neutralisée
    // (statut void, reste dû 0) plutôt qu'ignorée, pour corriger une ligne
    // déjà importée avant son archivage.
    const archived = Boolean(inv.archived_at);
    const remaining = archived ? 0 : Math.abs(parseFloat(inv.remaining_amount) || 0);
    const paid = total - remaining;
    const status = archived ? "void" : STATUS_MAP[inv.status] || "open";

    const payload = {
      organization_id: ctx.orgId,
      contact_id: contactId,
      company_id: companyFor(inv.customer?.id, contactId),
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

    const known = invoiceLinks.get(String(inv.id)) ?? null;
    if (known) {
      await ctx.supabase.from("invoices").update(payload).eq("id", known);
      invoicesImported++;
    } else {
      const { data: created } = await ctx.supabase.from("invoices").insert(payload).select("id").single();
      const internalId = created?.id ?? null;
      if (internalId) {
        await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, String(inv.id), "invoice", internalId);
        invoicesImported++;
      }
    }
  }

  // Factures FOURNISSEURS → décaissements (direction 'out'). Alimente les
  // blocs Trésorerie (balance, charges fixes, runway). entity_type distinct
  // pour éviter toute collision d'ID avec les factures clients.
  const supplierLinks = await loadLinkMap(ctx, "supplier_invoice");
  let supplierInvoicesImported = 0;
  for (const inv of supplierInvoices) {
    const total = parseFloat(inv.amount) || 0;
    // Mêmes pièges que côté clients : avoirs négatifs (abs) + archivées neutralisées.
    const archived = Boolean(inv.archived_at);
    const remaining = archived ? 0 : Math.abs(parseFloat(inv.remaining_amount) || 0);
    const status = archived ? "void" : STATUS_MAP[inv.status] || "open";

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

    const known = supplierLinks.get(String(inv.id)) ?? null;
    let internalId = known;
    if (internalId) {
      const { error } = await ctx.supabase.from("invoices").update(payload).eq("id", internalId);
      // Migration `direction` pas encore appliquée → retente sans la colonne.
      if (error) {
        const { direction: _d, ...noDir } = payload;
        await ctx.supabase.from("invoices").update(noDir).eq("id", internalId);
      }
      supplierInvoicesImported++;
    } else {
      const first = await ctx.supabase.from("invoices").insert(payload).select("id").single();
      let created = first.data;
      if (first.error) {
        // Migration `direction` pas encore appliquée → retente sans la colonne.
        const { direction: _d, ...noDir } = payload;
        ({ data: created } = await ctx.supabase.from("invoices").insert(noDir).select("id").single());
      }
      internalId = created?.id ?? null;
      if (internalId) {
        await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, String(inv.id), "supplier_invoice", internalId);
        supplierInvoicesImported++;
      }
    }
  }

  // ── Transactions bancaires + comptes (v2) → tables bank_transactions /
  // bank_accounts. Upserts PAR LOTS (pas de N+1). Silencieux si la migration
  // 20260721000006_bank_transactions n'est pas encore appliquée.
  let transactionsImported = 0;
  if (transactions.length > 0) {
    const rows = transactions.map((t) => {
      // Catégorie dominante (poids le plus élevé) si la transaction est catégorisée.
      const cats = Array.isArray(t.categories) ? t.categories : [];
      const main = cats.length > 0
        ? [...cats].sort((a, b) => (Number(b.weight) || 0) - (Number(a.weight) || 0))[0]
        : null;
      return {
        organization_id: ctx.orgId,
        primary_source: PROVIDER,
        external_id: String(t.id),
        label: t.label ?? null,
        amount: parseFloat(t.amount) || 0,
        fee: t.fee != null ? parseFloat(t.fee) || 0 : 0,
        currency: (t.currency || "EUR").toUpperCase(),
        date: t.date,
        bank_account_external_id: t.bank_account?.id != null ? String(t.bank_account.id) : null,
        category: main?.label ?? null,
        category_group: main?.category_group?.label ?? null,
        updated_at: new Date().toISOString(),
      };
    });
    for (let i = 0; i < rows.length; i += 500) {
      let { error } = await ctx.supabase
        .from("bank_transactions")
        .upsert(rows.slice(i, i + 500), { onConflict: "organization_id,primary_source,external_id" });
      if (error) {
        // Migration catégorie pas appliquée → retente sans ces colonnes.
        const bare = rows.slice(i, i + 500).map(({ category: _c, category_group: _g, ...r }) => r);
        ({ error } = await ctx.supabase
          .from("bank_transactions")
          .upsert(bare, { onConflict: "organization_id,primary_source,external_id" }));
      }
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

  // ── Écritures comptables → balance reconstruite (ledger_balances) ──
  // Agrégées compte × mois côté connecteur : la table reste minuscule quel
  // que soit le volume d'écritures. Silencieux si migration non appliquée.
  let ledgerLinesAggregated = 0;
  if (ledgerLines.length > 0) {
    const accountLabel = new Map<number, { number: string | null; label: string | null }>();
    for (const a of ledgerAccounts) accountLabel.set(a.id, { number: a.number ?? null, label: a.label ?? null });

    const agg = new Map<string, { account_number: string; account_label: string | null; month: string; debit: number; credit: number }>();
    for (const line of ledgerLines) {
      const accId = line.ledger_account?.id;
      const number = line.ledger_account?.number ?? (accId != null ? accountLabel.get(accId)?.number : null);
      if (!number || !line.date) continue;
      const d = new Date(line.date);
      if (Number.isNaN(d.getTime())) continue;
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
      const key = `${number}|${month}`;
      const cur = agg.get(key) ?? {
        account_number: number,
        account_label: accId != null ? accountLabel.get(accId)?.label ?? null : null,
        month,
        debit: 0,
        credit: 0,
      };
      cur.debit += parseFloat(line.debit) || 0;
      cur.credit += parseFloat(line.credit) || 0;
      agg.set(key, cur);
      ledgerLinesAggregated++;
    }

    const rows = [...agg.values()].map((r) => ({
      organization_id: ctx.orgId,
      primary_source: PROVIDER,
      account_number: r.account_number,
      account_label: r.account_label,
      month: r.month,
      debit: Math.round(r.debit * 100) / 100,
      credit: Math.round(r.credit * 100) / 100,
      updated_at: new Date().toISOString(),
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await ctx.supabase
        .from("ledger_balances")
        .upsert(rows.slice(i, i + 500), { onConflict: "organization_id,primary_source,account_number,month" });
      if (error) { ledgerLinesAggregated = 0; break; } // migration absente → on n'insiste pas
    }
  }

  // Rapport d'audit (couverture SIREN/TVA/email + méthodes de match) —
  // affiché dans Audit qualité → Audit onboarding.
  await recordConnectorAudit(ctx.supabase, ctx.orgId, PROVIDER, {
    ran_at: new Date().toISOString(),
    totals: {
      contacts: contactsImported,
      companies: customerIdToCompany.size,
      invoices: invoicesImported,
      supplier_invoices: supplierInvoicesImported,
      bank_transactions: transactionsImported,
      ledger_lines: ledgerLinesAggregated,
    },
    contact_match: audit.contact_match,
    company_match: audit.company_match,
    unmatched: audit.unmatched,
    identifier_coverage: accessor.coverage(),
  });

  return ok("Synchronisation Pennylane terminée.", {
    contacts: contactsImported,
    invoices: invoicesImported,
    supplier_invoices: supplierInvoicesImported,
    payments: transactionsImported,
    ledger_lines: ledgerLinesAggregated,
  });
};
