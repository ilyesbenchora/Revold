export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { PerformancesTabs } from "@/components/performances-tabs";
import { VentesTabs } from "@/components/ventes-tabs";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { EditableAlertCard, type EditableAlert } from "@/components/agents/editable-alert-card";

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
  const alerts = ((data ?? []) as AlertRow[]).filter(
    (a) => (a.status ?? "active") === "active" && (a.team === "sales" || ["sales", "commercial", "revops"].includes(a.category ?? "")),
  );

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
    </section>
  );
}
