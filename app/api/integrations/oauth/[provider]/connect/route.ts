import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createOAuthState } from "@/lib/integrations/oauth-state";
import { getOAuthProvider, buildAuthUrl } from "@/lib/integrations/oauth-providers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** GET /api/integrations/oauth/{provider}/connect — lance le flow OAuth. */
export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const p = getOAuthProvider(provider);
  if (!p) return NextResponse.json({ error: `Provider inconnu: ${provider}` }, { status: 404 });

  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.redirect(new URL(`/login?error=Connectez-vous+pour+lier+${p.label}`, APP_URL));
  }

  if (!process.env[p.clientIdEnv] || !process.env[p.clientSecretEnv]) {
    return NextResponse.redirect(
      new URL(`/dashboard/integration/bibliotheque?error=oauth_env_${provider}`, APP_URL),
    );
  }

  const state = createOAuthState(orgId);
  const res = NextResponse.redirect(buildAuthUrl(p, state));
  res.cookies.set(`oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
