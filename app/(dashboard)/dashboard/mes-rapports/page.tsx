import { MesRapports } from "@/components/agents/mes-rapports";

export const dynamic = "force-dynamic";

export default function MesRapportsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Mes rapports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Les rapports que tu as enregistrés depuis les agents, regroupés par agent.
        </p>
      </div>
      <MesRapports />
    </div>
  );
}
