export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const HS = "https://api.hubapi.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function searchCount(token: string, objectType: string, propName: string): Promise<number> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${HS}/crm/v3/objects/${objectType}/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: propName, operator: "HAS_PROPERTY" }] }],
          limit: 1,
        }),
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return 0;
      return (await res.json()).total ?? 0;
    } catch { return 0; }
  }
  return 0;
}

async function getTotalCount(token: string, objectType: string): Promise<number> {
  try {
    const res = await fetch(`${HS}/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ filterGroups: [], limit: 1 }),
    });
    if (!res.ok) return 0;
    return (await res.json()).total ?? 0;
  } catch { return 0; }
}

async function getProperties(token: string, objectType: string): Promise<Array<{ name: string; label: string; groupName: string; hubspotDefined: boolean; calculated: boolean }>> {
  try {
    const res = await fetch(`${HS}/crm/v3/properties/${objectType}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch { return []; }
}

const CONTACT_GROUPS = new Set(["contactinformation", "contact_activity", "sales_properties", "contactlcs"]);
const COMPANY_GROUPS = new Set(["companyinformation", "company_activity", "sales_properties"]);
const DEAL_GROUPS = new Set(["dealinformation", "deal_activity", "sales_properties"]);

function isRelevant(p: { groupName: string; hubspotDefined: boolean; calculated: boolean }, objectType: string): boolean {
  if (p.calculated) return false;
  const groups = objectType === "contacts" ? CONTACT_GROUPS : objectType === "companies" ? COMPANY_GROUPS : DEAL_GROUPS;
  return groups.has(p.groupName) || !p.hubspotDefined;
}

export async function GET(request: Request) {
  // Get all orgs with HubSpot connected
  const { data: integrations } = await supabase
    .from("integrations")
    .select("organization_id, access_token")
    .eq("provider", "hubspot")
    .eq("is_active", true);

  if (!integrations || integrations.length === 0) {
    // Fallback to env var for single-tenant
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) return NextResponse.json({ error: "No HubSpot token" }, { status: 400 });

    const { data: orgs } = await supabase.from("organizations").select("id").limit(1);
    if (!orgs?.[0]) return NextResponse.json({ error: "No org" }, { status: 400 });

    await computeForOrg(orgs[0].id, token);
    return NextResponse.json({ ok: true, orgs: 1 });
  }

  for (const int of integrations) {
    const token = int.access_token;
    if (!token || token.length < 15) continue;
    await computeForOrg(int.organization_id, token);
  }

  return NextResponse.json({ ok: true, orgs: integrations.length });
}

async function computeForOrg(orgId: string, token: string) {
  const objectTypes = ["contacts", "companies", "deals"];

  for (const objectType of objectTypes) {
    const [allProps, totalCount] = await Promise.all([
      getProperties(token, objectType),
      getTotalCount(token, objectType),
    ]);

    if (totalCount === 0) continue;

    const relevant = allProps.filter((p) => isRelevant(p, objectType));
    const now = new Date().toISOString();

    // Batch 3 at a time with 250ms delay
    for (let i = 0; i < relevant.length; i += 3) {
      const batch = relevant.slice(i, i + 3);
      const counts = await Promise.all(batch.map((p) => searchCount(token, objectType, p.name)));

      const rows = batch.map((p, j) => ({
        organization_id: orgId,
        object_type: objectType,
        property_name: p.name,
        label: p.label || p.name,
        group_name: p.groupName,
        is_custom: !p.hubspotDefined,
        fill_count: counts[j],
        total_count: totalCount,
        fill_rate: Math.round((counts[j] / totalCount) * 1000) / 10,
        computed_at: now,
      }));

      for (const row of rows) {
        await supabase.from("property_fill_rates").upsert(row, {
          onConflict: "organization_id,object_type,property_name",
        });
      }

      if (i + 3 < relevant.length) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }
}
