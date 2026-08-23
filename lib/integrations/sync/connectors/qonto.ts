/**
 * Qonto connector — transactions bancaires (12 mois) → table canonique
 * `payments`, pour la page Trésorerie et la réconciliation encaissements.
 *
 * Montants signés : crédit (encaissement) positif, débit (décaissement)
 * négatif — le sens est aussi conservé dans source_metadata.side.
 * Rattachement entreprise : contrepartie (label) via resolveCompany pour les
 * encaissements uniquement (les débits sont des fournisseurs, pas des clients).
 */

import {
  getQontoOrganization,
  listQontoTransactions,
  type QontoTransaction,
} from "@/lib/integrations/sources/qonto";
import { resolveCompany, upsertSourceLink } from "@/lib/integrations/entity-resolution";
import { loadIdentifierAccessor, newAuditCounters, recordConnectorAudit } from "../field-mapping";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "qonto";

const STATUS_MAP: Record<string, string> = {
  pending: "pending",
  completed: "succeeded",
  declined: "failed",
};

export const qontoConnector: SourceConnector = async (ctx) => {
  const slug = (ctx.credentials.organization_slug || "").trim();
  const secretKey = (ctx.credentials.secret_key || "").trim() || ctx.primaryToken;
  if (!slug || !secretKey) return fail("Identifiants Qonto manquants (slug d'organisation, clé secrète).");

  const org = await getQontoOrganization(slug, secretKey);
  if (!org) return fail("Qonto a refusé les identifiants (slug ou clé secrète invalides).");

  const transactions: Array<QontoTransaction & { iban: string }> = [];
  try {
    for (const account of org.bank_accounts ?? []) {
      const rows = await listQontoTransactions(slug, secretKey, account.iban);
      transactions.push(...rows.map((t) => ({ ...t, iban: account.iban })));
    }
  } catch (err) {
    return fail(`Erreur Qonto : ${(err as Error).message}`);
  }

  const accessor = await loadIdentifierAccessor(ctx.supabase, ctx.orgId, PROVIDER);
  const audit = newAuditCounters();

  // Paiements déjà importés → update au lieu d'insert.
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
  let companiesMatched = 0;
  const companyCache = new Map<string, string | null>();

  for (const t of transactions) {
    // Entreprise : contrepartie des encaissements uniquement (clients).
    let companyId: string | null = null;
    const ids = accessor.extract(t);
    const counterparty = ids.company_name ?? t.label ?? null;
    if (t.side === "credit" && counterparty) {
      if (companyCache.has(counterparty)) {
        companyId = companyCache.get(counterparty)!;
      } else {
        const company = await resolveCompany(ctx.supabase, ctx.orgId, PROVIDER, `cp_${counterparty}`, {
          name: counterparty,
          customId: ids.custom_id,
        });
        companyId = company?.id ?? null;
        companyCache.set(counterparty, companyId);
        if (company) {
          companiesMatched++;
          audit.bumpCompany(company.matchMethod);
        } else {
          audit.bumpUnmatched("encaissement_sans_entreprise");
        }
      }
    }

    const amountAbs = Math.abs(Number(t.amount) || 0);
    const payload = {
      organization_id: ctx.orgId,
      contact_id: null,
      company_id: companyId,
      status: STATUS_MAP[t.status ?? ""] ?? "pending",
      amount: t.side === "debit" ? -amountAbs : amountAbs,
      currency: (t.currency ?? "EUR").toUpperCase(),
      paid_at: t.settled_at ?? t.emitted_at ?? null,
      primary_source: PROVIDER,
      source_metadata: {
        qonto_id: t.transaction_id,
        side: t.side,
        operation_type: t.operation_type ?? null,
        label: t.label ?? null,
        reference: t.reference ?? null,
        iban: t.iban,
      },
    };

    const known = paymentLinks.get(t.transaction_id) ?? null;
    if (known) {
      await ctx.supabase.from("payments").update(payload).eq("id", known);
      paymentsImported++;
    } else {
      const { data: created } = await ctx.supabase.from("payments").insert(payload).select("id").single();
      if (created?.id) {
        await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, t.transaction_id, "payment", created.id);
        paymentsImported++;
      }
    }
  }

  await recordConnectorAudit(ctx.supabase, ctx.orgId, PROVIDER, {
    ran_at: new Date().toISOString(),
    totals: { companies: companiesMatched, payments: paymentsImported },
    contact_match: audit.contact_match,
    company_match: audit.company_match,
    unmatched: audit.unmatched,
    identifier_coverage: accessor.coverage(),
  });

  return ok("Synchronisation Qonto terminée.", {
    companies: companiesMatched,
    payments: paymentsImported,
  });
};
