import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchAllRecords,
  mapRecord,
  extraValuesFromRecord,
  customProvider,
  type CustomConnector,
  type CustomEndpoint,
} from "@/lib/integrations/custom-connector";
import { resolveCompany, resolveContact, upsertSourceLink } from "@/lib/integrations/entity-resolution";

/**
 * Synchronisation d'un CONNECTEUR SUR MESURE (ERP maison, logiciel métier).
 *
 * Le principe qui rend la chose possible sans code dédié : l'outil n'a pas
 * besoin d'être « connu » de Revold, il suffit que chaque enregistrement porte
 * l'ID DE RAPPROCHEMENT (le code client partagé avec le CRM). Revold résout
 * l'entreprise canonique par cet ID — exactement comme la règle
 * custom_id_match du moteur de résolution — puis écrit factures, abonnements,
 * transactions et tickets dans les MÊMES tables que Stripe ou Pennylane. Tous
 * les rapports cross-source fonctionnent alors immédiatement.
 */

export type CustomSyncCounts = {
  companies: number;
  contacts: number;
  deals: number;
  invoices: number;
  subscriptions: number;
  transactions: number;
  tickets: number;
  /** Enregistrements ignorés faute d'ID de rapprochement exploitable. */
  unmatched: number;
};

const num = (v: string | null | undefined): number | null => {
  if (v == null || v === "") return null;
  // Tolère « 1 234,56 € » et « 1,234.56 ».
  const cleaned = String(v).replace(/\s|€| /g, "");
  const normalized = cleaned.includes(",") && !cleaned.includes(".") ? cleaned.replace(",", ".") : cleaned.replace(/,(?=\d{3}\b)/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const date = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Map ID de rapprochement → company_id canonique (une requête, insensible à la casse). */
async function loadCustomIdIndex(sb: SupabaseClient, orgId: string): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  for (let page = 0; page < 20; page++) {
    const { data, error } = await sb
      .from("companies")
      .select("id, custom_id")
      .eq("organization_id", orgId)
      .not("custom_id", "is", null)
      .range(page * 1000, page * 1000 + 999);
    if (error) break;
    const rows = (data ?? []) as Array<{ id: string; custom_id: string | null }>;
    for (const r of rows) if (r.custom_id) index.set(r.custom_id.trim().toLowerCase(), r.id);
    if (rows.length < 1000) break;
  }
  return index;
}

/** Lignes déjà importées : external_id → id interne (évite le N+1). */
async function loadLinkMap(sb: SupabaseClient, orgId: string, provider: string, entityType: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data } = await sb
    .from("source_links")
    .select("external_id, internal_id")
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .eq("entity_type", entityType)
    .limit(10000);
  for (const r of (data ?? []) as Array<{ external_id: string; internal_id: string }>) {
    map.set(r.external_id, r.internal_id);
  }
  return map;
}

