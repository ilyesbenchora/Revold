/**
 * GET /api/integrations/hubspot/connect
 *
 * Initie le flow OAuth HubSpot :
 * 1) Vérifie l'auth + récupère orgId
 * 2) Crée un state signé (CSRF)
 * 3) Pose le state dans un cookie httpOnly
 * 4) Redirige vers HubSpot avec le state
 */
import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotAuthUrl } from "@/lib/integrations/hubspot";
import { createOAuthState } from "@/lib/integrations/oauth-state";

export async function GET() {
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.redirect(new URL("/login?error=Connectez-vous+pour+lier+HubSpot", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }

  if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_CLIENT_SECRET || !process.env.HUBSPOT_REDIRECT_URI) {
    return NextResponse.json(
      { error: "Variables d'environnement HubSpot manquantes (HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET, HUBSPOT_REDIRECT_URI)" },
      { status: 500 },
    );
  }

  const state = createOAuthState(orgId);
  const authUrl = getHubSpotAuthUrl(state);

  const res = NextResponse.redirect(authUrl);
  // Cookie httpOnly pour double-vérification au callback.
  // Path = "/" pour éviter tout problème de scope cookie (path strict trop
  // étroit peut être ignoré par certains browsers en cross-site redirect).
  res.cookies.set("hs_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min
  });
  return res;
}
