import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { refreshHubSpotToken } from "@/lib/integrations/hubspot";
import { syncHubSpotData } from "@/lib/integrations/hubspot-sync";
import { env } from "@/lib/env";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export async function POST(request: Request) {
  // Can be called by cron or manually
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all active HubSpot integrations
  const { data: integrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("provider", "hubspot")
    .eq("is_active", true);

  if (!integrations || integrations.length === 0) {
    return NextResponse.json({ message: "No active HubSpot integrations" });
  }

  const results = [];

  for (const integration of integrations) {
    let accessToken = integration.access_token;

    // Refresh token if expired
    const expiresAt = new Date(integration.token_expires_at).getTime();
    if (Date.now() > expiresAt - 60000) {
      try {
        const tokens = await refreshHubSpotToken(integration.refresh_token);
        accessToken = tokens.access_token;

        await supabase.from("integrations").update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", integration.id);
      } catch (err) {
        results.push({ org_id: integration.organization_id, error: `Token refresh failed: ${err}` });
        continue;
      }
    }

    try {
      const result = await syncHubSpotData(supabase, integration.organization_id, accessToken);
      results.push({ org_id: integration.organization_id, ...result });
    } catch (err) {
      results.push({ org_id: integration.organization_id, error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
