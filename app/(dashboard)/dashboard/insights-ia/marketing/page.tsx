export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CoachActionsSection } from "@/components/coach-actions-section";
import { CoachingAgendaSection } from "@/components/agents/coaching-agenda-section";
import { fetchReportCoachings } from "@/lib/reports/fetch-report-coachings";
import { inferActionType, type UnifiedCoaching } from "@/lib/reports/coaching-types";

export default async function MarketingCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  // Uniquement les actions proposées PAR LE COACH (chat, onglet Actions) ou
  // activées depuis un rapport — plus aucune suggestion pré-générée : le cœur
  // de la page est le coaching en direct, l'utilisateur choisit ses actions.
  const manualCoachings = await fetchReportCoachings(supabase, orgId, "marketing", ["active", "done", "removed"]);
  const items: UnifiedCoaching[] = manualCoachings.map((m): UnifiedCoaching => ({
    id: `manual-${m.id}`,
    source: "manual",
    reportCoachingId: m.id,
    severity: m.severity,
    title: m.title,
    body: m.body,
    recommendation: m.recommendation ?? m.body,
    hubspotUrl: undefined,
    category: "marketing",
    actionType: inferActionType({ title: m.title, body: m.body, recommendation: m.recommendation ?? "", category: "marketing" }),
    status: m.status,
    createdAt: m.created_at,
    sourceReportTitle: m.source_report_title,
    kpiLabel: m.kpi_label,
  }));

  return (
    <div className="space-y-6">
      <CoachingAgendaSection category="marketing" />
      <CoachActionsSection items={items} categoryLabel="marketing" category="marketing" />
    </div>
  );
}
