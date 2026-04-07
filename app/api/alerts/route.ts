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
  const { title, description, impact, category } = body;

  if (!title || !description || !impact) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data, error } = await supabase.from("alerts").insert({
    organization_id: profile.organization_id,
    title,
    description,
    impact,
    category: category || "sales",
    status: "active",
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id: data.id });
}
