"use client";

/**
 * Adaptive KPI visualization component.
 * Renders a gauge, bar, or simple value depending on the metric type.
 */

type Props = {
  label: string;
  value: string | null;
};

function detectType(label: string, value: string): "gauge" | "bar" | "currency" | "count" | "text" {
  const l = label.toLowerCase();
  const v = value.toLowerCase();
  // Gauge for percentages
  if (l.includes("%") || l.includes("taux") || l.includes("score") || l.includes("complétude")) return "gauge";
  // Currency for money values
  if (v.includes("€") || l.includes("(€)") || l.includes("ca ") || l.includes("mrr") || l.includes("arr") || l.includes("montant")) return "currency";
  // Bar for comparisons with "·"
  if (v.includes("·")) return "bar";
  // Count for numeric values
  if (/^\d/.test(value)) return "count";
  return "text";
}

function extractPercent(value: string): number {
  const match = value.match(/(\d+)\s*%/);
  return match ? Math.min(100, parseInt(match[1])) : 0;
}

function GaugeViz({ value, pct }: { value: string; pct: number }) {
  const color = pct >= 80 ? "text-emerald-500" : pct >= 50 ? "text-blue-500" : pct >= 25 ? "text-amber-500" : "text-red-400";
  const bgColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : pct >= 25 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1">
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${bgColor} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className={`text-xs font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function BarViz({ value }: { value: string }) {
  // Split by · and show as side-by-side bars
  const parts = value.split("·").map((s) => s.trim()).filter(Boolean);
  // Extract numbers for proportions
  const nums = parts.map((p) => {
    const m = p.match(/([\d\s,.]+)/);
    return m ? parseFloat(m[1].replace(/\s/g, "").replace(",", ".")) : 0;
  });
  const max = Math.max(...nums, 1);

  return (
    <div className="space-y-1">
      {parts.map((part, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">
            <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${i === 0 ? "bg-indigo-400" : "bg-slate-300"}`}
                style={{ width: `${Math.max(5, (nums[i] / max) * 100)}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] text-slate-600 shrink-0 tabular-nums">{part}</span>
        </div>
      ))}
    </div>
  );
}

function CurrencyViz({ value }: { value: string }) {
  return (
    <span className="text-sm font-semibold text-slate-900 tabular-nums">{value}</span>
  );
}

function CountViz({ value }: { value: string }) {
  return (
    <span className="text-sm font-medium text-slate-800 tabular-nums">{value}</span>
  );
}

export function KpiVisual({ label, value }: Props) {
  if (value === null) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 bg-slate-50/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-200" />
          <span className="text-[11px] text-slate-400 leading-tight">{label}</span>
        </div>
        <span className="text-[11px] text-slate-300">—</span>
      </div>
    );
  }

  const type = detectType(label, value);

  return (
    <div className="rounded-lg px-3 py-2.5 bg-slate-50">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-slate-500 leading-tight">{label}</span>
      </div>
      {type === "gauge" && <GaugeViz value={value} pct={extractPercent(value)} />}
      {type === "bar" && <BarViz value={value} />}
      {type === "currency" && <CurrencyViz value={value} />}
      {type === "count" && <CountViz value={value} />}
      {type === "text" && <span className="text-xs text-slate-700">{value}</span>}
    </div>
  );
}
