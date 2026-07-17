/**
 * GET /api/integrations/slack/callback
 *
 * Callback OAuth Slack : échange le code contre l'URL de webhook du canal choisi
 * par l'utilisateur, puis enregistre l'intégration + le canal de notification.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyOAuthState } from "@/lib/integrations/oauth-state";

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const settings = new URL("/dashboard/parametres/integrations", base);
  const bib = (msg: string) => {
    const u = new URL("/dashboard/integration/bibliotheque", base);
    u.searchParams.set("error", msg);
    return NextResponse.redirect(u);
  };

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const denied = req.nextUrl.searchParams.get("error");
  if (denied) return bib("slack_denied");
  if (!code || !state) return bib("slack_missing_code");

  // Vérif CSRF : state signé + cookie.
  const cookieState = req.cookies.get("slack_oauth_state")?.value;
  const verified = verifyOAuthState(state);
  if (!verified || (cookieState && cookieState !== state)) return bib("slack_bad_state");
  const orgId = verified.orgId;

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) return bib("oauth_env_slack");

  const redirectUri = `${base}/api/integrations/slack/callback`;

  try {
    const res = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      access_token?: string;
      team?: { id?: string; name?: string };
      incoming_webhook?: { url?: string; channel?: string; channel_id?: string };
    };
    if (!data.ok || !data.incoming_webhook?.url) {
      return bib(`slack_exchange_${data.error ?? "failed"}`);
    }

    const webhookUrl = data.incoming_webhook.url;
    const teamName = data.team?.name ?? "Slack";
    const channel = data.incoming_webhook.channel ?? "";

    const supabase = await createSupabaseServerClient();

    // Intégration Slack (miroir dans la table integrations).
    await supabase.from("integrations").upsert(
      {
        organization_id: orgId,
        provider: "slack",
        access_token: data.access_token ?? webhookUrl,
        metadata: { webhook_url: webhookUrl, team_name: teamName, channel },
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" },
    );

    // Canal de notification Slack (utilisé par les alertes).
    await supabase.from("notification_channels").upsert(
      {
        organization_id: orgId,
        type: "slack",
        config: { webhook_url: webhookUrl, channel, team_name: teamName },
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,type" },
    );

    settings.searchParams.set("connected", "slack");
    const out = NextResponse.redirect(settings);
    out.cookies.set("slack_oauth_state", "", { path: "/", maxAge: 0 });
    return out;
  } catch (e) {
    return bib(`slack_error_${e instanceof Error ? "exception" : "unknown"}`);
  }
}
