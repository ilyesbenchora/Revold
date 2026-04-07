import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

type Alert = {
  id: string;
  title: string;
  description: string;
  impact: string;
  category: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
};

export default async function AlertesPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  const { data: allAlerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const alerts = (allAlerts ?? []) as Alert[];
  const activeAlerts = alerts.filter((a) => a.status === "active");
  const resolvedAlerts = alerts.filter((a) => a.status === "resolved");

  const categoryColors: Record<string, { dot: string; badge: string }> = {
    sales: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700" },
    marketing: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
    data: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
    process: { dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700" },
  };

  const categoryLabels: Record<string, string> = {
    sales: "Commercial",
    marketing: "Marketing",
    data: "Data",
    process: "Process",
  };

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Alertes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Suivi des scénarios de simulation activés et de leur progression.
        </p>
      </header>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-4">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Alertes actives</p>
          <p className="mt-1 text-3xl font-bold text-orange-500">{activeAlerts.length}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Objectifs atteints</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{resolvedAlerts.length}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Total créées</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{alerts.length}</p>
        </article>
      </div>

      {/* Alertes en cours */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          Alertes en cours
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">{activeAlerts.length}</span>
        </h2>

        {activeAlerts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">Aucune alerte active. Activez un scénario depuis la page Insights IA.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAlerts.map((alert) => {
              const colors = categoryColors[alert.category] ?? categoryColors.sales;
              return (
                <article key={alert.id} className="card p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors.badge}`}>
                        {categoryLabels[alert.category] ?? alert.category}
                      </span>
                      <span className="rounded bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-700">En cours</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(alert.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-900">{alert.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{alert.description}</p>
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                      <polyline points="16 7 22 7 22 13" />
                    </svg>
                    <p className="text-sm font-medium text-slate-800">{alert.impact}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Objectifs atteints */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Objectifs atteints
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{resolvedAlerts.length}</span>
        </h2>

        {resolvedAlerts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">Aucun objectif atteint pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resolvedAlerts.map((alert) => {
              const colors = categoryColors[alert.category] ?? categoryColors.sales;
              return (
                <article key={alert.id} className="card border-emerald-200 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors.badge}`}>
                        {categoryLabels[alert.category] ?? alert.category}
                      </span>
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">Objectif atteint</span>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <p>Créée le {new Date(alert.created_at).toLocaleDateString("fr-FR")}</p>
                      {alert.resolved_at && <p>Atteint le {new Date(alert.resolved_at).toLocaleDateString("fr-FR")}</p>}
                    </div>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-900">{alert.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{alert.description}</p>
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm font-medium text-emerald-800">{alert.impact}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
