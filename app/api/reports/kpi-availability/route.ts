/**
 * GET /api/reports/kpi-availability
 *
 * Returns, for the current user's CRM, which IMPLEMENTED KPIs actually have
 * data (return non-null) vs which are implemented but produce nothing yet
 * (e.g. user has 0 tickets, no invoices, no calls).
 *
 * Cached 5 min per org to avoid repeatedly hitting HubSpot.
 */
import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { fetchRawKpiData, computeMetricsForFilters } from "@/lib/reports/report-kpis";
import { IMPLEMENTED_KPIS } from "@/lib/reports/implemented-kpis";

export const maxDuration = 60;

type CacheEntry = {
  expiresAt: number;
  payload: { withData: string[]; withoutData: string[]; hasToken: boolean };
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export async function GET() {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const now = Date.now();
  const cached = cache.get(orgId);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ ...cached.payload, cached: true });
  }

  const supabase = await createSupabaseServerClient();
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  if (!hubspotToken) {
    const payload = {
      withData: [],
      withoutData: [...IMPLEMENTED_KPIS],
      hasToken: false,
    };
    cache.set(orgId, { expiresAt: now + CACHE_TTL_MS, payload });
    return NextResponse.json({ ...payload, cached: false });
  }

  let withData: string[] = [];
  let withoutData: string[] = [];

  try {
    const raw = await fetchRawKpiData(hubspotToken, supabase, orgId);
    const values = computeMetricsForFilters(raw);
    for (const key of IMPLEMENTED_KPIS) {
      if (values[key] !== null && values[key] !== undefined) {
        withData.push(key);
      } else {
        withoutData.push(key);
      }
    }
  } catch (err) {
    console.error("[kpi-availability] failed", { orgId, err });
    // Fallback: assume all implemented are potentially available; user gets a
    // soft warning instead of a hard error.
    withData = [...IMPLEMENTED_KPIS];
    withoutData = [];
  }

  const payload = { withData, withoutData, hasToken: true };
  cache.set(orgId, { expiresAt: now + CACHE_TTL_MS, payload });
  return NextResponse.json({ ...payload, cached: false });
}
