"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { stripPeriodFromTitle } from "@/lib/reports/title";
import type { SavedReport } from "./saved-reports";
import type { ReportBlock, ReportSpec, ChartProposal } from "@/lib/ai/agents/agent-runtime";

/**
 * Rapport de ROUTINE en pleine largeur sous le chat : visuel « cockpit
 * futuriste » (fond nuit, halos néon fuchsia/indigo/cyan, grille) qui donne
 * toute la place aux données — rangée de KPIs, graphiques néon, tables
 * détaillées — suivi de l'analyse écrite exhaustive de l'agent.
 */

const NEON = ["#e879f9", "#818cf8", "#22d3ee", "#34d399", "#fbbf24", "#f472b6", "#a78bfa"];

function compactValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `${Math.round(v / 1_000).toLocaleString("fr-FR")} k`;
  return Math.round(v).toLocaleString("fr-FR");
}
function fullValue(v: number): string {
  return new Intl.NumberFormat("fr-FR").format(v);
}
function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
}

const TOOLTIP_STYLE = {
  background: "rgba(2, 6, 23, 0.95)",
  borderRadius: 10,
  border: "1px solid rgba(129, 140, 248, 0.35)",
  boxShadow: "0 0 24px rgba(99, 102, 241, 0.35)",
  fontSize: 12,
  padding: "8px 10px",
  color: "#e2e8f0",
} as const;

function NeonTooltip() {
  return (
    <Tooltip
      contentStyle={TOOLTIP_STYLE}
      formatter={(value) => [fullValue(Number(value)), null]}
      labelStyle={{ fontWeight: 600, color: "#f8fafc" }}
      itemStyle={{ color: "#22d3ee" }}
      cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
    />
  );
}

function NeonAxes() {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
      <YAxis
        tick={{ fontSize: 10, fill: "#64748b" }}
        tickLine={false}
        axisLine={false}
        width={52}
        tickFormatter={(v: number) => compactValue(v)}
      />
    </>
  );
}

