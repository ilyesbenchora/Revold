import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthUser, getProfile, getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

// Le badge "CRM HubSpot Connecté/Non connecté" du header doit refléter l'état
// réel après chaque connect/disconnect → pas de cache.
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

  // Check if HubSpot is connected to Revold
  let hubspotConnected = false;
  try {
    const [supabase, orgId] = await Promise.all([createSupabaseServerClient(), getOrgId()]);
    if (orgId) {
      const token = await getHubSpotToken(supabase, orgId);
      hubspotConnected = token != null && token.length > 15;
    }
  } catch {}

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader companyName={orgName} hubspotConnected={hubspotConnected} />
      <div className="mx-auto flex w-full max-w-[1400px]">
        <DashboardSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
