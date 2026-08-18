/**
 * GET /auth/callback?code=...
 *
 * Endpoint de callback Supabase Auth — gère l'échange du code reçu après :
 *   - confirmation d'email (signup)
 *   - magic link
 *   - reset password
 *
 * Ce route DOIT être référencé dans Supabase Dashboard :
 *   Project Settings → Authentication → URL Configuration
 *     - Site URL          : https://revold.io
 *     - Redirect URLs     : https://revold.io/auth/callback
 *
 * ET les templates d'email doivent pointer vers
 *   {{ .SiteURL }}/auth/callback?code={{ .TokenHash }}
 * pour rester sur le domaine Revold (pas de page Vercel par défaut).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") || "/dashboard";
  const errorDescription = req.nextUrl.searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription)}`, APP_URL),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=Code+manquant", APP_URL));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, APP_URL),
    );
  }

  // Succès. NOUVEAU compte OAuth (Google) — ni profil, ni entreprise dans les
  // métadonnées → même parcours d'inscription que le code email : formulaire
  // entreprise obligatoire (oauth=1 : le mot de passe y est optionnel, la
  // connexion Google suffit). Sinon, destination demandée (dashboard).
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const meta = user?.user_metadata as { org_name?: string } | null;
    if (user && !meta?.org_name?.trim()) {
      const { data: p } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
      if (!p) {
        return NextResponse.redirect(
          new URL(`/login?mode=entreprise&email=${encodeURIComponent(user.email ?? "")}&oauth=1`, APP_URL),
        );
      }
    }
  } catch {
    /* table profiles absente ou lecture impossible → dashboard (getOrgId gère) */
  }
  return NextResponse.redirect(new URL(next, APP_URL));
}
