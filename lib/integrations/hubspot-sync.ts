/**
 * HubSpot Sync Engine — Optimized for speed
 * Batch upserts instead of one-by-one.
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

  // Log sync start
  const { data: syncLog } = await supabase
    .from("sync_logs")
    .insert({
      organization_id: orgId,
      source: "hubspot",
      direction: "inbound",
      status: "running",
    })
    .select("id")
    .single();

  try {
    // Fetch all in parallel
    const [hsCompanies, hsContacts, hsDeals] = await Promise.all([
      fetchHubSpotCompanies(accessToken),
      fetchHubSpotContacts(accessToken),
      fetchHubSpotDeals(accessToken),
    ]);

    // Batch upsert companies (chunks of 50)
    const companyRows = hsCompanies.map((c) => mapCompany(c, orgId));
    let companiesCount = 0;
    for (let i = 0; i < companyRows.length; i += 50) {
      const batch = companyRows.slice(i, i + 50);
      const { error } = await supabase.from("companies").upsert(batch, {
        onConflict: "organization_id,hubspot_id",
        ignoreDuplicates: false,
      });
      if (error) errors.push(`Companies batch: ${error.message}`);
      else companiesCount += batch.length;
    }

    // Batch upsert contacts
    const contactRows = hsContacts.map((c) => mapContact(c, orgId));
    let contactsCount = 0;
    for (let i = 0; i < contactRows.length; i += 50) {
      const batch = contactRows.slice(i, i + 50);
      const { error } = await supabase.from("contacts").upsert(batch, {
        onConflict: "organization_id,hubspot_id",
        ignoreDuplicates: false,
      });
      if (error) errors.push(`Contacts batch: ${error.message}`);
      else contactsCount += batch.length;
    }

    // Batch upsert deals
    const dealRows = hsDeals.map((d) => mapDeal(d, orgId));
    let dealsCount = 0;
    for (let i = 0; i < dealRows.length; i += 50) {
      const batch = dealRows.slice(i, i + 50);
      const { error } = await supabase.from("deals").upsert(batch, {
        onConflict: "organization_id,hubspot_id",
        ignoreDuplicates: false,
      });
      if (error) errors.push(`Deals batch: ${error.message}`);
      else dealsCount += batch.length;
    }

    // Update sync log
    if (syncLog) {
      await supabase.from("sync_logs").update({
        status: "completed",
        entity_count: companiesCount + contactsCount + dealsCount,
        error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
        completed_at: new Date().toISOString(),
      }).eq("id", syncLog.id);
    }

    return { companies: companiesCount, contacts: contactsCount, deals: dealsCount, errors };
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
    close_date: hsd.properties.closedate?.split("T")[0] || null,
    created_date: hsd.properties.createdate?.split("T")[0] ?? new Date().toISOString().split("T")[0],
    updated_at: new Date().toISOString(),
  };
}
