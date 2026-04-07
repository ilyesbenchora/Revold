/**
 * HubSpot Sync Engine
 * Maps HubSpot data to Revold schema and upserts into Supabase.
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

type SyncResult = {
  companies: number;
  contacts: number;
  deals: number;
  errors: string[];
};

export async function syncHubSpotData(
  supabase: SupabaseClient,
  orgId: string,
  accessToken: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let companiesCount = 0;
  let contactsCount = 0;
  let dealsCount = 0;

  // Log sync start
  const { data: syncLog } = await supabase
    .from("sync_logs")
    .insert({
      organization_id: orgId,
      source: "hubspot",
      direction: "inbound",
      entity_type: "all",
      status: "running",
    })
    .select("id")
    .single();

  try {
    // 1. Sync Companies
    const hsCompanies = await fetchHubSpotCompanies(accessToken);
    for (const hsc of hsCompanies) {
      const { error } = await supabase.from("companies").upsert(
        mapCompany(hsc, orgId),
        { onConflict: "organization_id,hubspot_id", ignoreDuplicates: false },
      );
      if (error) errors.push(`Company ${hsc.id}: ${error.message}`);
      else companiesCount++;
    }

    // 2. Sync Contacts
    const hsContacts = await fetchHubSpotContacts(accessToken);
    for (const hscont of hsContacts) {
      const { error } = await supabase.from("contacts").upsert(
        mapContact(hscont, orgId),
        { onConflict: "organization_id,hubspot_id", ignoreDuplicates: false },
      );
      if (error) errors.push(`Contact ${hscont.id}: ${error.message}`);
      else contactsCount++;
    }

    // 3. Sync Deals
    const hsDeals = await fetchHubSpotDeals(accessToken);
    for (const hsd of hsDeals) {
      const { error } = await supabase.from("deals").upsert(
        mapDeal(hsd, orgId),
        { onConflict: "organization_id,hubspot_id", ignoreDuplicates: false },
      );
      if (error) errors.push(`Deal ${hsd.id}: ${error.message}`);
      else dealsCount++;
    }

    // Update sync log
    if (syncLog) {
      await supabase.from("sync_logs").update({
        status: errors.length > 0 ? "completed" : "completed",
        entity_count: companiesCount + contactsCount + dealsCount,
        error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
        completed_at: new Date().toISOString(),
      }).eq("id", syncLog.id);
    }
  } catch (err) {
    if (syncLog) {
      await supabase.from("sync_logs").update({
        status: "failed",
        error_message: String(err),
        completed_at: new Date().toISOString(),
      }).eq("id", syncLog.id);
    }
    throw err;
  }

  return { companies: companiesCount, contacts: contactsCount, deals: dealsCount, errors };
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
  const lifecycle = hscont.properties.lifecyclestage?.toLowerCase() ?? "";
  return {
    organization_id: orgId,
    hubspot_id: hscont.id,
    email: hscont.properties.email || `unknown-${hscont.id}@hubspot.com`,
    full_name: [hscont.properties.firstname, hscont.properties.lastname].filter(Boolean).join(" ") || `Contact ${hscont.id}`,
    title: hscont.properties.jobtitle,
    phone: hscont.properties.phone,
    is_mql: ["marketingqualifiedlead", "mql"].includes(lifecycle) || lifecycle.includes("qualified"),
    is_sql: ["salesqualifiedlead", "sql", "opportunity"].includes(lifecycle),
  };
}

function mapDeal(hsd: HubSpotDeal, orgId: string) {
  return {
    organization_id: orgId,
    hubspot_id: hsd.id,
    name: hsd.properties.dealname || `Deal ${hsd.id}`,
    amount: hsd.properties.amount ? Number(hsd.properties.amount) : 0,
    close_date: hsd.properties.closedate?.split("T")[0] ?? null,
    created_date: hsd.properties.createdate?.split("T")[0] ?? new Date().toISOString().split("T")[0],
    updated_at: new Date().toISOString(),
  };
}
