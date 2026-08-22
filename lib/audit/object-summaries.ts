/**
 * Synthèse par objet CRM (Contacts / Entreprises / Transactions) : volumes +
 * complétude des propriétés clés, enrichie des identifiants de rapprochement
 * actifs (SIREN, SIRET, TVA — règles cochées dans Paramètres → Modèle de
 * données). Alimente les cartes « Synthèse par objet » (page HubSpot de
 * l'audit données) et la tuile « Complétude moyenne » de la vue d'ensemble.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { hubFetch } from "@/lib/integrations/hub-fetch";

export type SummaryMetric = { label: string; pct: number; missing?: boolean };

export type ObjectSummary = {
  label: string;
  count: number;
  icon: "users" | "building" | "briefcase";
  tone: "blue" | "violet" | "orange";
  metrics: SummaryMetric[];
};

// Identifiants entreprise pilotés par les règles cochées dans Paramètres →
// Modèle de données → « Règles de résolution d'entités ». Une règle décochée
// fait disparaître sa métrique d'enrichissement du bloc Entreprises.
const COMPANY_RULE_IDENTIFIERS: Array<{
  ruleId: string;
  canonical: string;
  label: string;
  defaultEnabled: boolean;
  defaultField: string;
}> = [
  { ruleId: "siren_match", canonical: "siren", label: "SIREN", defaultEnabled: true, defaultField: "siren" },
  { ruleId: "siret_match", canonical: "siret", label: "SIRET", defaultEnabled: true, defaultField: "siret" },
  { ruleId: "vat_match", canonical: "vat_number", label: "N° TVA", defaultEnabled: true, defaultField: "vat_number" },
  { ruleId: "name_match", canonical: "company_name", label: "Nom", defaultEnabled: false, defaultField: "name" },
];

const pct = (filled: number, t: number) => (t > 0 ? Math.round((filled / t) * 100) : 0);

export async function computeObjectSummaries(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ObjectSummary[]> {
  const [snapshot, hubspotToken] = await Promise.all([
    getHubspotSnapshot(),
    getHubSpotToken(supabase, orgId),
  ]);

  const contactsTotal = snapshot.totalContacts;
  const contactsPhone = Math.max(0, contactsTotal - snapshot.contactsNoPhone);
  const contactsCompany = Math.max(0, contactsTotal - snapshot.orphansCount);
  const contactsTitle = Math.max(0, contactsTotal - snapshot.contactsNoTitle);

  const companiesTotal = snapshot.totalCompanies;
  const companiesDomain = Math.max(0, companiesTotal - snapshot.companiesNoDomain);
  const companiesIndustry = Math.max(0, companiesTotal - snapshot.companiesNoIndustry);
  const companiesRevenue = Math.max(0, companiesTotal - snapshot.companiesNoRevenue);

  const dealsTotal = snapshot.totalDeals;
  const dealsAmount = Math.max(0, dealsTotal - snapshot.dealsNoAmount);
  const dealsCloseDate = Math.max(0, dealsTotal - snapshot.dealsNoCloseDate);

  // dealsWithOwner non dans snapshot — fetch direct rapide
  let dealsOwner = 0;
  if (hubspotToken && dealsTotal > 0) {
    try {
      const res = await hubFetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "HAS_PROPERTY" }] }],
          limit: 1,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        dealsOwner = d.total ?? 0;
      }
    } catch {}
  }

  // ── Enrichissement Entreprises selon les règles de résolution cochées ──
  // On lit l'état des règles (entity_resolution_config) et le mapping des
  // propriétés HubSpot (identifier_field_mapping), puis on compte en live les
  // entreprises dont la propriété est renseignée (HAS_PROPERTY).
  let identifierMetrics: SummaryMetric[] = [];
  if (companiesTotal > 0) {
    let savedRules: Array<{ rule_id: string; enabled: boolean }> = [];
    let hubspotFieldMap: Record<string, string> = {};
    try {
      const [rulesRes, mappingRes] = await Promise.all([
        supabase.from("entity_resolution_config").select("rule_id, enabled").eq("organization_id", orgId),
        supabase.from("identifier_field_mapping").select("canonical_field, provider_field").eq("organization_id", orgId).eq("provider", "hubspot"),
      ]);
      savedRules = (rulesRes.data ?? []) as typeof savedRules;
      hubspotFieldMap = Object.fromEntries(
        ((mappingRes.data ?? []) as Array<{ canonical_field: string; provider_field: string }>).map((m) => [m.canonical_field, m.provider_field]),
      );
    } catch {}

    const activeIdentifiers = COMPANY_RULE_IDENTIFIERS.filter((def) => {
      const saved = savedRules.find((r) => r.rule_id === def.ruleId);
      return saved ? saved.enabled : def.defaultEnabled;
    });

    if (hubspotToken && activeIdentifiers.length > 0) {
      const results = await Promise.all(
        activeIdentifiers.map(async (def): Promise<SummaryMetric | null> => {
          const propName = (hubspotFieldMap[def.canonical] ?? def.defaultField).trim();
          if (!propName) return null;
          try {
            const res = await hubFetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
              method: "POST",
              headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: propName, operator: "HAS_PROPERTY" }] }],
                limit: 1,
              }),
            });
            if (res.ok) {
              const d = await res.json();
              return { label: def.label, pct: pct(d.total ?? 0, companiesTotal) };
            }
            // 400 = propriété inexistante dans le portail (mapping à créer côté CRM).
            if (res.status === 400) return { label: def.label, pct: 0, missing: true };
            return null;
          } catch {
            return null;
          }
        }),
      );
      identifierMetrics = results.filter((m): m is SummaryMetric => m !== null);
    }
  }

  return [
    {
      label: "Contacts",
      count: contactsTotal,
      icon: "users",
      tone: "blue",
      metrics: [
        { label: "Téléphone", pct: pct(contactsPhone, contactsTotal) },
        { label: "Entreprise liée", pct: pct(contactsCompany, contactsTotal) },
        { label: "Poste", pct: pct(contactsTitle, contactsTotal) },
      ],
    },
    {
      label: "Entreprises",
      count: companiesTotal,
      icon: "building",
      tone: "violet",
      metrics: [
        { label: "Domaine", pct: pct(companiesDomain, companiesTotal) },
        { label: "Secteur", pct: pct(companiesIndustry, companiesTotal) },
        { label: "CA", pct: pct(companiesRevenue, companiesTotal) },
        // Identifiants issus des règles de résolution cochées (SIREN, SIRET, TVA…).
        ...identifierMetrics,
      ],
    },
    {
      label: "Transactions",
      count: dealsTotal,
      icon: "briefcase",
      tone: "orange",
      metrics: [
        { label: "Montant", pct: pct(dealsAmount, dealsTotal) },
        { label: "Date closing", pct: pct(dealsCloseDate, dealsTotal) },
        { label: "Propriétaire", pct: pct(dealsOwner, dealsTotal) },
      ],
    },
  ];
}
