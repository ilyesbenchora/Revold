import { MesRapports } from "@/components/agents/mes-rapports";
import { DashboardTabs } from "@/components/dashboard-tabs";

export const dynamic = "force-dynamic";

export default function MesRapportsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mes rapports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tes rapports enregistrés qui ne sont rattachés à aucune page. Corrige leur câblage si besoin — la correction
          est conservée — puis range-les sur la page adéquate : leurs blocs y deviennent de vraies tables de données.
        </p>
      </header>

      <DashboardTabs />

      <MesRapports />
    </div>
  );
}
