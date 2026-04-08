import { cache } from "react";
import { createSupabaseServerClient } from "./server";
import { detectIntegrations, type DetectedIntegration } from "@/lib/integrations/detect-integrations";
import { detectPortalApps, type PortalApp } from "@/lib/integrations/detect-portal-apps";
import {
  filterBusinessIntegrations,
  computeIntegrationScore,
} from "@/lib/integrations/integration-score";

/**
 * Request-scoped cached helpers.
 * React `cache()` deduplicates calls within the same server request,
 * so layout + page calling getOrgId() only hits Supabase once.
 */

export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const getOrgId = cache(async (): Promise<string | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();

  let { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  // Auto-create profile if it doesn't exist (new user via Supabase Auth)
  if (!profile) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .limit(1)
      .single();

    if (!org) return null;

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

  return profile?.organization_id ?? null;
});

export const getProfile = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();

  // Call getOrgId first to ensure profile exists
  await getOrgId();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, organization_id, organizations(name)")
    .eq("id", user.id)
    .single();
  return profile;
});

/**
 * HubSpot integration detection — cached per request so layout + page can both
 * call it without hitting the HubSpot API twice. Includes portal apps so the
 * detection set is identical to the one rendered on the integration page.
 */
export const getCanonicalIntegrationData = cache(
  async (): Promise<{
    integrations: DetectedIntegration[];
    portalApps: { privateApps: PortalApp[]; publicApps: PortalApp[]; totalApps: number };
  }> => {
    const empty = {
      integrations: [],
      portalApps: { privateApps: [], publicApps: [], totalApps: 0 },
    };
    if (!process.env.HUBSPOT_ACCESS_TOKEN) return empty;
    try {
      const portalApps = await detectPortalApps(process.env.HUBSPOT_ACCESS_TOKEN);
      const allPortalApps = [...portalApps.privateApps, ...portalApps.publicApps];
      const integrations = await detectIntegrations(
        process.env.HUBSPOT_ACCESS_TOKEN,
        allPortalApps,
      );
      return { integrations, portalApps };
    } catch {
      return empty;
    }
  },
);

/** Backwards compat: returns just the integrations list. */
export const getDetectedIntegrations = cache(async (): Promise<DetectedIntegration[]> => {
  return (await getCanonicalIntegrationData()).integrations;
});

/**
 * HubSpot owners count — cached per request.
 */
export const getHubspotOwnersCount = cache(async (): Promise<number> => {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return 0;
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
      headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return (data.results ?? []).length;
  } catch {
    return 0;
  }
});

/**
 * Canonical HubSpot integration score — deterministic, count-based.
 * Same formula and same input data as the Intégration page so the header
 * and the page always agree.
 */
export const getHubspotIntegrationScore = cache(async (): Promise<number | null> => {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return null;
  const [{ integrations }, ownersCount] = await Promise.all([
    getCanonicalIntegrationData(),
    getHubspotOwnersCount(),
  ]);
  const businessIntegrations = filterBusinessIntegrations(integrations);
  return computeIntegrationScore(businessIntegrations, ownersCount).score;
});


export const getLatestKpi = cache(async () => {
  const orgId = await getOrgId();
  if (!orgId) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("kpi_snapshots")
    .select("*")
    .eq("organization_id", orgId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();
  return data;
});
