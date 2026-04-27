"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  CloseDateBuckets,
  CloseDateDeal,
  QuarterBucket,
} from "@/lib/integrations/hubspot-close-date";
import { CreateAlertCta } from "./create-alert-cta";
import { BlockHeaderIcon, SortHeader, useSorter } from "./ventes-ui";

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

  const passedTotal = buckets.passedCloseDate.reduce((s, d) => s + d.amount, 0);
  const passedWeighted = buckets.passedCloseDate.reduce((s, d) => s + d.weightedAmount, 0);

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

      <PassedCloseDateTable
        deals={buckets.passedCloseDate}
        totalAmount={passedTotal}
        weightedAmount={passedWeighted}
        maps={maps}
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

      <QuartersTable
        year={buckets.year}
        quarters={buckets.quarters}
        maps={maps}
        pipelineId={pipelineId}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Bloc 1 : Close date dépassée
// ──────────────────────────────────────────────────────────────────────

type PassedSortKey = keyof Pick<
  CloseDateDeal,
  "name" | "amount" | "daysOverdue" | "closeDate"
>;

function PassedCloseDateTable({
  deals,
  totalAmount,
  weightedAmount,
  maps,
  alert,
}: {
  deals: CloseDateDeal[];
  totalAmount: number;
  weightedAmount: number;
  maps: Maps;
  alert: React.ReactNode;
}) {
  const { sorted, sortKey, sortDir, toggle } = useSorter<CloseDateDeal>(
    deals,
    "daysOverdue",
    "desc",
  );
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const visible = sorted.slice(start, start + PAGE_SIZE);

  function lateBadge(days: number) {
    const cls =
      days >= 30
        ? "bg-red-100 text-red-700"
        : days >= 7
          ? "bg-orange-100 text-orange-700"
          : "bg-amber-100 text-amber-800";
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}
      >
        +{days}j
      </span>
    );
  }

  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-white px-5 py-4">
        <div className="flex items-start gap-3">
          <BlockHeaderIcon icon="alarm" tone="red" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">Close date dépassée</h3>
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                {deals.length} deal{deals.length > 1 ? "s" : ""}
              </span>
              {totalAmount > 0 && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {fmtK(totalAmount)} brut
                </span>
              )}
              {weightedAmount > 0 && (
                <span className="inline-flex items-center rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-semibold text-fuchsia-700">
                  {fmtK(weightedAmount)} pondéré
                </span>
              )}
            </div>
            <span className="mt-1.5 inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">
              Critère : deals encore ouverts dont la close date est passée
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">{alert}</div>
      </header>

      {deals.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">Aucun deal en retard de close date.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/60">
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-2">
                    <SortHeader label="Deal" active={sortKey === "name"} direction={sortDir} onToggle={() => toggle("name")} />
                  </th>
                  <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Pipeline</th>
                  <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Étape</th>
                  <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Propriétaire</th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Montant" active={sortKey === "amount"} direction={sortDir} onToggle={() => toggle("amount")} align="right" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Pondéré" active={sortKey === "weightedAmount"} direction={sortDir} onToggle={() => toggle("weightedAmount")} align="right" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Date closing" active={sortKey === "closeDate"} direction={sortDir} onToggle={() => toggle("closeDate")} align="right" />
                  </th>
                  <th className="px-5 py-2 text-right">
                    <SortHeader label="Retard" active={sortKey === "daysOverdue"} direction={sortDir} onToggle={() => toggle("daysOverdue")} align="right" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                    <td className="px-5 py-2 font-medium text-slate-700">{d.name}</td>
                    <td className="px-3 py-2 text-slate-600">{maps.pipelineById.get(d.pipelineId) ?? d.pipelineId}</td>
                    <td className="px-3 py-2 text-slate-600">{maps.stageById.get(d.stageId) ?? d.stageId}</td>
                    <td className="px-3 py-2 text-slate-600">{d.ownerId ? maps.ownerById.get(d.ownerId) ?? d.ownerId : "—"}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{d.amount > 0 ? fmtK(d.amount) : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex flex-col items-end">
                        <span className="font-semibold text-slate-700">{d.weightedAmount > 0 ? fmtK(d.weightedAmount) : "—"}</span>
                        <span className="text-[9px] text-slate-400">{d.stageProbability}%</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtDate(d.closeDate)}</td>
                    <td className="px-5 py-2 text-right">{lateBadge(d.daysOverdue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <Pagination total={sorted.length} start={start} page={safePage} totalPages={totalPages} setPage={setPage} />
          )}
        </>
      )}
    </article>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Bloc 2 : Close date par trimestre — année courante (T1/T2/T3/T4)
// ──────────────────────────────────────────────────────────────────────

type QuarterKey = "T1" | "T2" | "T3" | "T4";

