export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { EditableAlertCard, type EditableAlert } from "@/components/agents/editable-alert-card";
import { isSoon, isOverdue, daysUntil } from "@/lib/alerts/deadline";

type AlertRow = EditableAlert & { status: string | null };

export default async function MesAlertesPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("alerts")
    .select("id, title, description, impact, category, status, threshold, unit_mode, created_at, date_from, date_to, notification_channels")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  const alerts = (data ?? []) as AlertRow[];
  const activeAll = alerts.filter((a) => (a.status ?? "active") === "active");
  // Une alerte à date de fin dépassée est « terminée » → bloc dédié, hors suivi actif.
  const done = activeAll.filter((a) => isOverdue(a.date_to));
  const active = activeAll.filter((a) => !isOverdue(a.date_to));

  // Regroupement par catégorie (navigation en carrousel horizontal).
  const CAT_LABELS: Record<string, string> = {
    sales: "Ventes",
    commercial: "Ventes",
    marketing: "Marketing",
    revops: "RevOps",
    finance: "Finance",
    csm: "Service client",
  };
  const byCat = new Map<string, AlertRow[]>();
  for (const a of active) {
    const key = a.category ?? "revops";
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(a);
  }

  // Bientôt à échéance : date de fin dans les 7 jours (triées par urgence).
  const soon = active
    .filter((a) => isSoon(a.date_to, 7))
    .sort((x, y) => daysUntil(x.date_to as string) - daysUntil(y.date_to as string));

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mes alertes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Toutes tes alertes de suivi — créées depuis un agent, un pipeline, ou de zéro.
          </p>
        </div>
        <CreateAlertModal />
      </header>

      {activeAll.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Aucune alerte active. Crée-en une avec le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bientôt à échéance — timeline live */}
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

          {[...byCat.entries()].map(([cat, catAlerts]) => (
            <div key={cat} className="space-y-2">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                {CAT_LABELS[cat] ?? cat}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{catAlerts.length}</span>
              </h2>
              <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 scroll-smooth">
                {catAlerts.map((a) => (
                  <div key={a.id} className="snap-start shrink-0" style={{ width: "min(380px, 90vw)" }}>
                    <EditableAlertCard alert={a} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Alertes terminées — échéance dépassée */}
          {done.length > 0 && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-600">
                ✅ Alertes terminées
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">{done.length}</span>
                <span className="text-[11px] font-normal text-slate-400">échéance dépassée</span>
              </h2>
              <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 scroll-smooth">
                {done.map((a) => (
                  <div key={a.id} className="snap-start shrink-0 opacity-80" style={{ width: "min(380px, 90vw)" }}>
                    <EditableAlertCard alert={a} badge="Terminée" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
