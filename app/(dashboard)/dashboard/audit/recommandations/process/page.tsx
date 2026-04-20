export const dynamic = "force-dynamic";

import { getHubspotSnapshot } from "@/lib/supabase/cached";
import { buildAuditRecommendations } from "@/lib/audit/recommendations-library";
import { RecommendationCard } from "@/components/recommendation-card";

export default async function RecommandationsProcessPage() {
  const snapshot = await getHubspotSnapshot();
  const recs = buildAuditRecommendations(snapshot).process;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
        <p className="text-sm font-semibold text-indigo-900">⚙️ Process & Alignement — fluidifier le funnel</p>
        <p className="mt-1 text-xs text-indigo-800">
          {recs.length} recommandation{recs.length > 1 ? "s" : ""} sur les workflows, lifecycle stages, MEDDIC/BANT, handoff Marketing→Sales et rituels.
        </p>
      </div>

      {recs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Process en place</p>
          <p className="mt-1 text-xs text-slate-500">
            Workflows, sequences et lifecycle stages correctement configurés selon les benchmarks.
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
