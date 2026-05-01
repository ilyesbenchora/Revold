/**
 * Page d'acceptation d'invitation (magic link).
 *
 * URL : /auth/invitation?token=xxx
 *
 * 3 cas :
 *   - Token invalide / expiré / révoqué → message d'erreur
 *   - User déjà connecté avec une autre org → confirmation puis création profile
 *   - User non connecté → redirige vers signup avec token en query
 */

import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Lien d&apos;invitation invalide</h1>
        <p className="mt-3 text-sm text-slate-600">Aucun token fourni dans l&apos;URL.</p>
      </main>
    );
  }

  const supabase = adminClient();
  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, organization_id, email, role, accepted_at, expires_at, revoked_at, organizations(name)")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Invitation introuvable</h1>
        <p className="mt-3 text-sm text-slate-600">Ce lien n&apos;est pas reconnu. Demandez une nouvelle invitation à votre administrateur.</p>
      </main>
    );
  }

  if (invitation.accepted_at) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Invitation déjà utilisée</h1>
        <p className="mt-3 text-sm text-slate-600">Connectez-vous normalement avec votre email.</p>
        <a href="/login" className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white">Se connecter</a>
      </main>
    );
  }
  if (invitation.revoked_at) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Invitation révoquée</h1>
        <p className="mt-3 text-sm text-slate-600">Cette invitation a été annulée par l&apos;administrateur.</p>
      </main>
    );
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Invitation expirée</h1>
        <p className="mt-3 text-sm text-slate-600">Demandez à votre administrateur d&apos;en générer une nouvelle.</p>
      </main>
    );
  }

  // Si user déjà connecté avec le bon email, on peut accepter directement
  const userClient = await createSupabaseServerClient();
  const { data: auth } = await userClient.auth.getUser();
  const orgRows = invitation.organizations as Array<{ name: string }> | { name: string } | null;
  const orgName = Array.isArray(orgRows) ? orgRows[0]?.name : orgRows?.name;
  const safeOrgName = orgName ?? "votre organisation";

  if (auth.user && auth.user.email?.toLowerCase() === invitation.email.toLowerCase()) {
    // Crée/migre le profile vers la nouvelle org
    await supabase.from("profiles").upsert({
      id: auth.user.id,
      organization_id: invitation.organization_id,
      full_name: auth.user.user_metadata?.full_name ?? auth.user.email?.split("@")[0] ?? "Utilisateur",
      role: invitation.role,
    });
    await supabase
      .from("invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);
    await supabase.from("audit_log").insert({
      organization_id: invitation.organization_id,
      actor_id: auth.user.id,
      action: "member.invitation_accepted",
      target_type: "invitation",
      target_id: invitation.id,
    });
    redirect("/dashboard");
  }

  // Sinon : redirige vers signup avec email pré-rempli + token gardé
  redirect(`/essai-gratuit?email=${encodeURIComponent(invitation.email)}&inviteToken=${token}`);

  // Cette ligne est inatteignable mais TypeScript ne le comprend pas
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Invitation à rejoindre {safeOrgName}</h1>
      <p className="mt-3 text-sm text-slate-600">Redirection en cours…</p>
    </main>
  );
}
