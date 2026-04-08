import { cache } from "react";
import { createSupabaseServerClient } from "./server";
import { detectIntegrations, type DetectedIntegration } from "@/lib/integrations/detect-integrations";

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
 * call it without hitting the HubSpot API twice.
 */
export const getDetectedIntegrations = cache(async (): Promise<DetectedIntegration[]> => {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return [];
  try {
    return await detectIntegrations(process.env.HUBSPOT_ACCESS_TOKEN);
  } catch {
    return [];
  }
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
 * Returns the HubSpot integration score (same formula as the Integration page):
 *   score = min(50, tools×8) + min(30, avgEnrichmentRate) + ownersBonus
 * Returns null when no HubSpot token is configured.
 */
export const getHubspotIntegrationScore = cache(async (): Promise<number | null> => {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return null;
  const [integrations, ownersCount] = await Promise.all([
    getDetectedIntegrations(),
    getHubspotOwnersCount(),
  ]);
  const totalIntegrations = integrations.length;
  const avgEnrichmentRate = integrations.length > 0
    ? Math.round(integrations.reduce((s, i) => s + i.enrichmentRate, 0) / integrations.length)
    : 0;
  return Math.round(
    Math.min(50, totalIntegrations * 8) +
    Math.min(30, avgEnrichmentRate) +
    (ownersCount > 10 ? 20 : ownersCount > 5 ? 10 : 5),
  );
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
