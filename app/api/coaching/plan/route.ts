import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getCoachingMemory } from "@/lib/coaching/session-memory";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["commercial", "marketing", "data", "integration", "cross-source", "data-model"]);

/** GET /api/coaching/plan?category=… — mémoire de coaching (résumé + plan d'action). */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const category = new URL(request.url).searchParams.get("category") ?? "";
  if (!CATEGORIES.has(category)) return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });

  const memory = await getCoachingMemory(supabase, orgId, category);
  return NextResponse.json(memory);
}
