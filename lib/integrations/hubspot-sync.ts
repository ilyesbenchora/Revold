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
    // Fetch pipeline stages first to correctly identify won/lost
    const stageMap = await fetchStageMap(accessToken);
    const data = await fetchHubSpotDeals(accessToken);
    for (let i = 0; i < data.length; i += 50) {
      const batch = data.slice(i, i + 50).map((d) => mapDeal(d, orgId, stageMap));
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

  // Generate insights from real CRM data
  if (!error) {
    await generateRuleBasedInsights(supabase, orgId);
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

type StageInfo = { isWon: boolean; isLost: boolean; probability: number };

async function fetchStageMap(accessToken: string): Promise<Map<string, StageInfo>> {
  const res = await fetch("https://api.hubapi.com/crm/v3/pipelines/deals", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return new Map();
  const data = await res.json();
  const map = new Map<string, StageInfo>();
  for (const pipeline of data.results ?? []) {
    for (const stage of pipeline.stages ?? []) {
      const isClosed = stage.metadata?.isClosed === "true";
      const prob = parseFloat(stage.metadata?.probability ?? "0");
      map.set(stage.id, {
        isWon: isClosed && prob === 1.0,
        isLost: isClosed && prob === 0.0,
        probability: Math.round(prob * 100),
      });
    }
  }
  return map;
}

function mapDeal(hsd: HubSpotDeal, orgId: string, stages: Map<string, StageInfo>) {
  // Use pipeline stages API — hs_is_closed_won is unreliable on custom pipelines
  const stageInfo = stages.get(hsd.properties.dealstage);
  const isClosedWon = stageInfo?.isWon ?? false;
  const isClosedLost = stageInfo?.isLost ?? false;
  const probability = stageInfo?.probability ?? (
    hsd.properties.hs_deal_stage_probability
      ? Math.round(parseFloat(hsd.properties.hs_deal_stage_probability) * 100)
      : 0
  );

  return {
    organization_id: orgId,
    hubspot_id: hsd.id,
    name: hsd.properties.dealname || `Deal ${hsd.id}`,
    amount: hsd.properties.amount ? Number(hsd.properties.amount) : 0,
    close_date: hsd.properties.closedate?.split("T")[0] || null,
    created_date: hsd.properties.createdate?.split("T")[0] ?? new Date().toISOString().split("T")[0],
    last_activity_at: hsd.properties.hs_lastmodifieddate || null,
    last_contacted_at: hsd.properties.notes_last_contacted || null,
    next_activity_date: hsd.properties.notes_next_activity_date || null,
    sales_activities_count: hsd.properties.num_notes ? Number(hsd.properties.num_notes) : 0,
    days_to_close: hsd.properties.days_to_close ? Number(hsd.properties.days_to_close) : null,
    forecast_amount: hsd.properties.hs_forecast_amount ? Number(hsd.properties.hs_forecast_amount) : null,
    associated_contacts_count: hsd.properties.num_associated_contacts ? Number(hsd.properties.num_associated_contacts) : 0,
    is_closed_won: isClosedWon,
    is_closed_lost: isClosedLost,
    win_probability: probability,
    updated_at: new Date().toISOString(),
  };
}

// ── Rule-based Insights ──

async function generateRuleBasedInsights(supabase: SupabaseClient, orgId: string) {
  // Dismiss old insights
  await supabase.from("ai_insights").update({ is_dismissed: true }).eq("organization_id", orgId).eq("is_dismissed", false);

  // Query real CRM data for insights
  const [
    { count: totalDeals }, { count: wonDeals }, { count: lostDeals }, { count: openDeals },
    { count: dealsNoNextActivity }, { count: dealsNoActivity },
    { count: totalContacts }, { count: opportunityContacts }, { count: contactsOrphans },
    { count: contactsNoPhone }, { count: contactsNoTitle },
    { count: totalCompanies }, { count: companiesNoIndustry },
    { count: dealsNoAmount }, { count: dealsNoCloseDate },
  ] = await Promise.all([
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_lost", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).is("next_activity_date", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).eq("sales_activities_count", 0),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("company_id", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("phone", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("title", null),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("industry", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).lte("amount", 0),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("close_date", null),
  ]);

  const td = totalDeals ?? 0;
  const won = wonDeals ?? 0;
  const lost = lostDeals ?? 0;
  const open = openDeals ?? 0;
  const noNext = dealsNoNextActivity ?? 0;
  const noAct = dealsNoActivity ?? 0;
  const tc = totalContacts ?? 0;
  const opps = opportunityContacts ?? 0;
  const orphans = contactsOrphans ?? 0;
  const noPhone = contactsNoPhone ?? 0;
  const noTitle = contactsNoTitle ?? 0;
  const tco = totalCompanies ?? 0;
  const noIndustry = companiesNoIndustry ?? 0;
  const noAmount = dealsNoAmount ?? 0;
  const noClose = dealsNoCloseDate ?? 0;

  const closingRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const conversionRate = tc > 0 ? Math.round((opps / tc) * 100) : 0;
  const followUpRate = open > 0 ? Math.round(((open - noNext) / open) * 100) : 0;

  type Insight = { organization_id: string; category: string; severity: string; title: string; body: string; recommendation: string };
  const insights: Insight[] = [];

  // ── SALES ──
  if ((won + lost) > 0 && closingRate < 30) {
    insights.push({ organization_id: orgId, category: "sales", severity: closingRate < 15 ? "critical" : "warning",
      title: `Taux de closing : ${closingRate}%`,
      body: `Sur ${won + lost} transactions clôturées, ${won} ont été gagnées. Le benchmark se situe entre 25% et 35%.`,
      recommendation: "Analyser les transactions perdues pour identifier les causes récurrentes et renforcer le processus de qualification." });
  }

  if (open > 0 && noNext > open * 0.5) {
    insights.push({ organization_id: orgId, category: "sales", severity: "critical",
      title: `${noNext} transactions sans prochaine activité planifiée`,
      body: `${Math.round((noNext / open) * 100)}% des transactions en cours n'ont aucune prochaine activité planifiée. Ces deals risquent de stagner.`,
      recommendation: "Mettre en place une règle : chaque transaction ouverte doit avoir une prochaine étape datée dans le CRM." });
  }

  if (open > 0 && noAct > 0) {
    insights.push({ organization_id: orgId, category: "sales", severity: noAct > open * 0.3 ? "critical" : "warning",
      title: `${noAct} transactions sans aucune activité commerciale`,
      body: `Ces transactions ont été créées mais jamais travaillées. Elles occupent le pipeline sans avancer.`,
      recommendation: "Lancer un sprint de qualification : contacter chaque deal sans activité cette semaine ou le clôturer." });
  }

  // ── MARKETING ──
  if (tc > 0 && conversionRate < 20) {
    insights.push({ organization_id: orgId, category: "marketing", severity: conversionRate < 10 ? "warning" : "info",
      title: `Conversion Lead vers Opportunité : ${conversionRate}%`,
      body: `Sur ${tc.toLocaleString("fr-FR")} contacts, ${opps.toLocaleString("fr-FR")} sont en phase Opportunité. Le reste est encore en statut Lead.`,
      recommendation: "Revoir les critères de passage Lead → Opportunité et mettre en place des workflows de nurturing automatisés." });
  }

  if (tc > 0 && orphans > tc * 0.2) {
    insights.push({ organization_id: orgId, category: "marketing", severity: orphans > tc * 0.4 ? "critical" : "warning",
      title: `${orphans.toLocaleString("fr-FR")} contacts sans entreprise associée`,
      body: `${Math.round((orphans / tc) * 100)}% des contacts ne sont rattachés à aucune entreprise, ce qui empêche l'analyse par compte.`,
      recommendation: "Activer l'association automatique par domaine email dans HubSpot et lancer un nettoyage des contacts orphelins." });
  }

  // ── DATA QUALITY ──
  if (tc > 0 && noPhone > tc * 0.5) {
    insights.push({ organization_id: orgId, category: "data", severity: "warning",
      title: `${Math.round((noPhone / tc) * 100)}% des contacts sans numéro de téléphone`,
      body: `${noPhone.toLocaleString("fr-FR")} contacts n'ont pas de téléphone renseigné. Cela limite les possibilités de contact direct.`,
      recommendation: "Enrichir les données via un outil tiers (Dropcontact, Clearbit) ou rendre le champ téléphone obligatoire sur les formulaires." });
  }

  if (tc > 0 && noTitle > tc * 0.5) {
    insights.push({ organization_id: orgId, category: "data", severity: "info",
      title: `${Math.round((noTitle / tc) * 100)}% des contacts sans poste renseigné`,
      body: `Le poste permet de qualifier les contacts et de personnaliser les approches commerciales.`,
      recommendation: "Ajouter le champ poste dans les formulaires et enrichir les contacts existants via LinkedIn Sales Navigator." });
  }

  if (tco > 0 && noIndustry > tco * 0.7) {
    insights.push({ organization_id: orgId, category: "data", severity: "warning",
      title: `${Math.round((noIndustry / tco) * 100)}% des entreprises sans secteur d'activité`,
      body: `${noIndustry.toLocaleString("fr-FR")} entreprises n'ont pas de secteur renseigné. Impossible de segmenter par industrie.`,
      recommendation: "Enrichir les fiches entreprises avec le secteur d'activité via l'enrichissement automatique HubSpot ou un outil tiers." });
  }

  if (td > 0 && noAmount > td * 0.5) {
    insights.push({ organization_id: orgId, category: "data", severity: "critical",
      title: `${Math.round((noAmount / td) * 100)}% des transactions sans montant`,
      body: `${noAmount} transactions n'ont pas de montant renseigné. Les prévisions de revenus et la couverture pipeline sont faussées.`,
      recommendation: "Rendre le champ montant obligatoire à partir d'un certain stage du pipeline." });
  }

  if (td > 0 && noClose > td * 0.5) {
    insights.push({ organization_id: orgId, category: "data", severity: "warning",
      title: `${Math.round((noClose / td) * 100)}% des transactions sans date de closing`,
      body: `Sans date de closing prévisionnelle, il est impossible de construire un forecast fiable.`,
      recommendation: "Exiger une date de closing estimée dès la création de la transaction dans le CRM." });
  }

  // ── POSITIVE ──
  if (followUpRate >= 70) {
    insights.push({ organization_id: orgId, category: "sales", severity: "info",
      title: `Bon taux de suivi : ${followUpRate}% des deals avec activité planifiée`,
      body: `L'équipe commerciale maintient un bon rythme de suivi avec des prochaines étapes planifiées.`,
      recommendation: "Maintenir cette discipline et la partager comme bonne pratique à toute l'équipe." });
  }

  if ((won + lost) > 0 && closingRate >= 30) {
    insights.push({ organization_id: orgId, category: "sales", severity: "info",
      title: `Taux de closing solide : ${closingRate}%`,
      body: `${won} transactions gagnées sur ${won + lost} clôturées — au-dessus du benchmark de 25-30%.`,
      recommendation: "Documenter les facteurs de succès et les répliquer sur les deals en cours." });
  }

  if (insights.length > 0) {
    await supabase.from("ai_insights").insert(insights);
  }
}
