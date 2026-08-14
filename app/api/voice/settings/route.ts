import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Réglages de la tour de contrôle vocale, rattachés au COMPTE (table
 * voice_tower_settings, une ligne par utilisateur) : ils suivent l'utilisateur
 * d'un appareil à l'autre. Résilient si la migration n'est pas appliquée :
 * le client garde alors son cache local.
 */

const BOOL_KEYS = [
  "healthRing", "brief", "veille", "quickAnswer", "createActions", "navigation", "queue", "memory",
  "briefAlerts", "briefObjectives", "briefSyncs", "briefMeetings",
] as const;

/** Donnée personnalisée du brief : KPI câblé (label + query déterministe). */
function sanitizeCustomItems(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .filter((i) => {
      const q = i.query as Record<string, unknown> | undefined;
      return (
        typeof i.id === "string" &&
        typeof i.label === "string" &&
        !!q &&
        typeof q.entity === "string" &&
        typeof q.groupBy === "string" &&
        typeof q.measure === "string"
      );
    })
    .slice(0, 12)
    .map((i) => {
      const q = i.query as Record<string, unknown>;
      return {
        id: (i.id as string).slice(0, 64),
        label: (i.label as string).slice(0, 120),
        enabled: i.enabled !== false,
        unit: typeof i.unit === "string" ? i.unit.slice(0, 16) : null,
        query: {
          entity: (q.entity as string).slice(0, 40),
          groupBy: (q.groupBy as string).slice(0, 40),
          measure: (q.measure as string).slice(0, 20),
          field: typeof q.field === "string" ? q.field.slice(0, 40) : null,
        },
      };
    });
}

function sanitize(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, unknown> = {};
  const r = raw as Record<string, unknown>;
  for (const k of BOOL_KEYS) if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  if (typeof r.briefPhrase === "string") out.briefPhrase = r.briefPhrase.slice(0, 60);
  if (Array.isArray(r.briefCustom)) out.briefCustom = sanitizeCustomItems(r.briefCustom);
  return Object.keys(out).length > 0 ? out : null;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("voice_tower_settings")
    .select("settings")
    .eq("user_id", user.id)
    .maybeSingle();

  // Table absente (migration non appliquée) → pas de réglages serveur, sans erreur.
  if (error) return NextResponse.json({ settings: null, persisted: false });
  return NextResponse.json({ settings: sanitize(data?.settings), persisted: true });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const settings = sanitize((body as { settings?: unknown })?.settings);
  if (!settings) return NextResponse.json({ error: "Réglages invalides" }, { status: 400 });

  const { error } = await supabase
    .from("voice_tower_settings")
    .upsert(
      { user_id: user.id, organization_id: orgId, settings, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error) return NextResponse.json({ persisted: false });
  return NextResponse.json({ persisted: true });
}
