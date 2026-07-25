import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Liste les pipelines de deals de l'org (depuis pipeline_stages, miroir des
 * pipelines HubSpot). Sert au sélecteur de pipeline de la confirmation
 * d'alerte : sans restriction de pipeline, `groupBy: "stage"` agrège les
 * étapes homonymes de TOUS les pipelines — donc une alerte fausse.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("pipeline_external_id, pipeline_name")
    .eq("organization_id", orgId)
    .not("pipeline_external_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ pipeline_external_id: string | null; pipeline_name: string | null }>) {
    if (row.pipeline_external_id && !seen.has(row.pipeline_external_id)) {
      seen.set(row.pipeline_external_id, row.pipeline_name || row.pipeline_external_id);
    }
  }
  return NextResponse.json({
    pipelines: [...seen.entries()].map(([id, name]) => ({ id, name })),
  });
}
