export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { AlertBody } from "@/components/agents/alert-ui";

type AlertRow = {
  id: string;
  title: string;
  description: string | null;
  impact: string | null;
  category: string | null;
  status: string | null;
  created_at: string | null;
  date_from: string | null;
  date_to: string | null;
  notification_channels: string[] | null;
};

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "";
}

export default async function MesAlertesPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("alerts")
    .select("id, title, description, impact, category, status, created_at, date_from, date_to, notification_channels")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  const alerts = (data ?? []) as AlertRow[];
  const active = alerts.filter((a) => (a.status ?? "active") === "active");

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

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Aucune alerte active. Crée-en une avec le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {active.map((a) => (
            <div key={a.id} className="card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-600">
                  <span>✨</span> Alerte de suivi
                </span>
                <span className="text-xs text-slate-400">
                  {a.date_from || a.date_to ? `${fmt(a.date_from)} → ${fmt(a.date_to)}` : fmt(a.created_at)}
                </span>
              </div>
              <AlertBody
                title={a.title}
                description={a.description ?? ""}
                impact={a.impact}
                category={a.category}
                channels={a.notification_channels ?? undefined}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
