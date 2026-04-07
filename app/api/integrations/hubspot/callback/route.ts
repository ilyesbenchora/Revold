import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exchangeHubSpotCode } from "@/lib/integrations/hubspot";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const orgId = url.searchParams.get("state");

  if (!code || !orgId) {
    return NextResponse.redirect(new URL("/dashboard/parametres?error=hubspot_auth_failed", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const tokens = await exchangeHubSpotCode(code);

    await supabase.from("integrations").upsert(
      {
        organization_id: orgId,
        provider: "hubspot",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" },
    );

    return NextResponse.redirect(new URL("/dashboard/parametres?hubspot=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/dashboard/parametres?error=hubspot_token_failed", request.url));
  }
}
