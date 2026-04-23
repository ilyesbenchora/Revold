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
import {
  fetchHubSpotSnapshot,
  EMPTY_SNAPSHOT,
  type HubSpotSnapshot,
} from "@/lib/integrations/hubspot-snapshot";

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

  // 1ère tentative : profile déjà créé
  let { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profile?.organization_id) return profile.organization_id;

  // Pas de profile → créer org + profile.
  // ⚠ Multi-tenant strict : JAMAIS de fallback "first org found".
  // Pour éviter les race conditions (user qui refresh = 2 orgs créées),
  // on retry la lecture du profile une seconde fois APRÈS avoir tenté la
  // création (un autre render peut avoir créé entre-temps).

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
    // Re-check si une autre requête concurrente a créé entre-temps
    const { data: retry } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    return retry?.organization_id ?? null;
  }

  // Insert profile avec UPSERT idempotent (id = primary key user.id)
  // Si race condition crée déjà le profile, le UPSERT met juste à jour sans dupliquer
  const { data: newProfile, error: profErr } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        organization_id: org.id,
        full_name: fullName,
        role: "admin",
      },
      { onConflict: "id", ignoreDuplicates: false },
    )
    .select("organization_id")
    .single();

  if (profErr) {
    console.error("[getOrgId] failed to upsert profile", { userId: user.id, orgId: org.id, profErr });
    // Cleanup org orphan créée
    await supabase.from("organizations").delete().eq("id", org.id);
    return null;
  }

  // Si le profile renvoyé pointe vers une AUTRE org (race), supprime celle qu'on vient de créer
  if (newProfile?.organization_id && newProfile.organization_id !== org.id) {
    console.warn("[getOrgId] race detected, cleaning up duplicate org", {
      userId: user.id,
      created: org.id,
      kept: newProfile.organization_id,
    });
    await supabase.from("organizations").delete().eq("id", org.id);
    return newProfile.organization_id;
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

  return newProfile?.organization_id ?? org.id;
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

/**
 * SNAPSHOT HUBSPOT UNIFIÉ — source de vérité pour TOUTES les pages dashboard.
 *
 * Cache request-scoped : un seul fetch par render même si plusieurs pages
 * /composants l'appellent. Toujours préférer getHubspotSnapshot() à des
 * lectures Supabase directes pour TOUTE donnée présente dans HubSpot.
 *
 * Retourne aussi des METADATA (`status`, `error`) pour que les pages puissent
 * distinguer "0 = vraie donnée vide" vs "0 = panne API / token expiré".
 */
export type HubspotSnapshotResult = HubSpotSnapshot & {
  /** "ok" = données live OK ; "no-token" = pas connecté ; "error" = panne API */
  status: "ok" | "no-token" | "error";
  /** Message d'erreur si status === "error" */
  error?: string;
};

export const getHubspotSnapshot = cache(async (): Promise<HubspotSnapshotResult> => {
  const orgId = await getOrgId();
  if (!orgId) {
    return { ...EMPTY_SNAPSHOT, status: "no-token", error: "Aucune organisation" };
  }
  const supabase = await createSupabaseServerClient();

  // ── 1. CACHE FIRST : on lit le snapshot pré-calculé en local ──────────
  // C'est la stratégie pérenne : l'UI ne tape jamais HubSpot live, elle
  // lit hubspot_snapshot_cache (rempli par /api/sync/hubspot/[full|delta]).
  // Conséquences :
  //   - latence ~50 ms au lieu de 2-30 s
  //   - aucun 429 possible
  //   - app fonctionnelle même si HubSpot est down
  try {
    const { data: cached } = await supabase
      .from("hubspot_snapshot_cache")
      .select("snapshot, computed_at")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (cached?.snapshot) {
      const snap = cached.snapshot as unknown as HubSpotSnapshot;
      return { ...snap, status: "ok" };
    }
  } catch (err) {
    console.warn("[getHubspotSnapshot] cache read failed, falling back to live", err);
  }

  // ── 2. FALLBACK : live HubSpot (premier run, avant le bootstrap ETL) ──
  // Ce path ne devrait s'exécuter QU'UNE seule fois par org : la première
  // fois qu'elle se connecte, avant que le sync initial n'ait peuplé le
  // cache. Une fois /api/sync/hubspot/full appelé, on passe sur le cache.
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) {
    return { ...EMPTY_SNAPSHOT, status: "no-token" };
  }
  try {
    const snapshot = await fetchHubSpotSnapshot(token);
    return { ...snapshot, status: "ok" };
  } catch (err) {
    console.error("[getHubspotSnapshot] live fallback failed", { orgId, err });
    return {
      ...EMPTY_SNAPSHOT,
      status: "error",
      error: err instanceof Error ? err.message : "Erreur HubSpot inconnue",
    };
  }
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
