import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { fetchCompanyFacts, searchCompanyInSirene } from "@/lib/enrichment/company-enrichment";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Enrichissement EFFECTIFS & CA officiels des entreprises — source : API
 * Recherche d'Entreprises de l'État (tranches d'effectif URSSAF/INSEE + CA
 * déposé à l'INPI). Deux clés de lecture :
 *  - SIREN quand il est présent (déterministe) ;
 *  - NOM sinon : le SIREN trouvé sert UNIQUEMENT de clé de lecture — il n'est
 *    PAS écrit (certains clients ne veulent pas de SIREN dans leur base, mais
 *    veulent le CA et l'effectif).
 * Données évolutives : jamais enrichies d'abord, puis les plus anciennes.
 *
 * GET  : propose les données officielles (rien n'est écrit, l'utilisateur valide).
 * POST : applique la sélection — colonnes official_* chez Revold ET, si le
 *        portail est connecté, PATCH des propriétés HubSpot natives
 *        (annualrevenue, numberofemployees) : la base CRM du client est enrichie.
 */

type CompanyRow = {
  id: string;
  name: string | null;
  siren: string | null;
  hubspot_id: string | null;
  annual_revenue: number | null;
  employee_count: number | null;
  enriched_at: string | null;
};

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  // `scope=no_siren` : uniquement les entreprises SANS SIREN (lookup par nom).
  // Les entreprises AVEC SIREN sont déjà traitées automatiquement par le moteur
  // de backfill (bouton « Enrichir toute ma base » + cron) — ce périmètre évite
  // de refaire le même travail en doublon.
  const noSirenOnly = new URL(request.url).searchParams.get("scope") === "no_siren";

  // Jamais enrichies d'abord, puis les plus anciennes (données évolutives).
  let query = supabase
    .from("companies")
    .select("id, name, siren, hubspot_id, annual_revenue, employee_count, enriched_at")
    .eq("organization_id", orgId)
    .not("name", "is", null);
  if (noSirenOnly) query = query.is("siren", null);
  const { data, error } = await query
    .order("enriched_at", { ascending: true, nullsFirst: true })
    .limit(20);
  if (error) {
    return NextResponse.json({ error: "Migration companies_financials non appliquée — redéploie puis réessaie." }, { status: 500 });
  }

  const companies = ((data ?? []) as CompanyRow[]).filter(
    (c) => (c.siren && /^\d{9}$/.test(c.siren)) || (c.name ?? "").trim().length >= 2,
  );
  const proposals: Array<{
    companyId: string;
    name: string;
    siren: string | null;
    hubspotId: string | null;
    matchedVia: "siren" | "name";
    confidence: "high" | "medium";
    employeeRange: string | null;
    employeeYear: number | null;
    employeeMidpoint: number | null;
    revenue: number | null;
    revenueYear: number | null;
    currentEmployees: number | null;
    currentRevenue: number | null;
    lastEnrichedAt: string | null;
  }> = [];

  // Séquentiel : l'API publique limite à ~7 req/s — on reste très en dessous.
  for (const c of companies) {
    let facts = null;
    let matchedVia: "siren" | "name" = "siren";
    let confidence: "high" | "medium" = "high";
    let siren: string | null = c.siren;
    if (c.siren && /^\d{9}$/.test(c.siren)) {
      facts = await fetchCompanyFacts(c.siren);
    } else {
      // Sans SIREN : le nom sert de clé — le SIREN trouvé n'est PAS écrit.
      const found = await searchCompanyInSirene(c.name!);
      if (found) {
        facts = found.facts;
        matchedVia = "name";
        confidence = found.confidence;
        siren = found.siren;
      }
    }
    if (!facts || (facts.employeeRange == null && facts.revenue == null)) continue;
    proposals.push({
      companyId: c.id,
      name: c.name ?? siren ?? "—",
      siren,
      hubspotId: c.hubspot_id,
      matchedVia,
      confidence,
      employeeRange: facts.employeeRange,
      employeeYear: facts.employeeYear,
      employeeMidpoint: facts.employeeMidpoint,
      revenue: facts.revenue,
      revenueYear: facts.revenueYear,
      currentEmployees: c.employee_count,
      currentRevenue: c.annual_revenue,
      lastEnrichedAt: c.enriched_at,
    });
  }

  return NextResponse.json({ scanned: companies.length, proposals });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    items?: Array<{
      companyId?: string;
      employeeRange?: string | null;
      employeeYear?: number | null;
      employeeMidpoint?: number | null;
      revenue?: number | null;
      revenueYear?: number | null;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const items = (body.items ?? []).filter((i) => typeof i.companyId === "string");
  if (items.length === 0) return NextResponse.json({ error: "Aucun enrichissement à appliquer" }, { status: 400 });

  const hubspotToken = await getHubSpotToken(supabase, orgId);
  let applied = 0;
  let pushedToHubspot = 0;

  for (const item of items) {
    // 1. Colonnes officielles Revold (datées) — la référence rafraîchissable.
    const update: Record<string, unknown> = { enriched_at: new Date().toISOString() };
    if (item.employeeRange) {
      update.official_employee_range = String(item.employeeRange).slice(0, 60);
      update.official_employee_year = typeof item.employeeYear === "number" ? item.employeeYear : null;
    }
    if (typeof item.revenue === "number") {
      update.official_revenue = item.revenue;
      update.official_revenue_year = typeof item.revenueYear === "number" ? item.revenueYear : null;
    }
    const { error } = await supabase
      .from("companies")
      .update(update)
      .eq("id", item.companyId!)
      .eq("organization_id", orgId);
    if (error) continue;
    applied++;

    // 2. Écriture DANS HubSpot (propriétés natives) : le CRM du client est
    //    enrichi, pas seulement Revold — et la prochaine sync ramène ces
    //    valeurs dans les colonnes canoniques (boucle vertueuse).
    if (hubspotToken) {
      const { data: comp } = await supabase
        .from("companies")
        .select("hubspot_id")
        .eq("id", item.companyId!)
        .eq("organization_id", orgId)
        .maybeSingle();
      const hsId = comp?.hubspot_id as string | null | undefined;
      const properties: Record<string, string> = {};
      if (typeof item.revenue === "number") properties.annualrevenue = String(Math.round(item.revenue));
      if (typeof item.employeeMidpoint === "number") properties.numberofemployees = String(item.employeeMidpoint);
      if (hsId && Object.keys(properties).length > 0) {
        try {
          const res = await fetch(`https://api.hubapi.com/crm/v3/objects/companies/${hsId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ properties }),
          });
          if (res.ok) pushedToHubspot++;
        } catch {
          /* réseau : l'enrichissement Revold reste acquis */
        }
      }
    }
  }

  return NextResponse.json({ ok: true, applied, pushedToHubspot });
}
