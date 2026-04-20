export const maxDuration = 60;

export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { PropertyCarousel } from "@/components/property-carousel";
import { PropertyUsageBlock } from "@/components/property-usage-block";
import { ContactAssociationsBlock } from "@/components/contact-associations-block";
import { TrackingSourcesBlock } from "@/components/tracking-sources-block";
import { SharedPropertiesBlock } from "@/components/shared-properties-block";
import { fetchPropertyUsage, type PropertyUsage } from "@/lib/integrations/property-usage";

type PropStat = { name: string; label: string; fillRate: number; isCustom: boolean };
type SharedProp = {
  name: string;
  label: string;
  objects: string[];
  type: string;
  sameLabel: boolean;
  isCustom: boolean;
  fillRate: number;
};
type SourceStat = { source: string; label: string; count: number; pct: number };
type DrillDown = { value: string; count: number; pct: number };
type DistributionResult = { sources: SourceStat[]; drillDown1: DrillDown[]; drillDown2: DrillDown[]; total: number };
type AssociationStat = {
  targetObject: string;
  targetLabel: string;
  icon: string;
  totalContacts: number;
  withAssociation: number;
  rate: number;
  labels: Array<{ label: string; count: number }>;
};

const HS = "https://api.hubapi.com";

// ── Distribution : industry / country / type — enterprise-centric ──
async function fetchCompanyDistribution(token: string): Promise<DistributionResult> {
  const industryCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  let totalFetched = 0;
  let after: string | undefined;
  let pages = 0;

  while (pages < 100) {
    const url = new URL(`${HS}/crm/v3/objects/companies`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("properties", "industry,country,type");
    if (after) url.searchParams.set("after", after);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) break;
    const data = await res.json();
    if ((data.results ?? []).length === 0) break;
    for (const item of data.results) {
      const p = item.properties ?? {};
      if (p.industry) industryCounts.set(p.industry, (industryCounts.get(p.industry) ?? 0) + 1);
      if (p.country) countryCounts.set(p.country, (countryCounts.get(p.country) ?? 0) + 1);
      if (p.type) typeCounts.set(p.type, (typeCounts.get(p.type) ?? 0) + 1);
      totalFetched++;
    }
    after = data.paging?.next?.after;
    pages++;
    if (!after) break;
  }

  if (totalFetched === 0) return { sources: [], drillDown1: [], drillDown2: [], total: 0 };

  const toSorted = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([k, v]) => ({ value: k, count: v, pct: Math.round((v / totalFetched) * 1000) / 10 }))
      .sort((a, b) => b.count - a.count);

  return {
    sources: toSorted(industryCounts).slice(0, 20).map((s) => ({ source: s.value, label: s.value, count: s.count, pct: s.pct })),
    drillDown1: toSorted(countryCounts).slice(0, 15),
    drillDown2: toSorted(typeCounts).slice(0, 15),
    total: totalFetched,
  };
}

// ── Associations entreprise-centric : combien de contacts/deals ont une company ──
async function fetchCompanyAssociations(token: string): Promise<AssociationStat[]> {
  async function searchTotal(objectType: string): Promise<number> {
    try {
      const res = await fetch(`${HS}/crm/v3/objects/${objectType}/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filterGroups: [], limit: 1 }),
      });
      return res.ok ? ((await res.json()).total ?? 0) : 0;
    } catch {
      return 0;
    }
  }

  async function searchWithProperty(objectType: string, propertyName: string): Promise<number> {
    try {
      const res = await fetch(`${HS}/crm/v3/objects/${objectType}/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName, operator: "HAS_PROPERTY" }] }],
          limit: 1,
        }),
      });
      return res.ok ? ((await res.json()).total ?? 0) : 0;
    } catch {
      return 0;
    }
  }

  async function fetchLabels(fromType: string, toType: string): Promise<Array<{ label: string }>> {
    try {
      const res = await fetch(`${HS}/crm/v4/associations/${fromType}/${toType}/labels`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.results ?? [])
        .filter((l: { label: string | null }) => l.label)
        .map((l: { label: string }) => ({ label: l.label }));
    } catch {
      return [];
    }
  }

  const [totalContacts, contactsWithCompany, contactLabels, totalDeals, dealsWithCompany, dealLabels] =
    await Promise.all([
      searchTotal("contacts"),
      searchWithProperty("contacts", "associatedcompanyid"),
      fetchLabels("companies", "contacts"),
      searchTotal("deals"),
      searchWithProperty("deals", "num_associated_contacts"), // proxy, deals.associations.companies pas exposé en search
      fetchLabels("companies", "deals"),
    ]);

  const results: AssociationStat[] = [];

  if (totalContacts > 0) {
    results.push({
      targetObject: "contacts",
      targetLabel: "Contacts avec entreprise",
      icon: "👥",
      totalContacts,
      withAssociation: contactsWithCompany,
      rate: Math.round((contactsWithCompany / totalContacts) * 100),
      labels: contactLabels.map((l) => ({ label: l.label, count: 0 })),
    });
  }

  if (totalDeals > 0) {
    results.push({
      targetObject: "deals",
      targetLabel: "Transactions avec entreprise",
      icon: "💰",
      totalContacts: totalDeals,
      withAssociation: dealsWithCompany,
      rate: Math.round((dealsWithCompany / totalDeals) * 100),
      labels: dealLabels.map((l) => ({ label: l.label, count: 0 })),
    });
  }

  return results;
}