function QuartersTable({
  year,
  quarters,
  maps,
  pipelineId,
}: {
  year: number;
  quarters: QuarterBucket[];
  maps: Maps;
  pipelineId: string | null;
}) {
  const now = new Date();
  const currentQuarter: QuarterKey =
    (["T1", "T2", "T3", "T4"] as const)[Math.floor(now.getMonth() / 3)];
  const [active, setActive] = useState<QuarterKey>(currentQuarter);
  const bucket = quarters.find((q) => q.key === active) ?? quarters[0];
  const totalAmount = bucket?.deals.reduce((s, d) => s + d.amount, 0) ?? 0;
  const totalWeighted = bucket?.deals.reduce((s, d) => s + d.weightedAmount, 0) ?? 0;

  return (
    <article className="card overflow-hidden">
      <header className="border-b border-card-border bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <BlockHeaderIcon icon="calendar" tone="emerald" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Close date {year} — par trimestre
              </h3>
              <span className="mt-1.5 inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                Critère : deals à fermer durant le trimestre sélectionné
              </span>
            </div>
          </div>
          <CreateAlertCta
            team="sales"
            kpiId="weighted_pipeline"
            defaultThreshold={50000}
            defaultDirection="above"
            defaultUnit="currency"
            defaultPipelineIds={pipelineId ? [pipelineId] : []}
          />
        </div>

        {/* Tabs T1/T2/T3/T4 avec compteurs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {quarters.map((q) => {
            const isActive = q.key === active;
            const count = q.deals.length;
            const isCurrent = q.key === currentQuarter;
            return (
              <button
                key={q.key}
                type="button"
                onClick={() => setActive(q.key)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {q.label}
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                    isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
                {isCurrent && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                    Actuel
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {bucket && bucket.deals.length > 0 ? (
        <QuarterTableBody bucket={bucket} maps={maps} totalAmount={totalAmount} weightedAmount={totalWeighted} />
      ) : (
        <p className="px-5 py-6 text-sm text-slate-500">
          Aucun deal avec une close date dans <strong>{bucket?.label ?? active}</strong>.
        </p>
      )}
    </article>
  );
}

function QuarterTableBody({
  bucket,
  maps,
  totalAmount,
  weightedAmount,
}: {
  bucket: QuarterBucket;
  maps: Maps;
  totalAmount: number;
  weightedAmount: number;
}) {
  const { sorted, sortKey, sortDir, toggle } = useSorter<CloseDateDeal>(
    bucket.deals,
    "closeDate",
    "asc",
  );
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const visible = sorted.slice(start, start + PAGE_SIZE);

  return (
    <>
      {totalAmount > 0 && (
        <p className="border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-[11px] text-slate-600">
          <strong>{bucket.deals.length}</strong> deal{bucket.deals.length > 1 ? "s" : ""} ·{" "}
          brut <strong>{fmtK(totalAmount)}</strong> ·{" "}
          forecast pondéré <strong className="text-fuchsia-700">{fmtK(weightedAmount)}</strong>
          {totalAmount > 0 && (
            <span className="ml-1 text-slate-400">
              (taux moyen {Math.round((weightedAmount / totalAmount) * 100)}%)
            </span>
          )}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50/60">
            <tr className="border-b border-slate-100 text-left">
              <th className="px-5 py-2">
                <SortHeader label="Deal" active={sortKey === "name"} direction={sortDir} onToggle={() => toggle("name")} />
              </th>
              <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Pipeline</th>
              <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Étape</th>
              <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Propriétaire</th>
              <th className="px-3 py-2 text-right">
                <SortHeader label="Montant" active={sortKey === "amount"} direction={sortDir} onToggle={() => toggle("amount")} align="right" />
              </th>
              <th className="px-3 py-2 text-right">
                <SortHeader label="Pondéré" active={sortKey === "weightedAmount"} direction={sortDir} onToggle={() => toggle("weightedAmount")} align="right" />
              </th>
              <th className="px-5 py-2 text-right">
                <SortHeader label="Date closing" active={sortKey === "closeDate"} direction={sortDir} onToggle={() => toggle("closeDate")} align="right" />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => (
              <tr key={d.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                <td className="px-5 py-2 font-medium text-slate-700">{d.name}</td>
                <td className="px-3 py-2 text-slate-600">{maps.pipelineById.get(d.pipelineId) ?? d.pipelineId}</td>
                <td className="px-3 py-2 text-slate-600">{maps.stageById.get(d.stageId) ?? d.stageId}</td>
                <td className="px-3 py-2 text-slate-600">{d.ownerId ? maps.ownerById.get(d.ownerId) ?? d.ownerId : "—"}</td>
                <td className="px-3 py-2 text-right text-slate-700">{d.amount > 0 ? fmtK(d.amount) : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <span className="inline-flex flex-col items-end">
                    <span className="font-semibold text-slate-700">{d.weightedAmount > 0 ? fmtK(d.weightedAmount) : "—"}</span>
                    <span className="text-[9px] text-slate-400">{d.stageProbability}%</span>
                  </span>
                </td>
                <td className="px-5 py-2 text-right text-slate-700">{fmtDate(d.closeDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <Pagination total={sorted.length} start={start} page={safePage} totalPages={totalPages} setPage={setPage} />
      )}
    </>
  );
}

function Pagination({
  total,
  start,
  page,
  totalPages,
  setPage,
}: {
  total: number;
  start: number;
  page: number;
  totalPages: number;
  setPage: (fn: (p: number) => number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2 text-xs text-slate-500">
      <span>
        Affichage {start + 1}–{Math.min(start + PAGE_SIZE, total)} sur {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          aria-label="Page précédente"
        >
          ←
        </button>
        <span className="font-medium">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          aria-label="Page suivante"
        >
          →
        </button>
      </div>
    </div>
  );
}
