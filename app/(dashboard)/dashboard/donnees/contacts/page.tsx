export const maxDuration = 60;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getBarColor } from "@/lib/score-utils";
import { PropertyCarousel } from "@/components/property-carousel";
import { PropertyUsageBlock } from "@/components/property-usage-block";
import { ContactAssociationsBlock } from "@/components/contact-associations-block";
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
async function fetchAllPropertyFillRates(token: string): Promise<PropStat[]> {
  // 1. Get all contact properties
  const propsRes = await fetch(`${HS}/crm/v3/properties/contacts`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!propsRes.ok) return [];
  const propsData = await propsRes.json();
  const allProps: Array<{ name: string; label: string; hubspotDefined: boolean; calculated: boolean; groupName: string }> = propsData.results ?? [];
  // Only keep contact-relevant groups — exclude system/analytics/email/social/conversion
  const CONTACT_GROUPS = new Set(["contactinformation", "contact_activity", "sales_properties", "contactlcs"]);
  const relevantProps = allProps.filter((p) => !p.calculated && (CONTACT_GROUPS.has(p.groupName) || !p.hubspotDefined));

  // 2. Get total contacts count
  const totalRes = await fetch(`${HS}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filterGroups: [], limit: 1 }),
  });
  if (!totalRes.ok) return [];
  const totalData = await totalRes.json();
  const totalContacts = totalData.total ?? 0;
  if (totalContacts === 0) return [];

  // 3. For each property, get exact count via HAS_PROPERTY search
  // Batch 10 at a time to respect rate limits
  const results: PropStat[] = [];

  for (let i = 0; i < relevantProps.length; i += 10) {
    const batch = relevantProps.slice(i, i + 10);
    const counts = await Promise.all(
      batch.map(async (p) => {
        try {
          const res = await fetch(`${HS}/crm/v3/objects/contacts/search`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              filterGroups: [{ filters: [{ propertyName: p.name, operator: "HAS_PROPERTY" }] }],
              limit: 1,
            }),
          });
          if (!res.ok) return 0;
          const data = await res.json();
          return data.total ?? 0;
        } catch {
          return 0;
        }
      }),
    );

    for (let j = 0; j < batch.length; j++) {
      results.push({
        name: batch[j].name,
        label: batch[j].label || batch[j].name,
        fillRate: Math.round((counts[j] / totalContacts) * 100),
        isCustom: !batch[j].hubspotDefined,
      });
    }
  }

  return results.sort((a, b) => b.fillRate - a.fillRate);
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
  if (hubspotToken) {
    [allPropertyStats, propertyUsage, associationStats] = await Promise.all([
      fetchAllPropertyFillRates(hubspotToken),
      fetchPropertyUsage(hubspotToken),
      fetchContactAssociations(hubspotToken),
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
