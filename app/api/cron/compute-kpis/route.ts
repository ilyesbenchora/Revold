import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeAllKpis } from "@/lib/kpi/compute";
import { env } from "@/lib/env";

// Use service role for cron — bypasses RLS
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all organizations
  const { data: orgs } = await supabase.from("organizations").select("id, quarterly_target");

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ message: "No organizations found" });
  }

  const results = [];

  for (const org of orgs) {
    const orgId = org.id;
    const quarterlyTarget = org.quarterly_target ?? 2000000;

    // Fetch raw data
    const [dealsRes, contactsRes, activitiesRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, amount, close_date, created_date, days_in_stage, last_activity_at, is_at_risk, is_closed_won:pipeline_stages!inner(is_closed_won), is_closed_lost:pipeline_stages!inner(is_closed_lost), stage_probability:pipeline_stages!inner(probability)")
        .eq("organization_id", orgId),
      supabase
        .from("contacts")
        .select("id, company_id, is_mql, is_sql")
        .eq("organization_id", orgId),
      supabase
        .from("activities")
        .select("id, deal_id")
        .eq("organization_id", orgId),
    ]);

    // Normalize deals with joined stage data
    const deals = (dealsRes.data ?? []).map((d) => ({
      id: d.id,
      amount: Number(d.amount),
      close_date: d.close_date,
      created_date: d.created_date,
      days_in_stage: d.days_in_stage ?? 0,
      last_activity_at: d.last_activity_at,
      is_at_risk: d.is_at_risk ?? false,
      is_closed_won: (d.is_closed_won as unknown as { is_closed_won: boolean })?.is_closed_won ?? false,
      is_closed_lost: (d.is_closed_lost as unknown as { is_closed_lost: boolean })?.is_closed_lost ?? false,
      stage_probability: Number((d.stage_probability as unknown as { probability: number })?.probability ?? 0),
    }));

    const contacts = contactsRes.data ?? [];
    const activities = activitiesRes.data ?? [];

    // Get previous MQL count for lead velocity
    const { data: prevSnapshot } = await supabase
      .from("kpi_snapshots")
      .select("mql_to_sql_rate")
      .eq("organization_id", orgId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    const previousMqls = contacts.filter((c) => c.is_mql).length;

    // Compute KPIs
    const kpis = computeAllKpis(deals, contacts, activities, quarterlyTarget, previousMqls);

    // Upsert snapshot for today
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("kpi_snapshots").upsert(
      {
        organization_id: orgId,
        snapshot_date: today,
        ...kpis,
      },
      { onConflict: "organization_id,snapshot_date" },
    );

    results.push({ org_id: orgId, success: !error, error: error?.message });
  }

  return NextResponse.json({ computed: results.length, results });
}
