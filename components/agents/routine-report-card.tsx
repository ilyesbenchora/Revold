"use client";

import { stripPeriodFromTitle } from "@/lib/reports/title";
import { ReportChart } from "./agent-report";
import type { SavedReport } from "./saved-reports";
import type { ReportBlock, ReportSpec, ChartProposal } from "@/lib/ai/agents/agent-runtime";

/**
 * Rapport de ROUTINE en pleine largeur sous le chat — même DA que le reste de
 * l'app (cartes blanches, palette cockpit indigo/fuchsia des tables de données
 * et des rapports d'agents, cf. agent-report.tsx / block-data-table.tsx).
 *
 * La disposition privilégie l'HORIZONTAL : rangée de KPIs compacte, puis blocs
 * (graphiques, blocs chiffrés, tables) sur deux colonnes, et analyse écrite en
 * colonnes — pour lire le rapport sans scroller des pages entières.
 */

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
}

/** Table claire — même langage que BlockDataTable (en lecture seule). */
function ReportTable({ block }: { block: ReportBlock }) {
  const isNumeric = (cell: unknown) =>
    typeof cell === "string" || typeof cell === "number"
      ? /^-?[\d\s.,]+(?:\s*(?:€|%|k€|M€|j|jours))?$/.test(String(cell).trim())
      : false;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
            {(block.columns ?? []).map((c, i) => (
              <th key={i} className="px-2.5 py-2 font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(block.rows ?? []).map((r, ri) => (
            <tr key={ri} className="border-b border-slate-100 transition last:border-0 hover:bg-indigo-50/40">
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-2.5 py-1.5 ${isNumeric(cell) ? "text-right font-medium tabular-nums text-slate-900" : "text-slate-700"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockCard({ block }: { block: ReportBlock }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      {block.title && (
        <div className="mb-2 text-xs font-semibold text-slate-700">{block.title}</div>
      )}
      {block.type === "table" ? <ReportTable block={block} /> : <ReportChart block={block} showTotal={block.type === "donut"} />}
    </div>
  );
}

function ReportBlocks({ spec }: { spec: ReportSpec }) {
  // Sépare les KPIs (rangée horizontale compacte en tête) des blocs riches
  // (graphiques, tables, blocs chiffrés) posés sur deux colonnes.
  const kpis = spec.blocks.filter((b) => b.type === "kpi");
  const blocks = spec.blocks.filter((b) => b.type !== "kpi");

  return (
    <div className="space-y-4">
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {kpis.map((b, i) => (
            <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">{b.label}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{b.value}</div>
              {b.hint && <div className="text-[11px] text-slate-400">{b.hint}</div>}
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {blocks.map((b, i) => {
          // Une table large (5 colonnes et +) a besoin de la pleine largeur.
          const wide = b.type === "table" && (b.columns?.length ?? 0) >= 5;
          return (
            <div key={i} className={wide ? "lg:col-span-2 2xl:col-span-3" : ""}>
              <BlockCard block={b} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Graphique seul (routine ayant renvoyé propose_chart au lieu d'un rapport). */
function ChartOnly({ chart }: { chart: ChartProposal }) {
  const type = (chart.defaultType || chart.suggestedTypes?.[0] || "bar") as ReportBlock["type"];
  return <BlockCard block={{ type, data: chart.data }} />;
}

export function RoutineReportCard({
  report: r,
  onDelete,
  collapsed = false,
  onToggleCollapse,
  onHide,
}: {
  report: SavedReport;
  onDelete: (id: string) => void;
  /** Rapport replié : seul le bandeau d'en-tête est affiché. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Retire le rapport de l'affichage de la page agent (gardé dans « Mes rapports »). */
  onHide?: (id: string) => void;
}) {
  return (
    <article className="card overflow-hidden">
      {/* En-tête — même bandeau que les tables de données */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-card-border bg-slate-50/60 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-700">
              🕘 Routine{r.routineLabel ? ` · ${r.routineLabel}` : ""}
            </span>
            <span className="text-[11px] text-slate-400">Généré le {fmtDate(r.savedAt)} · {r.agentLabel}</span>
          </div>
          <h3 className="mt-1.5 text-base font-semibold text-slate-900 sm:text-lg">{stripPeriodFromTitle(r.title)}</h3>
          {!collapsed && r.summary && <p className="mt-0.5 max-w-3xl text-sm text-slate-500">{r.summary}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-500 transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-600"
            >
              {collapsed ? "▼ Afficher" : "▲ Réduire"}
            </button>
          )}
          {onHide && (
            <button
              onClick={() => onHide(r.id)}
              title="Retirer de cette page — le rapport reste dans « Mes rapports »"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
            >
              Retirer de l&apos;affichage
            </button>
          )}
          <button
            onClick={() => onDelete(r.id)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            Supprimer
          </button>
        </div>
      </div>
      {collapsed ? null : (
      <>

      <div className="p-4 sm:p-5">
        {/* Rapport visuel — deux colonnes pour limiter le scroll vertical */}
        {r.report ? <ReportBlocks spec={r.report} /> : r.chart ? <ChartOnly chart={r.chart} /> : null}

        {/* Analyse écrite exhaustive de l'agent — en colonnes sur grand écran */}
        {r.analysis && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-500">
              Analyse détaillée
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 lg:columns-2 lg:gap-10">
              {r.analysis}
            </p>
          </div>
        )}
      </div>
      </>
      )}
    </article>
  );
}
