export const dynamic = "force-dynamic";

import Link from "next/link";
import { getHubspotSnapshot, getSnapshotMeta } from "@/lib/supabase/cached";
import { buildAuditRecommendations } from "@/lib/audit/recommendations-library";
import { DataFreshnessIndicator } from "@/components/data-freshness-indicator";

const SECTIONS = [
  {
    href: "/dashboard/audit/recommandations/donnees",
    emoji: "🗂️",
    label: "Données",
    description: "Qualité, complétude, enrichissement, dédoublonnage. Fiabiliser la base avant tout.",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    href: "/dashboard/audit/recommandations/process",
    emoji: "⚙️",
    label: "Automatisations",
    description: "Workflows, lifecycle stages, MEDDIC/BANT, handoff Marketing→Sales, rituels.",
    gradient: "from-indigo-500 to-blue-600",
  },
  {
    href: "/dashboard/audit/recommandations/performances",
    emoji: "📈",
    label: "Performances",
    description: "Ventes, Marketing, Paiement & Facturation, Service Client. Recos par équipe.",
    gradient: "from-fuchsia-500 to-pink-600",
  },
  {
    href: "/dashboard/audit/recommandations/adoption",
    emoji: "🚀",
    label: "Adoption",
    description: "Owners, custom objects, workflows, pipelines. Gouverner pour scaler.",
    gradient: "from-amber-500 to-violet-600",
  },
];

export default async function RecommandationsOverviewPage() {
  const [snapshot, meta] = await Promise.all([getHubspotSnapshot(), getSnapshotMeta()]);
  const recs = buildAuditRecommendations(snapshot);
  const total = recs.donnees.length + recs.process.length + recs.performances.length + recs.adoption.length;
  const critical = [
    ...recs.donnees,
    ...recs.process,
    ...recs.performances,
    ...recs.adoption,
  ].filter((r) => r.severity === "critical").length;

  return (
    <div className="space-y-6">
      <DataFreshnessIndicator computedAt={meta.computedAt} source={meta.source ?? "sync"} />

      {/* Hero stats — 3 KPIs (Source retiré) */}
      <div className="card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-emerald-500" />
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Recommandations totales</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{total}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Critiques</p>
            <p className={`mt-1 text-3xl font-bold ${critical > 0 ? "text-rose-600" : "text-slate-400"}`}>{critical}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Sections couvertes</p>
            <p className="mt-1 text-3xl font-bold text-indigo-600">4</p>
          </div>
        </div>
      </div>

      {/* Sections cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => {
          const cat = s.href.split("/").pop() as keyof typeof recs;
          const count = recs[cat]?.length ?? 0;
          const criticalCount = recs[cat]?.filter((r) => r.severity === "critical").length ?? 0;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group card relative overflow-hidden p-5 transition hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.gradient}`} />
              <div className="flex items-start gap-3">
                <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.gradient} text-2xl shadow-sm`}>
                  {s.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-accent transition">{s.label}</h3>
                    <div className="flex items-center gap-1.5">
                      {criticalCount > 0 && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                          {criticalCount} critique{criticalCount > 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {count} reco{count > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{s.description}</p>
                  <p className="mt-3 text-xs font-medium text-accent group-hover:underline">
                    Voir les recommandations →
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {total === 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-base font-semibold text-emerald-800">🎉 Aucune recommandation critique détectée</p>
          <p className="mt-2 text-sm text-emerald-700">
            Votre stack revenue est dans un excellent état selon les benchmarks CRO/RevOps.
            Les recommandations apparaîtront automatiquement quand de nouveaux signaux seront détectés.
          </p>
        </div>
      )}
    </div>
  );
}
