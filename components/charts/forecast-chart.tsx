"use client";

/**
 * Graphique du prévisionnel de trésorerie — 3 scénarios (prudent / probable /
 * ambitieux) sur 12 mois. recharts, même langage visuel cockpit que
 * treso-charts.tsx : scénario probable en aire dégradée indigo, prudent et
 * ambitieux en pointillés, ligne de flottaison zéro, tooltip ombré.
 */

import { useId } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export type ForecastChartPoint = {
  label: string;
  prudent: number;
  probable: number;
  ambitieux: number;
};

const SCENARIOS: Array<{ key: keyof Omit<ForecastChartPoint, "label">; label: string; color: string }> = [
  { key: "ambitieux", label: "Ambitieux (récurrent + pipeline plein)", color: "#059669" },
  { key: "probable", label: "Probable (récurrent + pipeline pondéré)", color: "#4f46e5" },
  { key: "prudent", label: "Prudent (récurrent ralenti, sans pipeline)", color: "#e11d48" },
];

const fmtCompact = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  if (abs >= 1_000) return `${Math.round(v / 1_000).toLocaleString("fr-FR")} k€`;
  return `${Math.round(v).toLocaleString("fr-FR")} €`;
};
const fmtFull = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
  fontSize: 12,
  padding: "8px 10px",
} as const;

export function ForecastChart({ points }: { points: ForecastChartPoint[] }) {
  const gId = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (points.length === 0) return null;
  const hasNegative = points.some((p) => p.prudent < 0 || p.probable < 0 || p.ambitieux < 0);
  const scenarioLabel = (key: string) => SCENARIOS.find((s) => s.key === key)?.label ?? key;

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={points} margin={{ top: 8, right: 8 }}>
          <defs>
            <linearGradient id={`fcArea-${gId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} minTickGap={18} />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={fmtCompact}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [fmtFull(Number(value)), scenarioLabel(String(name))]}
            labelStyle={{ fontWeight: 600, color: "#0f172a" }}
          />
          {/* Ligne de flottaison : en dessous, la trésorerie est négative. */}
          {hasNegative && <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="5 4" opacity={0.5} />}
          <Line
            type="monotone"
            dataKey="ambitieux"
            stroke="#059669"
            strokeWidth={1.6}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3.5 }}
          />
          <Line
            type="monotone"
            dataKey="prudent"
            stroke="#e11d48"
            strokeWidth={1.6}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3.5 }}
          />
          <Area
            type="monotone"
            dataKey="probable"
            stroke="#4f46e5"
            strokeWidth={2.5}
            strokeLinejoin="round"
            fill={`url(#fcArea-${gId})`}
            dot={{ r: 2.5, fill: "#4f46e5", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap items-center gap-4">
        {SCENARIOS.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
