import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

const CATEGORIES = new Set(["commercial", "marketing", "data", "integration", "cross-source", "data-model"]);

/** Marque une séance de coaching comme réalisée (fin manuelle ou auto par inactivité). */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { category?: string; auto?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const category = String(body.category ?? "");
  if (!CATEGORIES.has(category)) return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });

  const { error } = await supabase.from("coaching_sessions").insert({
    organization_id: orgId,
    category,
    auto: body.auto === true,
    ended_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
