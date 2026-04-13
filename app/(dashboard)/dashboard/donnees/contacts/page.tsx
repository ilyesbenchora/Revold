export const maxDuration = 60;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getBarColor } from "@/lib/score-utils";
import { PropertyCarousel } from "@/components/property-carousel";
import { PropertyUsageBlock } from "@/components/property-usage-block";
import { ContactAssociationsBlock } from "@/components/contact-associations-block";
import { TrackingSourcesBlock } from "@/components/tracking-sources-block";
import { SharedPropertiesBlock } from "@/components/shared-properties-block";
import { fetchPropertyUsage, type PropertyUsage } from "@/lib/integrations/property-usage";

type PropStat = { name: string; label: string; fillRate: number; isCustom: boolean };
type SharedProp = { name: string; label: string; objects: string[]; type: string; sameLabel: boolean; isCustom: boolean; fillRate: number };
type SourceStat = { source: string; label: string; count: number; pct: number };
type DrillDown = { value: string; count: number; pct: number };
type TrackingResult = { sources: SourceStat[]; drillDown1: DrillDown[]; drillDown2: DrillDown[]; total: number };
type AssociationStat = { targetObject: string; targetLabel: string; icon: string; totalContacts: number; withAssociation: number; rate: number; labels: Array<{ label: string; count: number }> };

const HS = "https://api.hubapi.com";

const SOURCE_LABELS: Record<string, string> = {
  ORGANIC_SEARCH: "Recherche organique",
  PAID_SEARCH: "Recherche payante",
  EMAIL_MARKETING: "Email marketing",
  SOCIAL_MEDIA: "Réseaux sociaux",
  ORGANIC_SOCIAL: "Social organique",
  PAID_SOCIAL: "Social payant",
  REFERRALS: "Referrals",
  DIRECT_TRAFFIC: "Trafic direct",
  OTHER_CAMPAIGNS: "Autres campagnes",
  OFFLINE: "Offline / Import",
};

// ── Tracking: paginate contacts with source properties (fast, no search API) ──

async function fetchTrackingSources(token: string): Promise<TrackingResult> {
  const sourceCounts = new Map<string, number>();
  const dd1Counts = new Map<string, number>();
  const dd2Counts = new Map<string, number>();
  let totalFetched = 0;
  let after: string | undefined;
  let pages = 0;

  while (pages < 100) {
    const url = new URL(`${HS}/crm/v3/objects/contacts`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("properties", "hs_analytics_source,hs_analytics_source_data_1,hs_analytics_source_data_2");
    if (after) url.searchParams.set("after", after);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) break;
    const data = await res.json();
    if ((data.results ?? []).length === 0) break;
    for (const item of data.results) {
      const p = item.properties ?? {};
      if (p.hs_analytics_source) sourceCounts.set(p.hs_analytics_source, (sourceCounts.get(p.hs_analytics_source) ?? 0) + 1);
      if (p.hs_analytics_source_data_1) dd1Counts.set(p.hs_analytics_source_data_1, (dd1Counts.get(p.hs_analytics_source_data_1) ?? 0) + 1);
      if (p.hs_analytics_source_data_2) dd2Counts.set(p.hs_analytics_source_data_2, (dd2Counts.get(p.hs_analytics_source_data_2) ?? 0) + 1);
      totalFetched++;
    }
    after = data.paging?.next?.after;
    pages++;
    if (!after) break;
  }

  if (totalFetched === 0) return { sources: [], drillDown1: [], drillDown2: [], total: 0 };
  const toSorted = (map: Map<string, number>) =>
    [...map.entries()].map(([k, v]) => ({ value: k, count: v, pct: Math.round((v / totalFetched) * 1000) / 10 })).sort((a, b) => b.count - a.count);

  return {
    sources: toSorted(sourceCounts).map((s) => ({ source: s.value, label: SOURCE_LABELS[s.value] ?? s.value, count: s.count, pct: s.pct })),
    drillDown1: toSorted(dd1Counts).slice(0, 15),
    drillDown2: toSorted(dd2Counts).slice(0, 15),
    total: totalFetched,
  };
}

