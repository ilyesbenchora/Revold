import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DealsAtRiskPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  const orgId = profile?.organization_id;

  const { data: deals } = await supabase
    .from("deals")
    .select("*, companies(name), pipeline_stages(name)")
    .eq("organization_id", orgId)
    .eq("is_at_risk", true)
    .order("amount", { ascending: false });

  // Get related insights for at-risk deals
  const dealIds = (deals ?? []).map((d) => d.id);
  const { data: insights } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("organization_id", orgId)
    .in("deal_id", dealIds.length > 0 ? dealIds : ["none"]);

  const insightsByDeal = new Map<string, typeof insights>();
  (insights ?? []).forEach((i) => {
    if (!i.deal_id) return;
    const existing = insightsByDeal.get(i.deal_id) ?? [];
    existing.push(i);
    insightsByDeal.set(i.deal_id, existing);
  });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Deals à risque</h1>
        <p className="mt-1 text-sm text-slate-600">
          {deals?.length ?? 0} deal{(deals?.length ?? 0) > 1 ? "s" : ""} identifié{(deals?.length ?? 0) > 1 ? "s" : ""} comme à risque.
        </p>
      </header>

      {(!deals || deals.length === 0) && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-sm font-medium text-emerald-800">
            Aucun deal à risque. Votre pipeline est en bonne santé.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {(deals ?? []).map((deal) => {
          const companyName = (deal.companies as unknown as { name: string } | null)?.name;
          const stageName = (deal.pipeline_stages as unknown as { name: string } | null)?.name;
          const risks: string[] = Array.isArray(deal.risk_reasons) ? deal.risk_reasons : [];
          const dealInsights = insightsByDeal.get(deal.id) ?? [];

          return (
            <article
              key={deal.id}
              className="card overflow-hidden border-red-200"
            >
              <div className="border-b border-red-100 bg-red-50 px-6 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{deal.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {companyName && <span>{companyName} · </span>}
                      {stageName && <span>Étape : {stageName} · </span>}
                      {deal.days_in_stage > 0 && <span>{deal.days_in_stage}j dans cette étape</span>}
                    </p>
                  </div>
                  <span className="text-xl font-bold text-slate-900">
                    €{Number(deal.amount).toLocaleString("fr-FR")}
                  </span>
                </div>
              </div>

              <div className="px-6 py-4 space-y-3">
                {/* Risk reasons */}
                {risks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-700">Raisons du risque</p>
                    <ul className="mt-2 space-y-1">
                      {risks.map((reason, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* AI Insights for this deal */}
                {dealInsights.length > 0 && (
                  <div className="rounded-lg border border-indigo-200 bg-accent-soft p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Insight IA</p>
                    {dealInsights.map((ins) => (
                      <div key={ins.id} className="mt-2">
                        <p className="text-sm font-medium text-indigo-950">{ins.title}</p>
                        {ins.recommendation && (
                          <p className="mt-1 text-sm text-indigo-800">{ins.recommendation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Metadata */}
                <div className="flex gap-4 text-xs text-slate-500">
                  {deal.close_date && (
                    <span>
                      Close prévue : {new Date(deal.close_date).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                  {deal.last_activity_at && (
                    <span>
                      Dernière activité : {new Date(deal.last_activity_at).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                  {deal.win_probability != null && (
                    <span>Probabilité : {(Number(deal.win_probability) * 100).toFixed(0)}%</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
