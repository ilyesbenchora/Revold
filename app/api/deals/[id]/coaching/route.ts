import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DealCoach } from "@/lib/ai/deal-coaching";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch deal with related data
  const { data: deal, error } = await supabase
    .from("deals")
    .select("*, companies(name, segment, industry), pipeline_stages(name)")
    .eq("id", id)
    .single();

  if (error || !deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  // Fetch recent activities for this deal
  const { data: activities } = await supabase
    .from("activities")
    .select("type, subject, occurred_at")
    .eq("deal_id", id)
    .order("occurred_at", { ascending: false })
    .limit(10);

  const coach = new DealCoach(anthropicKey);

  const company = deal.companies as unknown as { name: string; segment: string | null; industry: string | null } | null;
  const stage = deal.pipeline_stages as unknown as { name: string } | null;

  const advice = await coach.coach({
    name: deal.name,
    amount: Number(deal.amount),
    stage: stage?.name ?? "Unknown",
    days_in_stage: deal.days_in_stage ?? 0,
    close_date: deal.close_date,
    created_date: deal.created_date,
    is_at_risk: deal.is_at_risk ?? false,
    risk_reasons: Array.isArray(deal.risk_reasons) ? deal.risk_reasons as string[] : [],
    win_probability: deal.win_probability ? Number(deal.win_probability) : null,
    last_activity_at: deal.last_activity_at,
    activities: (activities ?? []).map((a) => ({
      type: a.type,
      subject: a.subject,
      occurred_at: a.occurred_at,
    })),
    company: company
      ? { name: company.name, segment: company.segment, industry: company.industry }
      : null,
  });

  return NextResponse.json(advice);
}
