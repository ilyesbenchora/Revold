export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getBarColor } from "@/lib/score-utils";
import { PropertyCarousel } from "@/components/property-carousel";
import { PropertyUsageBlock } from "@/components/property-usage-block";
import { ContactAssociationsBlock } from "@/components/contact-associations-block";
import { TrackingSourcesBlock } from "@/components/tracking-sources-block";
import { fetchPropertyUsage, type PropertyUsage } from "@/lib/integrations/property-usage";

type PropStat = { name: string; label: string; fillRate: number; isCustom: boolean };

const HS = "https://api.hubapi.com";

type AssocTarget = {
  objectType: string;
  label: string;
  icon: string;
};

const ASSOC_TARGETS: AssocTarget[] = [
  { objectType: "companies", label: "Entreprises", icon: "🏢" },
  { objectType: "deals", label: "Transactions", icon: "💰" },
  { objectType: "tickets", label: "Tickets", icon: "🎫" },
];

type AssociationStat = {
  targetObject: string;
  targetLabel: string;
  icon: string;
  totalContacts: number;
  withAssociation: number;
  rate: number;
  labels: Array<{ label: string; count: number }>;
};

/**
 * Count contacts by association type using EXACT counts from Search API.
 * Uses HubSpot native properties (associatedcompanyid, num_associated_deals)
 * for precise counts, plus association labels from the Associations API.
 */
async function fetchContactAssociations(token: string): Promise<AssociationStat[]> {
  // 1. Total contacts (exact)
  const totalRes = await fetch(`${HS}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filterGroups: [], limit: 1 }),
  });
  if (!totalRes.ok) return [];
  const totalContacts = (await totalRes.json()).total ?? 0;
  if (totalContacts === 0) return [];

  // 2. Exact counts per association type via Search API
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

  const [withCompany, withDeal] = await Promise.all([
    searchCount([{ propertyName: "associatedcompanyid", operator: "HAS_PROPERTY" }]),
    searchCount([{ propertyName: "num_associated_deals", operator: "GT", value: "0" }]),
  ]);

  // 3. Association labels (for detail breakdown)
  const results: AssociationStat[] = [];

  for (const { objectType, label: targetLabel, icon, count } of [
    { objectType: "companies", label: "Entreprises", icon: "🏢", count: withCompany },
    { objectType: "deals", label: "Transactions", icon: "💰", count: withDeal },
  ]) {
    // Get association type labels
    let assocLabels: Array<{ typeId: number; label: string | null; category: string }> = [];
    try {
      const res = await fetch(`${HS}/crm/v4/associations/contacts/${objectType}/labels`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) assocLabels = (await res.json()).results ?? [];
    } catch {}

    const labels = assocLabels
      .filter((l) => l.label)
      .map((l) => ({ label: l.label!, count: 0 }));

    results.push({
      targetObject: objectType,
      targetLabel,
      icon,
      totalContacts: totalContacts,
      withAssociation: count,
      rate: Math.round((count / totalContacts) * 100),
      labels,
    });
  }

  return results;
}

/**
 * Fetch ALL contact properties with EXACT fill rates using the Search API.
 *
 * For each property, POST /crm/v3/objects/contacts/search with HAS_PROPERTY
 * returns the exact count of contacts that have this property filled.
 * No sampling, no approximation.
 */
type SourceStat = { source: string; label: string; count: number; pct: number };
type DrillDown = { value: string; count: number; pct: number };
type TrackingResult = {
  sources: SourceStat[];
  drillDown1: DrillDown[];
  drillDown2: DrillDown[];
  total: number;
};

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

/**
 * Fetch tracking sources by paginating contacts with source properties
 * and counting server-side. No parallel search calls → no rate limit issues.
 */
async function fetchTrackingSources(token: string): Promise<TrackingResult> {
  const sourceCounts = new Map<string, number>();
  const dd1Counts = new Map<string, number>();
  const dd2Counts = new Map<string, number>();
  let totalFetched = 0;
  let after: string | undefined;
  let pages = 0;

  // Paginate all contacts with source properties
  while (pages < 100) {
    const url = new URL(`${HS}/crm/v3/objects/contacts`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("properties", "hs_analytics_source,hs_analytics_source_data_1,hs_analytics_source_data_2");
    if (after) url.searchParams.set("after", after);

    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) break;
    const data = await res.json();
    const results = data.results ?? [];
    if (results.length === 0) break;

    for (const item of results) {
      const p = item.properties ?? {};
      const src = p.hs_analytics_source;
      const d1 = p.hs_analytics_source_data_1;
      const d2 = p.hs_analytics_source_data_2;
      if (src) sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
      if (d1) dd1Counts.set(d1, (dd1Counts.get(d1) ?? 0) + 1);
      if (d2) dd2Counts.set(d2, (dd2Counts.get(d2) ?? 0) + 1);
      totalFetched++;
    }

    after = data.paging?.next?.after;
    pages++;
    if (!after) break;
  }

  if (totalFetched === 0) return { sources: [], drillDown1: [], drillDown2: [], total: 0 };

  const toSorted = (map: Map<string, number>, labelFn?: (k: string) => string) =>
    [...map.entries()]
      .map(([k, v]) => ({ value: k, label: labelFn ? labelFn(k) : k, count: v, pct: Math.round((v / totalFetched) * 100) }))
      .sort((a, b) => b.count - a.count);

  return {
    sources: toSorted(sourceCounts, (k) => SOURCE_LABELS[k] ?? k).map((s) => ({
      source: s.value,
      label: s.label,
      count: s.count,
      pct: s.pct,
    })),
    drillDown1: toSorted(dd1Counts).slice(0, 15),
    drillDown2: toSorted(dd2Counts).slice(0, 15),
    total: totalFetched,
  };
}

/**
 * Fetch fill rates by paginating contacts with all properties and counting server-side.
 * Uses batch read in chunks of 50 properties to cover all of them.
 * No Search API calls → no rate limit issues.
 */
async function fetchAllPropertyFillRates(token: string): Promise<PropStat[]> {
  // 1. Get all contact properties
  const propsRes = await fetch(`${HS}/crm/v3/properties/contacts`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!propsRes.ok) return [];
  const propsData = await propsRes.json();
  const allProps: Array<{ name: string; label: string; hubspotDefined: boolean; calculated: boolean; groupName: string }> = propsData.results ?? [];
  const CONTACT_GROUPS = new Set(["contactinformation", "contact_activity", "sales_properties", "contactlcs"]);
  const relevantProps = allProps.filter((p) => !p.calculated && (CONTACT_GROUPS.has(p.groupName) || !p.hubspotDefined));

  if (relevantProps.length === 0) return [];

  // 2. Paginate contacts (max 2000) with first 50 properties to get IDs + partial data
  const propNames = relevantProps.map((p) => p.name);
  const firstChunk = propNames.slice(0, 50);
  const contactData = new Map<string, Record<string, string | null>>();
  let after: string | undefined;
  let pages = 0;

  while (pages < 100) {
    const url = new URL(`${HS}/crm/v3/objects/contacts`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("properties", firstChunk.join(","));
    if (after) url.searchParams.set("after", after);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) break;
    const data = await res.json();
    for (const item of data.results ?? []) contactData.set(item.id, { ...(item.properties ?? {}) });
    after = data.paging?.next?.after;
    pages++;
    if (!after) break;
  }

  if (contactData.size === 0) return [];

  // 3. Batch read remaining property chunks (50 at a time, max 100 contacts per batch read)
  const contactIds = [...contactData.keys()];
  for (let c = 1; c * 50 < propNames.length; c++) {
    const chunk = propNames.slice(c * 50, (c + 1) * 50);
    // Batch read in sub-batches of 100 IDs (HubSpot limit)
    for (let i = 0; i < contactIds.length; i += 100) {
      const idBatch = contactIds.slice(i, i + 100);
      try {
        const res = await fetch(`${HS}/crm/v3/objects/contacts/batch/read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: idBatch.map((id) => ({ id })), properties: chunk }),
        });
        if (res.ok) {
          const data = await res.json();
          for (const item of data.results ?? []) {
            const existing = contactData.get(item.id);
            if (existing && item.properties) Object.assign(existing, item.properties);
          }
        }
      } catch {}
    }
  }

  // 4. Count fill rate per property
  const total = contactData.size;
  const contacts = [...contactData.values()];

  return relevantProps
    .map((p) => {
      const filled = contacts.filter((c) => {
        const val = c[p.name];
        return val !== null && val !== undefined && val !== "";
      }).length;
      return {
        name: p.name,
        label: p.label || p.name,
        fillRate: Math.round((filled / total) * 100),
        isCustom: !p.hubspotDefined,
      };
    })
    .sort((a, b) => b.fillRate - a.fillRate);
}

