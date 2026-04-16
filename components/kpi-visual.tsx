"use client";

type Props = { label: string; value: string | null; format?: "auto" | "gauge" | "bar_v" | "bar_h" | "sparkline" | "evaluation" };

type KpiType = "gauge" | "bar_v" | "bar_h" | "sparkline" | "evaluation" | "currency" | "count" | "text";

function detectType(label: string, value: string): KpiType {
  const l = label.toLowerCase();
  // Sparkline for evolution/trend data with arrows
  if (value.includes("→")) return "sparkline";
  // Gauge for single percentages
  if ((l.includes("%") || l.includes("taux") || l.includes("score") || l.includes("complétude") || l.includes("connexion")) && !value.includes("·")) return "gauge";
  // Evaluation for single score-like values
  if (l.includes("durée") || l.includes("moyenne") || l.includes("cycle") || l.includes("délai")) return "evaluation";
  // Horizontal bars for multi-values
  if (value.includes("·")) return "bar_h";
  // Currency
  if (value.includes("€") || l.includes("(€)") || l.includes("ca ") || l.includes("mrr") || l.includes("arr") || l.includes("montant") || l.includes("revenue") || l.includes("chiffre")) return "currency";
  // Count
  if (/^\d/.test(value)) return "count";
  return "text";
}

function extractPercent(value: string): number {
  const match = value.match(/([\d,.]+)\s*%/);
  return match ? Math.min(100, parseFloat(match[1].replace(",", "."))) : 0;
}

// ── Gauge (circular-feel progress) ──
function Gauge({ value, pct }: { value: string; pct: number }) {
  const gradientId = `gauge-${Math.random().toString(36).slice(2, 8)}`;
  const fromColor = pct >= 70 ? "#10b981" : pct >= 40 ? "#3b82f6" : pct >= 20 ? "#f59e0b" : "#ef4444";
  const toColor = pct >= 70 ? "#059669" : pct >= 40 ? "#6366f1" : pct >= 20 ? "#d97706" : "#dc2626";
  const textColor = pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-blue-600" : pct >= 20 ? "text-amber-600" : "text-red-500";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <svg width="100%" height="100%">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={fromColor} />
              <stop offset="100%" stopColor={toColor} />
            </linearGradient>
          </defs>
          <rect width={`${pct}%`} height="100%" rx="5" fill={`url(#${gradientId})`} />
        </svg>
      </div>
      <span className={`text-sm font-bold tabular-nums ${textColor}`}>{value}</span>
    </div>
  );
}

