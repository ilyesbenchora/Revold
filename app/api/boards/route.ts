import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

const MAX_BOARDS = 20;

/** Liste les tableaux de bord personnalisés de l'organisation. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { data, error } = await supabase
    .from("custom_dashboards")
    .select("id, name, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ boards: data ?? [] });
}

/** Crée un tableau de bord personnalisé. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { name?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });

  const { count } = await supabase
    .from("custom_dashboards")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if ((count ?? 0) >= MAX_BOARDS) {
    return NextResponse.json({ error: `Maximum ${MAX_BOARDS} tableaux de bord — supprime-en un d'abord.` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("custom_dashboards")
    .insert({ organization_id: orgId, name, created_by: user.id })
    .select("id, name")
    .single();
  if (error) {
    const msg = /custom_dashboards/.test(error.message)
      ? "Migration 20260819000001_custom_dashboards non appliquée (table absente)."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ board: data });
}
