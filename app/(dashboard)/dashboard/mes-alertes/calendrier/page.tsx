export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CalendarView, type CalEvent } from "@/components/calendar-view";

type AlertRow = { id: string; title: string; status: string | null; date_from: string | null; date_to: string | null };
type ObjRow = { id: string; title: string; status?: string | null; date_from: string | null; date_to: string | null };

export default async function AlertesCalendrierPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;

  const supabase = await createSupabaseServerClient();
  const [{ data: alertsData }, objRes] = await Promise.all([
    supabase.from("alerts").select("id, title, status, date_from, date_to").eq("organization_id", orgId).limit(300),
    supabase.from("objectives").select("id, title, status, date_from, date_to").eq("organization_id", orgId).limit(300),
  ]);

  const alerts = ((alertsData ?? []) as AlertRow[]).filter((r) => (r.status ?? "active") === "active");
  // Résilient : table objectives absente (migration non appliquée).
  const objectives = objRes.error ? [] : ((objRes.data ?? []) as ObjRow[]).filter((o) => (o.status ?? "active") === "active");

  const events: CalEvent[] = [];
  // Couleur = TYPE (rose = alerte, indigo = objectif). Le sous-libellé indique début/échéance.
  for (const a of alerts) {
    if (a.date_to) events.push({ id: `a-${a.id}-end`, title: a.title, date: a.date_to, sub: "alerte · échéance", tone: "rose", href: "/dashboard/mes-alertes" });
    if (a.date_from) events.push({ id: `a-${a.id}-start`, title: a.title, date: a.date_from, sub: "alerte · début", tone: "rose", href: "/dashboard/mes-alertes" });
  }
  for (const o of objectives) {
    if (o.date_to) events.push({ id: `o-${o.id}-end`, title: o.title, date: o.date_to, sub: "objectif · échéance", tone: "indigo", href: "/dashboard/mes-alertes/objectifs" });
    if (o.date_from) events.push({ id: `o-${o.id}-start`, title: o.title, date: o.date_from, sub: "objectif · début", tone: "indigo", href: "/dashboard/mes-alertes/objectifs" });
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Calendrier des alertes et objectifs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vision temporelle de tes alertes et objectifs (début et échéance). Vue Jour / Semaine / Mois.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/dashboard/mes-alertes" className="inline-flex items-center gap-1 rounded-lg border border-card-border px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Alertes</Link>
          <Link href="/dashboard/mes-alertes/objectifs" className="inline-flex items-center gap-1 rounded-lg border border-card-border px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Objectifs</Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> Alerte</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-400" /> Objectif</span>
        <span className="text-slate-400">· le sous-libellé précise « début » ou « échéance »</span>
      </div>

      <CalendarView events={events} emptyLabel="Aucune alerte ni objectif ce jour." />
    </section>
  );
}
