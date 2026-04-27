/**
 * Webhook receiver HubSpot.
 *
 * Reçoit 4 catégories d'events et les route :
 *   - *.creation        → delta sync de l'object_type
 *   - *.propertyChange  → delta sync (le watermark va capturer le record)
 *   - *.deletion        → suppression locale immédiate
 *   - *.merged          → suppression des records absorbés + refresh du
 *                         survivant (delta sync)
 *
 * Configuration côté HubSpot Developer Portal → ton app → Webhooks :
 *   Target URL : https://revold.io/api/webhooks/hubspot
 *   Subscriptions :
 *     contact.{creation,deletion,merged,propertyChange}
 *     company.{creation,deletion,merged,propertyChange}
 *     deal.{creation,deletion,merged,propertyChange}
 *     ticket.{creation,deletion,propertyChange}    (pas de ticket.merged)
 *
 * Sécurité : signature HMAC-SHA256 v3 dans X-HubSpot-Signature-V3
 * (clé = HUBSPOT_CLIENT_SECRET).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { syncCrmObject } from "@/lib/sync/hubspot-etl";
import { computeSnapshotFromLocal, persistSnapshotCache } from "@/lib/sync/compute-snapshot";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type HubSpotEvent = {
  eventId: number;
  subscriptionId: number;
  portalId: number;
  appId: number;
  occurredAt: number;
  subscriptionType: string; // "deal.creation" | "deal.merged" | ...
  attemptNumber: number;
  objectId: number;
  changeSource?: string;
  changeFlag?: string;
  propertyName?: string;
  propertyValue?: string;
  // Champs additionnels présents pour merge events (variables selon
  // version HubSpot — on lit défensivement sous plusieurs clés)
  mergedFromObjectIds?: number[];
  primaryObjectId?: number;
  additionalData?: {
    mergedFromObjectIds?: number[];
    primaryObjectId?: number;
  };
};

type CrmType = "contacts" | "companies" | "deals" | "tickets";

const TYPE_MAP: Record<string, CrmType> = {
  contact: "contacts",
  company: "companies",
  deal: "deals",
  ticket: "tickets",
};

function verifySignature(req: NextRequest, body: string): boolean {
  const sig = req.headers.get("x-hubspot-signature-v3");
  const ts = req.headers.get("x-hubspot-request-timestamp");
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!sig || !ts || !secret) return false;

  const url = `${req.nextUrl.protocol}//${req.headers.get("host")}${req.nextUrl.pathname}`;
  const message = `POST${url}${body}${ts}`;
  const expected = createHmac("sha256", secret).update(message).digest("base64");
  return expected === sig;
}

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

/**
 * Supprime localement un ou plusieurs records HubSpot par leur hubspot_id.
 * Idempotent : si le record n'existe pas en local, no-op.
 */
async function deleteLocalRecords(
  supabase: SupabaseClient,
  orgId: string,
  type: CrmType,
  hubspotIds: string[],
): Promise<number> {
  if (hubspotIds.length === 0) return 0;
  const { error, count } = await supabase
    .from(type)
    .delete({ count: "exact" })
    .eq("organization_id", orgId)
    .in("hubspot_id", hubspotIds);
  if (error) {
    console.error(`[webhook] delete ${type}`, error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Extrait les IDs absorbés d'un event merge — HubSpot stocke ces IDs sous
 * différentes clés selon la version du payload. On vérifie tout.
 */
function extractMergedFromIds(ev: HubSpotEvent): string[] {
  const candidates: number[] = [
    ...(ev.mergedFromObjectIds ?? []),
    ...(ev.additionalData?.mergedFromObjectIds ?? []),
  ];
  return candidates.filter((n) => Number.isFinite(n)).map(String);
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  if (process.env.HUBSPOT_CLIENT_SECRET && !verifySignature(req, bodyText)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let events: HubSpotEvent[];
  try {
    const parsed = JSON.parse(bodyText);
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Groupe les events par portalId × type avec leurs actions à exécuter
  type Action = {
    needsDeltaSync: boolean;       // creation, propertyChange, merged
    deletions: Set<string>;        // hubspot_ids à supprimer localement
  };
  const actions = new Map<string, Map<CrmType, Action>>();

  for (const ev of events) {
    const [objectKey, action] = ev.subscriptionType.split(".");
    const type = TYPE_MAP[objectKey];
    if (!type) continue;
    const portalKey = String(ev.portalId);
    if (!actions.has(portalKey)) actions.set(portalKey, new Map());
    const portalActions = actions.get(portalKey)!;
    if (!portalActions.has(type)) {
      portalActions.set(type, { needsDeltaSync: false, deletions: new Set() });
    }
    const a = portalActions.get(type)!;

    switch (action) {
      case "creation":
      case "propertyChange":
        a.needsDeltaSync = true;
        break;
      case "deletion":
        a.deletions.add(String(ev.objectId));
        break;
      case "merged": {
        // Le record survivant (objectId) doit être resync,
        // les records absorbés (mergedFromObjectIds) doivent être supprimés
        a.needsDeltaSync = true;
        const absorbed = extractMergedFromIds(ev);
        for (const id of absorbed) a.deletions.add(id);
        break;
      }
      default:
        // Event inconnu (ex: restored) → on log mais on continue
        console.warn(`[webhook] event ignoré : ${ev.subscriptionType}`);
    }
  }

  const supabase = adminClient();
  const summary = {
    eventsReceived: events.length,
    orgsProcessed: 0,
    deletedRecords: 0,
    syncedTypes: 0,
  };

  for (const [portalIdStr, portalActions] of actions) {
    const { data: integration } = await supabase
      .from("integrations")
      .select("organization_id")
      .eq("provider", "hubspot")
      .eq("portal_id", portalIdStr)
      .eq("is_active", true)
      .maybeSingle();
    if (!integration) continue;

    const orgId = integration.organization_id as string;
    const token = await getHubSpotToken(supabase, orgId);
    if (!token) continue;

    for (const [type, a] of portalActions) {
      // 1. Suppressions locales (deletion + records absorbés par un merge)
      if (a.deletions.size > 0) {
        const deleted = await deleteLocalRecords(
          supabase,
          orgId,
          type,
          Array.from(a.deletions),
        );
        summary.deletedRecords += deleted;
      }

      // 2. Delta sync si creation/propertyChange/merged
      if (a.needsDeltaSync) {
        try {
          await syncCrmObject(token, supabase, orgId, type, "delta");
          summary.syncedTypes++;
        } catch (err) {
          console.error(`[webhook] sync ${type} failed for org ${orgId}`, err);
        }
      }
    }

    // 3. Recompute snapshot pour propager au cache (UI voit < 5 s)
    try {
      const snap = await computeSnapshotFromLocal(supabase, orgId);
      await persistSnapshotCache(supabase, orgId, snap, "sync");
    } catch (err) {
      console.error(`[webhook] snapshot recompute failed for org ${orgId}`, err);
    }
    summary.orgsProcessed++;
  }

  return NextResponse.json({ ok: true, ...summary });
}
