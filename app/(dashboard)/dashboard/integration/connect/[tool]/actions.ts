"use server";

import { redirect } from "next/navigation";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getConnectableTool } from "@/lib/integrations/connect-catalog";
import { pingTool } from "@/lib/integrations/ping";

export async function connectToolAction(toolKey: string, formData: FormData) {
  const tool = getConnectableTool(toolKey);
  if (!tool) {
    redirect(`/dashboard/integration?error=unknown_tool`);
  }
  if (tool.comingSoon) {
    redirect(`/dashboard/integration?error=coming_soon`);
  }

  const orgId = await getOrgId();
  if (!orgId) {
    redirect(`/dashboard/integration/connect/${toolKey}?error=no_org`);
  }

  // Collect all field values; the first password field becomes access_token,
  // everything else goes into metadata.
  const credentials: Record<string, string> = {};
  let primaryToken = "";
  for (const field of tool.fields) {
    const value = (formData.get(field.key) as string | null)?.trim() ?? "";
    if (!value) {
      redirect(`/dashboard/integration/connect/${toolKey}?error=missing_${field.key}`);
    }
    credentials[field.key] = value;
    if (field.type === "password" && !primaryToken) {
      primaryToken = value;
    }
  }
  if (!primaryToken) {
    primaryToken = Object.values(credentials)[0] ?? "";
  }

  // ── Validate the credentials BEFORE marking the integration active ──
  // Otherwise users see "Connecté" on garbage tokens and the next sync
  // fails silently. This is the gate that protects pilots.
  const ping = await pingTool(toolKey, credentials);
  if (!ping.ok) {
    const reason = encodeURIComponent(ping.reason);
    redirect(`/dashboard/integration/connect/${toolKey}?error=invalid_token&reason=${reason}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("integrations")
    .upsert(
      {
        organization_id: orgId,
        provider: toolKey,
        access_token: primaryToken,
        metadata: credentials,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" },
    );

  if (error) {
    redirect(`/dashboard/integration/connect/${toolKey}?error=save_failed`);
  }

  // ── Sync vers notification_channels pour les outils communication ──
  // Slack/Teams/Gmail/Outlook = canaux de notif. On crée la ligne
  // notification_channels correspondante pour qu'ils apparaissent comme
  // sélectionnables dans le step 4 de CreateAlertModal et AlertButton.
  if (tool && tool.category === "communication") {
    let channelType: "email" | "slack" | "teams" | null = null;
    let channelConfig: Record<string, unknown> = {};

    if (toolKey === "slack") {
      channelType = "slack";
      channelConfig = { webhook_url: credentials.webhook_url };
    } else if (toolKey === "teams") {
      channelType = "teams";
      channelConfig = { webhook_url: credentials.webhook_url };
    } else if (toolKey === "gmail" || toolKey === "outlook") {
      channelType = "email";
      const recipients = (credentials.recipients ?? "")
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      channelConfig = { recipients };
    }

    if (channelType) {
      await supabase.from("notification_channels").upsert(
        {
          organization_id: orgId,
          type: channelType,
          config: channelConfig,
          enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,type" },
      );
    }
  }

  // After saving credentials, trigger an initial sync via the orchestrator UI.
  redirect(`/dashboard/integration?connected=${toolKey}&sync=${toolKey}`);
}

export async function disconnectToolAction(toolKey: string) {
  const orgId = await getOrgId();
  if (!orgId) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("integrations")
    .delete()
    .eq("organization_id", orgId)
    .eq("provider", toolKey);
  redirect(`/dashboard/integration?disconnected=${toolKey}`);
}
