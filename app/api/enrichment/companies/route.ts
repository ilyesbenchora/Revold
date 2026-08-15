import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { vatFromSiren } from "@/lib/enrichment/company-enrichment";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * FILE DE VALIDATION des identités (SIREN / SIRET / TVA / raison sociale).
 *
 * Le SCAN de la base appartient au moteur de backfill
 * (lib/enrichment/backfill-engine : bouton « Enrichir toute ma base » + cron
 * horaire) : il applique seul les correspondances SÛRES et dépose ici les
 * correspondances PLAUSIBLES.
 *
 * GET  : liste les candidats en attente (candidate_*), zéro appel API.
 * POST : applique les candidats VALIDÉS — colonnes canoniques (companies) ET,
 *        si l'entreprise vient de HubSpot et que les propriétés sont mappées,
 *        pousse les valeurs DANS HubSpot.
 */

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  type ProposalOut = {
    companyId: string;
    name: string;
    domain: string | null;
    hubspotId: string | null;
    siren: string;
    siret: string | null;
    vatNumber: string;
    legalName: string;
    confidence: "high" | "medium";
  };

  // FILE DE VALIDATION uniquement (instantané, zéro appel API) : les
  // correspondances « plausibles » que l'enrichissement (backfill à la demande
  // ou cron horaire) n'a délibérément PAS appliquées seul. Le scan de la base
  // appartient au moteur de backfill — ce bloc ne fait que la validation.
  const { data: queued, error } = await supabase
    .from("companies")
    .select("id, name, domain, hubspot_id, candidate_siren, candidate_siret, candidate_legal_name")
    .eq("organization_id", orgId)
    .is("siren", null)
    .not("candidate_siren", "is", null)
    .limit(100);
  // Colonnes candidate_* absentes (migration non appliquée) → file vide.
  if (error) return NextResponse.json({ proposals: [], unavailable: true });

  const proposals: ProposalOut[] = [];
  for (const c of queued ?? []) {
    const siren = c.candidate_siren as string | null;
    if (!siren || !/^\d{9}$/.test(siren)) continue;
    proposals.push({
      companyId: c.id as string,
      name: (c.name as string | null) ?? siren,
      domain: (c.domain as string | null) ?? null,
      hubspotId: (c.hubspot_id as string | null) ?? null,
      siren,
      siret: (c.candidate_siret as string | null) ?? null,
      vatNumber: vatFromSiren(siren),
      legalName: (c.candidate_legal_name as string | null) ?? ((c.name as string | null) ?? siren),
      confidence: "medium",
    });
  }

  return NextResponse.json({ proposals });
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

    // Candidat validé → on vide la file (best-effort : colonnes d'une
    // migration récente, jamais bloquant).
    await supabase
      .from("companies")
      .update({ candidate_siren: null, candidate_siret: null, candidate_legal_name: null })
      .eq("id", item.companyId)
      .eq("organization_id", orgId);

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
