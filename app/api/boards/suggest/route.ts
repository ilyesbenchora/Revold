import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { proposeBoardComposition } from "@/lib/boards/board-suggest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Page Templates → « Compose ton tableau avec l'agent » : l'utilisateur décrit
 * son besoin, l'agent PROPOSE une composition (tuiles + tables) sanitisée —
 * rien n'est créé ici. La création passe par POST /api/boards { composition },
 * qui re-sanitise : ce qui est affiché est exactement ce qui est créé.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { brief?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  if (brief.length < 8) {
    return NextResponse.json({ error: "Décris ton besoin en une phrase (ex : « suivi de ma facturation ERP et des impayés »)." }, { status: 400 });
  }

  const res = await proposeBoardComposition(supabase, orgId, brief);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ proposal: res.proposal });
}
