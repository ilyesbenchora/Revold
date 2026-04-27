export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { fetchCloseDateBuckets } from "@/lib/integrations/hubspot-close-date";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("pipelineId");
  if (!raw) {
    return NextResponse.json({ error: "pipelineId required" }, { status: 400 });
  }
  const pipelineId = raw === "__all__" ? null : raw;

  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "no org" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) return NextResponse.json({ error: "no hubspot token" }, { status: 400 });

  // Build stage probability map depuis le snapshot cache (pipelines)
  const snapshot = await getHubspotSnapshot();
  const stageProbabilities = new Map<string, number>();
  for (const p of snapshot.pipelines ?? []) {
    for (const s of p.stages ?? []) {
      stageProbabilities.set(s.id, s.probability);
    }
  }

  const buckets = await fetchCloseDateBuckets(token, pipelineId, stageProbabilities);
  return NextResponse.json(buckets);
}
