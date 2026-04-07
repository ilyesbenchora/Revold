/**
 * HubSpot Sync Engine
 * Uses HubSpot native properties (hs_is_closed_won, hs_is_closed) for accurate mapping.
 * Maps lifecycle stages: lead → non qualifié, opportunity/customer → SQL.
 * Triggers KPI recomputation after deals sync.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchHubSpotCompanies,
  fetchHubSpotContacts,
  fetchHubSpotDeals,
  type HubSpotCompany,
  type HubSpotContact,
  type HubSpotDeal,
} from "./hubspot";
import { computeAllKpis } from "@/lib/kpi/compute";

type SyncResult = { count: number; errors: string[] };

// ── Lifecycle mapping ──
// HubSpot lifecyclestages: subscriber, lead, marketingqualifiedlead, salesqualifiedlead, opportunity, customer, evangelist, other
// In practice most portals only use: lead, opportunity, customer
function contactIsMql(lifecycle: string | null): boolean {
  const lc = lifecycle?.toLowerCase() ?? "";
  // opportunity and above implies qualified
  return ["marketingqualifiedlead", "salesqualifiedlead", "opportunity", "customer", "evangelist"].includes(lc);
}

function contactIsSql(lifecycle: string | null): boolean {
  const lc = lifecycle?.toLowerCase() ?? "";
  return ["salesqualifiedlead", "opportunity", "customer"].includes(lc);
}

// ── Sync by type ──

export async function syncHubSpotDataByType(
  supabase: SupabaseClient,
  orgId: string,
  accessToken: string,
  syncType: "companies" | "contacts" | "deals",
): Promise<SyncResult> {
  let count = 0;
  const errors: string[] = [];

  if (syncType === "companies") {
    const data = await fetchHubSpotCompanies(accessToken);
    for (let i = 0; i < data.length; i += 50) {
      const batch = data.slice(i, i + 50).map((c) => mapCompany(c, orgId));
      const { error } = await supabase.from("companies").upsert(batch, { onConflict: "organization_id,hubspot_id" });
      if (error) errors.push(error.message);
      else count += batch.length;
    }
  } else if (syncType === "contacts") {
    const data = await fetchHubSpotContacts(accessToken);
    for (let i = 0; i < data.length; i += 50) {
      const batch = data.slice(i, i + 50).map((c) => mapContact(c, orgId));
      const { error } = await supabase.from("contacts").upsert(batch, { onConflict: "organization_id,hubspot_id" });
      if (error) errors.push(error.message);
      else count += batch.length;
    }
  } else if (syncType === "deals") {
    const data = await fetchHubSpotDeals(accessToken);
    for (let i = 0; i < data.length; i += 50) {
      const batch = data.slice(i, i + 50).map((d) => mapDeal(d, orgId));
      const { error } = await supabase.from("deals").upsert(batch, { onConflict: "organization_id,hubspot_id" });
      if (error) errors.push(error.message);
      else count += batch.length;
    }
  }

  return { count, errors };
}

// ── KPI Recomputation ──

export async function recomputeKpis(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ success: boolean; error?: string }> {
  const [dealsRes, contactsRes, activitiesRes, orgRes] = await Promise.all([
    supabase
      .from("deals")
      .select("id, amount, close_date, created_date, days_in_stage, last_activity_at, is_at_risk, is_closed_won, is_closed_lost, win_probability")
      .eq("organization_id", orgId),
    supabase
      .from("contacts")
      .select("id, company_id, is_mql, is_sql")
      .eq("organization_id", orgId),
    supabase
      .from("activities")
      .select("id, deal_id")
      .eq("organization_id", orgId),
    supabase
      .from("organizations")
      .select("quarterly_target")
      .eq("id", orgId)
      .single(),
  ]);

  const quarterlyTarget = Number(orgRes.data?.quarterly_target) || 2000000;

  const deals = (dealsRes.data ?? []).map((d) => ({
    id: d.id,
    amount: Number(d.amount) || 0,
    close_date: d.close_date,
    created_date: d.created_date,
    days_in_stage: d.days_in_stage ?? 0,
    last_activity_at: d.last_activity_at,
    is_at_risk: d.is_at_risk ?? false,
    is_closed_won: d.is_closed_won ?? false,
    is_closed_lost: d.is_closed_lost ?? false,
    stage_probability: Number(d.win_probability) || 50,
  }));

  const contacts = contactsRes.data ?? [];
  const activities = activitiesRes.data ?? [];
  const previousMqls = contacts.filter((c) => c.is_mql).length;

  const kpis = computeAllKpis(deals, contacts, activities, quarterlyTarget, previousMqls);

  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase.from("kpi_snapshots").upsert(
    { organization_id: orgId, snapshot_date: today, ...kpis },
    { onConflict: "organization_id,snapshot_date" },
  );

  // Generate rule-based insights from KPIs
  if (!error) {
    await generateRuleBasedInsights(supabase, orgId, kpis);
  }

  return { success: !error, error: error?.message };
}

// ── Mappers ──

function mapCompany(hsc: HubSpotCompany, orgId: string) {
  return {
    organization_id: orgId,
    hubspot_id: hsc.id,
    name: hsc.properties.name || `Company ${hsc.id}`,
    domain: hsc.properties.domain,
    industry: hsc.properties.industry,
    annual_revenue: hsc.properties.annualrevenue ? Number(hsc.properties.annualrevenue) : null,
    employee_count: hsc.properties.numberofemployees ? Number(hsc.properties.numberofemployees) : null,
    updated_at: new Date().toISOString(),
  };
}

function mapContact(hscont: HubSpotContact, orgId: string) {
  return {
    organization_id: orgId,
    hubspot_id: hscont.id,
    email: hscont.properties.email || `unknown-${hscont.id}@hubspot.com`,
    full_name: [hscont.properties.firstname, hscont.properties.lastname].filter(Boolean).join(" ") || `Contact ${hscont.id}`,
    title: hscont.properties.jobtitle,
    phone: hscont.properties.phone,
    is_mql: contactIsMql(hscont.properties.lifecyclestage),
    is_sql: contactIsSql(hscont.properties.lifecyclestage),
  };
}

function mapDeal(hsd: HubSpotDeal, orgId: string) {
  // Use HubSpot native properties — most reliable
  const isClosedWon = hsd.properties.hs_is_closed_won === "true";
  const isClosed = hsd.properties.hs_is_closed === "true";
  const isClosedLost = isClosed && !isClosedWon;
  const probability = hsd.properties.hs_deal_stage_probability
    ? Math.round(parseFloat(hsd.properties.hs_deal_stage_probability) * 100)
    : 0;

  return {
    organization_id: orgId,
    hubspot_id: hsd.id,
    name: hsd.properties.dealname || `Deal ${hsd.id}`,
    amount: hsd.properties.amount ? Number(hsd.properties.amount) : 0,
    close_date: hsd.properties.closedate?.split("T")[0] || null,
    created_date: hsd.properties.createdate?.split("T")[0] ?? new Date().toISOString().split("T")[0],
    last_activity_at: hsd.properties.hs_lastmodifieddate || null,
    is_closed_won: isClosedWon,
    is_closed_lost: isClosedLost,
    win_probability: probability,
    updated_at: new Date().toISOString(),
  };
}

// ── Rule-based Insights ──

type KpiValues = Record<string, number>;

async function generateRuleBasedInsights(supabase: SupabaseClient, orgId: string, kpis: KpiValues) {
  // Dismiss old auto-generated insights
  await supabase
    .from("ai_insights")
    .update({ is_dismissed: true })
    .eq("organization_id", orgId)
    .eq("is_dismissed", false);

  const insights: Array<{
    organization_id: string;
    category: string;
    severity: string;
    title: string;
    body: string;
    recommendation: string;
  }> = [];

  const cr = kpis.closing_rate ?? 0;
  const pc = kpis.pipeline_coverage ?? 0;
  const scd = kpis.sales_cycle_days ?? 0;
  const idp = kpis.inactive_deals_pct ?? 0;
  const dc = kpis.data_completeness ?? 0;
  const mql = kpis.mql_to_sql_rate ?? 0;
  const fl = kpis.funnel_leakage_rate ?? 0;
  const dsr = kpis.deal_stagnation_rate ?? 0;
  const apd = kpis.activities_per_deal ?? 0;

  // Sales insights
  if (cr < 20) {
    insights.push({
      organization_id: orgId,
      category: "sales",
      severity: "critical",
      title: `Taux de closing faible : ${cr}%`,
      body: `Le taux de closing est de ${cr}%, bien en dessous du benchmark de 25-30%. Cela indique un problème de qualification ou de processus de vente.`,
      recommendation: "Revoir les critères de qualification des deals entrants et renforcer le coaching commercial sur les étapes de négociation.",
    });
  } else if (cr < 30) {
    insights.push({
      organization_id: orgId,
      category: "sales",
      severity: "warning",
      title: `Taux de closing à améliorer : ${cr}%`,
      body: `Le taux de closing est de ${cr}%. Il y a une marge d'amélioration par rapport au benchmark de 30%.`,
      recommendation: "Analyser les deals perdus récemment pour identifier les patterns et ajuster le discours commercial.",
    });
  }

  if (pc < 2) {
    insights.push({
      organization_id: orgId,
      category: "pipeline",
      severity: "critical",
      title: `Couverture pipeline insuffisante : ${pc}x`,
      body: `La couverture pipeline est de ${pc}x. Un ratio minimum de 3x est recommandé pour atteindre les objectifs trimestriels.`,
      recommendation: "Intensifier la prospection et les actions d'acquisition pour alimenter le pipeline.",
    });
  }

  if (scd > 60) {
    insights.push({
      organization_id: orgId,
      category: "sales",
      severity: "warning",
      title: `Cycle de vente long : ${scd} jours`,
      body: `Le cycle de vente moyen est de ${scd} jours. Un cycle supérieur à 60 jours ralentit la vélocité du pipeline.`,
      recommendation: "Identifier les étapes du pipeline où les deals stagnent et mettre en place des actions d'accélération.",
    });
  }

  // Marketing insights
  if (mql < 15) {
    insights.push({
      organization_id: orgId,
      category: "marketing",
      severity: "warning",
      title: `Conversion MQL vers SQL faible : ${mql}%`,
      body: `Seulement ${mql}% des MQL se convertissent en SQL. Le benchmark se situe entre 15% et 25%.`,
      recommendation: "Revoir les critères de scoring MQL et aligner marketing et sales sur la définition d'un lead qualifié.",
    });
  }

  if (fl > 50) {
    insights.push({
      organization_id: orgId,
      category: "marketing",
      severity: "critical",
      title: `Fuite funnel élevée : ${fl}%`,
      body: `${fl}% des leads qualifiés sont perdus dans le funnel avant de devenir des opportunités.`,
      recommendation: "Mettre en place des workflows de nurturing pour les leads qui ne convertissent pas immédiatement.",
    });
  }

  // Data/CRM insights
  if (dc < 70) {
    insights.push({
      organization_id: orgId,
      category: "data",
      severity: "critical",
      title: `Complétude des données CRM faible : ${dc}%`,
      body: `Seulement ${dc}% des champs obligatoires sont remplis dans le CRM. Cela affecte la fiabilité des KPIs et du scoring.`,
      recommendation: "Mettre en place des champs obligatoires dans HubSpot et former l'équipe commerciale à la saisie.",
    });
  }

  if (idp > 30) {
    insights.push({
      organization_id: orgId,
      category: "pipeline",
      severity: "warning",
      title: `${idp}% des deals sont inactifs`,
      body: `Un tiers des deals ouverts n'ont eu aucune activité depuis plus de 14 jours. Ce pipeline dormant fausse les prévisions.`,
      recommendation: "Lancer une revue de pipeline pour clôturer les deals morts et réactiver ceux qui ont du potentiel.",
    });
  }

  if (dsr > 25) {
    insights.push({
      organization_id: orgId,
      category: "pipeline",
      severity: "warning",
      title: `Stagnation élevée : ${dsr}% des deals bloqués`,
      body: `${dsr}% des deals sont restés trop longtemps dans la même étape, signe de friction dans le processus de vente.`,
      recommendation: "Identifier les étapes bloquantes et mettre en place des playbooks d'accélération par stage.",
    });
  }

  if (apd < 3) {
    insights.push({
      organization_id: orgId,
      category: "sales",
      severity: "info",
      title: `Faible engagement : ${apd} activités par deal`,
      body: `En moyenne ${apd} activités par deal. Les deals avec plus de 5 activités ont un taux de closing 2x supérieur.`,
      recommendation: "Encourager les commerciaux à augmenter le nombre de touchpoints (appels, emails, meetings) par deal.",
    });
  }

  // Always add at least one positive insight
  if (cr >= 30) {
    insights.push({
      organization_id: orgId,
      category: "sales",
      severity: "info",
      title: `Bon taux de closing : ${cr}%`,
      body: `Le taux de closing de ${cr}% est au-dessus du benchmark. L'équipe commerciale performe bien sur la conversion.`,
      recommendation: "Maintenir les bonnes pratiques et documenter les patterns de succès pour les partager avec l'équipe.",
    });
  }

  if (insights.length > 0) {
    await supabase.from("ai_insights").insert(insights);
  }
}
