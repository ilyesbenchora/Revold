export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncHubSpotDataByType, recomputeKpis } from "@/lib/integrations/hubspot-sync";
import { env } from "@/lib/env";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export async function GET(request: Request) {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "HUBSPOT_ACCESS_TOKEN not configured" }, { status: 400 });
  }

  const { data: orgs } = await supabase.from("organizations").select("id").limit(1);
  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }
  const orgId = orgs[0].id;

  const url = new URL(request.url);
  const syncType = url.searchParams.get("type") as "companies" | "contacts" | "deals" | "kpi" | null;

  try {
    // ?type=kpi → only recompute KPIs from existing data
    if (syncType === "kpi") {
      const kpiResult = await recomputeKpis(supabase, orgId);
      return NextResponse.json({ type: "kpi", ...kpiResult });
    }

    // Sync a specific type, default to companies
    const type = syncType || "companies";
    const { count, errors } = await syncHubSpotDataByType(supabase, orgId, accessToken, type);

    // Mark integration as active
    await supabase.from("integrations").upsert(
      { organization_id: orgId, provider: "hubspot", access_token: "private-app", is_active: true, updated_at: new Date().toISOString() },
      { onConflict: "organization_id,provider" },
    );

    // After deals sync, auto-trigger KPI recomputation
    let kpiResult = null;
    if (type === "deals") {
      kpiResult = await recomputeKpis(supabase, orgId);
    }

    const next = type === "companies" ? "contacts" : type === "contacts" ? "deals" : "done";
    return NextResponse.json({ type, count, errors, kpiComputed: kpiResult, next });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
