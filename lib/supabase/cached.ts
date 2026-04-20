import { cache } from "react";
import { createSupabaseServerClient } from "./server";
import { detectIntegrations, type DetectedIntegration } from "@/lib/integrations/detect-integrations";
import { detectPortalApps, type PortalApp } from "@/lib/integrations/detect-portal-apps";
import {
  filterBusinessIntegrations,
  computeIntegrationScore,
} from "@/lib/integrations/integration-score";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import {
  fetchHubSpotEcosystemCounts,
  EMPTY_ECOSYSTEM_COUNTS,
  type HubSpotEcosystemCounts,
} from "@/lib/integrations/hubspot";

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

  // Pas de profile : créer SA propre org depuis user_metadata.
  // ⚠ JAMAIS de fallback "first org found" — c'était une faille multi-tenant
  // qui attachait silencieusement les nouveaux users à la 1ʳᵉ org existante.
  if (!profile) {
    const meta = user.user_metadata as { org_name?: string; full_name?: string } | null;
    const orgName =
      (meta?.org_name && meta.org_name.trim()) ||
      (user.email ? `Org de ${user.email.split("@")[0]}` : "Mon organisation");
    const fullName = meta?.full_name?.trim() || user.email?.split("@")[0] || "Utilisateur";

    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      || "org";

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: orgName, slug: `${slug}-${Date.now()}` })
      .select("id")
      .single();

    if (orgErr || !org) {
      console.error("[getOrgId] failed to create org for new user", { userId: user.id, orgErr });
      return null;
    }

    const { data: newProfile, error: profErr } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        organization_id: org.id,
        full_name: fullName,
        role: "admin",
      })
      .select("organization_id")
      .single();

    if (profErr) {
      console.error("[getOrgId] failed to create profile", { userId: user.id, orgId: org.id, profErr });
      return null;
    }

    // Pipeline stages par défaut pour la nouvelle org
    await supabase.from("pipeline_stages").insert([
      { organization_id: org.id, name: "Découverte", position: 1, probability: 10 },
      { organization_id: org.id, name: "Qualification", position: 2, probability: 25 },
      { organization_id: org.id, name: "Proposition", position: 3, probability: 50 },
      { organization_id: org.id, name: "Négociation", position: 4, probability: 75 },
      { organization_id: org.id, name: "Gagné", position: 5, probability: 100, is_closed_won: true },
      { organization_id: org.id, name: "Perdu", position: 6, probability: 0, is_closed_lost: true },
    ]);

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
    const orgId = await getOrgId();
    if (!orgId) return empty;
    const supabase = await createSupabaseServerClient();
    const token = await getHubSpotToken(supabase, orgId);
    if (!token) return empty;
    try {
      const portalApps = await detectPortalApps(token);
      const allPortalApps = [...portalApps.privateApps, ...portalApps.publicApps];
      const integrations = await detectIntegrations(token, allPortalApps);
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
  const orgId = await getOrgId();
  if (!orgId) return 0;
  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) return 0;
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
      headers: { Authorization: `Bearer ${token}` },
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
  const orgId = await getOrgId();
  if (!orgId) return null;
  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) return null;
  const [{ integrations }, ownersCount] = await Promise.all([
    getCanonicalIntegrationData(),
    getHubspotOwnersCount(),
  ]);
  const businessIntegrations = filterBusinessIntegrations(integrations);
  return computeIntegrationScore(businessIntegrations, ownersCount).score;
});


/**
 * Snapshot écosystème HubSpot — counts pour TOUS les objets accessibles via
 * les scopes optional accordés (invoices, subscriptions, tickets, leads, etc.).
 * Cache request-scoped pour éviter de dupliquer les ~20 appels API si
 * plusieurs pages/composants l'utilisent dans le même render.
 */
export const getHubspotEcosystemCounts = cache(
  async (): Promise<HubSpotEcosystemCounts> => {
    const orgId = await getOrgId();
    if (!orgId) return EMPTY_ECOSYSTEM_COUNTS;
    const supabase = await createSupabaseServerClient();
    const token = await getHubSpotToken(supabase, orgId);
    if (!token) return EMPTY_ECOSYSTEM_COUNTS;
    try {
      return await fetchHubSpotEcosystemCounts(token);
    } catch {
      return EMPTY_ECOSYSTEM_COUNTS;
    }
  },
);

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
