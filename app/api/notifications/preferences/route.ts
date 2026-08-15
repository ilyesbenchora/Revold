import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS, defaultPrefFor } from "@/lib/notifications/events";

export const dynamic = "force-dynamic";

const VALID_CHANNELS = new Set<string>(NOTIFICATION_CHANNELS.map((c) => c.key));
const VALID_EVENTS = new Set(NOTIFICATION_EVENTS.map((e) => e.key));

/**
 * Préférences de notification par événement (Paramètres → Notifications).
 * GET  : { prefs: { [event_key]: { enabled, channels } }, needsMigration }
 * POST : { event_key, enabled?, channels? } — upsert d'un événement.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const prefs: Record<string, { enabled: boolean; channels: string[] }> = {};
  for (const e of NOTIFICATION_EVENTS) prefs[e.key] = defaultPrefFor(e.key);

  let needsMigration = false;
  try {
    const { data, error } = await supabase
      .from("notification_event_prefs")
      .select("event_key, enabled, channels")
      .eq("organization_id", orgId);
    if (error) needsMigration = true;
    for (const row of (data ?? []) as Array<{ event_key: string; enabled: boolean; channels: unknown }>) {
      if (!VALID_EVENTS.has(row.event_key)) continue;
      prefs[row.event_key] = {
        enabled: row.enabled !== false,
        channels: Array.isArray(row.channels)
          ? row.channels.filter((c): c is string => typeof c === "string" && VALID_CHANNELS.has(c))
          : prefs[row.event_key].channels,
      };
    }
  } catch {
    needsMigration = true;
  }

  return NextResponse.json({ prefs, needsMigration });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { event_key?: string; enabled?: boolean; channels?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const eventKey = String(body.event_key ?? "");
  if (!VALID_EVENTS.has(eventKey)) return NextResponse.json({ error: "Événement inconnu" }, { status: 400 });

  const current = defaultPrefFor(eventKey);
  const channels = Array.isArray(body.channels)
    ? body.channels.filter((c): c is string => typeof c === "string" && VALID_CHANNELS.has(c))
    : current.channels;

  const { error } = await supabase.from("notification_event_prefs").upsert(
    {
      organization_id: orgId,
      event_key: eventKey,
      enabled: body.enabled !== false,
      channels,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,event_key" },
  );
  if (error) return NextResponse.json({ error: error.message, needsMigration: true }, { status: 500 });

  return NextResponse.json({ ok: true, event_key: eventKey, enabled: body.enabled !== false, channels });
}
