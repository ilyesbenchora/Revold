/**
 * monday.com connector — pulls items from CRM-like boards and writes them
 * as canonical contacts (when an email is found) or deals.
 *
 * monday is highly schema-flexible, so we use heuristics on column titles
 * (Email, Phone, Company, Amount, Stage) — works for the standard CRM template.
 */

import {
  listMondayBoards,
  listMondayItems,
  pickCrmBoards,
  getCol,
} from "@/lib/integrations/sources/monday";
import { resolveContact, upsertSourceLink } from "@/lib/integrations/entity-resolution";
import { fail, ok, type SourceConnector } from "../types";

const PROVIDER = "monday";

export const mondayConnector: SourceConnector = async (ctx) => {
  const token = ctx.primaryToken;
  if (!token) return fail("API token monday manquant.");

  let boards;
  try {
    boards = await listMondayBoards(token);
  } catch (err) {
    return fail(`Erreur monday : ${(err as Error).message}`);
  }

  const crmBoards = pickCrmBoards(boards);
  if (crmBoards.length === 0) {
    return ok("Aucun board CRM/Deal détecté dans monday.", { contacts: 0, deals: 0 });
  }

  let contactsImported = 0;
  let dealsImported = 0;

  for (const board of crmBoards) {
    let items;
    try {
      items = await listMondayItems(token, board.id);
    } catch {
      continue;
    }

    for (const item of items) {
      const email = getCol(item, "Email", "E-mail");
      const phone = getCol(item, "Phone", "Téléphone");
      const stage = getCol(item, "Stage", "Status", "Statut");
      const amountStr = getCol(item, "Amount", "Deal value", "Montant", "Valeur");
      const amount = amountStr ? parseFloat(amountStr.replace(/[^\d.,-]/g, "").replace(",", ".")) : 0;

      // Treat as contact if it has an email
      if (email) {
        const resolved = await resolveContact(ctx.supabase, ctx.orgId, PROVIDER, item.id, {
          email,
          fullName: item.name,
          phone,
        });
        if (resolved) contactsImported++;
      }

      // Treat as deal if it has an amount or a stage
      if (amount > 0 || stage) {
        const isWon = stage ? /won|gagn/i.test(stage) : false;
        const isLost = stage ? /lost|perdu/i.test(stage) : false;

        const { data: existingLink } = await ctx.supabase
          .from("source_links")
          .select("internal_id")
          .eq("organization_id", ctx.orgId)
          .eq("provider", PROVIDER)
          .eq("entity_type", "deal")
          .eq("external_id", item.id)
          .maybeSingle();

        const payload = {
          organization_id: ctx.orgId,
          name: item.name || `monday item ${item.id}`,
          amount: Number.isFinite(amount) ? amount : 0,
          currency: "EUR",
          is_closed_won: isWon,
          is_closed_lost: isLost,
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
          await upsertSourceLink(ctx.supabase, ctx.orgId, PROVIDER, item.id, "deal", internalId);
          dealsImported++;
        }
      }
    }
  }

  return ok("Synchronisation monday CRM terminée.", {
    contacts: contactsImported,
    deals: dealsImported,
  });
};
