export const dynamic = "force-dynamic";

import { getHubspotSnapshot } from "@/lib/supabase/cached";
import { buildAuditRecommendations, SUBCATEGORY_LABELS } from "@/lib/audit/recommendations-library";
import type { RecoSubcategory } from "@/lib/audit/recommendations-library";
import { RecommendationCard } from "@/components/recommendation-card";

const SECTIONS: Array<{ key: RecoSubcategory; description: string }> = [
  { key: "ventes", description: "Closing rate, pipeline coverage, vélocité, deals stagnants, forecast" },
  { key: "marketing", description: "Lead → MQL, conversion, attribution, campaigns, lead scoring" },
  { key: "paiement", description: "Réconciliation deals ↔ factures, recouvrement, MRR/ARR, subscriptions" },
  { key: "service_client", description: "Tickets, CSAT/NPS, churn signals, process renewal" },
];

export default async function RecommandationsPerformancesPage() {
  const snapshot = await getHubspotSnapshot();
  const all = buildAuditRecommendations(snapshot).performances;

  const bySubcategory = SECTIONS.map(({ key, description }) => ({
    key,
    description,
    meta: SUBCATEGORY_LABELS[key],
    recs: all.filter((r) => r.subcategory === key),
  }));

  const total = all.length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/40 p-4">
        <p className="text-sm font-semibold text-fuchsia-900">📈 Performances — recommandations par équipe</p>
        <p className="mt-1 text-xs text-fuchsia-800">
          {total} recommandation{total > 1 ? "s" : ""} groupées par équipe (Ventes / Marketing / Paiement &amp; Facturation / Service Client).
        </p>
      </div>

      {bySubcategory.map(({ key, description, meta, recs }) => (
        <section key={key} className="space-y-3">
          <header className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span className={`inline-flex h-7 items-center rounded-full bg-gradient-to-r ${meta.gradient} px-2.5 text-[10px] font-bold uppercase tracking-wide text-white`}>
                  {meta.emoji} {meta.label}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {recs.length}
                </span>
              </h3>
              <p className="mt-1 text-xs text-slate-500">{description}</p>
            </div>
          </header>

          {recs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
              Aucune recommandation pour cette équipe — performances dans les benchmarks.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {recs.map((reco) => (
                <RecommendationCard key={reco.id} reco={reco} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