// ── Horizontal Bars (multi-value comparison) ──
function BarsHorizontal({ value }: { value: string }) {
  const parts = value.split("·").map((s) => s.trim()).filter(Boolean);
  const nums = parts.map((p) => {
    const m = p.match(/([\d\s,.]+)/);
    return m ? parseFloat(m[1].replace(/\s/g, "").replace(",", ".")) : 0;
  });
  const max = Math.max(...nums, 1);
  const gradients = [
    ["#6366f1", "#818cf8"], // indigo
    ["#8b5cf6", "#a78bfa"], // violet
    ["#ec4899", "#f472b6"], // pink
    ["#06b6d4", "#22d3ee"], // cyan
    ["#10b981", "#34d399"], // emerald
    ["#f59e0b", "#fbbf24"], // amber
  ];

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        const pct = Math.max(8, (nums[i] / max) * 100);
        const [from, to] = gradients[i % gradients.length];
        const gId = `bh-${i}-${Math.random().toString(36).slice(2, 6)}`;
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-slate-600 truncate max-w-[70%]">{part.replace(/([\d\s,.€%]+)$/, "").trim() || part}</span>
              <span className="text-[10px] font-semibold text-slate-800 tabular-nums">{part.match(/([\d\s,.€%]+)$/)?.[1]?.trim() || ""}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <svg width="100%" height="100%">
                <defs>
                  <linearGradient id={gId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={from} />
                    <stop offset="100%" stopColor={to} />
                  </linearGradient>
                </defs>
                <rect width={`${pct}%`} height="100%" rx="4" fill={`url(#${gId})`} />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Sparkline (trend over time) ──
function Sparkline({ value }: { value: string }) {
  const points = value.split("→").map((s) => s.trim());
  const nums = points.map((p) => {
    const m = p.match(/([\d\s,.]+)$/);
    return m ? parseFloat(m[1].replace(/\s/g, "").replace(",", ".")) : 0;
  });
  const labels = points.map((p) => p.replace(/([\d\s,.]+)$/, "").trim());
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums);
  const range = max - min || 1;

  const w = 200;
  const h = 36;
  const pad = 4;
  const pathPoints = nums.map((n, i) => {
    const x = pad + (i / Math.max(1, nums.length - 1)) * (w - 2 * pad);
    const y = pad + (1 - (n - min) / range) * (h - 2 * pad);
    return { x, y };
  });
  const pathD = pathPoints.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
  // Area fill
  const areaD = pathD + ` L${pathPoints[pathPoints.length - 1].x},${h} L${pathPoints[0].x},${h} Z`;

  const isUp = nums[nums.length - 1] >= nums[0];
  const strokeColor = isUp ? "#10b981" : "#ef4444";
  const fillFrom = isUp ? "#10b98120" : "#ef444420";
  const fillTo = isUp ? "#10b98105" : "#ef444405";
  const gId = `sp-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9">
        <defs>
          <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillFrom} />
            <stop offset="100%" stopColor={fillTo} />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gId})`} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pathPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={strokeColor} />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        {labels.map((lbl, i) => (
          <span key={i} className="text-[8px] text-slate-400 tabular-nums">{lbl} <span className="font-semibold text-slate-600">{nums[i].toLocaleString("fr-FR")}</span></span>
        ))}
      </div>
    </div>
  );
}

// ── Evaluation (single value with contextual color) ──
function Evaluation({ value, label }: { value: string; label: string }) {
  const num = parseFloat(value.replace(/[^\d,.]/g, "").replace(",", "."));
  const l = label.toLowerCase();
  // Determine if lower is better (cycle, durée, délai)
  const lowerIsBetter = l.includes("cycle") || l.includes("durée") || l.includes("délai") || l.includes("jours");
  const color = lowerIsBetter
    ? (num <= 30 ? "text-emerald-600" : num <= 60 ? "text-blue-600" : num <= 90 ? "text-amber-600" : "text-red-500")
    : (num >= 80 ? "text-emerald-600" : num >= 50 ? "text-blue-600" : num >= 25 ? "text-amber-600" : "text-red-500");
  const bgColor = lowerIsBetter
    ? (num <= 30 ? "bg-emerald-50" : num <= 60 ? "bg-blue-50" : num <= 90 ? "bg-amber-50" : "bg-red-50")
    : (num >= 80 ? "bg-emerald-50" : num >= 50 ? "bg-blue-50" : num >= 25 ? "bg-amber-50" : "bg-red-50");

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${bgColor}`}>
      <span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

// ── Currency (large formatted) ──
function Currency({ value }: { value: string }) {
  return <span className="text-base font-bold text-slate-900 tabular-nums">{value}</span>;
}

// ── Count ──
function Count({ value }: { value: string }) {
  return <span className="text-base font-semibold text-slate-800 tabular-nums">{value}</span>;
}

export function KpiVisual({ label, value, format }: Props) {
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

  const type = format && format !== "auto" ? format : detectType(label, value);

  return (
    <div className="rounded-lg px-3 py-2.5 bg-slate-50">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-slate-500 leading-tight">{label}</span>
      </div>
      {type === "gauge" && <Gauge value={value} pct={extractPercent(value)} />}
      {type === "bar_h" && <BarsHorizontal value={value} />}
      {type === "sparkline" && <Sparkline value={value} />}
      {type === "evaluation" && <Evaluation value={value} label={label} />}
      {type === "currency" && <Currency value={value} />}
      {type === "count" && <Count value={value} />}
      {type === "text" && <span className="text-xs text-slate-700">{value}</span>}
    </div>
  );
}
