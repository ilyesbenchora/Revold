import { getLatestKpi } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";

function getScoreLabel(score: number) {
  if (score >= 80) return { label: "Excellent", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 50) return { label: "Moyen", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Insuffisant", className: "bg-red-50 text-red-700 border-red-200" };
}

function getBarColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export default async function DonneesPage() {
  const latestKpi = await getLatestKpi();
  const k = latestKpi;

  // Score Données: data_completeness (50%), inverted doublons (25%), inverted orphelins (25%)
  const dataComp = Number(k?.data_completeness) || 0;
  const dupesPct = Number(k?.duplicate_contacts_pct) || 0;
  const orphansPct = Number(k?.orphan_contacts_pct) || 0;
  const dataScore = k ? Math.round(
    dataComp * 0.5 +
    Math.max(0, 100 - dupesPct * 5) * 0.25 +
    Math.max(0, 100 - orphansPct * 3) * 0.25
  ) : 0;

  const qualityMetrics = [
    {
      label: "Compl\u00e9tude des donn\u00e9es",
      value: k?.data_completeness ?? 0,
      suffix: "%",
      description: "Pourcentage de champs obligatoires remplis dans le CRM",
    },
    {
      label: "Doublons contacts",
      value: k?.duplicate_contacts_pct ?? 0,
      suffix: "%",
      description: "Taux de contacts en doublon d\u00e9tect\u00e9s",
      inverted: true,
    },
    {
      label: "Contacts orphelins",
      value: k?.orphan_contacts_pct ?? 0,
      suffix: "%",
      description: "Contacts sans entreprise associ\u00e9e",
      inverted: true,
    },
  ];

  const opsMetrics = [
    {
      label: "Deals inactifs",
      value: k?.inactive_deals_pct ?? 0,
      suffix: "%",
      description: "Deals sans activit\u00e9 depuis plus de 14 jours",
      inverted: true,
    },
    {
      label: "Taux de stagnation",
      value: k?.deal_stagnation_rate ?? 0,
      suffix: "%",
      description: "Deals rest\u00e9s trop longtemps dans la m\u00eame \u00e9tape",
      inverted: true,
    },
    {
      label: "Activit\u00e9s par deal",
      value: k?.activities_per_deal ?? 0,
      suffix: "",
      description: "Nombre moyen d\u2019interactions par opportunit\u00e9",
    },
  ];

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Donn\u00e9es</h1>
        <p className="mt-1 text-sm text-slate-500">
          Qualit\u00e9 et sant\u00e9 des donn\u00e9es dans votre CRM.
        </p>
      </header>

      {/* Score global Données */}
      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Donn\u00e9es" score={dataScore} colorClass="stroke-emerald-500" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{dataScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(dataScore).className}`}>
              {getScoreLabel(dataScore).label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            \u00c9valuation de la qualit\u00e9, de la compl\u00e9tude et de la propret\u00e9 de vos donn\u00e9es CRM.
          </p>
        </div>
      </div>

      {/* Data Quality */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Data Quality
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {qualityMetrics.map((m) => {
            const numVal = Number(m.value);
            const displayScore = m.inverted ? Math.max(0, 100 - numVal) : numVal;
            return (
              <article key={m.label} className="card p-5">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-slate-600">{m.label}</p>
                  <span className={`text-xl font-bold ${
                    displayScore >= 80 ? "text-emerald-600" :
                    displayScore >= 50 ? "text-amber-500" : "text-red-500"
                  }`}>
                    {numVal}{m.suffix}
                  </span>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className={`h-1.5 rounded-full ${getBarColor(displayScore)}`}
                    style={{ width: `${Math.min(100, displayScore)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-400">{m.description}</p>
              </article>
            );
          })}
        </div>
      </div>

      {/* Data Ops */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Data Ops
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {opsMetrics.map((m) => {
            const numVal = Number(m.value);
            const displayScore = m.inverted ? Math.max(0, 100 - numVal) : numVal;
            return (
              <article key={m.label} className="card p-5">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-slate-600">{m.label}</p>
                  <span className={`text-xl font-bold ${
                    displayScore >= 80 ? "text-emerald-600" :
                    displayScore >= 50 ? "text-amber-500" : "text-red-500"
                  }`}>
                    {numVal}{m.suffix}
                  </span>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className={`h-1.5 rounded-full ${getBarColor(displayScore)}`}
                    style={{ width: `${Math.min(100, displayScore)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-400">{m.description}</p>
              </article>
            );
          })}
        </div>
      </div>

      {!latestKpi && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            Aucune donn\u00e9e disponible. Les m\u00e9triques appara\u00eetront une fois les donn\u00e9es synchronis\u00e9es.
          </p>
        </div>
      )}
    </section>
  );
}
