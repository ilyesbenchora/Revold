/**
 * Notification dispatcher — Phase 8.4
 *
 * Envoie une notification via les canaux configurés (email/slack/teams/webhook)
 * et logue chaque envoi dans notification_log pour audit.
 *
 * Usage :
 *   await sendNotification(supabase, {
 *     orgId,
 *     sourceType: "alert_resolved",
 *     sourceId: alertId,
 *     channels: ["in_app", "email", "slack"],  // canaux per-alert
 *     subject: "Objectif atteint : Closing rate 35%",
 *     bodyText: "...",
 *     bodyHtml: "<p>...</p>",
 *     link: "/dashboard/alertes",
 *   });
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "Revold <noreply@revold.io>";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export type NotificationChannelType = "in_app" | "email" | "slack" | "teams" | "webhook" | "hubspot";

export type SendNotificationParams = {
  orgId: string;
  /** Type d'événement déclencheur */
  sourceType: "alert_resolved" | "daily_digest" | "weekly_digest" | "coaching_critical" | "manual";
  /** ID de l'alerte ou coaching à l'origine */
  sourceId?: string;
  /** Canaux à utiliser pour cette notif */
  channels: NotificationChannelType[];
  /** Optionnel : userId pour notif in-app ciblée */
  userId?: string;
  /** Sujet (utilisé en email + slack/teams card) */
  subject: string;
  /** Corps texte brut (fallback) */
  bodyText: string;
  /** Corps HTML pour email (optionnel, sinon généré depuis bodyText) */
  bodyHtml?: string;
  /** Lien d'action principal */
  link?: string;
};

type ChannelConfig = {
  type: NotificationChannelType;
  enabled: boolean;
  config: Record<string, unknown>;
};

async function loadOrgChannels(supabase: SupabaseClient, orgId: string): Promise<ChannelConfig[]> {
  const { data } = await supabase
    .from("notification_channels")
    .select("type, enabled, config")
    .eq("organization_id", orgId)
    .eq("enabled", true);
  return (data ?? []) as ChannelConfig[];
}

