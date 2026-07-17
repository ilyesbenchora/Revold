export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CalendarView, type CalEvent } from "@/components/calendar-view";

const CAT_LABELS: Record<string, string> = {
  commercial: "Ventes", sales: "Ventes", marketing: "Marketing", data: "Data",
  integration: "Intégration", "cross-source": "Cross-source", "data-model": "Modèle de données",
};

type Agenda = { category: string; next_meeting_at: string | null };

export default async function CoachingCalendrierPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("coaching_agendas")
    .select("category, next_meeting_at")
    .eq("organization_id", orgId)
    .not("next_meeting_at", "is", null)
    .limit(200);

  const events: CalEvent[] = ((data ?? []) as Agenda[])
    .filter((a) => a.next_meeting_at)
    .map((a) => ({
      id: `${a.category}-${a.next_meeting_at}`,
      title: `Coaching ${CAT_LABELS[a.category] ?? a.category}`,
      date: String(a.next_meeting_at).slice(0, 10),
      sub: "RDV",
      tone: "indigo" as const,
      href: "/dashboard/insights-ia",
    }));

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Calendrier des coachings IA</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tes rendez-vous de coaching planifiés. Vue Jour / Semaine / Mois.
          </p>
        </div>
        <Link href="/dashboard/insights-ia" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-card-border px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
          ← Coaching IA
        </Link>
      </header>

      <CalendarView events={events} emptyLabel="Aucun coaching planifié ce jour." />
    </section>
  );
}
