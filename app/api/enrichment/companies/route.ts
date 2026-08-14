import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { searchCompanyInSirene, vatFromSiren } from "@/lib/enrichment/company-enrichment";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Enrichissement SIREN / SIRET / N° TVA / raison sociale des entreprises via
 * la base Sirene (gratuite, sans clé).
 *
 * GET  : propose des enrichissements pour les entreprises SANS SIREN (nom
 *        requis) — rien n'est écrit, l'utilisateur valide.
 * POST : applique les enrichissements VALIDÉS — écrit dans les colonnes
 *        canoniques (companies) ET, si l'entreprise vient de HubSpot et que
 *        les propriétés sont mappées, pousse les valeurs DANS HubSpot
 *        (exécution directe dans l'outil, pas seulement chez Revold).
 */

type CompanyRow = { id: string; name: string | null; domain: string | null; siren: string | null; hubspot_id: string | null };

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { data } = await supabase
    .from("companies")
    .select("id, name, domain, siren, hubspot_id")
    .eq("organization_id", orgId)
    .is("siren", null)
    .not("name", "is", null)
    .limit(25);

  const companies = ((data ?? []) as CompanyRow[]).filter((c) => (c.name ?? "").trim().length >= 2);

  // Séquentiel : l'API publique limite à ~7 req/s — on reste très en dessous.
  const proposals: Array<{
    companyId: string;
    name: string;
    domain: string | null;
    hubspotId: string | null;
    siren: string;
    siret: string | null;
    vatNumber: string;
    legalName: string;
    confidence: "high" | "medium";
  }> = [];
  for (const c of companies) {
    const found = await searchCompanyInSirene(c.name!);
    if (found) {
      proposals.push({
        companyId: c.id,
        name: c.name!,
        domain: c.domain,
        hubspotId: c.hubspot_id,
        siren: found.siren,
        siret: found.siret,
        vatNumber: found.vatNumber,
        legalName: found.legalName,
        confidence: found.confidence,
      });
    }
  }

  return NextResponse.json({ scanned: companies.length, proposals });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { items?: Array<{ companyId?: string; siren?: string; siret?: string | null; legalName?: string | null }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const items = (body.items ?? []).filter(
    (i): i is { companyId: string; siren: string; siret: string | null; legalName: string | null } =>
      typeof i.companyId === "string" && typeof i.siren === "string" && /^\d{9}$/.test(i.siren),
  );
  if (items.length === 0) return NextResponse.json({ error: "Aucun enrichissement à appliquer" }, { status: 400 });

  // Mapping des propriétés HubSpot (Paramètres → Modèle de données) : requis
  // pour pousser les valeurs DANS le CRM. Défauts du catalogue sinon.
  const { data: mappings } = await supabase
    .from("identifier_field_mapping")
    .select("canonical_field, provider_field")
    .eq("organization_id", orgId)
    .eq("provider", "hubspot");
  const propFor = (canonical: string, fallback: string): string => {
    const m = (mappings ?? []).find((x) => x.canonical_field === canonical);
    return (m?.provider_field as string | undefined)?.trim() || fallback;
  };
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  let applied = 0;
  let pushedToHubspot = 0;
  for (const item of items) {
    const vat = vatFromSiren(item.siren);
    // 1. Colonnes canoniques Revold — la base du rapprochement.
    const update: Record<string, unknown> = { siren: item.siren, vat_number: vat };
    if (item.siret && /^\d{14}$/.test(item.siret)) update.siret = item.siret;
    const { error } = await supabase
      .from("companies")
      .update(update)
      .eq("id", item.companyId)
      .eq("organization_id", orgId);
    // Raison sociale (entreprise à facturer) : colonne dédiée, à part — si la
    // migration legal_name n'est pas appliquée, l'enrichissement reste acquis.
    if (!error && item.legalName) {
      // Résultat volontairement ignoré : colonne absente → pas bloquant.
      await supabase
        .from("companies")
        .update({ legal_name: item.legalName })
        .eq("id", item.companyId)
        .eq("organization_id", orgId);
    }
    if (error) continue;
    applied++;

    // 2. Écriture DANS HubSpot (best-effort) : la donnée corrigée vit aussi
    //    dans l'outil du client, pas seulement chez Revold.
    if (hubspotToken) {
      const { data: comp } = await supabase
        .from("companies")
        .select("hubspot_id")
        .eq("id", item.companyId)
        .eq("organization_id", orgId)
        .maybeSingle();
      const hsId = comp?.hubspot_id as string | null | undefined;
      if (hsId) {
        const properties: Record<string, string> = {
          [propFor("siren", "siren")]: item.siren,
          [propFor("vat_number", "vat_number")]: vat,
        };
        if (item.siret && /^\d{14}$/.test(item.siret)) properties[propFor("siret", "siret")] = item.siret;
        try {
          const res = await fetch(`https://api.hubapi.com/crm/v3/objects/companies/${hsId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ properties }),
          });
          if (res.ok) pushedToHubspot++;
        } catch {
          /* propriété absente du portail ou réseau : l'enrichissement Revold reste acquis */
        }
      }
    }
  }

  return NextResponse.json({ ok: true, applied, pushedToHubspot });
}
