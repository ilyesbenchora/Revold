/**
 * Envoi d'une notification PAR ÉVÉNEMENT : lit les préférences de l'org
 * (Paramètres → Notifications), puis dispatche sur les canaux retenus.
 *
 * Un événement désactivé n'envoie rien du tout — la cloche in-app comprise :
 * c'est le point de contrôle unique de ce qui sort de Revold.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification, type NotificationChannelType, type SendNotificationParams } from "./send";
import { defaultPrefFor } from "./events";

const VALID_CHANNELS = new Set<NotificationChannelType>([
  "in_app",
  "email",
  "slack",
  "teams",
  "webhook",
  "hubspot",
  "sms",
  "whatsapp",
]);

/** Préférence effective d'un événement (défaut du catalogue si non enregistrée). */
export async function loadEventPref(
  supabase: SupabaseClient,
  orgId: string,
  eventKey: string,
): Promise<{ enabled: boolean; channels: NotificationChannelType[] }> {
  const fallback = defaultPrefFor(eventKey);
  let enabled = fallback.enabled;
  let channels = fallback.channels;
  try {
    const { data } = await supabase
      .from("notification_event_prefs")
      .select("enabled, channels")
      .eq("organization_id", orgId)
      .eq("event_key", eventKey)
      .maybeSingle();
    if (data) {
      enabled = data.enabled !== false;
      if (Array.isArray(data.channels)) channels = data.channels.filter((c): c is string => typeof c === "string");
    }
  } catch {
    /* migration non appliquée → défauts du catalogue */
  }
  return {
    enabled,
    channels: channels.filter((c): c is NotificationChannelType => VALID_CHANNELS.has(c as NotificationChannelType)),
  };
}

/**
 * Notifie un événement selon les préférences. Renvoie le nombre d'envois
 * réussis (0 si l'événement est coupé ou sans canal).
 */
export async function notifyEvent(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    eventKey: string;
    sourceType: SendNotificationParams["sourceType"];
    sourceId?: string;
    userId?: string;
    subject: string;
    bodyText: string;
    link?: string;
  },
): Promise<number> {
  const pref = await loadEventPref(supabase, args.orgId, args.eventKey);
  if (!pref.enabled || pref.channels.length === 0) return 0;
  try {
    const res = await sendNotification(supabase, {
      orgId: args.orgId,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      channels: pref.channels,
      userId: args.userId,
      subject: args.subject,
      bodyText: args.bodyText,
      link: args.link,
    });
    return res.sentCount;
  } catch {
    return 0;
  }
}
