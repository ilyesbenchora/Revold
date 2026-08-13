export const dynamic = "force-dynamic";

import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ParametresTabs } from "@/components/parametres-tabs";
import { TeamManagement } from "@/components/team-management";
import { PageAccessSettings } from "@/components/page-access-settings";
import { getCurrentRole } from "@/lib/auth/rbac";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  rep: "Commercial",
};

export default async function EquipePage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const myRole = userId ? await getCurrentRole(supabase, userId) : null;

  const membersRes = await supabase
    .from("profiles")
    .select("id, full_name, role, pole, created_at")
    .eq("organization_id", orgId)
    .order("created_at");
  // Résilience : colonne pole absente (migration non appliquée).
  let members = membersRes.data as
    | Array<{ id: string; full_name: string; role: string; pole?: string | null; created_at: string | null }>
    | null;
  if (membersRes.error && /pole/.test(membersRes.error.message)) {
    const fb = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("organization_id", orgId)
      .order("created_at");
    members = fb.data as typeof members;
  }
  // Règles d'accès par page (matrice Utilisateurs & équipes) — résilient si la
  // migration page_access n'est pas appliquée (aucune règle).
  let accessRules: Record<string, Record<string, Record<string, boolean>>> = {};
  try {
    const { data: rows } = await supabase
      .from("page_access")
      .select("page_href, access")
      .eq("organization_id", orgId);
    for (const r of rows ?? []) {
      const row = r as { page_href: string; access: Record<string, Record<string, boolean>> | null };
      if (row.page_href && row.access) accessRules[row.page_href] = row.access;
    }
  } catch {
    accessRules = {};
  }

  const { data: pending } = await supabase
    .from("invitations")
    .select("id, email, role, expires_at, created_at")
    .eq("organization_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Utilisateurs &amp; équipes : invitations, rôles, pôles, et accès aux pages par équipe. Le pôle définit l&apos;espace de travail du membre (Ventes, Marketing, Service client, Comptabilité) ; la matrice ci-dessous affine, page par page, ce que chaque équipe peut voir, modifier ou créer. L&apos;admin garde l&apos;accès à tous les espaces (switcher en haut de la barre latérale).
        </p>
      </header>

      <ParametresTabs />

      <TeamManagement
        myUserId={userId}
        myRole={myRole}
        members={(members ?? []).map((m) => ({
          id: m.id as string,
          fullName: m.full_name as string,
          role: m.role as string,
          roleLabel: ROLE_LABEL[m.role as string] ?? m.role as string,
          pole: (m.pole as string | null | undefined) ?? null,
          createdAt: m.created_at as string | null,
        }))}
        pending={(pending ?? []).map((p) => ({
          id: p.id as string,
          email: p.email as string,
          role: p.role as string,
          roleLabel: ROLE_LABEL[p.role as string] ?? p.role as string,
          expiresAt: p.expires_at as string,
          createdAt: p.created_at as string,
        }))}
      />

      {/* ── Accès par page et par équipe (visualisation / modification / création) ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">Accès aux pages par équipe</h2>
        <p className="text-sm text-slate-500">
          Choisis, pour chaque page, ce que chaque équipe de l&apos;espace de travail peut faire. La visualisation
          pilote la navigation ; sans réglage, une page suit l&apos;accès par défaut de l&apos;espace.
        </p>
        <PageAccessSettings initialRules={accessRules} />
      </div>
    </section>
  );
}
