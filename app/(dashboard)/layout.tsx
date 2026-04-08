import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthUser, getProfile, getLatestKpi, getHubspotIntegrationScore } from "@/lib/supabase/cached";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  const org = profile?.organizations as unknown as { name: string } | null;
  const orgName = org?.name ?? "Mon entreprise";

  const [latestKpi, hubspotIntegrationScore] = await Promise.all([
    getLatestKpi(),
    getHubspotIntegrationScore(),
  ]);

  // Header now only shows the HubSpot integration score. Fallback on the
  // legacy KPI-based formula if HubSpot isn't connected yet.
  let integrationScore: number | undefined;
  if (hubspotIntegrationScore != null) {
    integrationScore = hubspotIntegrationScore;
  } else if (latestKpi) {
    const crm = Number(latestKpi.crm_ops_score) || 0;
    const dataComp = Number(latestKpi.data_completeness) || 0;
    integrationScore = Math.round(dataComp * 0.4 + crm * 0.6);
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader companyName={orgName} integrationScore={integrationScore} />
      <div className="mx-auto flex w-full max-w-[1400px]">
        <DashboardSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
