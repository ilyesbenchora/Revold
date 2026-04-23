/**
 * Webhook receiver HubSpot.
 *
 * HubSpot pousse les événements (deal.creation, deal.propertyChange,
 * contact.creation, etc.) sur cet endpoint. On met à jour Supabase en
 * temps réel, puis on recompute le snapshot de l'org concernée.
 *
 * Configuration côté HubSpot (Settings → Integrations → Private Apps OU
 * App Marketplace) :
 *   Target URL : https://revold.io/api/webhooks/hubspot
 *   Events :
 *     - contact.creation, contact.deletion, contact.propertyChange
 *     - company.creation, company.deletion, company.propertyChange
 *     - deal.creation, deal.deletion, deal.propertyChange
 *     - ticket.creation, ticket.deletion, ticket.propertyChange
 *
 * Sécurité : on vérifie la signature HMAC-SHA256 v3 envoyée dans
 * X-HubSpot-Signature-V3 (clé = HUBSPOT_CLIENT_SECRET).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { syncCrmObject } from "@/lib/sync/hubspot-etl";
import { computeSnapshotFromLocal, persistSnapshotCache } from "@/lib/sync/compute-snapshot";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { createHmac } from "crypto";

type HubSpotEvent = {
  eventId: number;
  subscriptionId: number;
  portalId: number;
  appId: number;
  occurredAt: number;
  subscriptionType: string; // ex: "deal.creation"
  attemptNumber: number;
  objectId: number;
  changeSource?: string;
  changeFlag?: string;
  propertyName?: string;
  propertyValue?: string;
};

function verifySignature(req: NextRequest, body: string): boolean {
  const sig = req.headers.get("x-hubspot-signature-v3");
  const ts = req.headers.get("x-hubspot-request-timestamp");
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!sig || !ts || !secret) return false;

  // HubSpot v3 : signature = base64(hmacSHA256(secret, METHOD + URL + body + timestamp))
  const url = `${req.nextUrl.protocol}//${req.headers.get("host")}${req.nextUrl.pathname}`;
  const message = `POST${url}${body}${ts}`;
  const expected = createHmac("sha256", secret).update(message).digest("base64");
  return expected === sig;
}

function adminClient() {
  // Server-only client utilisé depuis un webhook HubSpot (pas d'utilisateur
  // auth). On utilise le service role key pour bypass RLS.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

const TYPE_MAP: Record<string, "contacts" | "companies" | "deals" | "tickets"> = {
  contact: "contacts",
  company: "companies",
  deal: "deals",
  ticket: "tickets",
};

export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  // Vérifie la signature HMAC sauf si on est en dev local sans secret
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

  // Group events by portalId × object_type pour éviter les doubles syncs
  const byPortal = new Map<string, Set<string>>();
  for (const ev of events) {
    const objectKey = ev.subscriptionType.split(".")[0];
    const objectType = TYPE_MAP[objectKey];
    if (!objectType) continue;
    const portalKey = String(ev.portalId);
    if (!byPortal.has(portalKey)) byPortal.set(portalKey, new Set());
    byPortal.get(portalKey)!.add(objectType);
  }

  const supabase = adminClient();
  let processedOrgs = 0;
  for (const [portalIdStr, types] of byPortal) {
    // Trouve l'org Revold qui possède ce portail HubSpot
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

    // Pour chaque object_type touché par les events, on lance un delta sync
    // (le watermark hs_lastmodifieddate va capturer les nouveaux records)
    for (const type of types) {
      const t = type as "contacts" | "companies" | "deals" | "tickets";
      try {
        await syncCrmObject(token, supabase, orgId, t, "delta");
      } catch (err) {
        console.error(`[webhook] sync ${t} failed for org ${orgId}`, err);
      }
    }

    // Recompute snapshot pour que l'UI voit les changements immédiatement
    try {
      const snap = await computeSnapshotFromLocal(supabase, orgId);
      await persistSnapshotCache(supabase, orgId, snap, "sync");
    } catch (err) {
      console.error(`[webhook] snapshot recompute failed for org ${orgId}`, err);
    }
    processedOrgs++;
  }

  return NextResponse.json({
    ok: true,
    eventsReceived: events.length,
    orgsProcessed: processedOrgs,
  });
}