// ── Shared properties — filtrées pour celles présentes sur companies ──
async function fetchSharedProperties(token: string): Promise<SharedProp[]> {
  const objectTypes = ["contacts", "companies", "deals"];
  const byName = new Map<string, Array<{ object: string; label: string; type: string; hubspotDefined: boolean }>>();

  await Promise.all(
    objectTypes.map(async (obj) => {
      try {
        const res = await fetch(`${HS}/crm/v3/properties/${obj}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        for (const p of data.results ?? []) {
          if (!byName.has(p.name)) byName.set(p.name, []);
          byName.get(p.name)!.push({ object: obj, label: p.label, type: p.type, hubspotDefined: !!p.hubspotDefined });
        }
      } catch {}
    }),
  );

  return [...byName.entries()]
    .filter(([, entries]) => entries.length > 1 && entries.some((e) => e.object === "companies"))
    .map(([name, entries]) => ({
      name,
      label: entries[0].label,
      objects: entries.map((e) => e.object),
      type: entries[0].type,
      sameLabel: new Set(entries.map((e) => e.label)).size === 1,
      isCustom: entries.some((e) => !e.hubspotDefined),
      fillRate: -1,
    }))
    .sort((a, b) => b.objects.length - a.objects.length || a.name.localeCompare(b.name));
}

export default async function DonneesEntreprisesPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const hubspotToken = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  const totalCompanies = snapshot.totalCompanies;

  // Fill rates Supabase pré-calculés pour companies
  const { data: fillRateRows } = await supabase
    .from("property_fill_rates")
    .select("property_name, label, is_custom, fill_rate")
    .eq("organization_id", orgId)
    .eq("object_type", "companies")
    .order("fill_rate", { ascending: false });

  const allPropertyStats: PropStat[] = (fillRateRows ?? [])
    .map((r) => ({
      name: r.property_name,
      label: r.label,
      fillRate: r.fill_rate,
      isCustom: r.is_custom,
    }))
    .filter((p) => p.fillRate > 0 || p.isCustom);

  let propertyUsage: PropertyUsage[] = [];
  let associationStats: AssociationStat[] = [];
  let distributionData: DistributionResult = { sources: [], drillDown1: [], drillDown2: [], total: 0 };
  let sharedProps: SharedProp[] = [];

  if (hubspotToken) {
    [propertyUsage, associationStats, distributionData, sharedProps] = await Promise.all([
      fetchPropertyUsage(hubspotToken),
      fetchCompanyAssociations(hubspotToken),
      fetchCompanyDistribution(hubspotToken),
      fetchSharedProperties(hubspotToken),
    ]);
  }

  // Filter HubSpot 0% out
  const zeroHubspotNames = new Set(
    (fillRateRows ?? []).filter((r) => r.fill_rate === 0 && !r.is_custom).map((r) => r.property_name),
  );
  propertyUsage = propertyUsage.filter((p) => !zeroHubspotNames.has(p.name) || p.isCustom);

  const fillRateMap = new Map(allPropertyStats.map((p) => [p.name, p.fillRate]));
  for (const sp of sharedProps) sp.fillRate = fillRateMap.get(sp.name) ?? -1;
  sharedProps = sharedProps.filter((p) => p.fillRate > 0 || p.isCustom);

  const hasData = allPropertyStats.length > 0;

  return (
    <div className="space-y-6">
      {!hasData && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800">
            Les taux d&apos;enrichissement entreprises sont en cours de calcul. Disponibles dans quelques minutes.
          </p>
        </div>
      )}

      {hasData && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Toutes les propriétés entreprises</h2>
          <p className="text-[11px] text-slate-500 mb-3">
            {allPropertyStats.length} propriétés triées par taux d&apos;enrichissement sur {totalCompanies.toLocaleString("fr-FR")} entreprises
          </p>
          <div className="card p-4">
            <PropertyCarousel properties={allPropertyStats} />
          </div>
        </div>
      )}

      {associationStats.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Associations des entreprises</h2>
          <p className="text-[11px] text-slate-500 mb-3">
            % de contacts et deals rattachés à une entreprise (rapprochement compte-based)
          </p>
          <div className="card p-4">
            <ContactAssociationsBlock stats={associationStats} />
          </div>
        </div>
      )}

      {sharedProps.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Propriétés multi-objets</h2>
          <p className="text-[11px] text-slate-500 mb-3">
            Propriétés d&apos;entreprise présentes sur plusieurs objets CRM (utiles pour cross-source)
          </p>
          <div className="card p-4">
            <SharedPropertiesBlock properties={sharedProps} />
          </div>
        </div>
      )}

      {distributionData.sources.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Distribution firmographic</h2>
          <p className="text-[11px] text-slate-500 mb-3">
            Répartition des entreprises par secteur (industry), pays et type
          </p>
          <div className="card p-4">
            <TrackingSourcesBlock
              sources={distributionData.sources}
              drillDown1={distributionData.drillDown1}
              drillDown2={distributionData.drillDown2}
              total={distributionData.total}
            />
          </div>
        </div>
      )}

      {propertyUsage.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Utilisation des propriétés</h2>
          <p className="text-[11px] text-slate-500 mb-3">
            Dépendances aux assets HubSpot (workflows, formulaires, segments)
          </p>
          <div className="card p-4">
            <PropertyUsageBlock properties={propertyUsage} />
          </div>
        </div>
      )}
    </div>
  );
}
