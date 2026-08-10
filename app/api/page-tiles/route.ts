import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

const KINDS = new Set(["kpi", "hide_tile", "hide_block"]);
const UNITS = new Set(["percent", "currency", "count"]);

/** Liste la personnalisation d'une page (tuiles ajoutées + masquages). */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const pageKey = new URL(request.url).searchParams.get("page_key");
  if (!pageKey) return NextResponse.json({ error: "page_key requis" }, { status: 400 });

  const { data, error } = await supabase
    .from("page_tiles")
    .select("id, kind, tile_key, title, forecast_type, agg_spec, unit_mode, position, created_at")
    .eq("organization_id", orgId)
    .eq("page_key", pageKey)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tiles: data ?? [] });
}

/** Ajoute une tuile KPI, ou masque une tuile/un bloc par défaut. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    page_key?: string; kind?: string; tile_key?: string | null; title?: string | null;
    forecast_type?: string | null; agg_spec?: Record<string, unknown> | null;
    unit_mode?: string | null; position?: number;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const kind = body.kind || "kpi";
  if (!body.page_key || !KINDS.has(kind)) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }
  if (kind === "kpi") {
    // Une tuile KPI doit être résoluble : forecast_type OU agg_spec (contrat cron).
    const hasForecast = typeof body.forecast_type === "string" && body.forecast_type.trim();
    const spec = body.agg_spec;
    const hasAgg = spec && typeof spec === "object" && typeof spec.entity === "string" && typeof spec.groupBy === "string";
    if (!hasForecast && !hasAgg) {
      return NextResponse.json({ error: "forecast_type ou agg_spec requis" }, { status: 400 });
    }
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: "title requis" }, { status: 400 });
    }
  } else if (!body.tile_key || !body.tile_key.trim()) {
    return NextResponse.json({ error: "tile_key requis pour un masquage" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("page_tiles")
    .insert({
      organization_id: orgId,
      page_key: body.page_key,
      kind,
      tile_key: body.tile_key?.trim() || null,
      title: body.title?.trim() || null,
      forecast_type: body.forecast_type?.trim() || null,
      agg_spec: kind === "kpi" && body.agg_spec && typeof body.agg_spec === "object" ? body.agg_spec : null,
      unit_mode: body.unit_mode && UNITS.has(body.unit_mode) ? body.unit_mode : null,
      position: Number.isFinite(body.position) ? Math.trunc(body.position as number) : 0,
      created_by: user.id,
    })
    .select("id, kind, tile_key, title, forecast_type, agg_spec, unit_mode, position")
    .single();

  if (error) {
    // Masquage déjà enregistré (index unique) → idempotent, pas une erreur utilisateur.
    if (/duplicate key/i.test(error.message)) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tile: data });
}
