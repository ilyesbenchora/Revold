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

  // Auto-détection : si HubSpot connecté → marque l'étape comme faite
  // (pour ne pas perdre l'avancement quand l'user passe par /parametres)
  const { data: hubspotInt } = await supabase
    .from("integrations")
    .select("created_at")
    .eq("organization_id", orgId)
    .eq("provider", "hubspot")
    .eq("is_active", true)
    .maybeSingle();

  // Auto-détection : si premier sync visible
  const { data: syncState } = await supabase
    .from("hubspot_sync_state")
    .select("last_full_sync_at")
    .eq("organization_id", orgId)
    .not("last_full_sync_at", "is", null)
    .limit(1)
    .maybeSingle();

  const initialState = await getOnboardingState(supabase, orgId);

  // Si déjà complete et pas de skip explicite → redirige vers dashboard
  if (initialState.completedAt) {
    redirect("/dashboard");
  }

  return (
    <OnboardingWizard
      initial={initialState}
      hubspotConnectedAtFromIntegration={hubspotInt?.created_at ?? null}
      hasFirstSync={!!syncState?.last_full_sync_at}
    />
  );
}
