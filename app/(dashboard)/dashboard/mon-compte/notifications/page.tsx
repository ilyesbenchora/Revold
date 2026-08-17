export const dynamic = "force-dynamic";

import Link from "next/link";
import { MonCompteTabs } from "@/components/mon-compte-tabs";
import { NotificationPreferencesForm } from "@/components/notification-preferences-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

/**
 * Mon compte → Notifications : LE point de gestion des canaux pour les
 * alertes, les alertes techniques et les objectifs. Les cartes de création
 * n'ont plus de sélecteur de canaux — tout se règle ici, et le changement
 * s'applique aussi aux alertes/objectifs déjà créés.
 */
export default async function MonCompteNotificationsPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const { data: channels } = await supabase
    .from("notification_channels")
    .select("type, enabled")
    .eq("organization_id", orgId);

  // Mobile de l'org (Mon compte → Profil) : conditionne SMS et WhatsApp.
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

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mon compte</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choisissez où recevoir vos alertes, alertes techniques et objectifs.
        </p>
      </header>

      <MonCompteTabs />

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Canaux par type de suivi
        </h2>
        <p className="text-xs text-slate-500">
          Ces canaux s&apos;appliquent à TOUTES vos alertes et objectifs, existants et futurs — plus rien à
          choisir carte par carte. La configuration des canaux eux-mêmes (email, Slack…) et les autres
          événements restent dans{" "}
          <Link href="/dashboard/parametres/notifications" className="font-medium text-accent hover:underline">
            Paramètres → Notifications
          </Link>
          .
        </p>
        <NotificationPreferencesForm
          configuredChannels={(channels ?? []).filter((c) => c.enabled).map((c) => String(c.type))}
          hasPhone={hasPhone}
          only={["alert_resolved", "technical_alert_resolved", "objective_late", "objective_reached"]}
        />
      </div>
    </section>
  );
}
