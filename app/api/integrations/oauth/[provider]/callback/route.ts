import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyOAuthState } from "@/lib/integrations/oauth-state";
import { getOAuthProvider, exchangeCode } from "@/lib/integrations/oauth-providers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const SETTINGS = "/dashboard/parametres/integrations";

function redirectTo(path: string, params: Record<string, string> = {}) {
  const url = new URL(path, APP_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/** GET /api/integrations/oauth/{provider}/callback — échange le code + stocke. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const p = getOAuthProvider(provider);
  if (!p) return redirectTo(SETTINGS, { oauth_error: `Provider inconnu: ${provider}` });

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const errParam = sp.get("error");
  if (errParam) {
    const desc = sp.get("error_description") || "";
    return redirectTo(SETTINGS, { oauth_error: `${p.label} a refusé : ${errParam}${desc ? ` — ${desc}` : ""}` });
  }
  if (!code || !state) return redirectTo(SETTINGS, { oauth_error: "Réponse OAuth invalide (code/state manquant)" });

  // CSRF : cookie + signature HMAC.
  const cookieState = req.cookies.get(`oauth_state_${provider}`)?.value;
  if (!cookieState || cookieState !== state) {
    return redirectTo(SETTINGS, { oauth_error: "Vérification CSRF échouée — relancez la connexion" });
  }
  const verified = verifyOAuthState(state);
  if (!verified) return redirectTo(SETTINGS, { oauth_error: "State OAuth invalide (signature)" });
  const { orgId } = verified;

  let tokens;
  try {
    tokens = await exchangeCode(p, code);
  } catch (err) {
    console.error(`[oauth ${provider}] exchange failed`, err);
    return redirectTo(SETTINGS, { oauth_error: `Échec de l'échange du code (${p.label})` });
  }

  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("integrations").upsert(
    {
      organization_id: orgId,
      provider,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expires_at: expiresAt,
      metadata: { scope: tokens.scope ?? p.scopes.join(" "), connected_at: new Date().toISOString() },
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider" },
  );
  if (error) {
    console.error(`[oauth ${provider}] save failed`, error);
    return redirectTo(SETTINGS, { oauth_error: `Échec de l'enregistrement (${p.label})` });
  }

  const res = redirectTo("/dashboard/integration/mes-outils", { connected: provider });
  res.cookies.set(`oauth_state_${provider}`, "", { path: "/", maxAge: 0 });
  return res;
}