async function logNotification(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    channelType: NotificationChannelType;
    sourceType: SendNotificationParams["sourceType"];
    sourceId?: string;
    status: "sent" | "failed" | "pending";
    error?: string;
    recipient?: string;
    subject?: string;
  },
): Promise<void> {
  await supabase.from("notification_log").insert({
    organization_id: args.orgId,
    channel_type: args.channelType,
    source_type: args.sourceType,
    source_id: args.sourceId ?? null,
    status: args.status,
    error: args.error ?? null,
    recipient: args.recipient ?? null,
    subject: args.subject ?? null,
    sent_at: args.status === "sent" ? new Date().toISOString() : null,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// EMAIL via Resend
// ────────────────────────────────────────────────────────────────────────────

async function sendEmail(
  recipients: string[],
  subject: string,
  bodyText: string,
  bodyHtml: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }
  if (recipients.length === 0) {
    return { ok: false, error: "No recipients configured" };
  }
  try {
    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to: recipients,
      subject,
      text: bodyText,
      html: bodyHtml,
    });
    if (error) return { ok: false, error: String(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// SLACK / TEAMS via webhook (incoming webhooks)
// ────────────────────────────────────────────────────────────────────────────

async function sendSlackMessage(
  webhookUrl: string,
  subject: string,
  bodyText: string,
  link?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const blocks: unknown[] = [
      { type: "header", text: { type: "plain_text", text: subject } },
      { type: "section", text: { type: "mrkdwn", text: bodyText } },
    ];
    if (link) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Ouvrir Revold" },
            url: link.startsWith("http") ? link : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://revold.io"}${link}`,
          },
        ],
      });
    }
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: subject, blocks }),
    });
    if (!res.ok) return { ok: false, error: `Slack webhook ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendTeamsMessage(
  webhookUrl: string,
  subject: string,
  bodyText: string,
  link?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const card = {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      themeColor: "8B5CF6",
      summary: subject,
      title: subject,
      text: bodyText,
      potentialAction: link
        ? [
            {
              "@type": "OpenUri",
              name: "Ouvrir Revold",
              targets: [
                {
                  os: "default",
                  uri: link.startsWith("http")
                    ? link
                    : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://revold.io"}${link}`,
                },
              ],
            },
          ]
        : [],
    };
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!res.ok) return { ok: false, error: `Teams webhook ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// HUBSPOT — task assignée à un owner. La task assignée déclenche la
// notification interne HubSpot (cloche dans le header de l'user owner) +
// elle apparaît dans son Tasks list. C'est l'équivalent le plus proche
// d'une "notification dans l'app HubSpot" via API publique.
// ────────────────────────────────────────────────────────────────────────────

/** Récupère l'ID du premier owner HubSpot (synced localement). */
async function getDefaultHubspotOwnerId(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("hubspot_objects")
    .select("hubspot_id")
    .eq("organization_id", orgId)
    .eq("object_type", "owners")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.hubspot_id as string | undefined) ?? null;
}

async function sendHubSpotNotification(
  supabase: SupabaseClient,
  orgId: string,
  subject: string,
  bodyText: string,
  link?: string,
): Promise<{ ok: boolean; error?: string }> {
  // Lazy import pour éviter de charger la lib HubSpot quand le canal n'est pas utilisé
  const { getHubSpotToken } = await import("@/lib/integrations/get-hubspot-token");
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) {
    return { ok: false, error: "HubSpot non connecté pour cette org" };
  }
  const fullLink = link
    ? link.startsWith("http")
      ? link
      : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://revold.io"}${link}`
    : null;
  const body = `${bodyText}${fullLink ? `\n\n→ ${fullLink}` : ""}`;
  const ownerId = await getDefaultHubspotOwnerId(supabase, orgId);

  try {
    const properties: Record<string, unknown> = {
      hs_task_subject: subject.slice(0, 200),
      hs_task_body: body.slice(0, 65535),
      hs_task_priority: "HIGH",
      hs_task_status: "NOT_STARTED",
      hs_task_type: "TODO",
      hs_timestamp: Date.now(),
    };
    // Sans owner_id, la task apparaît dans la liste mais ne déclenche pas
    // de notification utilisateur. Avec owner_id, l'owner reçoit la notif
    // dans la cloche HubSpot.
    if (ownerId) properties.hubspot_owner_id = ownerId;

    const res = await fetch("https://api.hubapi.com/crm/v3/objects/tasks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `HubSpot ${res.status}: ${err.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendCustomWebhook(
  url: string,
  payload: object,
  headers: Record<string, string> = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: `Custom webhook ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// HTML EMAIL TEMPLATE
// ────────────────────────────────────────────────────────────────────────────

export function buildEmailHtml(args: {
  subject: string;
  bodyText: string;
  link?: string;
  ctaLabel?: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://revold.io";
  const fullLink = args.link
    ? args.link.startsWith("http")
      ? args.link
      : `${appUrl}${args.link}`
    : appUrl;
  const ctaLabel = args.ctaLabel ?? "Ouvrir Revold";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${args.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding:0;background:linear-gradient(90deg,#d946ef,#a855f7,#4f46e5);height:6px;"></td>
          </tr>
          <tr>
            <td style="padding:32px 32px 12px;">
              <p style="margin:0;font-size:11px;font-weight:600;color:#a855f7;text-transform:uppercase;letter-spacing:0.08em;">Revold</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">${args.subject}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px;">
              <div style="font-size:14px;line-height:1.6;color:#475569;white-space:pre-wrap;">${args.bodyText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <a href="${fullLink}" style="display:inline-block;background:linear-gradient(90deg,#a855f7,#4f46e5);color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">${ctaLabel} →</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                Vous recevez cette notification car vous avez activé les alertes Revold.
                <a href="${appUrl}/dashboard/parametres/notifications" style="color:#a855f7;">Modifier mes préférences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN DISPATCHER
// ────────────────────────────────────────────────────────────────────────────

export async function sendNotification(
  supabase: SupabaseClient,
  params: SendNotificationParams,
): Promise<{ sentCount: number; failedCount: number; details: Array<{ channel: string; ok: boolean; error?: string }> }> {
  const { orgId, sourceType, sourceId, channels, userId, subject, bodyText, link } = params;
  const bodyHtml = params.bodyHtml ?? buildEmailHtml({ subject, bodyText, link });

  const orgChannels = await loadOrgChannels(supabase, orgId);
  const orgChannelMap = new Map(orgChannels.map((c) => [c.type, c]));

  const results: Array<{ channel: string; ok: boolean; error?: string }> = [];

  for (const channel of channels) {
    if (channel === "in_app") {
      // In-app : simple insert dans notifications (table existante)
      try {
        await supabase.from("notifications").insert({
          organization_id: orgId,
          user_id: userId ?? null,
          type: sourceType,
          title: subject,
          body: bodyText,
          link: link ?? null,
          alert_id: sourceType === "alert_resolved" ? sourceId : null,
        });
        await logNotification(supabase, { orgId, channelType: "in_app", sourceType, sourceId, status: "sent", subject });
        results.push({ channel: "in_app", ok: true });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await logNotification(supabase, { orgId, channelType: "in_app", sourceType, sourceId, status: "failed", error, subject });
        results.push({ channel: "in_app", ok: false, error });
      }
      continue;
    }

    // HubSpot : pas de config user-level, utilise le token OAuth de l'org.
    // On saute la lookup dans notification_channels et on appelle directement.
    if (channel === "hubspot") {
      const result = await sendHubSpotNotification(supabase, orgId, subject, bodyText, link);
      await logNotification(supabase, {
        orgId,
        channelType: "hubspot",
        sourceType,
        sourceId,
        status: result.ok ? "sent" : "failed",
        error: result.error,
        recipient: "HubSpot Notification",
        subject,
      });
      results.push({ channel: "hubspot", ...result });
      continue;
    }

    const cfg = orgChannelMap.get(channel);
    if (!cfg) {
      results.push({ channel, ok: false, error: "Canal non configuré pour cette org" });
      continue;
    }

    if (channel === "email") {
      const recipients = (cfg.config.recipients as string[] | undefined) ?? [];
      const result = await sendEmail(recipients, subject, bodyText, bodyHtml);
      await logNotification(supabase, {
        orgId,
        channelType: "email",
        sourceType,
        sourceId,
        status: result.ok ? "sent" : "failed",
        error: result.error,
        recipient: recipients.join(", "),
        subject,
      });
      results.push({ channel: "email", ...result });
    } else if (channel === "slack") {
      const url = (cfg.config.webhook_url as string | undefined) ?? "";
      const result = await sendSlackMessage(url, subject, bodyText, link);
      await logNotification(supabase, {
        orgId,
        channelType: "slack",
        sourceType,
        sourceId,
        status: result.ok ? "sent" : "failed",
        error: result.error,
        recipient: url,
        subject,
      });
      results.push({ channel: "slack", ...result });
    } else if (channel === "teams") {
      const url = (cfg.config.webhook_url as string | undefined) ?? "";
      const result = await sendTeamsMessage(url, subject, bodyText, link);
      await logNotification(supabase, {
        orgId,
        channelType: "teams",
        sourceType,
        sourceId,
        status: result.ok ? "sent" : "failed",
        error: result.error,
        recipient: url,
        subject,
      });
      results.push({ channel: "teams", ...result });
    } else if (channel === "webhook") {
      const url = (cfg.config.url as string | undefined) ?? "";
      const headers = (cfg.config.headers as Record<string, string> | undefined) ?? {};
      const result = await sendCustomWebhook(
        url,
        { sourceType, sourceId, subject, bodyText, link, timestamp: new Date().toISOString() },
        headers,
      );
      await logNotification(supabase, {
        orgId,
        channelType: "webhook",
        sourceType,
        sourceId,
        status: result.ok ? "sent" : "failed",
        error: result.error,
        recipient: url,
        subject,
      });
      results.push({ channel: "webhook", ...result });
    }
  }

  const sentCount = results.filter((r) => r.ok).length;
  const failedCount = results.filter((r) => !r.ok).length;
  return { sentCount, failedCount, details: results };
}
