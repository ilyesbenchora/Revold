/**
 * GET /api/simulations/revenue?pipeline=<ID>
 *
 * Retourne les simulations Revenue contextualisées au pipeline sélectionné.
 * Sections : growth / ticket / forecast / retention.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { buildRevenueSimulations } from "@/lib/simulations/revenue-library";
import type { DealLite } from "@/lib/simulations/cycle-ventes-library";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HS_API = "https://api.hubapi.com";

async function fetchAllDealsForPipeline(token: string, pipelineId: string): Promise<DealLite[]> {
  const all: DealLite[] = [];
  let after: string | undefined;
  let page = 0;
  do {
    try {
      const res = await fetch(`${HS_API}/crm/v3/objects/deals/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "pipeline", operator: "EQ", value: pipelineId }] }],
          properties: [
            "amount",
            "closedate",
            "createdate",
            "dealstage",
            "hs_deal_stage_probability",
            "hs_is_closed",
            "hs_is_closed_won",
            "notes_last_contacted",
            "notes_next_activity_date",
          ],
          limit: 100,
          ...(after ? { after } : {}),
        }),
      });
      if (!res.ok) break;
      const data = await res.json();
      for (const r of data.results ?? []) {
        const p = r.properties ?? {};
        all.push({
          id: r.id,
          amount: parseFloat(p.amount ?? "0") || 0,
          closedate: p.closedate ?? null,
          dealstage: p.dealstage ?? "",
          probability: parseFloat(p.hs_deal_stage_probability ?? "0") || 0,
          notes_last_contacted: p.notes_last_contacted
            ? new Date(parseInt(p.notes_last_contacted, 10)).toISOString()
            : null,
          notes_next_activity_date: p.notes_next_activity_date ?? null,
          createdate: p.createdate ?? null,
          is_closed: p.hs_is_closed === "true",
          is_won: p.hs_is_closed_won === "true",
        });
      }
      after = data.paging?.next?.after;
      page++;
    } catch {
      break;
    }
  } while (after && page < 50);
  return all;
}

export async function GET(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pipelineId = req.nextUrl.searchParams.get("pipeline");
  if (!pipelineId) {
    return NextResponse.json({ error: "pipeline param required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) {
    return NextResponse.json({ error: "HubSpot non connecté" }, { status: 400 });
  }

  const snapshot = await getHubspotSnapshot();
  const pipeline = snapshot.pipelines.find((p) => p.id === pipelineId);
  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline introuvable" }, { status: 404 });
  }

  const deals = await fetchAllDealsForPipeline(token, pipelineId);
  const result = buildRevenueSimulations(pipeline, deals);

  // Group sims by section
  const bySection = result.sims.reduce<Record<string, typeof result.sims>>(
    (acc, sim) => {
      acc[sim.section] = acc[sim.section] ?? [];
      acc[sim.section].push(sim);
      return acc;
    },
    {},
  );

  return NextResponse.json({
    pipeline: { id: pipeline.id, label: pipeline.label, stages: pipeline.stages },
    inferredType: result.context.inferredType,
    counts: {
      totalDeals: result.context.totalDeals,
      wonAmount: result.context.wonAmount,
      openAmount: result.context.openAmount,
      weightedPipeline: result.context.weightedPipeline,
      forecastNext30Days: result.context.forecastNext30Days,
      forecastNext90Days: result.context.forecastNext90Days,
      avgWonAmount: result.context.avgWonAmount,
    },
    sections: {
      growth: bySection.growth ?? [],
      ticket: bySection.ticket ?? [],
      forecast: bySection.forecast ?? [],
      retention: bySection.retention ?? [],
    },
  });
}
