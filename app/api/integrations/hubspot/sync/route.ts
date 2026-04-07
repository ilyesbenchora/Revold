export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchHubSpotCompanies,
  fetchHubSpotContacts,
  fetchHubSpotDeals,
} from "@/lib/integrations/hubspot";
import { env } from "@/lib/env";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export async function GET(request: Request) {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "HUBSPOT_ACCESS_TOKEN not configured" }, { status: 400 });
  }

  const { data: orgs } = await supabase.from("organizations").select("id").limit(1);
  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }
  const orgId = orgs[0].id;

  const url = new URL(request.url);
  const syncType = url.searchParams.get("type") || "companies";

  try {
    let count = 0;
    const errors: string[] = [];

    if (syncType === "companies") {
      const data = await fetchHubSpotCompanies(accessToken);
      for (let i = 0; i < data.length; i += 50) {
        const batch = data.slice(i, i + 50).map((c) => ({
          organization_id: orgId,
          hubspot_id: c.id,
          name: c.properties.name || `Company ${c.id}`,
          domain: c.properties.domain,
          industry: c.properties.industry,
          annual_revenue: c.properties.annualrevenue ? Number(c.properties.annualrevenue) : null,
          employee_count: c.properties.numberofemployees ? Number(c.properties.numberofemployees) : null,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("companies").upsert(batch, { onConflict: "organization_id,hubspot_id" });
        if (error) errors.push(error.message);
        else count += batch.length;
      }
    } else if (syncType === "contacts") {
      const data = await fetchHubSpotContacts(accessToken);
      for (let i = 0; i < data.length; i += 50) {
        const batch = data.slice(i, i + 50).map((c) => {
          const lc = c.properties.lifecyclestage?.toLowerCase() ?? "";
          return {
            organization_id: orgId,
            hubspot_id: c.id,
            email: c.properties.email || `unknown-${c.id}@hubspot.com`,
            full_name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(" ") || `Contact ${c.id}`,
            title: c.properties.jobtitle,
            phone: c.properties.phone,
            is_mql: ["marketingqualifiedlead", "mql"].includes(lc) || lc.includes("qualified"),
            is_sql: ["salesqualifiedlead", "sql", "opportunity"].includes(lc),
          };
        });
        const { error } = await supabase.from("contacts").upsert(batch, { onConflict: "organization_id,hubspot_id" });
        if (error) errors.push(error.message);
        else count += batch.length;
      }
    } else if (syncType === "deals") {
      const data = await fetchHubSpotDeals(accessToken);
      for (let i = 0; i < data.length; i += 50) {
        const batch = data.slice(i, i + 50).map((d) => ({
          organization_id: orgId,
          hubspot_id: d.id,
          name: d.properties.dealname || `Deal ${d.id}`,
          amount: d.properties.amount ? Number(d.properties.amount) : 0,
          close_date: d.properties.closedate?.split("T")[0] || null,
          created_date: d.properties.createdate?.split("T")[0] ?? new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("deals").upsert(batch, { onConflict: "organization_id,hubspot_id" });
        if (error) errors.push(error.message);
        else count += batch.length;
      }
    }

    // Mark integration as active
    await supabase.from("integrations").upsert(
      { organization_id: orgId, provider: "hubspot", access_token: "private-app", is_active: true, updated_at: new Date().toISOString() },
      { onConflict: "organization_id,provider" },
    );

    const next = syncType === "companies" ? "contacts" : syncType === "contacts" ? "deals" : "done";
    return NextResponse.json({ type: syncType, count, errors, next });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