export default async function DonneesContactsPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  const { count: total } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  let allPropertyStats: PropStat[] = [];
  let propertyUsage: PropertyUsage[] = [];
  let associationStats: AssociationStat[] = [];
  let trackingData: TrackingResult = { sources: [], drillDown1: [], drillDown2: [], total: 0 };
  if (hubspotToken) {
    [allPropertyStats, propertyUsage, associationStats, trackingData] = await Promise.all([
      fetchAllPropertyFillRates(hubspotToken),
      fetchPropertyUsage(hubspotToken),
      fetchContactAssociations(hubspotToken),
      fetchTrackingSources(hubspotToken),
    ]);
  }

  const t = total ?? 0;
  const globalCompleteness = allPropertyStats.length > 0
    ? Math.round(allPropertyStats.reduce((s, p) => s + p.fillRate, 0) / allPropertyStats.length)
    : 0;

  const customCount = allPropertyStats.filter((p) => p.isCustom).length;
  const hubspotCount = allPropertyStats.filter((p) => !p.isCustom).length;

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
          <div className={`h-full rounded-full ${getBarColor(globalCompleteness)} transition-all`} style={{ width: `${globalCompleteness}%` }} />
        </div>
      </div>

      {/* All properties with filter */}
      {allPropertyStats.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Toutes les propriétés</h2>
          <p className="text-[11px] text-slate-500 mb-3">
            {allPropertyStats.length} propriétés triées par taux d&apos;enrichissement
          </p>
          <div className="card p-4">
            <PropertyCarousel properties={allPropertyStats} />
          </div>
        </div>
      )}

      {/* Associations */}
      {associationStats.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Associations des contacts</h2>
          <p className="text-[11px] text-slate-500 mb-3">Nombre de contacts associés à chaque type d&apos;objet et par type d&apos;association</p>
          <div className="card p-4">
            <ContactAssociationsBlock stats={associationStats} />
          </div>
        </div>
      )}

      {/* Tracking sources */}
      {trackingData.sources.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Propriétés de tracking</h2>
          <p className="text-[11px] text-slate-500 mb-3">Répartition des contacts par source analytique HubSpot</p>
          <div className="card p-4">
            <TrackingSourcesBlock
              sources={trackingData.sources}
              drillDown1={trackingData.drillDown1}
              drillDown2={trackingData.drillDown2}
              total={trackingData.total}
            />
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