/** Graphique d'un bloc en rendu néon plein écran (bar / line / area / donut). */
function NeonChart({ block }: { block: ReportBlock }) {
  const data = block.data ?? [];
  if (data.length === 0) return null;
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);

  if (block.type === "donut") {
    const LEGEND_MAX = 8;
    const legendRows = data.slice(0, LEGEND_MAX);
    const rest = data.slice(LEGEND_MAX);
    const restTotal = rest.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const share = (v: number) => (total > 0 ? `${Math.round((v / total) * 100)} %` : "—");
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="relative h-[240px] w-[240px] shrink-0 [filter:drop-shadow(0_0_14px_rgba(232,121,249,0.35))]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={64}
                outerRadius={104}
                paddingAngle={2.5}
                cornerRadius={5}
                stroke="#020617"
                strokeWidth={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={NEON[i % NEON.length]} />
                ))}
              </Pie>
              <text x="50%" y="45%" textAnchor="middle" fontSize={10} fill="#64748b">Total</text>
              <text x="50%" y="56%" textAnchor="middle" fontSize={17} fontWeight={700} fill="#f8fafc">
                {compactValue(total)}
              </text>
              <NeonTooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {legendRows.map((d, i) => (
            <li key={i} className="flex items-center gap-2.5 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: NEON[i % NEON.length], boxShadow: `0 0 8px ${NEON[i % NEON.length]}` }}
              />
              <span className="min-w-0 flex-1 truncate text-slate-300">{d.name}</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-100">{fullValue(Number(d.value) || 0)}</span>
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-slate-500">{share(Number(d.value) || 0)}</span>
            </li>
          ))}
          {rest.length > 0 && (
            <li className="flex items-center gap-2.5 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-600" />
              <span className="min-w-0 flex-1 truncate text-slate-500">+ {rest.length} autres</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-400">{fullValue(restTotal)}</span>
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-slate-500">{share(restTotal)}</span>
            </li>
          )}
        </ul>
      </div>
    );
  }

  if (block.type === "line" || block.type === "area") {
    const lastLabel = (props: { x?: unknown; y?: unknown; index?: number; value?: unknown }) => {
      const { x, y, index, value } = props;
      if (index !== data.length - 1 || typeof x !== "number" || typeof y !== "number" || typeof value !== "number") return <g />;
      return (
        <text x={x} y={y - 10} textAnchor="end" fontSize={12} fontWeight={600} fill="#22d3ee">
          {compactValue(value)}
        </text>
      );
    };
    return (
      <div className="[filter:drop-shadow(0_0_10px_rgba(34,211,238,0.3))]">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 20, right: 10 }}>
            <defs>
              <linearGradient id="routineArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <NeonAxes />
            <NeonTooltip />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#22d3ee"
              strokeWidth={2.5}
              strokeLinejoin="round"
              fill="url(#routineArea)"
              dot={{ r: 3, fill: "#22d3ee", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#e879f9" }}
              label={lastLabel}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // bar (défaut) — barres en dégradé néon, maximum en fuchsia, valeur
  // au-dessus de chaque barre tant que la densité le permet.
  const maxValue = Math.max(...data.map((d) => Number(d.value) || 0));
  const showBarLabels = data.length <= 14;
  const barLabel = (props: { x?: unknown; y?: unknown; width?: unknown; value?: unknown }) => {
    const { x, y, width, value } = props;
    if (!showBarLabels || typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof value !== "number") return <g />;
    return (
      <text
        x={x + width / 2}
        y={value < 0 ? y + 14 : y - 7}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={value === maxValue ? "#e879f9" : "#a5b4fc"}
      >
        {compactValue(value)}
      </text>
    );
  };
  return (
    <div className="[filter:drop-shadow(0_0_10px_rgba(129,140,248,0.28))]">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 24, right: 10 }}>
          <defs>
            <linearGradient id="routineBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="routineBarMax" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e879f9" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#d946ef" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <NeonAxes />
          <NeonTooltip />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={52} label={barLabel}>
            {data.map((d, i) => (
              <Cell key={i} fill={(Number(d.value) || 0) === maxValue ? "url(#routineBarMax)" : "url(#routineBar)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bloc « cockpit » : chiffre héros + ventilation des principaux segments. */
function NeonBloc({ block }: { block: ReportBlock }) {
  const data = block.data ?? [];
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const sorted = [...data].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)).slice(0, 4);
  const share = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{block.title || "Total"}</p>
      <p className="mt-1 bg-gradient-to-r from-fuchsia-400 via-indigo-300 to-cyan-300 bg-clip-text text-3xl font-bold tabular-nums text-transparent">
        {fullValue(total)}
      </p>
      {sorted.length > 1 && (
        <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
          {sorted.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-slate-400">{d.name}</span>
              <div className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${share(Number(d.value) || 0)}%`, background: NEON[i % NEON.length], boxShadow: `0 0 6px ${NEON[i % NEON.length]}` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right font-semibold tabular-nums text-slate-100">
                {compactValue(Number(d.value) || 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NeonTable({ block }: { block: ReportBlock }) {
  const isNumeric = (cell: unknown) =>
    typeof cell === "string" || typeof cell === "number"
      ? /^-?[\d\s.,]+(?:\s*(?:€|%|k€|M€|j|jours))?$/.test(String(cell).trim())
      : false;
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.04] text-[11px] uppercase tracking-widest text-slate-500">
            {(block.columns ?? []).map((c, i) => (
              <th key={i} className="px-3 py-2.5 font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(block.rows ?? []).map((r, ri) => (
            <tr key={ri} className="border-b border-white/5 transition last:border-0 hover:bg-indigo-500/10">
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-2 ${isNumeric(cell) ? "text-right font-medium tabular-nums text-cyan-200" : "text-slate-300"}`}
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

function ReportBlocks({ spec }: { spec: ReportSpec }) {
  // Regroupe les blocs KPI consécutifs sur une même rangée pleine largeur.
  const groups: ReportBlock[][] = [];
  for (const b of spec.blocks) {
    const last = groups[groups.length - 1];
    if (b.type === "kpi" && last && last[0]?.type === "kpi") last.push(b);
    else groups.push([b]);
  }
  return (
    <div className="space-y-6">
      {groups.map((group, gi) => {
        if (group[0].type === "kpi") {
          return (
            <div key={gi} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.map((b, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">{b.label}</div>
                  <div className="mt-1 bg-gradient-to-r from-fuchsia-400 via-indigo-300 to-cyan-300 bg-clip-text text-2xl font-bold tabular-nums text-transparent">
                    {b.value}
                  </div>
                  {b.hint && <div className="mt-0.5 text-[11px] text-slate-500">{b.hint}</div>}
                </div>
              ))}
            </div>
          );
        }
        const b = group[0];
        return (
          <div key={gi}>
            {b.title && (
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                <span className="h-1 w-1 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                {b.title}
              </div>
            )}
            {b.type === "table" ? <NeonTable block={b} /> : b.type === "bloc" ? <NeonBloc block={b} /> : <NeonChart block={b} />}
          </div>
        );
      })}
    </div>
  );
}

/** Graphique seul (routine ayant renvoyé propose_chart au lieu d'un rapport). */
function ChartOnly({ chart }: { chart: ChartProposal }) {
  const type = (chart.defaultType || chart.suggestedTypes?.[0] || "bar") as ReportBlock["type"];
  return <NeonChart block={{ type, data: chart.data }} />;
}

export function RoutineReportCard({ report: r, onDelete }: { report: SavedReport; onDelete: (id: string) => void }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-slate-950 shadow-[0_0_60px_-18px_rgba(99,102,241,0.5)]">
      {/* Halos néon + grille — la touche futuriste du cockpit */}
      <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-1/2 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      <div className="relative z-10 p-5 sm:p-7">
        {/* En-tête */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 shadow-[0_0_14px_-4px_#e879f9]">
                🕘 Routine{r.routineLabel ? ` · ${r.routineLabel}` : ""}
              </span>
              <span className="text-[11px] text-slate-500">Généré le {fmtDate(r.savedAt)} · {r.agentLabel}</span>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-slate-50 sm:text-xl">{stripPeriodFromTitle(r.title)}</h3>
            {r.summary && <p className="mt-1 max-w-3xl text-sm text-slate-400">{r.summary}</p>}
          </div>
          <button
            onClick={() => onDelete(r.id)}
            className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
          >
            Supprimer
          </button>
        </div>

        {/* Rapport visuel pleine largeur */}
        <div className="mt-6">
          {r.report ? <ReportBlocks spec={r.report} /> : r.chart ? <ChartOnly chart={r.chart} /> : null}
        </div>

        {/* Analyse écrite exhaustive de l'agent */}
        {r.analysis && (
          <div className="mt-7 border-t border-white/10 pt-5">
            <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              <span className="h-1 w-1 rounded-full bg-fuchsia-400 shadow-[0_0_6px_#e879f9]" />
              Analyse détaillée
            </div>
            <p className="max-w-4xl whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{r.analysis}</p>
          </div>
        )}
      </div>
    </article>
  );
}
