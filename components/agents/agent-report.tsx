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
import { EditableReportTable } from "./editable-report-table";
import { bucketTickInterval, currentLocale, formatBucketLabel, useLocale } from "@/lib/locale";
import type { ReportSpec, ReportBlock } from "@/lib/ai/agents/agent-runtime";

// Palette catégorielle VALIDÉE (script dataviz : bande de luminance, chroma,
// séparation daltonisme ΔE ≥ 8 par paire adjacente, plancher vision normale,
// contraste ≥ 3:1 sur carte blanche). Ordre FIXE, jamais recyclé — le fuchsia
// Revold reste la 1re série. Ne pas réordonner sans re-valider.
const COLORS = ["#c026d3", "#0d9488", "#d97706", "#4f46e5", "#db2777", "#0284c7", "#4d7c0f"];

export type ChartUnit = "currency" | "percent" | "count" | string | null;

/** Format compact pour l'axe Y (« 32 M€ », « 450 k€ ») — style cockpit Trésorerie. */
function compactValue(v: number, unit?: ChartUnit): string {
  const loc = currentLocale();
  if (unit === "percent") return `${Math.round(v)} %`;
  const cur = unit === "currency";
  const abs = Math.abs(v);
  if (abs >= 1_000_000)
    return `${(v / 1_000_000).toLocaleString(loc, { maximumFractionDigits: 1 })} M${cur ? "€" : ""}`;
  if (abs >= 1_000) return `${Math.round(v / 1_000).toLocaleString(loc)} k${cur ? "€" : ""}`;
  return `${Math.round(v).toLocaleString(loc)}${cur ? " €" : ""}`;
}

