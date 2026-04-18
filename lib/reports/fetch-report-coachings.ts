import type { SupabaseClient } from "@supabase/supabase-js";

export type ReportCoaching = {
  id: string;
  organization_id: string;
  report_id: string | null;
  category: string;
  team: string | null;
  kpi_label: string | null;
  title: string;
  body: string;
  recommendation: string | null;
  severity: "info" | "warning" | "critical";
  status: "active" | "done" | "removed";
  source_report_title: string | null;
  created_at: string;
};

export async function fetchReportCoachings(
  supabase: SupabaseClient,
  orgId: string,
  category: string,
): Promise<ReportCoaching[]> {
  const { data, error } = await supabase
    .from("report_coachings")
    .select("*")
    .eq("organization_id", orgId)
    .eq("category", category)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[fetchReportCoachings]", { category, error: error.message });
    return [];
  }
  return (data ?? []) as ReportCoaching[];
}
