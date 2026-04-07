import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotAuthUrl } from "@/lib/integrations/hubspot";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Try to get existing profile
  let { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  // If no profile, check if an org exists and create profile
  if (!profile) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .limit(1)
      .single();

    if (!org) return NextResponse.json({ error: "No organization found" }, { status: 400 });

    const { data: newProfile } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        organization_id: org.id,
        full_name: user.email?.split("@")[0] ?? "Utilisateur",
        role: "admin",
      })
      .select("organization_id")
      .single();

    profile = newProfile;
  }

  if (!profile) return NextResponse.json({ error: "Could not create profile" }, { status: 400 });

  const url = getHubSpotAuthUrl(profile.organization_id);
  return NextResponse.redirect(url);
}
