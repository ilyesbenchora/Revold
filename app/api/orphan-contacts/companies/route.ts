import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Recherche d'entreprise pour l'association en masse (page Contacts sans
 * entreprise) : nom ou domaine, uniquement des fiches synchronisées HubSpot
 * (hubspot_id présent — condition pour pouvoir écrire l'association).
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ companies: [] });
  // Neutralise les jokers PostgREST dans la saisie utilisateur.
  const safe = q.replace(/[%_,()]/g, " ").trim();
  if (!safe) return NextResponse.json({ companies: [] });

  const { data } = await supabase
    .from("companies")
    .select("id, name, domain, hubspot_id")
    .eq("organization_id", orgId)
    .not("hubspot_id", "is", null)
    .or(`name.ilike.%${safe}%,domain.ilike.%${safe}%`)
    .order("name", { ascending: true })
    .limit(20);

  return NextResponse.json({
    companies: (data ?? []).map((c) => ({ id: c.id, name: c.name, domain: c.domain })),
  });
}
