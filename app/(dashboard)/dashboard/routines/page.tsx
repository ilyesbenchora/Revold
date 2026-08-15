import { RoutinesReports } from "@/components/agents/routines-reports";
import { DashboardTabs } from "@/components/dashboard-tabs";

export const dynamic = "force-dynamic";

/**
 * Dashboard → Routines : tous les rapports produits automatiquement par les
 * routines des agents, regroupés par routine. Les rapports enregistrés à la
 * main vivent dans l'onglet « Mes rapports ».
 */
export default function RoutinesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Routines</h1>
        <p className="mt-1 text-sm text-slate-500">
          Les rapports générés automatiquement par tes routines, regroupés par routine. Chaque exécution dépose son
          rapport ici — le câblage reste corrigeable et la correction est conservée.
        </p>
      </header>

      <DashboardTabs />

      <RoutinesReports />
    </div>
  );
}
