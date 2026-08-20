import type { SupabaseClient } from "@supabase/supabase-js";
import { signWebhookPayload } from "@/lib/api/keys";

/** Événements webhook émis par Revold (liste affichée dans Sécurité & API). */
export type WebhookEvent =
  | "alert.created"
  | "sync.completed"
  | "sync.failed"
  | "objective.reached"
  | "test.ping";

/**
 * Envoie un événement aux webhooks ACTIFS de l'org abonnés à cet événement.
 * Best-effort (jamais bloquant pour l'appelant) : timeout 5 s par endpoint,
 * signature HMAC-SHA256 dans x-revold-signature, statut mémorisé sur la ligne.
 */
export async function dispatchWebhookEvent(
  supabase: SupabaseClient,
  orgId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: hooks } = await supabase
      .from("webhooks")
      .select("id, url, events, secret")
      .eq("organization_id", orgId)
      .eq("is_active", true);
    const targets = (hooks ?? []).filter((h) => (h.events as string[]).includes(event));
    if (targets.length === 0) return;

    const body = JSON.stringify({ event, organization_id: orgId, created_at: new Date().toISOString(), data: payload });
    await Promise.all(
      targets.map(async (h) => {
        let status = 0;
        try {
          const res = await fetch(h.url as string, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-revold-event": event,
              "x-revold-signature": signWebhookPayload(h.secret as string, body),
            },
            body,
            signal: AbortSignal.timeout(5000),
          });
          status = res.status;
        } catch {
          status = -1; // réseau/timeout
        }
        await supabase
          .from("webhooks")
          .update({ last_delivery_at: new Date().toISOString(), last_status: status })
          .eq("id", h.id)
          .then(() => {}, () => {});
      }),
    );
  } catch {
    /* table absente ou erreur réseau : jamais bloquant */
  }
}
