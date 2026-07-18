export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { PerformancesTabs } from "@/components/performances-tabs";
import { VentesTabs } from "@/components/ventes-tabs";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { EditableAlertCard, type EditableAlert } from "@/components/agents/editable-alert-card";
import { isSoon, isOverdue, daysUntil } from "@/lib/alerts/deadline";

type AlertRow = EditableAlert & { status: string | null; team: string | null };

export default async function VentesAlertesPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("alerts")
    .select("id, title, description, impact, category, status, team, threshold, unit_mode, created_at, date_from, date_to, notification_channels")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  // Alertes liées à la performance commerciale (via agent ou pipeline).
  const allAlerts = ((data ?? []) as AlertRow[]).filter(
    (a) => (a.status ?? "active") === "active" && (a.team === "sales" || ["sales", "commercial", "revops"].includes(a.category ?? "")),
  );
  // Une alerte à date de fin dépassée est « terminée » → bloc dédié, hors suivi actif.
  const done = allAlerts.filter((a) => isOverdue(a.date_to));
  const alerts = allAlerts.filter((a) => !isOverdue(a.date_to));
  // Bientôt à échéance : date de fin dans les 7 jours (triées par urgence).
  const soon = alerts
    .filter((a) => isSoon(a.date_to, 7))
    .sort((x, y) => daysUntil(x.date_to as string) - daysUntil(y.date_to as string));

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mes alertes — Ventes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Toutes les alertes de performance commerciale, créées via un agent ou directement dans les pipelines.
          </p>
        </div>
        <CreateAlertModal />
      </header>

      <PerformancesTabs />
      <VentesTabs />

      {soon.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-amber-900">
            ⏳ Bientôt à échéance
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">{soon.length}</span>
            <span className="text-[11px] font-normal text-amber-700/70">échéance dans 7 jours ou moins</span>
          </h2>
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 scroll-smooth">
            {soon.map((a) => (
              <div key={a.id} className="snap-start shrink-0" style={{ width: "min(380px, 90vw)" }}>
                <EditableAlertCard alert={a} badge="Bientôt à échéance" />
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Aucune alerte de performance active. Crée-en une ci-dessus ou depuis un pipeline.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {alerts.map((a) => (
            <EditableAlertCard key={a.id} alert={a} badge="Alerte performance" />
          ))}
        </div>
      )}

      {/* Alertes terminées — échéance dépassée */}
      {done.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-600">
            ✅ Alertes terminées
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">{done.length}</span>
            <span className="text-[11px] font-normal text-slate-400">échéance dépassée</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {done.map((a) => (
              <div key={a.id} className="opacity-80">
                <EditableAlertCard alert={a} badge="Terminée" />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
