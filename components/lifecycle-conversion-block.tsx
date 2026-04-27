import type { LifecycleConversion } from "@/lib/sync/compute-lifecycle-conversion";

function arrowColor(pct: number | null): string {
  if (pct === null) return "text-slate-400";
  if (pct >= 30) return "text-emerald-600";
  if (pct >= 10) return "text-amber-600";
  return "text-red-600";
}

function bgForPct(pct: number | null): string {
  if (pct === null) return "bg-slate-100 text-slate-500";
  if (pct >= 30) return "bg-emerald-100 text-emerald-700";
  if (pct >= 10) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export function LifecycleConversionBlock({ data }: { data: LifecycleConversion }) {
  if (data.stages.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
        Aucun contact avec lifecycle stage canonique HubSpot. Vérifiez que la
        propriété <code className="rounded bg-slate-100 px-1">lifecyclestage</code>{" "}
        est utilisée dans votre CRM.
      </p>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">
          Funnel Lifecycle — {data.stages[0]?.label} → {data.stages[data.stages.length - 1]?.label}
        </p>
        {data.endToEndPct !== null && (
          <p className="text-xs text-slate-500">
            Conversion globale :{" "}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${bgForPct(data.endToEndPct)}`}
            >
              {data.endToEndPct}%
            </span>
          </p>
        )}
      </div>

      <p className="mt-1 text-[11px] text-slate-500">
        {data.stages.length} étape{data.stages.length > 1 ? "s" : ""} clé
        {data.stages.length > 1 ? "s" : ""} sur {data.totalContactsInFunnel.toLocaleString("fr-FR")} contacts
        dans le funnel canonique
        {data.contactsOutsideFunnel > 0 &&
          ` · ${data.contactsOutsideFunnel.toLocaleString("fr-FR")} contacts hors funnel (lifecycle custom ou null)`}
      </p>

      {data.insufficientStages ? (
        <p className="mt-4 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
          Une seule étape lifecycle peuplée — il faut au moins 2 étapes pour
          calculer un taux de conversion.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {data.stages.map((s, i) => {
            const isLast = i === data.stages.length - 1;
            return (
              <div key={s.value} className="flex flex-col gap-1">
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{s.label}</p>
                    <p className="text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">
                        {s.inStageCount.toLocaleString("fr-FR")}
                      </span>{" "}
                      contact{s.inStageCount > 1 ? "s" : ""} actuellement à cette étape ·{" "}
                      <span className="font-semibold text-slate-700">
                        {s.reachedCount.toLocaleString("fr-FR")}
                      </span>{" "}
                      l&apos;ont atteinte
                    </p>
                  </div>
                </div>
                {!isLast && (
                  <div className="ml-3 flex items-center gap-2 pl-2">
                    <span className={`text-lg ${arrowColor(s.conversionToNextPct)}`}>↓</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${bgForPct(s.conversionToNextPct)}`}
                    >
                      {s.conversionToNextPct !== null
                        ? `${s.conversionToNextPct}% conversion`
                        : "—"}
                    </span>
                    <span className="text-[11px] text-slate-500">vers « {s.nextLabel} »</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] text-slate-400">
        Méthode : on ne retient que les étapes lifecycle canoniques HubSpot (subscriber → lead → MQL → SQL →
        opportunity → customer → evangelist) ayant au moins 1 contact. « ont atteint » = comptés dans cette
        étape ou une étape suivante.
      </p>
    </div>
  );
}
