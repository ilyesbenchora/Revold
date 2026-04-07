import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectRisks } from "@/lib/kpi/risk-detection";
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

  const { data: orgs } = await supabase.from("organizations").select("id");
  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ message: "No organizations found" });
  }

  let totalUpdated = 0;

  for (const org of orgs) {
    const { data: deals } = await supabase
      .from("deals")
      .select("id, name, amount, days_in_stage, last_activity_at, close_date, pipeline_stages!inner(is_closed_won, is_closed_lost)")
      .eq("organization_id", org.id);

    const normalized = (deals ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      amount: Number(d.amount),
      days_in_stage: d.days_in_stage ?? 0,
      last_activity_at: d.last_activity_at,
      close_date: d.close_date,
      is_closed_won: (d.pipeline_stages as unknown as { is_closed_won: boolean })?.is_closed_won ?? false,
      is_closed_lost: (d.pipeline_stages as unknown as { is_closed_lost: boolean })?.is_closed_lost ?? false,
    }));

    const results = detectRisks(normalized);

    for (const result of results) {
      await supabase
        .from("deals")
        .update({
          is_at_risk: result.is_at_risk,
          risk_reasons: result.risk_reasons,
        })
        .eq("id", result.deal_id);
      totalUpdated++;
    }
  }

  return NextResponse.json({ deals_evaluated: totalUpdated });
}
