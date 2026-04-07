import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthUser, getProfile, getLatestKpi } from "@/lib/supabase/cached";
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

  const latestKpi = await getLatestKpi();

  let globalScore: number | undefined;
  let integrationScore: number | undefined;

  if (latestKpi) {
    const sales = Number(latestKpi.sales_score) || 0;
    const marketing = Number(latestKpi.marketing_score) || 0;
    const crm = Number(latestKpi.crm_ops_score) || 0;
    const dataComp = Number(latestKpi.data_completeness) || 0;
    const dupesPct = Number(latestKpi.duplicate_contacts_pct) || 0;
    const orphansPct = Number(latestKpi.orphan_contacts_pct) || 0;
    const donneesScore = Math.round(
      dataComp * 0.5 + Math.max(0, 100 - dupesPct * 5) * 0.25 + Math.max(0, 100 - orphansPct * 3) * 0.25
    );
    const inactivePct = Number(latestKpi.inactive_deals_pct) || 0;
    const stagnationPct = Number(latestKpi.deal_stagnation_rate) || 0;
    const actPerDeal = Number(latestKpi.activities_per_deal) || 0;
    const cycleDays = Number(latestKpi.sales_cycle_days) || 0;
    const processScore = Math.round(
      Math.max(0, (1 - inactivePct / 50) * 100) * 0.30 +
      Math.max(0, (1 - stagnationPct / 40) * 100) * 0.30 +
      Math.min(100, (actPerDeal / 12) * 100) * 0.20 +
      Math.min(100, Math.max(0, (1 - (cycleDays - 30) / 90) * 100)) * 0.20
    );
    integrationScore = Math.round(dataComp * 0.4 + crm * 0.6);
    globalScore = Math.round(
      donneesScore * 0.20 + processScore * 0.20 + sales * 0.25 + marketing * 0.20 + integrationScore * 0.15
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader companyName={orgName} globalScore={globalScore} integrationScore={integrationScore} />
      <div className="mx-auto flex w-full max-w-[1400px]">
        <DashboardSidebar />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
