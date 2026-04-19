"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    redirect("/login?error=Veuillez+remplir+tous+les+champs");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const orgName = String(formData.get("org_name") ?? "").trim();

  if (!email || !password || !fullName || !orgName) {
    redirect("/login?mode=signup&error=Veuillez+remplir+tous+les+champs");
  }

  const supabase = await createSupabaseServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Stocker org_name + full_name dans le user_metadata. getOrgId() les
      // utilisera au premier login pour créer la VRAIE org du nouveau user
      // (sans tomber sur le fallback "first org" buggy d'avant).
      data: { full_name: fullName, org_name: orgName },
      // Lien de confirmation email pointe vers Revold (pas la page Vercel
      // par défaut). Nécessite que /auth/callback soit dans la liste des
      // Redirect URLs configurés sur Supabase Dashboard.
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  }

  if (data.user && !data.user.identities?.length) {
    redirect("/login?error=Cet+email+est+déjà+utilisé");
  }

  // ⚠ NE PAS créer org + profile ici. À ce stade le user n'est pas encore
  // authentifié (en attente de confirmation email), donc les inserts
  // tomberaient sous RLS de manière imprévisible. La création réelle de
  // l'org se fait au premier accès dashboard via getOrgId() qui lit
  // user_metadata.org_name. C'est plus robuste et évite les états orphelins.

  // Si email confirm DISABLED dans Supabase → session immédiate → dashboard
  // Si email confirm ENABLED → user doit cliquer le lien → /auth/callback
  if (data.session) {
    redirect("/dashboard");
  }
  redirect("/login?check_email=1");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
