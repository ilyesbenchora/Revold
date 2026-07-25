import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { sanitizeStoredPeriod } from "@/lib/reports/periods";

export const dynamic = "force-dynamic";

/**
 * Valide une période reçue du client (repli « all » si inconnue).
 * Accepte les presets, « description » (période déjà précisée dans la
 * description du KPI) et « custom:YYYY-MM-DD..YYYY-MM-DD » (plage figée).
 */
export function cleanPeriod(v: unknown): string {
  return sanitizeStoredPeriod(v);
}

/** Valide la liste d'outils sources reçue du client (clés texte, dédupliquées, max 12). */
export function cleanSources(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((s): s is string => typeof s === "string" && !!s.trim()).map((s) => s.trim()))].slice(0, 12);
}

export const TABLE_COLS =
  "id, page_key, title, entity, group_by, measure, field, unit_mode, view, custom_kpi, description, period_preset, sources, created_at";

/** Liste les tables de données persistées d'une page. */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const pageKey = new URL(request.url).searchParams.get("page_key");
  if (!pageKey) return NextResponse.json({ error: "page_key requis" }, { status: 400 });

  const { data, error } = await supabase
    .from("page_data_tables")
    .select(TABLE_COLS)
    .eq("organization_id", orgId)
    .eq("page_key", pageKey)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tables: data ?? [] });
}

/** Crée une nouvelle table de données sur une page. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    page_key?: string; title?: string; entity?: string; group_by?: string;
    measure?: string; field?: string | null; unit_mode?: string | null; view?: string;
    period_preset?: string; sources?: string[];
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  if (!body.page_key || !body.title || !body.entity || !body.group_by) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("page_data_tables")
    .insert({
      organization_id: orgId,
      page_key: body.page_key,
      title: body.title,
      entity: body.entity,
      group_by: body.group_by,
      measure: body.measure || "count",
      field: body.field ?? null,
      unit_mode: body.unit_mode ?? null,
      view: body.view || "table",
      period_preset: cleanPeriod(body.period_preset),
      sources: cleanSources(body.sources),
      created_by: user.id,
    })
    .select(TABLE_COLS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data });
}
