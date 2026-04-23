export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { fetchDealRiskBuckets } from "@/lib/integrations/hubspot-deal-risk";

export async function GET(req: NextRequest) {
  const pipelineId = req.nextUrl.searchParams.get("pipelineId");
  if (!pipelineId) {
    return NextResponse.json({ error: "pipelineId required" }, { status: 400 });
  }

  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "no org" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) return NextResponse.json({ error: "no hubspot token" }, { status: 400 });

  const buckets = await fetchDealRiskBuckets(token, pipelineId);
  return NextResponse.json(buckets);
}
