export const dynamic = "force-dynamic";

import Link from "next/link";
import { ParametresTabs } from "@/components/parametres-tabs";
import { NotificationChannelsForm } from "@/components/notification-channels-form";
import { NotificationPreferencesForm } from "@/components/notification-preferences-form";
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

  // Mobile de l'org (Mon compte) : conditionne les canaux SMS et WhatsApp.
  // Résilient tant que la colonne phone n'est pas migrée.
  let hasPhone = false;
  try {
    const { data: withPhone } = await supabase
      .from("profiles")
      .select("phone")
      .eq("organization_id", orgId)
      .not("phone", "is", null)
      .limit(1);
    hasPhone = (withPhone ?? []).some((p) => /^\+?\d[\d\s.-]{7,}$/.test(String(p.phone ?? "")));
  } catch {}

  // Stats récentes : combien de notifs envoyées sur les 7 derniers jours.
  // Page force-dynamic : la fenêtre est volontairement calculée à la requête.
  // eslint-disable-next-line react-hooks/purity
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

      {/* Contenu des notifications — miroir « push » du brief vocal */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Contenu des notifications
        </h2>
        <p className="text-xs text-slate-500">
          Choisis ce qui déclenche une notification, et sur quels canaux. Même logique que le{" "}
          <Link href="/dashboard/parametres/tour-de-controle" className="font-medium text-accent hover:underline">
            contenu du brief
          </Link>{" "}
          de la tour de contrôle : le brief te LIT ces informations quand tu le demandes, les notifications te
          les ENVOIENT quand elles se produisent. La cloche in-app reste le canal par défaut.
        </p>
        <NotificationPreferencesForm
          configuredChannels={(channels ?? []).filter((c) => c.enabled).map((c) => String(c.type))}
          hasPhone={hasPhone}
        />
      </div>

      {/* Canaux configurables */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Canaux additionnels
        </h2>
        <p className="text-xs text-slate-500">
          Configurez les canaux supplémentaires pour recevoir vos alertes et digests. Le mobile (SMS et
          WhatsApp) n&apos;a rien à configurer ici : il utilise le numéro de{" "}
          <Link href="/dashboard/mon-compte" className="font-medium text-accent hover:underline">
            Mon compte
          </Link>
          .
        </p>
        <NotificationChannelsForm initialChannels={channels ?? []} />
      </div>

      {/* Digest quotidien — canaux hérités des préférences ci-dessus */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Digest quotidien
        </h2>
        <div className="card p-5">
          <p className="text-sm text-slate-700">
            Envoyé chaque matin à 7h via le canal email configuré : alertes atteintes dans les
            dernières 24h, coachings critiques, et KPIs principaux avec leur variation.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Activez l&apos;email ci-dessus pour le recevoir. Pour le point de situation à la demande
            (vocal, calculé en direct), voyez la{" "}
            <Link href="/dashboard/parametres/tour-de-controle" className="font-medium text-accent hover:underline">
              tour de contrôle
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Stats par canal */}
      {Object.keys(stats.byChannel).length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Activité par canal (7 jours)
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
