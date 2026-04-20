export const dynamic = "force-dynamic";

import { getHubspotSnapshot } from "@/lib/supabase/cached";
import { buildAuditRecommendations } from "@/lib/audit/recommendations-library";
import { RecommendationCard } from "@/components/recommendation-card";

export default async function RecommandationsDonneesPage() {
  const snapshot = await getHubspotSnapshot();
  const recs = buildAuditRecommendations(snapshot).donnees;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
        <p className="text-sm font-semibold text-emerald-900">🗂️ Données — fiabiliser la base</p>
        <p className="mt-1 text-xs text-emerald-800">
          {recs.length} recommandation{recs.length > 1 ? "s" : ""} CRO/RevOps détectée{recs.length > 1 ? "s" : ""} sur la qualité, l&apos;enrichissement et la gouvernance des données CRM.
        </p>
      </div>

      {recs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Données en bon état</p>
          <p className="mt-1 text-xs text-slate-500">
            Aucune anomalie majeure détectée selon les benchmarks B2B (orphelins, complétude, doublons).
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
