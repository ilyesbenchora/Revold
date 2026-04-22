export const dynamic = "force-dynamic";

import { getHubspotSnapshot } from "@/lib/supabase/cached";
import { buildAuditRecommendations } from "@/lib/audit/recommendations-library";
import { RecommendationCard } from "@/components/recommendation-card";

export default async function RecommandationsServiceClientPage() {
  const snapshot = await getHubspotSnapshot();
  const recs = buildAuditRecommendations(snapshot).performances.filter(
    (r) => r.subcategory === "service_client",
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/40 p-4">
        <p className="text-sm font-semibold text-fuchsia-900">🎧 Service Client</p>
        <p className="mt-1 text-xs text-fuchsia-800">
          {recs.length} recommandation{recs.length > 1 ? "s" : ""} CRO/RevOps sur les tickets, CSAT/NPS,
          signaux churn et process renouvellement.
        </p>
      </div>

      {recs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Service Client bien géré</p>
          <p className="mt-1 text-xs text-slate-500">
            Aucune anomalie majeure détectée sur le support, la satisfaction et la rétention.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {recs.map((reco) => (
            <RecommendationCard key={reco.id} reco={reco} />
          ))}
        </div>
      )}
    </div>
  );
}
