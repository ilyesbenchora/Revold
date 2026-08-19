import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { resolveCohortAccessor } from "@/lib/ai/agents/tool-library";

export const dynamic = "force-dynamic";

/**
 * Ids HubSpot des DEALS dont l'entreprise appartient à une cohorte — pour les
 * blocs alimentés en direct par HubSpot (Deals à risque, Forecast management) :
 * ils filtrent leurs listes côté client sur ce Set, avec exactement les mêmes
 * règles de lecture de cohorte que le moteur d'agrégats.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const url = new URL(request.url);
  const key = (url.searchParams.get("key") ?? "").trim();
  const value = (url.searchParams.get("value") ?? "").trim();
  if (!key || !value) return NextResponse.json({ error: "key et value requis" }, { status: 400 });

  const acc = await resolveCohortAccessor(supabase, orgId, key);
  if (!acc.prop && !acc.col) {
    return NextResponse.json({ error: `Cohorte inconnue ou non mappée : ${key}.` }, { status: 400 });
  }

  // Entreprises de la cohorte → Set d'ids → deals rattachés (jointure JS).
  const target = acc.prop ? `raw_data->properties->>${acc.prop}` : acc.col!;
  let cq = supabase.from("companies").select("id").eq("organization_id", orgId).limit(10000);
  cq = value === "inconnu" ? cq.is(target, null) : cq.eq(target, value);
  const { data: comp, error: compErr } = await cq;
  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 });
  const companyIds = new Set(((comp ?? []) as { id: string }[]).map((c) => c.id));

  const { data: deals, error: dealsErr } = await supabase
    .from("deals")
    .select("hubspot_id, company_id")
    .eq("organization_id", orgId)
    .limit(10000);
  if (dealsErr) return NextResponse.json({ error: dealsErr.message }, { status: 500 });
  const dealIds = ((deals ?? []) as { hubspot_id: string | null; company_id: string | null }[])
    .filter((d) => d.hubspot_id && d.company_id && companyIds.has(d.company_id))
    .map((d) => d.hubspot_id as string);

  return NextResponse.json({ dealIds });
}
