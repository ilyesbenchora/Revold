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
    const { templateKey, status, title, body: insightBody, recommendation, severity, category, hubspotUrl } = body;

    if (!templateKey || typeof templateKey !== "string") {
      return NextResponse.json({ error: "templateKey requis" }, { status: 400 });
    }

    const dismissalStatus = status === "removed" ? "removed" : "done";

    // Try full snapshot upsert
    const fullPayload: Record<string, unknown> = {
      organization_id: profile.organization_id,
      template_key: templateKey,
      status: dismissalStatus,
      dismissed_at: new Date().toISOString(),
      title: title ?? null,
      body: insightBody ?? null,
      recommendation: recommendation ?? null,
      severity: severity ?? "info",
      category: category ?? "commercial",
      hubspot_url: hubspotUrl ?? null,
    };

    let { error } = await supabase
      .from("insight_dismissals")
      .upsert(fullPayload, { onConflict: "organization_id,template_key" });

    // Fallback: if any snapshot column is missing, retry with minimal payload
    if (error && /column .* does not exist/i.test(error.message)) {
      console.warn("[dismiss] snapshot columns missing, falling back to minimal payload");
      const minimalPayload: Record<string, unknown> = {
        organization_id: profile.organization_id,
        template_key: templateKey,
        dismissed_at: new Date().toISOString(),
      };
      // Try with status if column exists
      const tryWithStatus = await supabase
        .from("insight_dismissals")
        .upsert({ ...minimalPayload, status: dismissalStatus }, { onConflict: "organization_id,template_key" });
      if (tryWithStatus.error && tryWithStatus.error.message.toLowerCase().includes("status")) {
        const tryNoStatus = await supabase
          .from("insight_dismissals")
          .upsert(minimalPayload, { onConflict: "organization_id,template_key" });
        error = tryNoStatus.error;
      } else {
        error = tryWithStatus.error;
      }
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
