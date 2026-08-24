import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { poleToWorkspace, isPathAllowed } from "@/lib/workspaces";
import { getAuthUser, getProfile, getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { DashboardHeader, type ConnectedBadge } from "@/components/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ActiveChatBanner } from "@/components/active-chat-banner";
import { TowerQueue } from "@/components/voice/tower-queue";
import { EnrichmentBackgroundRunner } from "@/components/enrichment-background-runner";
import { OrgSetupModal } from "@/components/org-setup-modal";
import { isNewUser } from "@/lib/onboarding/is-new-user";

// Les badges du header reflètent l'état réel des connexions par org →
// pas de cache.
export const dynamic = "force-dynamic";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  const org = profile?.organizations as unknown as { name: string } | null;
  const orgName = org?.name ?? "Mon entreprise";

  // POC espaces de travail : rôle + pôle du membre pour filtrer la navigation,
  // + effectifs par pôle (affichés dans le switcher d'espace).
  let role: string | null = null;
  let pole: string | null = null;
  const memberCounts: Record<string, number> = {};
  try {
    const supa = await createSupabaseServerClient();
    const orgId = await getOrgId();
    const first = await supa.from("profiles").select("role, pole").eq("id", user.id).maybeSingle();
    let prof = first.data as { role?: string | null; pole?: string | null } | null;
    // Résilience : colonne pole absente (migration non appliquée).
    if (first.error && /pole/.test(first.error.message)) {
      const fb = await supa.from("profiles").select("role").eq("id", user.id).maybeSingle();
      prof = fb.data as { role?: string | null } | null;
    }
    role = prof?.role ?? null;
    pole = prof?.pole ?? null;

    if (orgId) {
      const all = await supa.from("profiles").select("pole").eq("organization_id", orgId);
      const rows = (all.data as { pole?: string | null }[] | null) ?? [];
      memberCounts.all = rows.length;
      for (const r of rows) {
        const key = r.pole ?? "";
        if (key) memberCounts[key] = (memberCounts[key] ?? 0) + 1;
      }
    }
  } catch {
    /* défaut : accès global */
  }

  // ── Contrôle d'accès SERVEUR par espace de travail ──
  // Un membre (non-admin) rattaché à un pôle ne peut pas ouvrir une page hors
  // de son espace en tapant l'URL : redirection vers la vue d'ensemble. Le
  // pathname vient du middleware (header x-pathname).
  if (role !== "admin") {
    const memberWs = poleToWorkspace(pole);
    if (memberWs) {
      const pathname = (await headers()).get("x-pathname") ?? "";
      if (pathname && !isPathAllowed(memberWs, pathname)) redirect("/dashboard");
    }
  }

  // Accès aux pages par équipe (Paramètres → Utilisateurs & équipes) : la
  // Visualisation pilote la sidebar. Résilient si la migration est absente.
  const pageAccess: Record<string, Record<string, boolean>> = {};
  try {
    const supa = await createSupabaseServerClient();
    const orgId = await getOrgId();
    if (orgId) {
      const { data } = await supa.from("page_access").select("page_href, access").eq("organization_id", orgId);
      for (const r of data ?? []) {
        const row = r as { page_href: string; access: Record<string, { view?: boolean }> | null };
        if (!row.page_href || !row.access) continue;
        const viewByTeam: Record<string, boolean> = {};
        for (const team of ["sales", "marketing", "cs", "finance"]) {
          const v = row.access[team]?.view;
          if (typeof v === "boolean") viewByTeam[team] = v;
        }
        if (Object.keys(viewByTeam).length > 0) pageAccess[row.page_href] = viewByTeam;
      }
    }
  } catch {
    /* table absente → accès par défaut des espaces */
  }

  // Liste des outils RÉELLEMENT connectés à Revold pour CETTE org.
  // Source unique : table integrations (is_active=true). Aucun fallback
  // env var dans le badge — c'est la vérité multi-tenant par org.
  const connectedTools: ConnectedBadge[] = [];
  try {
    const [supabase, orgId] = await Promise.all([createSupabaseServerClient(), getOrgId()]);
    if (orgId) {
      const { data } = await supabase
        .from("integrations")
        .select("provider, refresh_token, portal_id")
        .eq("organization_id", orgId)
        .eq("is_active", true);

      for (const row of data ?? []) {
        // Pour HubSpot OAuth, on exige refresh_token + portal_id (vrai OAuth).
        // Pour les autres providers (API key), is_active suffit.
        if (row.provider === "hubspot" && (!row.refresh_token || !row.portal_id)) continue;
        const tool = CONNECTABLE_TOOLS[row.provider];
        if (tool) {
          connectedTools.push({ key: tool.key, label: tool.label, domain: tool.domain, icon: tool.icon });
        }
      }
    }
  } catch {}

  // ── Onboarding : modale bloquante réservée à la PREMIÈRE connexion d'un
  // nouveau compte — jamais pour un compte existant. setup_completed est le
  // marqueur (backfillé à vrai pour les orgs antérieures) ; les champs
  // manquants seuls ne suffisent plus à la déclencher. Le NOM est saisi par
  // l'utilisateur : le fallback auto (« Org de x ») n'est jamais pré-rempli.
  // Résilient : colonnes absentes → pas de modale.
  let orgSetupName: string | null = null;
  try {
    const supa = await createSupabaseServerClient();
    const orgId = await getOrgId();
    if (orgId) {
      const { data: orgRow, error: orgRowErr } = await supa
        .from("organizations")
        .select("name, employees_range, industry, setup_completed")
        .eq("id", orgId)
        .maybeSingle();
      if (!orgRowErr && orgRow && orgRow.setup_completed !== true && (!orgRow.employees_range || !orgRow.industry)) {
        const n = (orgRow.name as string | null) ?? "";
        orgSetupName = /^org de /i.test(n) || n === "Mon organisation" ? "" : n;
      }
    }
  } catch {
    /* migration org_infos/setup_completed non appliquée → pas de modale */
  }

  // ── Mini-tutoriels (FeatureTour) : réservés aux NOUVEAUX comptes (fenêtre
  // 48 h après création) — un client existant ne les voit jamais, quel que
  // soit l'état de son localStorage. Le marqueur DOM est lu par FeatureTour.
  let toursEligible = false;
  try {
    const supa = await createSupabaseServerClient();
    toursEligible = await isNewUser(supa);
  } catch { /* au moindre doute : pas de tutoriel */ }

  return (
    // .dashboard-shell : périmètre du mode sombre violet (Paramètres → Apparence).
    <div className="dashboard-shell min-h-screen bg-background">
      <DashboardHeader companyName={orgName} connectedTools={connectedTools} />
      <div className="flex w-full">
        <DashboardSidebar role={role} pole={pole} memberCounts={memberCounts} pageAccess={pageAccess} />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
      {orgSetupName !== null && <OrgSetupModal initialName={orgSetupName} />}
      {/* Marqueur d'éligibilité aux tutoriels — absent = aucun tour ne démarre. */}
      {toursEligible && <span id="feature-tours-eligible" hidden />}
      <ActiveChatBanner />
      {/* Demandes vocales en attente (tour de contrôle multi-agents) */}
      <TowerQueue />
      {/* Enrichissement : avance quelle que soit la page consultée (sans UI) */}
      <EnrichmentBackgroundRunner />
    </div>
  );
}
