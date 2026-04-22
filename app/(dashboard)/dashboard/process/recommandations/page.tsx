export const dynamic = "force-dynamic";

import Link from "next/link";
import { getHubspotSnapshot } from "@/lib/supabase/cached";
import { buildAuditRecommendations } from "@/lib/audit/recommendations-library";
import { RecommendationCard } from "@/components/recommendation-card";
import { AuditPageTabs } from "@/components/audit-page-tabs";

export default async function ProcessRecommandationsPage() {
  const snapshot = await getHubspotSnapshot();
  const recommendations = buildAuditRecommendations(snapshot).process;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Automatisations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Recommandations CRO/RevOps pour optimiser vos workflows et lifecycle stages.
        </p>
      </header>

      <AuditPageTabs
        tabs={[
          { href: "/dashboard/process", label: "Vue d'ensemble" },
          { href: "/dashboard/process/recommandations", label: "Recommandations", highlight: true },
        ]}
      />

      {recommendations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-10 text-center">
          <p className="text-sm font-semibold text-emerald-800">Aucune recommandation détectée</p>
          <p className="mt-1 text-xs text-emerald-700">
            Vos automatisations sont alignées avec les benchmarks RevOps.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50/60 to-indigo-50/40 p-4">
            <p className="text-sm font-semibold text-fuchsia-900">
              ✨ {recommendations.length} recommandation{recommendations.length > 1 ? "s" : ""} CRO/RevOps détectée{recommendations.length > 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-xs text-fuchsia-800">
              Cliquez sur &laquo; Activer le coaching IA &raquo; pour transformer une reco en coaching actionnable
              (Coaching IA → Ventes ou Marketing selon la catégorie).
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
