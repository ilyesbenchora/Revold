export const maxDuration = 60;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getBarColor } from "@/lib/score-utils";
import { PropertyCarousel } from "@/components/property-carousel";
import { PropertyUsageBlock } from "@/components/property-usage-block";
import { fetchPropertyUsage, type PropertyUsage } from "@/lib/integrations/property-usage";

type PropStat = { name: string; label: string; fillRate: number; isCustom: boolean };

/** Fetch ALL contact properties and compute fill rates by chunking the properties param */
async function fetchAllPropertyFillRates(token: string): Promise<PropStat[]> {
  // 1. Get all contact properties
  const propsRes = await fetch("https://api.hubapi.com/crm/v3/properties/contacts", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!propsRes.ok) return [];
  const propsData = await propsRes.json();
  const allProps: Array<{ name: string; label: string; hubspotDefined: boolean; calculated: boolean }> = propsData.results ?? [];

  // Filter out calculated/read-only system props that are never user-facing
  const relevantProps = allProps.filter((p) => !p.calculated);

  // 2. Fetch a sample of 500 contacts in chunks of properties (HubSpot limits ~50 props per request)
  // First pass: get contact IDs + first chunk of props
  const propChunks: string[][] = [];
  const propNames = relevantProps.map((p) => p.name);
  for (let i = 0; i < propNames.length; i += 50) {
    propChunks.push(propNames.slice(i, i + 50));
  }

  // Fetch contacts with first chunk to get IDs
  const contactRows: Map<string, Record<string, string | null>> = new Map();
  let after: string | undefined;
  let pages = 0;
  while (pages < 5) {
    const url = new URL("https://api.hubapi.com/crm/v3/objects/contacts");
    url.searchParams.set("limit", "100");
    url.searchParams.set("properties", propChunks[0]?.join(",") ?? "email");
    if (after) url.searchParams.set("after", after);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) break;
    const data = await res.json();
    for (const item of data.results ?? []) {
      contactRows.set(item.id, { ...(item.properties ?? {}) });
    }
    after = data.paging?.next?.after;
    pages++;
    if (!after) break;
  }

  if (contactRows.size === 0) return [];

  // Fetch remaining property chunks for the same contacts
  const contactIds = [...contactRows.keys()];
  for (let c = 1; c < propChunks.length; c++) {
    // Use batch read to get additional properties for existing contacts
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/read", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: contactIds.map((id) => ({ id })),
          properties: propChunks[c],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        for (const item of data.results ?? []) {
          const existing = contactRows.get(item.id);
          if (existing && item.properties) {
            Object.assign(existing, item.properties);
          }
        }
      }
    } catch {}
  }

  // 3. Compute fill rate per property
  const total = contactRows.size;
  const contacts = [...contactRows.values()];

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
  if (hubspotToken) {
    [allPropertyStats, propertyUsage] = await Promise.all([
      fetchAllPropertyFillRates(hubspotToken),
      fetchPropertyUsage(hubspotToken),
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
