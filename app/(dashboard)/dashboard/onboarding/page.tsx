export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOnboardingState } from "@/lib/onboarding/state";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default async function OnboardingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  }
  const supabase = await createSupabaseServerClient();

  // ── Auto-détection SYNCHRONE de l'état réel — force-dynamic + router.refresh()
  // du wizard rejouent cette lecture à chaque « Continuer » : l'onboarding suit
  // donc ce que l'utilisateur fait en direct (connexion d'un 1er, 2e, 3e outil). ──

  // TOUT outil connecté compte (pas seulement HubSpot) : le premier connecté
  // valide l'étape « Connecter vos outils ».
  const { data: activeInts } = await supabase
    .from("integrations")
    .select("provider, created_at")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  const connectedTools = (activeInts ?? []) as Array<{ provider: string; created_at: string | null }>;
  const connectedToolCount = connectedTools.length;
  const firstConnectedAt = connectedTools[0]?.created_at ?? null;

  // Premier sync : miroir HubSpot OU tout run de connecteur direct réussi.
  const [{ data: hsSync }, { data: syncLog }] = await Promise.all([
    supabase
      .from("hubspot_sync_state")
      .select("last_full_sync_at")
      .eq("organization_id", orgId)
      .not("last_full_sync_at", "is", null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_logs")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "success")
      .limit(1)
      .maybeSingle(),
  ]);
  const hasFirstSync = !!hsSync?.last_full_sync_at || !!syncLog?.id;

  // Pôle/équipe de l'utilisateur — collecté par la modale d'accueil OBLIGATOIRE
  // (OrgSetupModal). L'onboarding ne redemande donc plus l'équipe : il en dérive
  // les pôles à activer et saute cette étape.
  const { data: { user } } = await supabase.auth.getUser();
  let userPole: string | null = null;
  if (user) {
    const { data: prof } = await supabase.from("profiles").select("pole").eq("id", user.id).maybeSingle();
    userPole = (prof?.pole as string | null) ?? null;
  }

  const initialState = await getOnboardingState(supabase, orgId);

  // Persiste la détection dans onboarding_state pour que la barre de complétion
  // (progress %) reflète la réalité partout, même hors du wizard.
  const persist: Record<string, unknown> = {};
  if (connectedToolCount > 0 && !initialState.hubspotConnectedAt) {
    persist.hubspot_connected_at = firstConnectedAt ?? new Date().toISOString();
  }
  if (hasFirstSync && !initialState.firstSyncSeenAt) {
    persist.first_sync_seen_at = new Date().toISOString();
  }
  if (Object.keys(persist).length > 0) {
    try {
      await supabase
        .from("onboarding_state")
        .upsert({ organization_id: orgId, updated_at: new Date().toISOString(), ...persist }, { onConflict: "organization_id" });
      Object.assign(initialState, {
        hubspotConnectedAt: persist.hubspot_connected_at ?? initialState.hubspotConnectedAt,
        firstSyncSeenAt: persist.first_sync_seen_at ?? initialState.firstSyncSeenAt,
      });
    } catch { /* best effort — l'affichage utilise déjà les valeurs détectées */ }
  }

  // Si déjà complete et pas de skip explicite → redirige vers dashboard
  if (initialState.completedAt) {
    redirect("/dashboard");
  }

  return (
    <OnboardingWizard
      initial={initialState}
      connectedAtFromIntegration={firstConnectedAt}
      connectedToolCount={connectedToolCount}
      hasFirstSync={hasFirstSync}
      userPole={userPole}
    />
  );
}
