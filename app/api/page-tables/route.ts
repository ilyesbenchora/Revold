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
  "id, page_key, title, entity, group_by, measure, field, unit_mode, view, custom_kpi, description, period_preset, sources, show_total, show_filters, pipeline, granularity, position, created_at";

/** Fréquences temporelles valides (dimensions month_*). */
export const VALID_GRANULARITIES = new Set(["day", "week", "month", "quarter", "semester", "year"]);

/** Liste les tables de données persistées d'une page. */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const pageKey = new URL(request.url).searchParams.get("page_key");
  if (!pageKey) return NextResponse.json({ error: "page_key requis" }, { status: 400 });

  // Résilient aux colonnes récentes non migrées (sources, show_total…) : on
  // retire la colonne fautive et on réessaie plutôt que casser la liste.
  let cols = TABLE_COLS;
  for (let i = 0; i < 4; i++) {
    // Ordre : position (drag & drop) puis date de création — sans tri position
    // si la colonne n'est pas migrée (elle a été retirée de cols à l'essai précédent).
    let query = supabase
      .from("page_data_tables")
      .select(cols)
      .eq("organization_id", orgId)
      .eq("page_key", pageKey);
    if (cols.includes("position")) query = query.order("position", { ascending: true, nullsFirst: false });
    const { data, error } = await query.order("created_at", { ascending: true });
    if (!error) return NextResponse.json({ tables: data ?? [] });
    const m = /column .*?([a-z_0-9]+) does not exist/i.exec(error.message);
    if (m && cols.includes(`, ${m[1]}`)) { cols = cols.replace(`, ${m[1]}`, ""); continue; }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tables: [] });
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
    // KPI personnalisé confirmé à l'étape « Vérification » : la spec résolue par
    // l'agent (déjà affichée à l'utilisateur) est créée telle quelle.
    custom_kpi?: string | null; description?: string | null;
    // Deals uniquement : pipeline ciblé (nom ou id) — évite les étapes homonymes.
    pipeline?: string | null;
    // Fréquence des dimensions temporelles (day/week/month/quarter/semester/year).
    granularity?: string | null;
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
      custom_kpi: typeof body.custom_kpi === "string" && body.custom_kpi.trim() ? body.custom_kpi.trim() : null,
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      pipeline: typeof body.pipeline === "string" && body.pipeline.trim() ? body.pipeline.trim() : null,
      granularity: typeof body.granularity === "string" && VALID_GRANULARITIES.has(body.granularity) ? body.granularity : null,
      created_by: user.id,
    })
    .select(TABLE_COLS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data });
}
