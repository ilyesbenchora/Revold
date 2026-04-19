/**
 * Debug endpoint — GET /api/debug/portal-apps
 *
 * Returns the raw response of every HubSpot endpoint we use to detect
 * connected apps. Use it to verify which endpoints actually work on your
 * portal and which app names are returned, so we can adjust patterns and
 * filters accordingly.
 *
 * Authenticated by the user session — only returns data for the caller's
 * organization.
 */

import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";

const HS_API = "https://api.hubapi.com";

async function safeFetch(url: string, token: string) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {}
    return { status: res.status, ok: res.ok, body };
  } catch (err) {
    return { status: 0, ok: false, body: { error: (err as Error).message } };
  }
}

export async function GET() {
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Aucune organisation" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) {
    return NextResponse.json({ error: "Aucun token HubSpot — connectez via OAuth ou définissez HUBSPOT_ACCESS_TOKEN" }, { status: 400 });
  }

  // Get portal id first (needed by integrators-public endpoints)
  const accountInfo = await safeFetch(`${HS_API}/account-info/v3/details`, token);
  const portalId =
    typeof accountInfo.body === "object" && accountInfo.body
      ? (accountInfo.body as Record<string, unknown>).portalId ?? (accountInfo.body as Record<string, unknown>).hubId ?? null
      : null;

  // Try every endpoint we know of
  const endpoints = [
    `/account-info/v3/details`,
    `/account-info/v3/api-usage/daily/private-apps`,
    `/account-info/v3/api-usage/daily`,
    portalId ? `/integrators-public/v1/portals/${portalId}/connected-applications` : null,
    portalId ? `/integrators/v1/${portalId}/installed/apps` : null,
    portalId ? `/integration-platform/v1/portals/${portalId}/installs` : null,
    portalId ? `/marketplace/v2/installs?portalId=${portalId}` : null,
  ].filter((p): p is string => Boolean(p));

  const results: Record<string, unknown> = {};
  for (const path of endpoints) {
    results[path] = await safeFetch(`${HS_API}${path}`, token);
  }

  return NextResponse.json(
    {
      portalId,
      results,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
