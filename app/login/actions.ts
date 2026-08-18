"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

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

export async function googleAction() {
  const supabase = await createSupabaseServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // OAuth Google via Supabase (PKCE) : le code verifier est posé en cookie par
  // @supabase/ssr, l'échange se fait au retour sur /auth/callback (déjà en
  // place). Marche pour la connexion ET l'inscription : un compte Google
  // inconnu est créé au premier passage (getOrgId crée l'org au 1er accès
  // dashboard — fallback « Org de <user> » sans org_name).
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data?.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "Connexion Google indisponible")}`);
  }
  redirect(data.url);
}

// ── Connexion par email (code à 6 chiffres) ─────────────────────────────────
// 1. emailOtpAction : envoie le code (crée le compte si l'email est inconnu).
// 2. verifyOtpAction : vérifie le code → session ; nouveau compte sans
//    entreprise renseignée → formulaire (mode=entreprise), sinon dashboard.
// 3. completeProfileAction : nom d'entreprise + effectif + secteur (tous
//    obligatoires) → user_metadata + organisation, puis dashboard.
// ⚠ Le template d'email « Magic Link » de Supabase doit contenir {{ .Token }}
//    pour que le code à 6 chiffres apparaisse dans l'email.

export async function emailOtpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?error=Renseigne+ton+email");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(`/login?mode=otp&email=${encodeURIComponent(email)}`);
}

export async function verifyOtpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  if (!email) redirect("/login?error=Email+manquant");
  if (!/^\d{6}$/.test(code)) {
    redirect(`/login?mode=otp&email=${encodeURIComponent(email)}&error=Le+code+comporte+6+chiffres`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    redirect(`/login?mode=otp&email=${encodeURIComponent(email)}&error=Code+invalide+ou+expiré`);
  }

  // Compte déjà installé (profil existant ou entreprise déjà renseignée) →
  // dashboard direct ; sinon, formulaire entreprise obligatoire.
  const { data: { user } } = await supabase.auth.getUser();
  const meta = user?.user_metadata as { org_name?: string } | null;
  let hasProfile = false;
  if (user) {
    try {
      const { data: p } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
      hasProfile = Boolean(p);
    } catch {}
  }
  if (hasProfile || meta?.org_name?.trim()) redirect("/dashboard");
  // L'email est repassé au formulaire entreprise : affiché en lecture seule et
  // associé au mot de passe pour que le navigateur propose de l'enregistrer.
  redirect(`/login?mode=entreprise&email=${encodeURIComponent(email)}`);
}

export async function completeProfileAction(formData: FormData) {
  const orgName = String(formData.get("org_name") ?? "").trim();
  const employees = String(formData.get("employees_range") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  if (!orgName || !employees || !industry || !password) {
    redirect("/login?mode=entreprise&error=Tous+les+champs+sont+obligatoires");
  }
  if (password.length < 8) {
    redirect("/login?mode=entreprise&error=Le+mot+de+passe+doit+faire+au+moins+8+caractères");
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=Session+expirée+—+reconnecte-toi");

  // Mot de passe (connexions futures par mot de passe possibles) + métadonnées
  // en un appel : getOrgId() lit org_name pour nommer la vraie org.
  const { error } = await supabase.auth.updateUser({
    password,
    data: { org_name: orgName, employees_range: employees, industry },
  });
  if (error) redirect(`/login?mode=entreprise&error=${encodeURIComponent(error.message)}`);

  // Crée l'organisation maintenant, puis y range effectif + secteur (best
  // effort : les infos restent dans user_metadata si la colonne manque).
  try {
    const orgId = await getOrgId();
    if (orgId) {
      await supabase
        .from("organizations")
        .update({ employees_range: employees, industry })
        .eq("id", orgId);
    }
  } catch {}

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
