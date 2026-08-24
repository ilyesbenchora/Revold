import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { fetchCompanyParents } from "@/lib/sync/hubspot-etl";
import { activateHierarchy } from "@/lib/actions/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Synchronisation À LA DEMANDE des hiérarchies d'entreprises HubSpot
 * (associations parent/enfant company→company) vers companies.parent_company_id.
 * Découpée en tranches (le client boucle avec `offset`) pour afficher un taux
 * de complétion pendant le passage, comme le moteur d'enrichissement.
 * On ne devine jamais : seule la hiérarchie réellement posée dans HubSpot
 * est ingérée — zéro association trouvée = réponse honnête, pas un échec.
 */

const SLICE = 1000;

async function loadCompanies(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, orgId: string) {
  const rows: Array<{ id: string; hubspot_id: string | null; parent_company_id: string | null }> = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from("companies")
      .select("id, hubspot_id, parent_company_id")
      .eq("organization_id", orgId)
      .not("hubspot_id", "is", null)
      .order("hubspot_id", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) {
      // Colonne parent_company_id absente → migration non appliquée.
      if (/parent_company_id/.test(error.message)) return { rows: null, migrationMissing: true } as const;
      break;
    }
    const batch = (data ?? []) as typeof rows;
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return { rows, migrationMissing: false } as const;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const token = await getHubSpotToken(supabase, orgId);
  const { rows, migrationMissing } = await loadCompanies(supabase, orgId);
  if (migrationMissing || rows === null) return NextResponse.json({ total: 0, linkedChildren: 0, hubspotConnected: !!token, migrationMissing: true });
  const linkedChildren = rows.filter((r) => r.parent_company_id).length;
  return NextResponse.json({ total: rows.length, linkedChildren, hubspotConnected: !!token, migrationMissing: false });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const token = await getHubSpotToken(supabase, orgId);
  if (!token) return NextResponse.json({ error: "HubSpot non connecté — la hiérarchie se lit dans le CRM." }, { status: 400 });

  let offset = 0;
  try {
    const body = await request.json();
    if (Number.isInteger(body?.offset) && body.offset >= 0) offset = body.offset;
  } catch { /* offset 0 */ }

  // Premier passage = OPT-IN : la détection de hiérarchies (suggestions à
  // valider) ne démarre qu'à partir de ce clic — jamais avant.
  if (offset === 0) await activateHierarchy(supabase, orgId);

  const { rows, migrationMissing } = await loadCompanies(supabase, orgId);
  if (migrationMissing || rows === null) {
    return NextResponse.json({ error: "Migration company_hierarchy non appliquée — relance après le prochain déploiement." }, { status: 400 });
  }
  const total = rows.length;
  if (total === 0) return NextResponse.json({ processed: 0, total: 0, parentsFound: 0, linked: 0, done: true });

  const compByHs = new Map<string, { id: string; parent_company_id: string | null }>();
  for (const c of rows) if (c.hubspot_id) compByHs.set(String(c.hubspot_id), { id: c.id, parent_company_id: c.parent_company_id });

  const slice = rows.slice(offset, offset + SLICE);
  const parents = await fetchCompanyParents(token, slice.map((c) => String(c.hubspot_id)));
  const parentsFound = Object.keys(parents).length;

  // Applique les liens de la tranche (idempotent — parent réécrit à chaque passage).
  const byParent = new Map<string, string[]>();
  for (const c of slice) {
    const parentHs = parents[String(c.hubspot_id)];
    const parent = parentHs ? compByHs.get(String(parentHs)) : undefined;
    if (parent && parent.id !== c.id && c.parent_company_id !== parent.id) {
      (byParent.get(parent.id) ?? byParent.set(parent.id, []).get(parent.id))!.push(c.id);
    }
  }
  let linked = 0;
  for (const [parentId, childIds] of byParent) {
    for (let i = 0; i < childIds.length; i += 200) {
      const ids = childIds.slice(i, i + 200);
      const { error, count } = await supabase
        .from("companies")
        .update({ parent_company_id: parentId, company_group_source: "hubspot" }, { count: "exact" })
        .eq("organization_id", orgId)
        .in("id", ids);
      if (!error) linked += count ?? ids.length;
    }
  }

  const processed = Math.min(offset + SLICE, total);
  return NextResponse.json({
    processed,
    total,
    parentsFound,
    linked,
    done: processed >= total,
    nextOffset: processed,
  });
}
