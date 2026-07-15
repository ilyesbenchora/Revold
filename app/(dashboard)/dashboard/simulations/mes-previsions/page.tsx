import Link from "next/link";
import { MesPrevisions } from "@/components/agents/mes-previsions";

export const dynamic = "force-dynamic";

export default function MesPrevisionsPage() {
  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mes prévisions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Toutes les projections enregistrées depuis le chat de tes agents de prévisions, regroupées par agent.
          </p>
        </div>
        <Link
          href="/dashboard/simulations"
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-card-border px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          + Nouvelle prévision
        </Link>
      </header>

      <MesPrevisions />
    </section>
  );
}
