import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const body = await request.json();
  const { templateKey } = body;

  if (!templateKey || typeof templateKey !== "string") {
    return NextResponse.json({ error: "templateKey required" }, { status: 400 });
  }

  const { error } = await supabase.from("insight_dismissals").upsert(
    {
      organization_id: profile.organization_id,
      template_key: templateKey,
    },
    { onConflict: "organization_id,template_key" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
