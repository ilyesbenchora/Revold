/**
 * GET /api/integrations/slack/connect
 *
 * Démarre l'OAuth Slack (« Se connecter avec Slack » en un clic, comme HubSpot).
 * Scope incoming-webhook : Slack demande à l'utilisateur de choisir un canal et
 * renvoie l'URL de webhook au callback. Aucune saisie manuelle d'URL.
 *
 * Prérequis (une seule fois, côté admin Revold) :
 *   - SLACK_CLIENT_ID / SLACK_CLIENT_SECRET (app Slack)
 *   - Redirect URL dans l'app Slack : {NEXT_PUBLIC_APP_URL}/api/integrations/slack/callback
 */
import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createOAuthState } from "@/lib/integrations/oauth-state";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.redirect(new URL("/login?error=Connectez-vous+pour+lier+Slack", base));
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId || !process.env.SLACK_CLIENT_SECRET) {
    // Env non configurée → on renvoie vers la bibliothèque avec un message clair.
    return NextResponse.redirect(new URL("/dashboard/integration/bibliotheque?error=oauth_env_slack", base));
  }

  const redirectUri = `${base}/api/integrations/slack/callback`;
  const state = createOAuthState(orgId);
  const authUrl =
    `https://slack.com/oauth/v2/authorize?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent("incoming-webhook")}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("slack_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
