import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getBarColor } from "@/lib/score-utils";
import { PropertyCarousel } from "@/components/property-carousel";
import { PropertyUsageBlock } from "@/components/property-usage-block";
import { fetchPropertyUsage, type PropertyUsage } from "@/lib/integrations/property-usage";

type HsProp = {
  name: string;
  label: string;
  hubspotDefined: boolean;
  calculated: boolean;
};

/** Fetch all contact properties + a sample of contacts to compute fill rates */
async function fetchPropertyFillRates(token: string): Promise<Array<{ name: string; label: string; fillRate: number; isCustom: boolean }>> {
  // 1. Get all contact properties
  const propsRes = await fetch("https://api.hubapi.com/crm/v3/properties/contacts", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!propsRes.ok) return [];
  const propsData = await propsRes.json();
  const allProps: HsProp[] = (propsData.results ?? []).filter(
    (p: HsProp) => !p.calculated && !p.name.startsWith("hs_") || ["hs_analytics_source", "hs_lead_status"].includes(p.name),
  );

  // 2. Fetch a sample of contacts (500) with ALL property names to count fill rates
  const propNames = allProps.map((p) => p.name);
  // HubSpot limits properties param, so chunk if needed
  const sampleSize = 500;
  const contacts: Array<Record<string, string | null>> = [];
  let after: string | undefined;
  let pages = 0;

  while (pages < 5) {
    const url = new URL("https://api.hubapi.com/crm/v3/objects/contacts");
    url.searchParams.set("limit", "100");
    url.searchParams.set("properties", propNames.slice(0, 50).join(","));
    if (after) url.searchParams.set("after", after);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) break;
    const data = await res.json();
    for (const item of data.results ?? []) contacts.push(item.properties ?? {});
    after = data.paging?.next?.after;
    pages++;
    if (!after) break;
  }

  if (contacts.length === 0) return [];

  // 3. Compute fill rate per property
  const total = contacts.length;
  return allProps
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

  // Fetch HubSpot property fill rates + usage/dependencies
  let allPropertyStats: Array<{ name: string; label: string; fillRate: number; isCustom: boolean }> = [];
  let propertyUsage: PropertyUsage[] = [];
  if (hubspotToken) {
    [allPropertyStats, propertyUsage] = await Promise.all([
      fetchPropertyFillRates(hubspotToken),
      fetchPropertyUsage(hubspotToken),
    ]);
  }

  const t = total ?? 0;

  // Global completeness from all property fill rates
  const globalCompleteness = allPropertyStats.length > 0
    ? Math.round(allPropertyStats.reduce((s, p) => s + p.fillRate, 0) / allPropertyStats.length)
    : 0;

  // Top 50 properties for carousel
  const carouselProps = allPropertyStats.slice(0, 50);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Complétude globale des contacts</p>
            <p className="text-xs text-slate-500">{t.toLocaleString("fr-FR")} contacts synchronisés</p>
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

      {/* Property carousel — top 50 by fill rate */}
      {carouselProps.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Toutes les propriétés</h2>
          <p className="text-[11px] text-slate-500 mb-3">Top 50 propriétés triées du plus au moins enrichi</p>
          <div className="card p-4">
            <PropertyCarousel properties={carouselProps} />
          </div>
        </div>
      )}

      {/* Property usage / dependencies */}
      {propertyUsage.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Utilisation des propriétés</h2>
          <p className="text-[11px] text-slate-500 mb-3">Dépendances de chaque propriété aux assets HubSpot (workflows, formulaires, segments)</p>
          <div className="card p-4">
            <PropertyUsageBlock properties={propertyUsage} />
          </div>
        </div>
      )}
    </div>
  );
}
