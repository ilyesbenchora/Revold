import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { fetchDealsPipelines } from "@/lib/integrations/hubspot-snapshot";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { poleToWorkspace } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

/**
 * Options du brief personnalisé par équipe (Paramètres → Tour de contrôle) :
 * rôle/pôle de l'utilisateur (admin : choix libre de l'équipe ; membre :
 * verrouillé sur son pôle), CRM connecté (nommé dans le brief) et pipelines de
 * deals (miroir pipeline_stages, sinon lecture directe HubSpot).
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const [{ data: profile }, { data: ints }, token] = await Promise.all([
    supabase.from("profiles").select("role, pole").eq("id", user.id).maybeSingle(),
    supabase.from("integrations").select("provider").eq("organization_id", orgId).eq("is_active", true).limit(50),
    getHubSpotToken(supabase, orgId),
  ]);
  const crm = (ints ?? []).map((i) => i.provider as string).find((p) => CONNECTABLE_TOOLS[p]?.category === "crm") ?? null;
  const crmLabel = crm ? (CONNECTABLE_TOOLS[crm]?.label ?? crm) : null;

  // Pipelines : miroir local d'abord (aucun appel API), direct HubSpot sinon.
  const seen = new Map<string, string>();
  try {
    const { data } = await supabase
      .from("pipeline_stages")
      .select("pipeline_external_id, pipeline_name")
      .eq("organization_id", orgId)
      .not("pipeline_external_id", "is", null);
    for (const r of (data ?? []) as Array<{ pipeline_external_id: string | null; pipeline_name: string | null }>) {
      if (r.pipeline_external_id && !seen.has(r.pipeline_external_id)) seen.set(r.pipeline_external_id, r.pipeline_name || r.pipeline_external_id);
    }
  } catch {}
  if (seen.size === 0 && token) {
    for (const p of await fetchDealsPipelines(token)) if (!p.archived) seen.set(p.id, p.label);
  }

  const role = (profile?.role as string | null) ?? null;
  const pole = poleToWorkspace(profile?.pole as string | null);
  return NextResponse.json({
    me: { role, pole, isAdmin: role === "admin" },
    crmLabel,
    hasToken: !!token,
    pipelines: [...seen.entries()].map(([id, label]) => ({ id, label })),
  });
}
