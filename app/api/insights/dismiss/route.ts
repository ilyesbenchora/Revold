import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized — pas de session" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: `Profil introuvable: ${profileError?.message ?? "no profile"}` }, { status: 400 });
    }

    const body = await request.json();
    const { templateKey, status } = body;

    if (!templateKey || typeof templateKey !== "string") {
      return NextResponse.json({ error: "templateKey requis" }, { status: 400 });
    }

    const dismissalStatus = status === "removed" ? "removed" : "done";

    // First attempt with status column
    let { error } = await supabase.from("insight_dismissals").upsert(
      {
        organization_id: profile.organization_id,
        template_key: templateKey,
        status: dismissalStatus,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,template_key" },
    );

    // Fallback: if status column doesn't exist, retry without it
    if (error && error.message.toLowerCase().includes("status")) {
      console.warn("[dismiss] status column missing, falling back without it");
      const retry = await supabase.from("insight_dismissals").upsert(
        {
          organization_id: profile.organization_id,
          template_key: templateKey,
          dismissed_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,template_key" },
      );
      error = retry.error;
    }

    if (error) {
      console.error("[dismiss] supabase error:", error);
      return NextResponse.json({ error: `Erreur DB: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, templateKey, status: dismissalStatus });
  } catch (err) {
    console.error("[dismiss] unexpected error:", err);
    return NextResponse.json({ error: `Erreur serveur: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
