import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: `Profil introuvable: ${profileError?.message ?? "no profile"}` }, { status: 400 });
    }

    const { templateKey } = await request.json();
    if (!templateKey) return NextResponse.json({ error: "templateKey requis" }, { status: 400 });

    const { error } = await supabase
      .from("insight_dismissals")
      .delete()
      .eq("organization_id", profile.organization_id)
      .eq("template_key", templateKey);

    if (error) {
      console.error("[restore] supabase error:", error);
      return NextResponse.json({ error: `Erreur DB: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[restore] unexpected error:", err);
    return NextResponse.json({ error: `Erreur serveur: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
