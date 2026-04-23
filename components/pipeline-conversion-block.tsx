"use client";

import { useState } from "react";
import type { PipelineConversion } from "@/lib/integrations/hubspot-pipeline-conversion";
import { CreateAlertCta } from "./create-alert-cta";

function arrowColor(pct: number | null): string {
  if (pct === null) return "text-slate-400";
  if (pct >= 60) return "text-emerald-600";
  if (pct >= 30) return "text-amber-600";
  return "text-red-600";
}

function bgForPct(pct: number | null): string {
  if (pct === null) return "bg-slate-100 text-slate-500";
  if (pct >= 60) return "bg-emerald-100 text-emerald-700";
  if (pct >= 30) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export function PipelineConversionBlock({
  conversions,
}: {
  conversions: PipelineConversion[];
}) {
  const [pipelineId, setPipelineId] = useState<string>(
    conversions.find((c) => c.totalEntries > 0)?.pipeline.id ??
      conversions[0]?.pipeline.id ??
      "",
  );
  const selected = conversions.find((c) => c.pipeline.id === pipelineId) ?? conversions[0];

  if (!selected) {
    return (
      <p className="text-sm text-slate-500">
        Aucun pipeline disponible pour calculer le taux de conversion.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-600">Pipeline :</label>
          <select
            value={selected.pipeline.id}
            onChange={(e) => setPipelineId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            {conversions.map((c) => (
              <option key={c.pipeline.id} value={c.pipeline.id}>
                {c.pipeline.label} ({c.totalEntries} deals)
              </option>
            ))}
          </select>
        </div>
        <CreateAlertCta
          team="sales"
          kpiId="pipeline_stage_conversion"
          defaultThreshold={50}
          defaultDirection="below"
          defaultUnit="percent"
          defaultPipelineIds={[selected.pipeline.id]}
        />
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-slate-700">
            Funnel de conversion à l&apos;instant T — {selected.pipeline.label}
          </p>
          <p className="text-xs text-slate-500">
            Conversion globale (1<sup>ère</sup> étape → dernière étape) :{" "}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${bgForPct(selected.endToEndPct)}`}
            >
              {selected.endToEndPct !== null ? `${selected.endToEndPct}%` : "—"}
            </span>
          </p>
        </div>

        {selected.totalEntries === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
            Aucun deal ouvert dans ce pipeline — impossible de calculer une conversion.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {selected.stages.map((s, i) => {
              const isLast = i === selected.stages.length - 1;
              return (
                <div key={s.stage.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {s.stage.label}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">{s.inStageCount}</span>{" "}
                        deal{s.inStageCount > 1 ? "s" : ""} actuellement à cette étape ·{" "}
                        <span className="font-semibold text-slate-700">{s.reachedCount}</span>{" "}
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
                      <span className="text-[11px] text-slate-500">
                        vers « {s.nextStageLabel} »
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-[11px] text-slate-400">
          Conversion calculée à partir de la distribution actuelle des deals ouverts dans
          chaque étape (« ont atteint » = comptés dans cette étape ou une étape suivante).
        </p>
      </div>
    </div>
  );
}