export async function syncCustomConnector(
  sb: SupabaseClient,
  connector: CustomConnector,
  endpoints: CustomEndpoint[],
): Promise<{ counts: CustomSyncCounts; errors: string[] }> {
  const provider = customProvider(connector.key);
  const orgId = connector.organization_id;
  const counts: CustomSyncCounts = {
    companies: 0, contacts: 0, deals: 0, invoices: 0, subscriptions: 0, transactions: 0, tickets: 0, unmatched: 0,
  };
  const errors: string[] = [];

  const active = endpoints.filter((e) => e.is_active);
  // 1. Les CLIENTS d'abord : ils posent/complètent les ID de rapprochement.
  const ordered = [...active].sort((a, b) => (a.entity === "companies" ? -1 : b.entity === "companies" ? 1 : 0));

  let index = await loadCustomIdIndex(sb, orgId);

  for (const ep of ordered) {
    const { records, error } = await fetchAllRecords(connector, ep);
    if (error) {
      errors.push(`${ep.entity} : ${error}`);
      continue;
    }
    const rows = records.map((r) => mapRecord(r, ep.field_map));
    // Champs MÉTIER supplémentaires (extra_fields) : valeurs typées extraites
    // de l'enregistrement BRUT, rangées dans source_metadata.extra.<id> —
    // agrégeables dans le funnel (groupBy/field "extra.<id>").
    const rowExtras = records.map((r) => extraValuesFromRecord(r, ep.extra_fields));
    const extraOf = new Map(rows.map((r, i) => [r, rowExtras[i]]));

    // ── CLIENTS : résolution d'entreprise par ID de rapprochement ──
    if (ep.entity === "companies") {
      for (const r of rows) {
        const customId = r.custom_id?.trim();
        if (!customId) {
          counts.unmatched++;
          continue;
        }
        const resolved = await resolveCompany(sb, orgId, provider, r.external_id?.trim() || customId, {
          name: r.name,
          domain: r.domain,
          siren: r.siren,
          vatNumber: r.vat_number,
          customId,
        });
        if (resolved) {
          index.set(customId.toLowerCase(), resolved.id);
          counts.companies++;
        } else {
          counts.unmatched++;
        }
      }
      // L'index profite des entreprises créées à l'instant.
      index = await loadCustomIdIndex(sb, orgId);
      continue;
    }

    const companyFor = (r: Record<string, string | null>): string | null => {
      const cid = r.custom_id?.trim().toLowerCase();
      return cid ? index.get(cid) ?? null : null;
    };

    // ── CONTACTS (identifiés par l'email, rattachés à leur entreprise) ──
    if (ep.entity === "contacts") {
      for (const r of rows) {
        const email = r.email?.trim();
        if (!email) {
          counts.unmatched++;
          continue;
        }
        const resolved = await resolveContact(sb, orgId, provider, r.external_id?.trim() || email, {
          email,
          fullName: r.full_name,
          phone: r.phone,
        });
        if (!resolved) {
          counts.unmatched++;
          continue;
        }
        // Rattachement à l'entreprise + fonction : complétés à part pour ne
        // jamais écraser ce qu'une autre source a déjà renseigné.
        const patch: Record<string, unknown> = {};
        const companyId = companyFor(r);
        if (companyId) patch.company_id = companyId;
        if (r.title) patch.title = r.title;
        if (Object.keys(patch).length > 0) await sb.from("contacts").update(patch).eq("id", resolved.id);
        counts.contacts++;
      }
      continue;
    }

    // ── OPPORTUNITÉS / AFFAIRES ──
    if (ep.entity === "deals") {
      const links = await loadLinkMap(sb, orgId, provider, "deal");
      for (const r of rows) {
        const externalId = r.external_id?.trim();
        if (!externalId) continue;
        const companyId = companyFor(r);
        if (!companyId) counts.unmatched++;
        // Statut libre de l'outil → gagné / perdu (le vocabulaire varie).
        const status = (r.status ?? "").toLowerCase();
        const won = /gagn|won|sign|conclu|accept/.test(status);
        const lost = /perdu|lost|abandon|annul|refus|clos.*perdu/.test(status);
        const payload = {
          organization_id: orgId,
          company_id: companyId,
          name: r.name ?? externalId,
          amount: num(r.amount),
          created_date: date(r.created_date)?.slice(0, 10) ?? null,
          close_date: date(r.close_date)?.slice(0, 10) ?? null,
          is_closed_won: won,
          is_closed_lost: lost,
          // Champs métier supplémentaires — colonne posée par la migration
          // 20260819000002 (livrée avec ce code, appliquée au même build).
          ...(extraOf.get(r) ? { source_metadata: { custom_connector: connector.key, extra: extraOf.get(r) } } : {}),
          updated_at: new Date().toISOString(),
        };
        const known = links.get(externalId);
        if (known) {
          const { error: e } = await sb.from("deals").update(payload).eq("id", known);
          if (!e) counts.deals++;
        } else {
          const { data: created } = await sb.from("deals").insert(payload).select("id").single();
          if (created?.id) {
            await upsertSourceLink(sb, orgId, provider, externalId, "deal", created.id as string);
            counts.deals++;
          }
        }
      }
      continue;
    }

    // ── FACTURES ──
    if (ep.entity === "invoices") {
      const links = await loadLinkMap(sb, orgId, provider, "invoice");
      for (const r of rows) {
        const externalId = r.external_id?.trim() || r.number?.trim();
        if (!externalId) continue;
        const companyId = companyFor(r);
        if (!companyId) counts.unmatched++;
        const total = num(r.amount_total) ?? 0;
        const paid = num(r.amount_paid);
        const due = num(r.amount_due);
        const payload = {
          organization_id: orgId,
          company_id: companyId,
          number: r.number ?? externalId,
          status: r.status ?? (due != null && due <= 0 ? "paid" : "open"),
          amount_total: total,
          amount_paid: paid ?? (due != null ? total - due : 0),
          amount_due: due ?? (paid != null ? total - paid : total),
          issued_at: date(r.issued_at),
          paid_at: date(r.paid_at),
          due_at: date(r.due_at),
          primary_source: provider,
          source_metadata: {
            custom_connector: connector.key,
            external_id: externalId,
            ...(extraOf.get(r) ? { extra: extraOf.get(r) } : {}),
          },
          updated_at: new Date().toISOString(),
        };
        const known = links.get(externalId);
        if (known) {
          const { error: e } = await sb.from("invoices").update(payload).eq("id", known);
          if (!e) counts.invoices++;
        } else {
          const { data: created } = await sb.from("invoices").insert(payload).select("id").single();
          if (created?.id) {
            await upsertSourceLink(sb, orgId, provider, externalId, "invoice", created.id as string);
            counts.invoices++;
          }
        }
      }
      continue;
    }

    // ── ABONNEMENTS ──
    if (ep.entity === "subscriptions") {
      const links = await loadLinkMap(sb, orgId, provider, "subscription");
      for (const r of rows) {
        const externalId = r.external_id?.trim();
        if (!externalId) continue;
        const companyId = companyFor(r);
        if (!companyId) counts.unmatched++;
        const payload = {
          organization_id: orgId,
          company_id: companyId,
          mrr: num(r.mrr) ?? 0,
          status: r.status ?? "active",
          started_at: date(r.started_at),
          canceled_at: date(r.canceled_at),
          primary_source: provider,
          source_metadata: {
            custom_connector: connector.key,
            external_id: externalId,
            ...(extraOf.get(r) ? { extra: extraOf.get(r) } : {}),
          },
          updated_at: new Date().toISOString(),
        };
        const known = links.get(externalId);
        if (known) {
          const { error: e } = await sb.from("subscriptions").update(payload).eq("id", known);
          if (!e) counts.subscriptions++;
        } else {
          const { data: created } = await sb.from("subscriptions").insert(payload).select("id").single();
          if (created?.id) {
            await upsertSourceLink(sb, orgId, provider, externalId, "subscription", created.id as string);
            counts.subscriptions++;
          }
        }
      }
      continue;
    }

    // ── TRANSACTIONS (encaissements / décaissements réels) ──
    if (ep.entity === "transactions") {
      const links = await loadLinkMap(sb, orgId, provider, "transaction");
      for (const r of rows) {
        const externalId = r.external_id?.trim();
        if (!externalId) continue;
        const payload = {
          organization_id: orgId,
          company_id: companyFor(r),
          label: r.label ?? "Transaction",
          amount: num(r.amount) ?? 0,
          date: date(r.date)?.slice(0, 10) ?? null,
          category: r.category ?? null,
          primary_source: provider,
          ...(extraOf.get(r) ? { source_metadata: { custom_connector: connector.key, extra: extraOf.get(r) } } : {}),
          updated_at: new Date().toISOString(),
        };
        const known = links.get(externalId);
        if (known) {
          const { error: e } = await sb.from("bank_transactions").update(payload).eq("id", known);
          if (!e) counts.transactions++;
        } else {
          const { data: created } = await sb.from("bank_transactions").insert(payload).select("id").single();
          if (created?.id) {
            await upsertSourceLink(sb, orgId, provider, externalId, "transaction", created.id as string);
            counts.transactions++;
          }
        }
      }
      continue;
    }

    // ── TICKETS ──
    if (ep.entity === "tickets") {
      const links = await loadLinkMap(sb, orgId, provider, "ticket");
      for (const r of rows) {
        const externalId = r.external_id?.trim();
        if (!externalId) continue;
        const payload = {
          organization_id: orgId,
          company_id: companyFor(r),
          subject: r.subject ?? "Ticket",
          status: r.status ?? "open",
          priority: r.priority ?? null,
          opened_at: date(r.opened_at),
          resolved_at: date(r.resolved_at),
          closed_at: date(r.resolved_at),
          primary_source: provider,
          ...(extraOf.get(r) ? { source_metadata: { custom_connector: connector.key, extra: extraOf.get(r) } } : {}),
          updated_at: new Date().toISOString(),
        };
        const known = links.get(externalId);
        if (known) {
          const { error: e } = await sb.from("tickets").update(payload).eq("id", known);
          if (!e) counts.tickets++;
        } else {
          const { data: created } = await sb.from("tickets").insert(payload).select("id").single();
          if (created?.id) {
            await upsertSourceLink(sb, orgId, provider, externalId, "ticket", created.id as string);
            counts.tickets++;
          }
        }
      }
    }
  }

  return { counts, errors };
}
