import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncHubSpotData } from "@/lib/integrations/hubspot-sync";
import { env } from "@/lib/env";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export async function POST(request: Request) {
  // Auth check for cron
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "HUBSPOT_ACCESS_TOKEN not configured" }, { status: 400 });
  }

  // Get the org to sync for
  const { data: orgs } = await supabase.from("organizations").select("id").limit(1);
  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const orgId = orgs[0].id;

  try {
    const result = await syncHubSpotData(supabase, orgId, accessToken);

    // Upsert integration record
    await supabase.from("integrations").upsert(
      {
        organization_id: orgId,
        provider: "hubspot",
        access_token: accessToken,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" },
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Also support GET for easy manual trigger
export async function GET(request: Request) {
  return POST(request);
}