/** Format complet pour le tooltip (« 5 430 200 € »). */
function fullValue(v: number, unit?: ChartUnit): string {
  const loc = currentLocale();
  if (unit === "currency")
    return new Intl.NumberFormat(loc, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${v.toFixed(1)} %`;
  return new Intl.NumberFormat(loc).format(v);
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
  onBucketClick,
}: {
  block: ReportBlock;
  unit?: ChartUnit;
  /** Affiche le total DANS la visualisation : badge (barres/courbe) ou centre de l'anneau. */
  showTotal?: boolean;
  /** Drill-down : clic sur une barre / un segment / un point → détail des enregistrements du bucket. */
  onBucketClick?: (bucket: { raw: string; label: string }) => void;
}) {
  // Buckets temporels → libellés localisés (« 2026-01 » → « Janvier 2026 »),
  // dans la langue choisie (Mon compte → Langue & formats). Les clés non
  // temporelles (étape, statut…) passent telles quelles. rawName = clé BRUTE
  // du moteur, conservée pour le drill-down.
  const locale = useLocale();
  // Espacement des ticks pour les fréquences jour (tous les 5 jours) et
  // semaine (toutes les semaines, 7 jours entre libellés) — calculé sur les
  // clés BRUTES avant traduction.
  const tickInterval = bucketTickInterval((block.data ?? []).map((d) => d.name));
  const data = (block.data ?? []).map((d) => ({ ...d, rawName: d.name, name: formatBucketLabel(d.name, locale) }));
  // Déclenche le drill-down depuis un élément recharts (payload ou datum direct).
  const fireBucket = (d: unknown) => {
    if (!onBucketClick) return;
    const o = d as { rawName?: string; name?: string; payload?: { rawName?: string; name?: string } } | null;
    const p = o?.payload?.rawName ? o.payload : o;
    if (p?.rawName) onBucketClick({ raw: p.rawName, label: p.name ?? p.rawName });
  };
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

  // « Bloc » cockpit (inspiré du prévisionnel Trésorerie) : le chiffre en héros,
  // en chiffres tabulaires, avec la ventilation des principaux segments en
  // dessous — la retranscription chiffrée la plus directe possible.
  if (block.type === "bloc") {
    const sorted = [...data].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const top = sorted.slice(0, 3);
    const rest = sorted.slice(3);
    const restTotal = rest.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const share = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
    return (
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {block.title || "Total"}
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{fullValue(total, unit)}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {data.length} segment{data.length > 1 ? "s" : ""}
        </p>
        {data.length > 1 && (
          <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
            {top.map((d, i) => (
              <div
                key={i}
                onClick={() => fireBucket(d)}
                className={`flex items-center gap-2 text-xs ${onBucketClick ? "cursor-pointer rounded-md px-1 -mx-1 transition hover:bg-indigo-50/60" : ""}`}
                title={onBucketClick ? "Voir le détail" : undefined}
              >
                <span className="min-w-0 flex-1 truncate text-slate-600">{d.name}</span>
                <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${i === 0 ? "bg-fuchsia-500" : "bg-indigo-400"}`}
                    style={{ width: `${share(Number(d.value) || 0)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-semibold tabular-nums text-slate-900">
                  {compactValue(Number(d.value) || 0, unit)}
                </span>
                <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
                  {share(Number(d.value) || 0)} %
                </span>
              </div>
            ))}
            {rest.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-slate-400">+ {rest.length} autres</span>
                <span className="w-20 shrink-0 text-right font-semibold tabular-nums text-slate-500">
                  {compactValue(restTotal, unit)}
                </span>
                <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{share(restTotal)} %</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (block.type === "donut") {
    // Légende chiffrée à côté de l'anneau — même exigence de « retranscription
    // chiffrée » que les courbes cockpit : chaque segment affiche sa valeur et
    // sa part, sans devoir survoler. Au-delà de 7 segments, le reste est agrégé.
    const LEGEND_MAX = 7;
    const legendRows = data.slice(0, LEGEND_MAX);
    const rest = data.slice(LEGEND_MAX);
    const restTotal = rest.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const share = (v: number) => (total > 0 ? `${Math.round((v / total) * 100)} %` : "—");
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative h-[200px] w-[200px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={86}
                paddingAngle={2}
                cornerRadius={4}
                stroke="#fff"
                strokeWidth={2}
                onClick={fireBucket}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} cursor={onBucketClick ? "pointer" : undefined} />
                ))}
              </Pie>
              {/* Total au centre de l'anneau — l'espace vide lui est destiné. */}
              {showTotal && (
                <>
                  <text x="50%" y="46%" textAnchor="middle" fontSize={10} fill="#94a3b8">Total</text>
                  <text x="50%" y="57%" textAnchor="middle" fontSize={14} fontWeight={700} fill="#0f172a">
                    {compactValue(total, unit)}
                  </text>
                </>
              )}
              {tooltip}
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="min-w-0 flex-1 space-y-1">
          {legendRows.map((d, i) => (
            <li
              key={i}
              onClick={() => fireBucket(d)}
              title={onBucketClick ? "Voir le détail" : undefined}
              className={`flex items-center gap-2 text-xs ${onBucketClick ? "-mx-1 cursor-pointer rounded-md px-1 transition hover:bg-indigo-50/60" : ""}`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="min-w-0 flex-1 truncate text-slate-600">{d.name}</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">{fullValue(Number(d.value) || 0, unit)}</span>
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{share(Number(d.value) || 0)}</span>
            </li>
          ))}
          {rest.length > 0 && (
            <li className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-200" />
              <span className="min-w-0 flex-1 truncate text-slate-400">+ {rest.length} autres</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-500">{fullValue(restTotal, unit)}</span>
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{share(restTotal)}</span>
            </li>
          )}
        </ul>
      </div>
    );
  }

  const axis = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} interval={tickInterval} />
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
      <div className="relative" style={onBucketClick ? { cursor: "pointer" } : undefined}>
        {totalBadge}
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart
            data={data}
            margin={{ top: 18, right: 8 }}
            // Drill-down : clic sur un point de la courbe → détail du bucket actif.
            onClick={(st) => fireBucket((st as { activePayload?: { payload?: unknown }[] } | null)?.activePayload?.[0]?.payload)}
          >
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
  // bar (défaut) — même langage que les courbes cockpit : monochrome indigo en
  // dégradé, barre maximale mise en avant en fuchsia, et valeur compacte
  // affichée AU-DESSUS de chaque barre (retranscription chiffrée directe,
  // sans survol) tant que la densité le permet.
  const maxValue = Math.max(...data.map((d) => Number(d.value) || 0));
  const showBarLabels = data.length <= 12;
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
        fill={value === maxValue ? "#c026d3" : "#4f46e5"}
      >
        {compactValue(value, unit)}
      </text>
    );
  };
  return (
    <div className="relative">
      {totalBadge}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 22, right: 8 }}>
          <defs>
            <linearGradient id="agentBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.45} />
            </linearGradient>
            <linearGradient id="agentBarMax" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d946ef" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#d946ef" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          {axis}
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48} label={barLabel} onClick={fireBucket}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={(Number(d.value) || 0) === maxValue ? "url(#agentBarMax)" : "url(#agentBar)"}
                cursor={onBucketClick ? "pointer" : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgentReport({
  spec,
  onBlockBucketClick,
  onSpecChange,
}: {
  spec: ReportSpec;
  /** Drill-down : clic sur un bucket d'un bloc PORTEUR de query déterministe. */
  onBlockBucketClick?: (block: ReportBlock, bucket: { raw: string; label: string }) => void;
  /**
   * B11 — tableaux éditables : colonnes modifiables/ajoutables/supprimables +
   * sélection en masse des lignes. Absent → tableaux en lecture seule.
   */
  onSpecChange?: (next: ReportSpec) => void;
}) {
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
                    <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{b.value}</div>
                    {b.hint && <div className="text-[11px] text-slate-400">{b.hint}</div>}
                  </div>
                ))}
              </div>
            );
          }
          const b = group[0];
          if (b.type === "table") {
            const blockIndex = spec.blocks.indexOf(b);
            return (
              <EditableReportTable
                key={gi}
                title={b.title}
                columns={b.columns ?? []}
                rows={b.rows ?? []}
                onChange={
                  onSpecChange
                    ? (patch) =>
                        onSpecChange({
                          ...spec,
                          blocks: spec.blocks.map((x, i) =>
                            i === blockIndex
                              ? { ...x, columns: patch.columns, rows: patch.rows.map((r) => r.map(String)) }
                              : x,
                          ),
                        })
                    : undefined
                }
              />
            );
          }
          return (
            <div key={gi}>
              {b.title && <div className="mb-1 text-xs font-medium text-slate-600">{b.title}</div>}
              <ReportChart
                block={b}
                onBucketClick={
                  onBlockBucketClick && b.query ? (bucket) => onBlockBucketClick(b, bucket) : undefined
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