// ── Associations: exact counts via Search API (only 2 calls) ──

async function fetchContactAssociations(token: string): Promise<AssociationStat[]> {
  const searchCount = async (filters: Array<{ propertyName: string; operator: string; value?: string }>): Promise<number> => {
    try {
      const res = await fetch(`${HS}/crm/v3/objects/contacts/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filterGroups: [{ filters }], limit: 1 }),
      });
      if (!res.ok) return 0;
      return (await res.json()).total ?? 0;
    } catch { return 0; }
  };
  const totalRes = await fetch(`${HS}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filterGroups: [], limit: 1 }),
  });
  const totalContacts = totalRes.ok ? ((await totalRes.json()).total ?? 0) : 0;
  if (totalContacts === 0) return [];

  const [withCompany, withDeal] = await Promise.all([
    searchCount([{ propertyName: "associatedcompanyid", operator: "HAS_PROPERTY" }]),
    searchCount([{ propertyName: "num_associated_deals", operator: "GT", value: "0" }]),
  ]);

  return [
    { targetObject: "companies", targetLabel: "Entreprises", icon: "🏢", totalContacts, withAssociation: withCompany, rate: Math.round((withCompany / totalContacts) * 100), labels: [] },
    { targetObject: "deals", targetLabel: "Transactions", icon: "💰", totalContacts, withAssociation: withDeal, rate: Math.round((withDeal / totalContacts) * 100), labels: [] },
  ];
}

// ── Shared properties: cross-object check (3 API calls, fast) ──

