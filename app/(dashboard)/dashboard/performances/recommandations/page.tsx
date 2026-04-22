export const dynamic = "force-dynamic";

import Link from "next/link";
import { getHubspotSnapshot } from "@/lib/supabase/cached";
import { buildAuditRecommendations, SUBCATEGORY_LABELS } from "@/lib/audit/recommendations-library";
import type { RecoSubcategory } from "@/lib/audit/recommendations-library";
import { RecommendationCard } from "@/components/recommendation-card";
import { PerformancesTabs } from "@/components/performances-tabs";

const SECTIONS: Array<{ key: RecoSubcategory; description: string }> = [
  { key: "ventes", description: "Closing rate, pipeline coverage, vélocité, deals stagnants, forecast" },
  { key: "marketing", description: "Lead → MQL, conversion, attribution, campaigns, lead scoring" },
];

export default async function PerformancesRecommandationsPage() {
  const snapshot = await getHubspotSnapshot();
  const all = buildAuditRecommendations(snapshot).performances;

  // On ne garde que ventes + marketing ici (paiement et service_client ont
  // leurs propres pages dédiées sous /audit/paiement-facturation et
  // /audit/service-client).
  const bySubcategory = SECTIONS.map(({ key, description }) => ({
    key,
    description,
    meta: SUBCATEGORY_LABELS[key],
    recs: all.filter((r) => r.subcategory === key),
  }));

  const total = bySubcategory.reduce((s, b) => s + b.recs.length, 0);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
        <p className="mt-1 text-sm text-slate-500">
          Recommandations CRO/RevOps pour booster la performance commerciale et marketing.
        </p>
      </header>

      <PerformancesTabs />

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-10 text-center">
          <p className="text-sm font-semibold text-emerald-800">Aucune recommandation détectée</p>
          <p className="mt-1 text-xs text-emerald-700">
            Vos performances sont dans les benchmarks Ventes et Marketing.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50/60 to-indigo-50/40 p-4">
            <p className="text-sm font-semibold text-fuchsia-900">
              ✨ {total} recommandation{total > 1 ? "s" : ""} CRO/RevOps détectée{total > 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-xs text-fuchsia-800">
              Groupées par équipe (Ventes / Marketing). Activez chaque reco pour la transformer en
              coaching IA actionnable dans Coaching IA → Ventes ou Marketing.
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
