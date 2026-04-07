import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { InsightGenerator } from "@/lib/ai/insight-generator";
import { env } from "@/lib/env";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const generator = new InsightGenerator(anthropicKey);

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, plan");

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ message: "No organizations found" });
  }

  const results = [];

  for (const org of orgs) {
    // Get latest KPI snapshot
    const { data: kpi } = await supabase
      .from("kpi_snapshots")
      .select("*")
      .eq("organization_id", org.id)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    if (!kpi) {
      results.push({ org_id: org.id, skipped: true, reason: "No KPI data" });
      continue;
    }

    // Get deals at risk
    const { data: riskyDeals } = await supabase
      .from("deals")
      .select("name, amount, risk_reasons, days_in_stage, pipeline_stages(name)")
      .eq("organization_id", org.id)
      .eq("is_at_risk", true)
      .order("amount", { ascending: false })
      .limit(5);

    const dealsAtRisk = (riskyDeals ?? []).map((d) => ({
      name: d.name,
      amount: Number(d.amount),
      stage: (d.pipeline_stages as unknown as { name: string })?.name ?? "Unknown",
      days_in_stage: d.days_in_stage ?? 0,
      risk_reasons: Array.isArray(d.risk_reasons) ? d.risk_reasons as string[] : [],
    }));

    try {
      const insights = await generator.generate(
        {
          closing_rate: Number(kpi.closing_rate),
          pipeline_coverage: Number(kpi.pipeline_coverage),
          sales_cycle_days: kpi.sales_cycle_days,
          weighted_forecast: Number(kpi.weighted_forecast),
          deal_velocity: Number(kpi.deal_velocity),
          mql_to_sql_rate: Number(kpi.mql_to_sql_rate),
          lead_velocity_rate: Number(kpi.lead_velocity_rate ?? 0),
          funnel_leakage_rate: Number(kpi.funnel_leakage_rate ?? 0),
          inactive_deals_pct: Number(kpi.inactive_deals_pct),
          data_completeness: Number(kpi.data_completeness),
          deal_stagnation_rate: Number(kpi.deal_stagnation_rate ?? 0),
          duplicate_contacts_pct: Number(kpi.duplicate_contacts_pct ?? 0),
          orphan_contacts_pct: Number(kpi.orphan_contacts_pct ?? 0),
          activities_per_deal: Number(kpi.activities_per_deal ?? 0),
          sales_score: kpi.sales_score,
          marketing_score: kpi.marketing_score,
          crm_ops_score: kpi.crm_ops_score,
        },
        {
          org_name: org.name,
          industry: "B2B SaaS",
          segment: "Mid-Market",
          quarterly_target: 2000000,
          team_size: 8,
          currency: "EUR",
        },
        dealsAtRisk,
      );

      // Mark old insights as dismissed
      await supabase
        .from("ai_insights")
        .update({ is_dismissed: true })
        .eq("organization_id", org.id)
        .eq("is_dismissed", false);

      // Insert new insights
      const insightRows = insights.map((ins) => ({
        organization_id: org.id,
        category: ins.category,
        severity: ins.severity,
        title: ins.title,
        body: ins.body,
        recommendation: ins.recommendation,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));

      await supabase.from("ai_insights").insert(insightRows);

      results.push({ org_id: org.id, insights_generated: insights.length });
    } catch (err) {
      results.push({ org_id: org.id, error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
