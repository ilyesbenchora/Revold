import { ProgressScore } from "@/components/progress-score";

const scorecards = [
  { label: "Moteur Sales", score: 76, colorClass: "stroke-indigo-500" },
  { label: "Moteur Marketing", score: 68, colorClass: "stroke-amber-500" },
  { label: "Ops CRM", score: 83, colorClass: "stroke-emerald-500" },
];

const kpis = [
  { label: "Taux de closing", value: "28.4%" },
  { label: "Couverture pipeline", value: "2.1x" },
  { label: "Cycle de vente", value: "47 jours" },
  { label: "Prévision pondérée", value: "€1.84M" },
  { label: "MQL vers SQL", value: "22.1%" },
  { label: "Deals inactifs", value: "34%" },
  { label: "Complétude données", value: "87%" },
  { label: "Vélocité deals", value: "€12.4K/j" },
];

export default function DashboardOverviewPage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Vue d&apos;ensemble revenue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Synthèse des performances commerciales, marketing et CRM.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {scorecards.map((card) => (
          <ProgressScore
            key={card.label}
            label={card.label}
            score={card.score}
            colorClass={card.colorClass}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-2">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="card p-5">
            <p className="text-sm text-slate-600">{kpi.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{kpi.value}</p>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-indigo-200 bg-accent-soft p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Insight IA</p>
        <h2 className="mt-2 text-lg font-semibold text-indigo-950">
          Le ralentissement du pipeline vient principalement des deals Mid-Market.
        </h2>
        <p className="mt-2 text-sm text-indigo-900/80">
          Recommandation: renforcer les relances entre J+14 et J+21 pour améliorer la vélocité et
          réduire les deals inactifs de 5 à 8 points.
        </p>
      </section>
    </section>
  );
}
