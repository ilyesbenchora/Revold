import { createClient } from "@supabase/supabase-js";

/**
 * Insère une notification in-app (cloche du header) via le service-role, pour
 * garantir l'écriture quelles que soient les RLS. Utilisée pour les
 * confirmations immédiates (ex : alerte créée), en complément des notifications
 * de seuil atteint générées par le cron.
 */
export async function createInAppNotification(args: {
  orgId: string;
  userId?: string | null;
  alertId?: string | null;
  title: string;
  body?: string | null;
  link?: string | null;
  type?: string;
}): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const admin = createClient(url, key);
    await admin.from("notifications").insert({
      organization_id: args.orgId,
      user_id: args.userId ?? null,
      type: args.type ?? "manual",
      title: args.title,
      body: args.body ?? null,
      link: args.link ?? null,
      alert_id: args.alertId ?? null,
    });
  } catch {
    // Best-effort : on ne bloque jamais la création de l'alerte sur la notif.
  }
}
