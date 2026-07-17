export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CalendarView, type CalEvent } from "@/components/calendar-view";
import { isOverdue, isSoon } from "@/lib/alerts/deadline";

type Row = { id: string; title: string; status: string | null; date_from: string | null; date_to: string | null };

export default async function AlertesCalendrierPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("alerts")
    .select("id, title, status, date_from, date_to")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = ((data ?? []) as Row[]).filter((r) => (r.status ?? "active") === "active");

  const events: CalEvent[] = [];
  for (const r of rows) {
    if (r.date_to) {
      events.push({
        id: `${r.id}-end`,
        title: r.title,
        date: r.date_to,
        sub: "échéance",
        tone: isOverdue(r.date_to) ? "rose" : isSoon(r.date_to, 7) ? "amber" : "indigo",
        href: "/dashboard/mes-alertes",
      });
    }
    if (r.date_from) {
      events.push({ id: `${r.id}-start`, title: r.title, date: r.date_from, sub: "début", tone: "slate", href: "/dashboard/mes-alertes" });
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Calendrier des alertes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vision temporelle de tes alertes : début et échéance. Vue Jour / Semaine / Mois.
          </p>
        </div>
        <Link href="/dashboard/mes-alertes" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-card-border px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
          ← Mes alertes
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> Échue</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Bientôt (≤7 j)</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-400" /> Échéance</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> Début</span>
      </div>

      <CalendarView events={events} emptyLabel="Aucune alerte ce jour." />
    </section>
  );
}
