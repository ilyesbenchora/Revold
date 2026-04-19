export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type Deal = {
  id: string;
  name: string;
  amount: number;
  company_name: string | null;
  close_date: string | null;
  is_at_risk: boolean;
  days_in_stage: number;
};

type Stage = {
  id: string;
  name: string;
  position: number;
  probability: number;
  is_closed_won: boolean;
  is_closed_lost: boolean;
  deals: Deal[];
  total: number;
};

export default async function PipelinePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  const orgId = profile?.organization_id;

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("organization_id", orgId)
    .order("position");

  const { data: deals } = await supabase
    .from("deals")
    .select("id, name, amount, close_date, is_at_risk, days_in_stage, stage_id, companies(name)")
    .eq("organization_id", orgId);

  // Group deals by stage
  const stageMap: Stage[] = (stages ?? []).map((stage) => {
    const stageDeals = (deals ?? [])
      .filter((d) => d.stage_id === stage.id)
      .map((d) => ({
        id: d.id,
        name: d.name,
        amount: Number(d.amount),
        company_name: (d.companies as unknown as { name: string } | null)?.name ?? null,
        close_date: d.close_date,
        is_at_risk: d.is_at_risk ?? false,
        days_in_stage: d.days_in_stage ?? 0,
      }));

    return {
      ...stage,
      probability: Number(stage.probability),
      deals: stageDeals,
      total: stageDeals.reduce((sum, d) => sum + d.amount, 0),
    };
  });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
        <p className="mt-1 text-sm text-slate-600">
          Visualisation des deals par étape du pipeline.
        </p>
      </header>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stageMap.map((stage) => (
          <div
            key={stage.id}
            className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-card-border bg-white"
          >
            {/* Stage header */}
            <div className="border-b border-card-border px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{stage.name}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {stage.deals.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {stage.probability}% · €{(stage.total / 1000).toFixed(0)}K
              </p>
            </div>

            {/* Deals */}
            <div className="flex-1 space-y-2 p-3">
              {stage.deals.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-400">Aucun deal</p>
              )}
              {stage.deals.map((deal) => (
                <div
                  key={deal.id}
                  className={`rounded-lg border p-3 text-sm transition hover:shadow-sm ${
                    deal.is_at_risk
                      ? "border-red-200 bg-red-50"
                      : "border-card-border bg-white"
                  }`}
                >
                  <p className="font-medium text-slate-900">{deal.name}</p>
                  {deal.company_name && (
                    <p className="mt-0.5 text-xs text-slate-500">{deal.company_name}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">
                      €{deal.amount.toLocaleString("fr-FR")}
                    </span>
                    {deal.close_date && (
                      <span className="text-xs text-slate-400">
                        {new Date(deal.close_date).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    )}
                  </div>
                  {deal.is_at_risk && (
                    <span className="mt-2 inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                      À risque
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
