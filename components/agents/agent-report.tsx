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
import type { ReportSpec, ReportBlock } from "@/lib/ai/agents/agent-runtime";

const COLORS = ["#d946ef", "#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

export type ChartUnit = "currency" | "percent" | "count" | string | null;

/** Format compact pour l'axe Y (« 32 M€ », « 450 k€ ») — style cockpit Trésorerie. */
function compactValue(v: number, unit?: ChartUnit): string {
  if (unit === "percent") return `${Math.round(v)} %`;
  const cur = unit === "currency";
  const abs = Math.abs(v);
  if (abs >= 1_000_000)
    return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M${cur ? "€" : ""}`;
  if (abs >= 1_000) return `${Math.round(v / 1_000).toLocaleString("fr-FR")} k${cur ? "€" : ""}`;
  return `${Math.round(v).toLocaleString("fr-FR")}${cur ? " €" : ""}`;
}

/** Format complet pour le tooltip (« 5 430 200 € »). */
function fullValue(v: number, unit?: ChartUnit): string {
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${v.toFixed(1)} %`;
  return new Intl.NumberFormat("fr-FR").format(v);
}

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
  fontSize: 12,
  padding: "8px 10px",
} as const;

export function ReportChart({
  block,
  unit,
  showTotal = false,
}: {
  block: ReportBlock;
  unit?: ChartUnit;
  /** Affiche le total DANS la visualisation : badge (barres/courbe) ou centre de l'anneau. */
  showTotal?: boolean;
}) {
  const data = block.data ?? [];
  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const totalBadge = showTotal ? (
    <div className="pointer-events-none absolute right-1 top-0 z-10 rounded-md border border-indigo-100 bg-indigo-50/90 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
      Total · {fullValue(total, unit)}
    </div>
  ) : null;

  const tooltip = (
    <Tooltip
      contentStyle={TOOLTIP_STYLE}
      formatter={(value) => [fullValue(Number(value), unit), null]}
      labelStyle={{ fontWeight: 600, color: "#0f172a" }}
    />
  );

  if (block.type === "donut") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          {/* Total au centre de l'anneau — l'espace vide lui est destiné. */}
          {showTotal && (
            <>
              <text x="50%" y="46%" textAnchor="middle" fontSize={10} fill="#94a3b8">Total</text>
              <text x="50%" y="56%" textAnchor="middle" fontSize={14} fontWeight={700} fill="#0f172a">
                {compactValue(total, unit)}
              </text>
            </>
          )}
          {tooltip}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const axis = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
      <YAxis
        tick={{ fontSize: 10, fill: "#94a3b8" }}
        tickLine={false}
        axisLine={false}
        width={52}
        tickFormatter={(v: number) => compactValue(v, unit)}
      />
      {tooltip}
    </>
  );

  // Valeur affichée au-dessus du dernier point — signature des courbes cockpit.
  const lastPointLabel = (props: { x?: unknown; y?: unknown; index?: number; value?: unknown }) => {
    const { x, y, index, value } = props;
    if (index !== data.length - 1 || typeof x !== "number" || typeof y !== "number" || typeof value !== "number") return <g />;
    return (
      <text x={x} y={y - 10} textAnchor="end" fontSize={11} fontWeight={600} fill="#4f46e5">
        {compactValue(value, unit)}
      </text>
    );
  };

  if (block.type === "line" || block.type === "area") {
    return (
      <div className="relative">
        {totalBadge}
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 18, right: 8 }}>
          <defs>
            <linearGradient id="agentArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {axis}
          <Area
            type="monotone"
            dataKey="value"
            stroke="#6366f1"
            strokeWidth={2.25}
            strokeLinejoin="round"
            fill="url(#agentArea)"
            dot={{ r: 2.5, fill: "#6366f1", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            label={lastPointLabel}
          />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }
  // bar (défaut)
  return (
    <div className="relative">
      {totalBadge}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: showTotal ? 18 : 4 }}>
          {axis}
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgentReport({ spec }: { spec: ReportSpec }) {
  // Regroupe les blocs KPI consécutifs sur une même rangée.
  const groups: ReportBlock[][] = [];
  for (const b of spec.blocks) {
    const last = groups[groups.length - 1];
    if (b.type === "kpi" && last && last[0]?.type === "kpi") last.push(b);
    else groups.push([b]);
  }

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-white p-4">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Rapport</div>
      <h3 className="text-sm font-semibold text-slate-900">{stripPeriodFromTitle(spec.title)}</h3>
      {spec.summary && <p className="mt-0.5 text-sm text-slate-600">{spec.summary}</p>}

      <div className="mt-3 space-y-4">
        {groups.map((group, gi) => {
          if (group[0].type === "kpi") {
            return (
              <div key={gi} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.map((b, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">{b.label}</div>
                    <div className="mt-0.5 text-lg font-semibold text-slate-900">{b.value}</div>
                    {b.hint && <div className="text-[11px] text-slate-400">{b.hint}</div>}
                  </div>
                ))}
              </div>
            );
          }
          const b = group[0];
          if (b.type === "table") {
            return (
              <div key={gi}>
                {b.title && <div className="mb-1 text-xs font-medium text-slate-600">{b.title}</div>}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        {(b.columns ?? []).map((c, i) => (
                          <th key={i} className="px-2 py-1.5 font-medium">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(b.rows ?? []).map((r, ri) => (
                        <tr key={ri} className="border-b border-slate-100">
                          {r.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1.5 text-slate-700">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          return (
            <div key={gi}>
              {b.title && <div className="mb-1 text-xs font-medium text-slate-600">{b.title}</div>}
              <ReportChart block={b} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
