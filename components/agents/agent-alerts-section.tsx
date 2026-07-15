import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { EditableAlertCard, type EditableAlert } from "./editable-alert-card";

/**
 * Section « Alertes » d'un agent : liste les alertes enregistrées depuis le chat
 * de cet agent (filtrées par agent_key), modifiables et supprimables.
 */
export async function AgentAlertsSection({ agentKey }: { agentKey: string }) {
  const orgId = await getOrgId();
  if (!orgId) return null;
  const supabase = await createSupabaseServerClient();

  const cols = "id, title, description, impact, category, threshold, unit_mode, created_at, date_from, date_to, notification_channels";
  const first = await supabase
    .from("alerts")
    .select(cols)
    .eq("organization_id", orgId)
    .eq("agent_key", agentKey)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);

  let rows = first.data as EditableAlert[] | null;
  // Résilience : colonne agent_key absente (migration non appliquée) → on n'affiche rien.
  if (first.error && /agent_key/.test(first.error.message)) rows = [];
  const alerts = rows ?? [];

  return (
    <section className="mt-8 space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fuchsia-500"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
        Alertes
        <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">{alerts.length}</span>
      </h2>
      {alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
          Aucune alerte pour cet agent. Dans le chat, active une alerte de suivi sous un rapport pour la retrouver ici.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {alerts.map((a) => (
            <EditableAlertCard key={a.id} alert={a} />
          ))}
        </div>
      )}
    </section>
  );
}
