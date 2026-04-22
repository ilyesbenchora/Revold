export const dynamic = "force-dynamic";

import Link from "next/link";
import { getHubspotSnapshot } from "@/lib/supabase/cached";
import { buildAuditRecommendations, SUBCATEGORY_LABELS } from "@/lib/audit/recommendations-library";
import { RecommendationCard } from "@/components/recommendation-card";
import { ServiceClientTabs } from "@/components/service-client-tabs";

export default async function ServiceClientRecommandationsPage() {
  const snapshot = await getHubspotSnapshot();
  const recommendations = buildAuditRecommendations(snapshot).performances.filter(
    (r) => r.subcategory === "service_client",
  );

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Service Client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Recommandations CRO/RevOps pour optimiser onboarding, churn, expansion et renouvellement.
        </p>
      </header>

      <ServiceClientTabs />

      {recommendations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-10 text-center">
          <p className="text-sm font-semibold text-emerald-800">Aucune recommandation détectée</p>
          <p className="mt-1 text-xs text-emerald-700">
            Vos KPIs service client (CSAT, churn, renouvellement) sont dans les benchmarks.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50/60 to-indigo-50/40 p-4">
            <p className="text-sm font-semibold text-fuchsia-900">
              ✨ {recommendations.length} recommandation{recommendations.length > 1 ? "s" : ""} CRO/RevOps détectée{recommendations.length > 1 ? "s" : ""} —{" "}
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-700">
                {SUBCATEGORY_LABELS.service_client.emoji} {SUBCATEGORY_LABELS.service_client.label}
              </span>
            </p>
            <p className="mt-1 text-xs text-fuchsia-800">
              Activez chaque reco pour la transformer en coaching IA dans Coaching IA → Cross-Source.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {recommendations.map((reco) => (
              <RecommendationCard key={reco.id} reco={reco} />
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Voir toutes les recommandations toutes catégories confondues ?{" "}
            <Link href="/dashboard/audit/recommandations" className="font-medium text-accent hover:underline">
              Page Recommandations IA globale →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
