import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { vatFromSiren, employeeMidpointFromRange } from "@/lib/enrichment/company-enrichment";
import { hubFetch } from "@/lib/integrations/hub-fetch";

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
    /** Taille réelle de l'entreprise — aide à trancher, appliquée à la validation. */
    employeeRange: string | null;
    employeeYear: number | null;
    revenue: number | null;
    revenueYear: number | null;
  };

  // FILE DE VALIDATION uniquement (instantané, zéro appel API) : les
  // correspondances « plausibles » que l'enrichissement (backfill à la demande
  // ou cron horaire) n'a délibérément PAS appliquées seul. Le scan de la base
  // appartient au moteur de backfill — ce bloc ne fait que la validation.
  const COLS_FULL =
    "id, name, domain, hubspot_id, candidate_siren, candidate_siret, candidate_legal_name, candidate_employee_range, candidate_employee_year, candidate_revenue, candidate_revenue_year";
  const COLS_BASE = "id, name, domain, hubspot_id, candidate_siren, candidate_siret, candidate_legal_name";
  const fetchQueue = (cols: string) =>
    supabase
      .from("companies")
      .select(cols)
      .eq("organization_id", orgId)
      .is("siren", null)
      .not("candidate_siren", "is", null)
      .order("candidate_revenue", { ascending: false, nullsFirst: false })
      .limit(500);

  // Colonnes de faits d'une migration récente → repli sur les colonnes de base.
  let { data: queued, error } = await fetchQueue(COLS_FULL);
  if (error) ({ data: queued, error } = await fetchQueue(COLS_BASE));
  // Colonnes candidate_* absentes (migration non appliquée) → file vide.
  if (error) return NextResponse.json({ proposals: [], unavailable: true });

  const proposals: ProposalOut[] = [];
  for (const row of (queued ?? []) as unknown as Record<string, unknown>[]) {
    const siren = row.candidate_siren as string | null;
    if (!siren || !/^\d{9}$/.test(siren)) continue;
    const num = (v: unknown): number | null => (v == null ? null : Number(v) || null);
    proposals.push({
      companyId: row.id as string,
      name: (row.name as string | null) ?? siren,
      domain: (row.domain as string | null) ?? null,
      hubspotId: (row.hubspot_id as string | null) ?? null,
      siren,
      siret: (row.candidate_siret as string | null) ?? null,
      vatNumber: vatFromSiren(siren),
      legalName: (row.candidate_legal_name as string | null) ?? ((row.name as string | null) ?? siren),
      confidence: "medium",
      employeeRange: (row.candidate_employee_range as string | null) ?? null,
      employeeYear: num(row.candidate_employee_year),
      revenue: num(row.candidate_revenue),
      revenueYear: num(row.candidate_revenue_year),
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

  type Item = {
    companyId: string;
    siren: string;
    siret: string | null;
    legalName: string | null;
    employeeRange?: string | null;
    employeeYear?: number | null;
    revenue?: number | null;
    revenueYear?: number | null;
  };
  let body: { items?: Array<Partial<Item>> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const items = (body.items ?? []).filter(
    (i): i is Item =>
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
    let { error } = await supabase
      .from("companies")
      .update(update)
      .eq("id", item.companyId)
      .eq("organization_id", orgId);

    // Effectifs & CA validés en même temps que l'identité (déjà connus du
    // registre) — colonnes d'une migration récente : repli silencieux.
    if (!error && (item.employeeRange || typeof item.revenue === "number")) {
      const facts: Record<string, unknown> = { enriched_at: new Date().toISOString() };
      if (item.employeeRange) {
        facts.official_employee_range = item.employeeRange;
        facts.official_employee_year = item.employeeYear ?? null;
      }
      if (typeof item.revenue === "number") {
        facts.official_revenue = item.revenue;
        facts.official_revenue_year = item.revenueYear ?? null;
      }
      const { error: factsError } = await supabase
        .from("companies")
        .update(facts)
        .eq("id", item.companyId)
        .eq("organization_id", orgId);
      // Une colonne de faits absente ne doit jamais annuler l'identité validée.
      if (factsError) error = null;
    }
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
    const clearFull = {
      candidate_siren: null, candidate_siret: null, candidate_legal_name: null,
      candidate_employee_range: null, candidate_employee_year: null,
      candidate_revenue: null, candidate_revenue_year: null,
    };
    const { error: clearError } = await supabase
      .from("companies")
      .update(clearFull)
      .eq("id", item.companyId)
      .eq("organization_id", orgId);
    if (clearError) {
      await supabase
        .from("companies")
        .update({ candidate_siren: null, candidate_siret: null, candidate_legal_name: null })
        .eq("id", item.companyId)
        .eq("organization_id", orgId);
    }

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
        // Taille de l'entreprise poussée dans les propriétés natives HubSpot.
        if (typeof item.revenue === "number") properties.annualrevenue = String(Math.round(item.revenue));
        const mid = employeeMidpointFromRange(item.employeeRange);
        if (mid != null) properties.numberofemployees = String(mid);
        try {
          const res = await hubFetch(`https://api.hubapi.com/crm/v3/objects/companies/${hsId}`, {
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
