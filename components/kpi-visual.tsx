"use client";

type Props = { label: string; value: string | null };

type KpiType = "gauge" | "bars" | "sparkline" | "currency" | "count" | "text";

function detectType(label: string, value: string): KpiType {
  const l = label.toLowerCase();
  // Sparkline for evolution/trend data with arrows
  if (value.includes("→")) return "sparkline";
  // Gauge for single percentages
  if ((l.includes("%") || l.includes("taux") || l.includes("score") || l.includes("complétude")) && !value.includes("·")) return "gauge";
  // Multi-bar for values with · separator
  if (value.includes("·")) return "bars";
  // Currency
  if (value.includes("€") || l.includes("(€)") || l.includes("ca ") || l.includes("mrr") || l.includes("arr") || l.includes("montant")) return "currency";
  // Count
  if (/^\d/.test(value)) return "count";
  return "text";
}

function extractPercent(value: string): number {
  const match = value.match(/(\d+)\s*%/);
  return match ? Math.min(100, parseInt(match[1])) : 0;
}

function Gauge({ value, pct }: { value: string; pct: number }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : pct >= 25 ? "bg-amber-500" : "bg-red-400";
  const textColor = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-blue-600" : pct >= 25 ? "text-amber-600" : "text-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-semibold tabular-nums ${textColor}`}>{value}</span>
    </div>
  );
}

function Bars({ value }: { value: string }) {
  const parts = value.split("·").map((s) => s.trim()).filter(Boolean);
  const nums = parts.map((p) => {
    const m = p.match(/([\d\s,.]+)/);
    return m ? parseFloat(m[1].replace(/\s/g, "").replace(",", ".")) : 0;
  });
  const max = Math.max(...nums, 1);
  const colors = ["bg-indigo-500", "bg-slate-400", "bg-amber-400", "bg-emerald-400", "bg-fuchsia-400"];

  return (
    <div className="space-y-1.5">
      {parts.map((part, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${colors[i % colors.length]} transition-all duration-500`}
              style={{ width: `${Math.max(8, (nums[i] / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-600 shrink-0 tabular-nums whitespace-nowrap">{part}</span>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ value }: { value: string }) {
  // Format: "01/26 693 → 02/26 412 → 03/26 120 → 04/26 5"
  const points = value.split("→").map((s) => s.trim());
  const nums = points.map((p) => {
    const m = p.match(/([\d\s,.]+)$/);
    return m ? parseFloat(m[1].replace(/\s/g, "").replace(",", ".")) : 0;
  });
  const labels = points.map((p) => p.replace(/([\d\s,.]+)$/, "").trim());
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums);
  const range = max - min || 1;

  // SVG sparkline
  const w = 140;
  const h = 28;
  const padding = 2;
  const pathPoints = nums.map((n, i) => {
    const x = padding + (i / Math.max(1, nums.length - 1)) * (w - 2 * padding);
    const y = padding + (1 - (n - min) / range) * (h - 2 * padding);
    return `${x},${y}`;
  });
  const pathD = pathPoints.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(" ");

  return (
    <div>
      <div className="flex items-end gap-2">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7 shrink-0">
          <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {nums.map((n, i) => {
            const x = padding + (i / Math.max(1, nums.length - 1)) * (w - 2 * padding);
            const y = padding + (1 - (n - min) / range) * (h - 2 * padding);
            return <circle key={i} cx={x} cy={y} r="2.5" fill="#6366f1" />;
          })}
        </svg>
      </div>
      <div className="flex justify-between mt-1">
        {labels.map((lbl, i) => (
          <span key={i} className="text-[8px] text-slate-400 tabular-nums">{lbl} <span className="font-medium text-slate-600">{nums[i]}</span></span>
        ))}
      </div>
    </div>
  );
}

function Currency({ value }: { value: string }) {
  return <span className="text-sm font-semibold text-slate-900 tabular-nums">{value}</span>;
}

function Count({ value }: { value: string }) {
  return <span className="text-sm font-medium text-slate-800 tabular-nums">{value}</span>;
}

export function KpiVisual({ label, value }: Props) {
  if (value === null) {
    return (
      <div className="rounded-lg px-3 py-2.5 bg-slate-50/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-200" />
            <span className="text-[11px] text-slate-400">{label}</span>
          </div>
          <span className="text-[11px] text-slate-300">—</span>
        </div>
      </div>
    );
  }

  const type = detectType(label, value);

  return (
    <div className="rounded-lg px-3 py-2.5 bg-slate-50">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-slate-500 leading-tight">{label}</span>
      </div>
      {type === "gauge" && <Gauge value={value} pct={extractPercent(value)} />}
      {type === "bars" && <Bars value={value} />}
      {type === "sparkline" && <Sparkline value={value} />}
      {type === "currency" && <Currency value={value} />}
      {type === "count" && <Count value={value} />}
      {type === "text" && <span className="text-xs text-slate-700">{value}</span>}
    </div>
  );
}
