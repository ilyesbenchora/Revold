"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { CloseDateBuckets, CloseDateDeal } from "@/lib/integrations/hubspot-close-date";
import { CreateAlertCta } from "./create-alert-cta";

const PAGE_SIZE = 25;

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

type PipelineOption = {
  id: string;
  label: string;
  stages: Array<{ id: string; label: string }>;
};
type OwnerOption = { id: string; name: string };

type Maps = {
  stageById: Map<string, string>;
  pipelineById: Map<string, string>;
  ownerById: Map<string, string>;
};

export function CloseDateManagementBlock({
  pipelines,
  owners,
  initialPipelineId,
  initialBuckets,
}: {
  pipelines: PipelineOption[];
  owners: OwnerOption[];
  initialPipelineId: string | null;
  initialBuckets: CloseDateBuckets;
}) {
  const [pipelineId, setPipelineId] = useState<string | null>(initialPipelineId);
  const [buckets, setBuckets] = useState<CloseDateBuckets>(initialBuckets);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (pipelineId === initialPipelineId) {
      setBuckets(initialBuckets);
      return;
    }
    startTransition(() => {
      const url = pipelineId
        ? `/api/integrations/hubspot/close-date?pipelineId=${encodeURIComponent(pipelineId)}`
        : `/api/integrations/hubspot/close-date?pipelineId=__all__`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setBuckets(data as CloseDateBuckets);
        })
        .catch(() => {});
    });
  }, [pipelineId, initialPipelineId, initialBuckets]);

  const maps: Maps = useMemo(() => {
    const stageById = new Map<string, string>();
    const pipelineById = new Map<string, string>();
    for (const p of pipelines) {
      pipelineById.set(p.id, p.label);
      for (const s of p.stages) stageById.set(s.id, s.label);
    }
    const ownerById = new Map(owners.map((o) => [o.id, o.name]));
    return { stageById, pipelineById, ownerById };
  }, [pipelines, owners]);

  const passedTotalAmount = buckets.passedCloseDate.reduce((s, d) => s + d.amount, 0);
  const quarterTotalAmount = buckets.currentQuarter.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-600">Pipeline :</label>
          <select
            value={pipelineId ?? "__all__"}
            onChange={(e) =>
              setPipelineId(e.target.value === "__all__" ? null : e.target.value)
            }
            disabled={isPending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-accent focus:outline-none disabled:opacity-50"
          >
            <option value="__all__">Tous pipelines</option>
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
        maps={maps}
        totalAmount={passedTotalAmount}
        valueLabel="Retard"
        renderRight={(d) => (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
            +{d.daysOverdue}j
          </span>
        )}
        alert={
          <CreateAlertCta
            team="sales"
            kpiId="deals_at_risk"
            defaultThreshold={5}
            defaultDirection="below"
            defaultUnit="count"
            defaultPipelineIds={pipelineId ? [pipelineId] : []}
          />
        }
      />

      <CloseDateTable
        title={`Close date ${buckets.quarterLabel}`}
        subtitle={`Deals à fermer durant le trimestre courant (${buckets.quarterLabel})`}
        accent="bg-emerald-500"
        countBg="bg-emerald-50 text-emerald-700"
        deals={buckets.currentQuarter}
        maps={maps}
        totalAmount={quarterTotalAmount}
        valueLabel="Close date"
        renderRight={(d) => (
          <span className="text-[11px] font-medium text-slate-600">
            {fmtDate(d.closeDate)}
          </span>
        )}
        alert={
          <CreateAlertCta
            team="sales"
            kpiId="weighted_pipeline"
            defaultThreshold={50000}
            defaultDirection="above"
            defaultUnit="currency"
            defaultPipelineIds={pipelineId ? [pipelineId] : []}
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
  maps,
  totalAmount,
  valueLabel,
  renderRight,
  alert,
}: {
  title: string;
  subtitle: string;
  accent: string;
  countBg: string;
  deals: CloseDateDeal[];
  maps: Maps;
  totalAmount: number;
  valueLabel: string;
  renderRight: (d: CloseDateDeal) => React.ReactNode;
  alert: React.ReactNode;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(deals.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const visible = deals.slice(start, start + PAGE_SIZE);

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
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10px] font-medium uppercase text-slate-400">
                  <th className="px-5 py-2">Deal</th>
                  <th className="px-3 py-2">Pipeline</th>
                  <th className="px-3 py-2">Étape</th>
                  <th className="px-3 py-2">Propriétaire</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                  <th className="px-5 py-2 text-right">{valueLabel}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2 font-medium text-slate-700">{d.name}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {maps.pipelineById.get(d.pipelineId) ?? d.pipelineId}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {maps.stageById.get(d.stageId) ?? d.stageId}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {d.ownerId ? maps.ownerById.get(d.ownerId) ?? d.ownerId : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {d.amount > 0 ? fmtK(d.amount) : "—"}
                    </td>
                    <td className="px-5 py-2 text-right">{renderRight(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2 text-xs text-slate-500">
              <span>
                Affichage {start + 1}–{Math.min(start + PAGE_SIZE, deals.length)} sur{" "}
                {deals.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  aria-label="Page précédente"
                >
                  ←
                </button>
                <span className="font-medium">
                  {safePage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  aria-label="Page suivante"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </article>
  );
}
