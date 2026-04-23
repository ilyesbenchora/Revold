"use client";

import { useEffect, useState, useTransition } from "react";
import type { CloseDateBuckets, CloseDateDeal } from "@/lib/integrations/hubspot-close-date";
import { AlertButton } from "./alert-button";

const fmtK = (n: number) =>
  n >= 1000
    ? `${Math.round(n / 1000).toLocaleString("fr-FR")}K€`
    : `${Math.round(n).toLocaleString("fr-FR")}€`;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return "—";
  }
}

type PipelineOption = { id: string; label: string; stages: Array<{ id: string; label: string }> };

export function CloseDateManagementBlock({
  pipelines,
  initialPipelineId,
  initialBuckets,
}: {
  pipelines: PipelineOption[];
  initialPipelineId: string;
  initialBuckets: CloseDateBuckets;
}) {
  const [pipelineId, setPipelineId] = useState(initialPipelineId);
  const [buckets, setBuckets] = useState<CloseDateBuckets>(initialBuckets);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (pipelineId === initialPipelineId) {
      setBuckets(initialBuckets);
      return;
    }
    startTransition(() => {
      fetch(`/api/integrations/hubspot/close-date?pipelineId=${encodeURIComponent(pipelineId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setBuckets(data as CloseDateBuckets);
        })
        .catch(() => {});
    });
  }, [pipelineId, initialPipelineId, initialBuckets]);

  const stageMap = new Map(
    pipelines.find((p) => p.id === pipelineId)?.stages.map((s) => [s.id, s.label]) ?? [],
  );
  const selectedPipelineLabel =
    pipelines.find((p) => p.id === pipelineId)?.label ?? "—";

  const passedTotalAmount = buckets.passedCloseDate.reduce((s, d) => s + d.amount, 0);
  const quarterTotalAmount = buckets.currentQuarter.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-600">Pipeline :</label>
          <select
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            disabled={isPending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-accent focus:outline-none disabled:opacity-50"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {isPending && <span className="text-xs text-slate-400">Chargement…</span>}
        </div>
      </div>

      <CloseDateTable
        title="Close date dépassée"
        subtitle="Deals encore ouverts dont la date de fermeture est dans le passé"
        accent="bg-red-500"
        countBg="bg-red-50 text-red-700"
        deals={buckets.passedCloseDate}
        stageMap={stageMap}
        totalAmount={passedTotalAmount}
        renderRight={(d) => (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
            +{d.daysOverdue}j de retard
          </span>
        )}
        alert={
          <AlertButton
            title={`Close date dépassée · ${selectedPipelineLabel}`}
            description="Deals ouverts dont la date de fermeture est dans le passé."
            impact="Détecte le forecast décalé et déclenche une alerte si le nombre de deals en retard dépasse le seuil défini."
            category="ventes"
            forecastType="close_date_passed"
            threshold={5}
            direction="above"
          />
        }
      />

      <CloseDateTable
        title={`Close date ${buckets.quarterLabel}`}
        subtitle={`Deals dont la date de fermeture tombe dans le trimestre courant (${buckets.quarterLabel})`}
        accent="bg-emerald-500"
        countBg="bg-emerald-50 text-emerald-700"
        deals={buckets.currentQuarter}
        stageMap={stageMap}
        totalAmount={quarterTotalAmount}
        renderRight={(d) => (
          <span className="text-[11px] font-medium text-slate-600">
            {fmtDate(d.closeDate)}
          </span>
        )}
        alert={
          <AlertButton
            title={`Close date ${buckets.quarterLabel} · ${selectedPipelineLabel}`}
            description={`Deals à fermer durant le trimestre ${buckets.quarterLabel}.`}
            impact="Suit le pipeline du trimestre et déclenche une alerte si la valeur cumulée passe sous le seuil défini."
            category="ventes"
            forecastType="close_date_current_quarter"
            threshold={50000}
            direction="below"
          />
        }
      />
    </div>
  );
}

function CloseDateTable({
  title,
  subtitle,
  accent,
  countBg,
  deals,
  stageMap,
  totalAmount,
  renderRight,
  alert,
}: {
  title: string;
  subtitle: string;
  accent: string;
  countBg: string;
  deals: CloseDateDeal[];
  stageMap: Map<string, string>;
  totalAmount: number;
  renderRight: (d: CloseDateDeal) => React.ReactNode;
  alert: React.ReactNode;
}) {
  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-slate-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${accent}`} />
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${countBg}`}>
            {deals.length}
          </span>
          {totalAmount > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {fmtK(totalAmount)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">{subtitle}</p>
          {alert}
        </div>
      </header>

      {deals.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">Aucun deal détecté.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[10px] font-medium uppercase text-slate-400">
                <th className="px-5 py-2">Deal</th>
                <th className="px-3 py-2">Étape</th>
                <th className="px-3 py-2 text-right">Montant</th>
                <th className="px-5 py-2 text-right">Détail</th>
              </tr>
            </thead>
            <tbody>
              {deals.slice(0, 25).map((d) => (
                <tr key={d.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2 font-medium text-slate-700">{d.name}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {stageMap.get(d.stageId) ?? d.stageId}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {d.amount > 0 ? fmtK(d.amount) : "—"}
                  </td>
                  <td className="px-5 py-2 text-right">{renderRight(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {deals.length > 25 && (
            <p className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400">
              + {deals.length - 25} autre{deals.length - 25 > 1 ? "s" : ""} non affiché
              {deals.length - 25 > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
