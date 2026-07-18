import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

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
    .select("id, page_key, title, entity, group_by, measure, field, unit_mode, view, custom_kpi, description, created_at")
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
      created_by: user.id,
    })
    .select("id, page_key, title, entity, group_by, measure, field, unit_mode, view, custom_kpi, description, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data });
}