async function fetchSharedProperties(token: string): Promise<SharedProp[]> {
  const objectTypes = ["contacts", "companies", "deals"];
  const byName = new Map<string, Array<{ object: string; label: string; type: string; hubspotDefined: boolean }>>();

  await Promise.all(objectTypes.map(async (obj) => {
    try {
      const res = await fetch(`${HS}/crm/v3/properties/${obj}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      for (const p of data.results ?? []) {
        if (!byName.has(p.name)) byName.set(p.name, []);
        byName.get(p.name)!.push({ object: obj, label: p.label, type: p.type, hubspotDefined: !!p.hubspotDefined });
      }
    } catch {}
  }));

  return [...byName.entries()]
    .filter(([, entries]) => entries.length > 1 && entries.some((e) => e.object === "contacts"))
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

// ── PAGE ──

export default async function DonneesContactsPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  // Fill rates from pre-computed Supabase table (instant)
  const { data: fillRateRows } = await supabase
    .from("property_fill_rates")
    .select("property_name, label, is_custom, fill_rate, fill_count, total_count")
    .eq("organization_id", orgId)
    .eq("object_type", "contacts")
    .order("fill_rate", { ascending: false });

  const allPropertyStats: PropStat[] = (fillRateRows ?? [])
    .map((r) => ({
      name: r.property_name,
      label: r.label,
      fillRate: r.fill_rate,
      isCustom: r.is_custom,
    }))
    .filter((p) => p.fillRate > 0 || p.isCustom); // Retirer les propriétés HubSpot à 0%

  const totalContacts = fillRateRows?.[0]?.total_count ?? 0;

  // Fast API calls (tracking, associations, shared props, property usage)
  let propertyUsage: PropertyUsage[] = [];
  let associationStats: AssociationStat[] = [];
  let trackingData: TrackingResult = { sources: [], drillDown1: [], drillDown2: [], total: 0 };
  let sharedProps: SharedProp[] = [];

  if (hubspotToken) {
    [propertyUsage, associationStats, trackingData, sharedProps] = await Promise.all([
      fetchPropertyUsage(hubspotToken),
      fetchContactAssociations(hubspotToken),
      fetchTrackingSources(hubspotToken),
      fetchSharedProperties(hubspotToken),
    ]);
  }

  // Filter out HubSpot properties at 0% from property usage
  const zeroHubspotNames = new Set(
    (fillRateRows ?? []).filter((r) => r.fill_rate === 0 && !r.is_custom).map((r) => r.property_name),
  );
  propertyUsage = propertyUsage.filter((p) => !zeroHubspotNames.has(p.name) || p.isCustom);

  const t = totalContacts;
  const globalCompleteness = allPropertyStats.length > 0
    ? Math.round(allPropertyStats.reduce((s, p) => s + p.fillRate, 0) / allPropertyStats.length * 10) / 10
    : 0;
  const customCount = allPropertyStats.filter((p) => p.isCustom).length;
  const hubspotCount = allPropertyStats.filter((p) => !p.isCustom).length;

  // Enrich shared props with fill rates
  // Enrich shared props with fill rates and filter out HubSpot 0%
  const fillRateMap = new Map(allPropertyStats.map((p) => [p.name, p.fillRate]));
  for (const sp of sharedProps) sp.fillRate = fillRateMap.get(sp.name) ?? -1;
  sharedProps = sharedProps.filter((p) => p.fillRate > 0 || p.isCustom);

  const hasData = allPropertyStats.length > 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Complétude globale des contacts</p>
            <p className="text-xs text-slate-500">
              {t.toLocaleString("fr-FR")} contacts · {allPropertyStats.length} propriétés ({customCount} custom · {hubspotCount} HubSpot)
            </p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold tabular-nums ${globalCompleteness >= 80 ? "text-emerald-600" : globalCompleteness >= 50 ? "text-amber-600" : "text-red-500"}`}>{globalCompleteness} %</p>
            <p className="text-[10px] text-slate-400">complétude moyenne</p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${getBarColor(Math.round(globalCompleteness))} transition-all`} style={{ width: `${globalCompleteness}%` }} />
        </div>
      </div>

      {!hasData && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800">
            Les taux d&apos;enrichissement sont en cours de calcul. Ils seront disponibles dans quelques minutes.
          </p>
        </div>
      )}

      {/* All properties */}
      {hasData && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Toutes les propriétés</h2>
          <p className="text-[11px] text-slate-500 mb-3">{allPropertyStats.length} propriétés triées par taux d&apos;enrichissement</p>
          <div className="card p-4">
            <PropertyCarousel properties={allPropertyStats} />
          </div>
        </div>
      )}

      {/* Associations */}
      {associationStats.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Associations des contacts</h2>
          <p className="text-[11px] text-slate-500 mb-3">Nombre de contacts associés à chaque type d&apos;objet</p>
          <div className="card p-4">
            <ContactAssociationsBlock stats={associationStats} />
          </div>
        </div>
      )}

      {/* Shared properties */}
      {sharedProps.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Propriétés multi-objets</h2>
          <p className="text-[11px] text-slate-500 mb-3">Propriétés de contact présentes sur plusieurs objets CRM</p>
          <div className="card p-4">
            <SharedPropertiesBlock properties={sharedProps} />
          </div>
        </div>
      )}

      {/* Tracking sources */}
      {trackingData.sources.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Propriétés de tracking</h2>
          <p className="text-[11px] text-slate-500 mb-3">Répartition des contacts par source analytique HubSpot</p>
          <div className="card p-4">
            <TrackingSourcesBlock sources={trackingData.sources} drillDown1={trackingData.drillDown1} drillDown2={trackingData.drillDown2} total={trackingData.total} />
          </div>
        </div>
      )}

      {/* Property usage */}
      {propertyUsage.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Utilisation des propriétés</h2>
          <p className="text-[11px] text-slate-500 mb-3">Dépendances aux assets HubSpot (workflows, formulaires, segments)</p>
          <div className="card p-4">
            <PropertyUsageBlock properties={propertyUsage} />
          </div>
        </div>
      )}
    </div>
  );
}
