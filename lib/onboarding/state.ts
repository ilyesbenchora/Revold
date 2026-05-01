/**
 * Helpers pour l'état d'onboarding d'une org.
 *
 * 4 étapes :
 *   1. welcomed_at
 *   2. hubspot_connected_at  (auto-détecté depuis integrations.is_active)
 *   3. objectives_set_at
 *   4. first_sync_seen_at    (auto-détecté depuis hubspot_sync_state)
 *
 * `completed_at` est settable manuellement (CTA "Terminer") ou auto si les 4
 * étapes critiques sont OK et l'user voit son 1er insight.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type OnboardingState = {
  welcomedAt: string | null;
  hubspotConnectedAt: string | null;
  objectivesSetAt: string | null;
  firstSyncSeenAt: string | null;
  completedAt: string | null;
  skipped: boolean;
  objectives: string[];
};

const EMPTY: OnboardingState = {
  welcomedAt: null,
  hubspotConnectedAt: null,
  objectivesSetAt: null,
  firstSyncSeenAt: null,
  completedAt: null,
  skipped: false,
  objectives: [],
};

export async function getOnboardingState(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OnboardingState> {
  const { data } = await supabase
    .from("onboarding_state")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!data) return { ...EMPTY };

  return {
    welcomedAt: data.welcomed_at as string | null,
    hubspotConnectedAt: data.hubspot_connected_at as string | null,
    objectivesSetAt: data.objectives_set_at as string | null,
    firstSyncSeenAt: data.first_sync_seen_at as string | null,
    completedAt: data.completed_at as string | null,
    skipped: !!data.skipped,
    objectives: (data.objectives as string[] | undefined) ?? [],
  };
}

/** Determine si l'org doit voir le wizard ou non. */
export function shouldShowOnboarding(state: OnboardingState): boolean {
  if (state.completedAt) return false;
  if (state.skipped) return false;
  return true;
}

/** Pourcentage d'avancement (pour badge / progress bar). */
export function onboardingProgress(state: OnboardingState): number {
  let done = 0;
  if (state.welcomedAt) done++;
  if (state.hubspotConnectedAt) done++;
  if (state.objectivesSetAt) done++;
  if (state.firstSyncSeenAt) done++;
  return Math.round((done / 4) * 100);
}
