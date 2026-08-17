import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getEnrichmentSettings } from "@/lib/enrichment/settings";
import { vatFromSiren } from "@/lib/enrichment/company-enrichment";
import { ensureHubSpotIdProperty, pushHubspotIfEmpty, type EnsurePropertyResult } from "@/lib/enrichment/hubspot-push";

export const dynamic = "force-dynamic";

const BATCH = 25;
const THROTTLE_MS = 150; // 2 appels HubSpot par fiche — rester sous la limite de débit

/**
 * Poussée immédiate des identifiants enrichis (SIREN/SIRET/TVA) dans les
 * fiches HubSpot de TOUTE la base — déclenchée à l'enregistrement de
 * Paramètres → Enrichissement (option « Recherche par SIREN/SIRET »).
 * Appelée en boucle par l'UI : { cursor } → { nextCursor } jusqu'à done.
 * Au premier appel (sans cursor), les propriétés cibles sont créées dans le
 * portail si absentes (valeurs uniques → cherchables dans la barre HubSpot).
 * Champs VIDES uniquement — jamais d'écrasement.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { cursor?: string | null };
  try { body = await request.json(); } catch { body = {}; }
  const cursor = typeof body.cursor === "string" ? body.cursor : null;

  const settings = await getEnrichmentSettings(supabase, orgId);
  if (!settings.hubspotSearchIds) {
    return NextResponse.json({ error: "Option « Recherche par SIREN/SIRET » désactivée." }, { status: 400 });
  }
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) return NextResponse.json({ error: "HubSpot non connecté." }, { status: 400 });

  // Noms des propriétés HubSpot cibles : mapping des identifiants s'il existe,
  // sinon les défauts (siren / siret / vat_number).
  const { data: mapped } = await supabase
    .from("identifier_field_mapping")
    .select("canonical_field, provider_field")
    .eq("organization_id", orgId)
    .eq("provider", "hubspot");
  const propFor = (canonical: string, fallback: string) =>
    (mapped ?? []).find((m) => m.canonical_field === canonical)?.provider_field?.trim() || fallback;
  const sirenProp = propFor("siren", "siren");
  const siretProp = propFor("siret", "siret");
  const vatProp = propFor("vat_number", "vat_number");

  // Premier appel : garantir l'existence des propriétés + taille totale du lot.
  let properties: EnsurePropertyResult[] | undefined;
  let total: number | undefined;
  if (!cursor) {
    const ensures: Array<Promise<EnsurePropertyResult>> = [ensureHubSpotIdProperty(token, sirenProp, "SIREN")];
    if (settings.fields.siret) ensures.push(ensureHubSpotIdProperty(token, siretProp, "SIRET"));
    if (settings.fields.vat) ensures.push(ensureHubSpotIdProperty(token, vatProp, "N° TVA intracommunautaire"));
    properties = await Promise.all(ensures);
    const { count } = await supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("siren", "is", null)
      .not("hubspot_id", "is", null);
    total = count ?? 0;
  }

  let query = supabase
    .from("companies")
    .select("id, siren, siret, vat_number, hubspot_id")
    .eq("organization_id", orgId)
    .not("siren", "is", null)
    .not("hubspot_id", "is", null)
    .order("id", { ascending: true })
    .limit(BATCH);
  // Pagination par curseur — id est un uuid : pas de .gt sur chaîne vide.
  if (cursor) query = query.gt("id", cursor);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{ id: string; siren: string; siret: string | null; vat_number: string | null; hubspot_id: string }>;
  let pushed = 0;
  let failed = 0;
  for (const c of rows) {
    const props: Record<string, string> = { [sirenProp]: c.siren };
    if (settings.fields.siret && c.siret) props[siretProp] = c.siret;
    if (settings.fields.vat) props[vatProp] = c.vat_number ?? vatFromSiren(c.siren);
    const ok = await pushHubspotIfEmpty(token, c.hubspot_id, props);
    if (ok) pushed++;
    else failed++;
    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }

  return NextResponse.json({
    processed: rows.length,
    pushed,
    failed,
    nextCursor: rows.length === BATCH ? rows[rows.length - 1].id : null,
    done: rows.length < BATCH,
    ...(properties ? { properties } : {}),
    ...(total !== undefined ? { total } : {}),
  });
}
