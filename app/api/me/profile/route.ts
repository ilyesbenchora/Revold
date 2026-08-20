import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Profil léger de l'utilisateur courant : rôle + pôle. Utilisé par le
 * formulaire Tour de contrôle pour proposer le bon choix d'équipe de récap
 * (admin → toutes les équipes ; membre rattaché à un pôle → son équipe seule).
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("role, pole").eq("id", user.id).maybeSingle();
  return NextResponse.json({
    role: (data?.role as string | null) ?? null,
    pole: (data?.pole as string | null) ?? null,
  });
}
