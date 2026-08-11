"use client";

/**
 * Graphiques Trésorerie — recharts, même langage visuel que les courbes
 * cockpit des rapports d'agents et des tables de données (agent-report.tsx) :
 * courbes lissées (monotone), aire en dégradé indigo, axes épurés sans trait,
 * tooltip ombré, valeur compacte au-dessus du dernier point.
 *
 * - TresoLineChart  : évolution d'une série (solde, cumul, marge mensuelle…).
 * - SimpleBarsChart : barres mono-série (CA signé par mois, tickets créés…).
 * - TresoFlowsChart : encaissements (vert) vs décaissements (rouge) par mois.
 */

import { useId } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export type ChartUnit = "currency" | "count";
export type SeriesPoint = { label: string; value: number };
export type FlowsPoint = { label: string; in: number; out: number };

/** Format compact pour l'axe Y (« 32 M€ », « 450 k€ ») — style cockpit. */
function compactValue(v: number, unit: ChartUnit): string {
  const cur = unit === "currency";
  const abs = Math.abs(v);
  if (abs >= 1_000_000)
    return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M${cur ? "€" : ""}`;
  if (abs >= 1_000) return `${Math.round(v / 1_000).toLocaleString("fr-FR")} k${cur ? "€" : ""}`;
  return `${Math.round(v).toLocaleString("fr-FR")}${cur ? " €" : ""}`;
}

/** Format complet pour le tooltip (« 5 430 200 € »). */
function fullValue(v: number, unit: ChartUnit): string {
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  return new Intl.NumberFormat("fr-FR").format(Math.round(v));
}

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
  fontSize: 12,
  padding: "8px 10px",
} as const;

function cockpitAxes(unit: ChartUnit) {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} minTickGap={18} />
      <YAxis
        tick={{ fontSize: 10, fill: "#94a3b8" }}
        tickLine={false}
        axisLine={false}
        width={52}
        tickFormatter={(v: number) => compactValue(v, unit)}
      />
    </>
  );
}

/** Valeur affichée au-dessus du dernier point — signature des courbes cockpit. */
function lastPointLabel(count: number, unit: ChartUnit) {
  return function LastPointLabel(props: { x?: unknown; y?: unknown; index?: number; value?: unknown }) {
    const { x, y, index, value } = props;
    if (index !== count - 1 || typeof x !== "number" || typeof y !== "number" || typeof value !== "number") return <g />;
    return (
      <text x={x} y={y - 10} textAnchor="end" fontSize={11} fontWeight={600} fill="#4f46e5">
        {compactValue(value, unit)}
      </text>
    );
  };
}

export function TresoLineChart({ points, unit = "currency" }: { points: SeriesPoint[]; unit?: ChartUnit }) {
  const gId = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (points.length === 0) return null;
  const hasNegative = points.some((p) => p.value < 0);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={points} margin={{ top: 18, right: 8 }}>
        <defs>
          <linearGradient id={`tresoArea-${gId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {cockpitAxes(unit)}
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [fullValue(Number(value), unit), null]}
          labelStyle={{ fontWeight: 600, color: "#0f172a" }}
        />
        {hasNegative && <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="5 4" opacity={0.5} />}
        <Area
          type="monotone"
          dataKey="value"
          stroke="#6366f1"
          strokeWidth={2.25}
          strokeLinejoin="round"
          fill={`url(#tresoArea-${gId})`}
          dot={{ r: 2.5, fill: "#6366f1", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          label={lastPointLabel(points.length, unit)}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Barres mono-série (ex : CA signé par mois, tickets créés par mois…). */
export function SimpleBarsChart({
  points,
  color = "#6366f1",
  unit = "currency",
}: {
  points: SeriesPoint[];
  color?: string;
  unit?: ChartUnit;
}) {
  if (points.length === 0) return null;
  const maxValue = Math.max(...points.map((p) => p.value));
  const showBarLabels = points.length <= 12;
  // Valeur compacte AU-DESSUS de chaque barre (retranscription chiffrée
  // directe, sans survol) tant que la densité le permet — barre max en avant.
  const barLabel = (props: { x?: unknown; y?: unknown; width?: unknown; value?: unknown }) => {
    const { x, y, width, value } = props;
    if (!showBarLabels || typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof value !== "number") return <g />;
    return (
      <text
        x={x + width / 2}
        y={value < 0 ? y + 14 : y - 7}
        textAnchor="middle"
        fontSize={10.5}
        fontWeight={600}
        fill={value === maxValue ? "#c026d3" : "#4f46e5"}
      >
        {compactValue(value, unit)}
      </text>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={points} margin={{ top: 18, right: 8 }}>
        {cockpitAxes(unit)}
        <Tooltip
          cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [fullValue(Number(value), unit), null]}
          labelStyle={{ fontWeight: 600, color: "#0f172a" }}
        />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={34} label={barLabel} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TresoFlowsChart({ points }: { points: FlowsPoint[] }) {
  if (points.length === 0) return null;
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={points} margin={{ top: 8, right: 8 }} barGap={3}>
          {cockpitAxes("currency")}
          <Tooltip
            cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [fullValue(Number(value), "currency"), name === "in" ? "Encaissements" : "Décaissements"]}
            labelStyle={{ fontWeight: 600, color: "#0f172a" }}
          />
          <Bar dataKey="in" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={22} />
          <Bar dataKey="out" fill="#f43f5e" radius={[5, 5, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Encaissements
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="inline-block h-2 w-2 rounded-sm bg-rose-500" /> Décaissements
        </span>
      </div>
    </div>
  );
}
