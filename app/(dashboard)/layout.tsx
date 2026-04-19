import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthUser, getProfile, getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { DashboardHeader, type ConnectedBadge } from "@/components/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

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

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader companyName={orgName} connectedTools={connectedTools} />
      <div className="mx-auto flex w-full max-w-[1400px]">
        <DashboardSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
