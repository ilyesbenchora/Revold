import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

const KINDS = new Set(["kpi", "hide_tile", "hide_block", "tile_order", "tile_override"]);
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
    /** kind='tile_order' : ordre complet des clés de tuiles (drag & drop). */
    order?: unknown;
    /** kind='tile_override' : description affichée sous la valeur (optionnelle). */
    sub?: string | null;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const kind = body.kind || "kpi";
  if (!body.page_key || !KINDS.has(kind)) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  // ── Ordre des tuiles (drag & drop) : UNE ligne par page, upsert manuel
  // (l'index unique est partiel → pas d'ON CONFLICT possible via l'API). ──
  if (kind === "tile_order") {
    const order = Array.isArray(body.order)
      ? body.order.filter((k): k is string => typeof k === "string" && !!k.trim()).slice(0, 100)
      : null;
    if (!order || order.length === 0) {
      return NextResponse.json({ error: "order (liste de clés) requis" }, { status: 400 });
    }
    const { data: existing } = await supabase
      .from("page_tiles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("page_key", body.page_key)
      .eq("kind", "tile_order")
      .maybeSingle();
    const { error } = existing
      ? await supabase.from("page_tiles").update({ agg_spec: { order } }).eq("id", existing.id)
      : await supabase.from("page_tiles").insert({
          organization_id: orgId,
          page_key: body.page_key,
          kind: "tile_order",
          tile_key: "__order__",
          agg_spec: { order },
          created_by: user.id,
        });
    if (error) {
      const msg = /check|kind/i.test(error.message)
        ? "Migration 20260814000001_page_layout_order non appliquée (kind tile_order refusé)."
        : error.message;
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── Override d'une tuile PAR DÉFAUT (✎) : titre + description — UNE ligne
  // par tuile, upsert manuel (index unique partiel → pas d'ON CONFLICT). ──
  if (kind === "tile_override") {
    if (!body.tile_key?.trim()) return NextResponse.json({ error: "tile_key requis" }, { status: 400 });
    if (!body.title?.trim()) return NextResponse.json({ error: "title requis" }, { status: 400 });
    const values = {
      title: body.title.trim(),
      // sub vide ou absent = revenir à la description d'origine de la tuile.
      agg_spec: typeof body.sub === "string" && body.sub.trim() ? { sub: body.sub.trim() } : null,
    };
    const { data: existing } = await supabase
      .from("page_tiles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("page_key", body.page_key)
      .eq("kind", "tile_override")
      .eq("tile_key", body.tile_key.trim())
      .maybeSingle();
    const { error } = existing
      ? await supabase.from("page_tiles").update(values).eq("id", existing.id)
      : await supabase.from("page_tiles").insert({
          organization_id: orgId,
          page_key: body.page_key,
          kind: "tile_override",
          tile_key: body.tile_key.trim(),
          ...values,
          created_by: user.id,
        });
    if (error) {
      const msg = /check|kind/i.test(error.message)
        ? "Migration 20260818000002_page_tile_override non appliquée (kind tile_override refusé)."
        : error.message;
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
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
