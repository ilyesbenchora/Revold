export const dynamic = "force-dynamic";

import { ParametresTabs } from "@/components/parametres-tabs";
import { NotificationChannelsForm } from "@/components/notification-channels-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export default async function ParametresNotificationsPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const { data: channels } = await supabase
    .from("notification_channels")
    .select("*")
    .eq("organization_id", orgId);

  // Stats récentes : combien de notifs envoyées sur les 7 derniers jours
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: recentLogs } = await supabase
    .from("notification_log")
    .select("channel_type, status")
    .eq("organization_id", orgId)
    .gte("created_at", sevenDaysAgo);

  const stats = {
    total: recentLogs?.length ?? 0,
    sent: recentLogs?.filter((l) => l.status === "sent").length ?? 0,
    failed: recentLogs?.filter((l) => l.status === "failed").length ?? 0,
    byChannel: (recentLogs ?? []).reduce<Record<string, number>>((acc, l) => {
      acc[l.channel_type] = (acc[l.channel_type] ?? 0) + 1;
      return acc;
    }, {}),
  };

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configuration des canaux de notification et des digests.
        </p>
      </header>

      <ParametresTabs />

      {/* Stats 7j */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <article className="card p-4">
          <p className="text-[10px] font-medium uppercase text-slate-500">Notifs envoyées (7j)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
        </article>
        <article className="card p-4">
          <p className="text-[10px] font-medium uppercase text-slate-500">Réussies</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.sent}</p>
        </article>
        <article className="card p-4">
          <p className="text-[10px] font-medium uppercase text-slate-500">Échecs</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              stats.failed > 0 ? "text-rose-600" : "text-slate-400"
            }`}
          >
            {stats.failed}
          </p>
        </article>
        <article className="card p-4">
          <p className="text-[10px] font-medium uppercase text-slate-500">Canaux configurés</p>
          <p className="mt-1 text-2xl font-bold text-accent">
            {(channels ?? []).filter((c) => c.enabled).length}
          </p>
        </article>
      </div>

      {/* In-app (toujours actif) */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Cloche in-app
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            ✓ Toujours actif
          </span>
        </h2>
        <p className="text-xs text-slate-500">
          Les notifications apparaissent dans la cloche du header et la page Alertes.
          Activé par défaut pour toute alerte créée.
        </p>
      </div>

      {/* Canaux configurables */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Canaux additionnels
        </h2>
        <p className="text-xs text-slate-500">
          Configurez les canaux supplémentaires pour recevoir vos alertes et digests.
        </p>
        <NotificationChannelsForm initialChannels={channels ?? []} />
      </div>

      {/* Digest schedule (placeholder pour les futures préférences globales) */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />Digests automatiques
        </h2>
        <div className="card p-5">
          <p className="text-sm text-slate-700">
            Le <strong>digest quotidien</strong> est envoyé tous les matins à 8h via le canal email
            configuré. Il regroupe :
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
            <li>• Alertes dont l&apos;objectif a été atteint dans les dernières 24h</li>
            <li>• Top 3 coachings critiques générés par l&apos;IA Revold</li>
            <li>• KPIs principaux (closing rate, pipeline, conversion) avec variation 24h</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Activez l&apos;email ci-dessus pour recevoir le digest. Pour désactiver le digest sans
            désactiver les alertes ponctuelles, contactez-nous (préférence digest individuelle à
            venir).
          </p>
        </div>
      </div>

      {/* Stats par canal */}
      {Object.keys(stats.byChannel).length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />Activité par canal (7 jours)
          </h2>
          <div className="card p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {Object.entries(stats.byChannel).map(([channel, count]) => (
                <div key={channel} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase text-slate-500">{channel}</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">{count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
