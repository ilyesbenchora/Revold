"use client";

type Props = { label: string; value: string | null; format?: "auto" | "gauge" | "bar_v" | "bar_h" | "sparkline" | "evaluation" };

type KpiType = "gauge" | "bar_h" | "sparkline" | "evaluation" | "currency" | "count" | "text";

function detectType(label: string, value: string): KpiType {
  const l = label.toLowerCase();
  if (value.includes("→")) return "sparkline";
  if ((l.includes("%") || l.includes("taux") || l.includes("score") || l.includes("complétude") || l.includes("connexion") || l.includes("enrichissement")) && !value.includes("·")) return "gauge";
  if (l.includes("durée") || l.includes("cycle") || l.includes("délai") || l.includes("moyenne")) {
    if (value.includes("·")) return "bar_h";
    return "evaluation";
  }
  if (value.includes("·")) return "bar_h";
  if (value.includes("€") || l.includes("(€)") || l.includes("ca ") || l.includes("mrr") || l.includes("arr") || l.includes("montant") || l.includes("revenue") || l.includes("chiffre") || l.includes("pipeline")) return "currency";
  if (/^\d/.test(value)) return "count";
  return "text";
}

function extractPercent(value: string): number {
  const match = value.match(/([\d,.]+)\s*%/);
  return match ? Math.min(100, parseFloat(match[1].replace(",", "."))) : 0;
}

function extractNumber(str: string): number {
  // Extract numeric value from strings like "1 000 000 €", "37 500€", "375", "25 000€"
  const cleaned = str.replace(/[^\d,.]/g, "").replace(/\s/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// ── Gauge ──
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

// ── Horizontal Bars ──
function BarsHorizontal({ value }: { value: string }) {
  const parts = value.split("·").map((s) => s.trim()).filter(Boolean);

  // Parse each part: "Pipeline AXMA 25 000 €" → { label: "Pipeline AXMA", num: 25000, display: "25 000 €" }
  const parsed = parts.map((part) => {
    // Try to extract a numeric value (possibly with € or % or "j")
    const numMatch = part.match(/([\d\s,.]+)\s*(€|%|j|deals|won|contacts|par owner)?$/i);
    const num = numMatch ? extractNumber(numMatch[1]) : 0;
    const displayValue = numMatch ? numMatch[0].trim() : "";
    const label = numMatch ? part.slice(0, part.length - numMatch[0].length).trim() : part;
    return { label: label || part, num, displayValue: displayValue || String(num) };
  });

  const max = Math.max(...parsed.map((p) => p.num), 1);

  // Fuchsia/indigo gradient palette
  const gradients: [string, string][] = [
    ["#d946ef", "#a855f7"], // fuchsia→purple
    ["#8b5cf6", "#6366f1"], // violet→indigo
    ["#ec4899", "#f472b6"], // pink
    ["#06b6d4", "#0ea5e9"], // cyan→sky
    ["#10b981", "#34d399"], // emerald
    ["#f59e0b", "#fbbf24"], // amber
  ];

  return (
    <div className="space-y-2.5">
      {parsed.map((p, i) => {
        const pct = Math.max(6, (p.num / max) * 100);
        const [from, to] = gradients[i % gradients.length];
        const gId = `bh-${i}-${Math.random().toString(36).slice(2, 6)}`;
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-slate-700 truncate max-w-[60%]">{p.label}</span>
              <span className="text-[11px] font-bold text-slate-900 tabular-nums">{p.displayValue}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <svg width="100%" height="100%">
                <defs>
                  <linearGradient id={gId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={from} />
                    <stop offset="100%" stopColor={to} />
                  </linearGradient>
                </defs>
                <rect width={`${pct}%`} height="100%" rx="6" fill={`url(#${gId})`} />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Sparkline ──
function Sparkline({ value }: { value: string }) {
  const points = value.split("→").map((s) => s.trim());
  const nums = points.map((p) => extractNumber(p));
  const labels = points.map((p) => p.replace(/([\d\s,.]+)$/, "").trim());
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums);
  const range = max - min || 1;

  const w = 200, h = 36, pad = 4;
  const pathPoints = nums.map((n, i) => ({
    x: pad + (i / Math.max(1, nums.length - 1)) * (w - 2 * pad),
    y: pad + (1 - (n - min) / range) * (h - 2 * pad),
  }));
  const pathD = pathPoints.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
  const areaD = pathD + ` L${pathPoints[pathPoints.length - 1].x},${h} L${pathPoints[0].x},${h} Z`;
  const isUp = nums[nums.length - 1] >= nums[0];
  const stroke = isUp ? "#d946ef" : "#ef4444";
  const fillFrom = isUp ? "#d946ef25" : "#ef444425";
  const fillTo = isUp ? "#d946ef05" : "#ef444405";
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
        <path d={pathD} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pathPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={stroke} />
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

// ── Evaluation ──
function Evaluation({ value, label }: { value: string; label: string }) {
  const num = extractNumber(value);
  const l = label.toLowerCase();
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

function Currency({ value }: { value: string }) {
  return <span className="text-base font-bold text-slate-900 tabular-nums">{value}</span>;
}

function Count({ value }: { value: string }) {
  return <span className="text-base font-semibold text-slate-800 tabular-nums">{value}</span>;
}

export function KpiVisual({ label, value, format }: Props) {
  if (value === null) {
    return (
      <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
            <span className="text-[11px] text-slate-600 truncate">{label}</span>
          </div>
          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
            Données absentes
          </span>
        </div>
      </div>
    );
  }

  const type = format && format !== "auto" ? format : detectType(label, value);

  return (
    <div className="rounded-lg px-3 py-2.5 bg-slate-50">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-500" />
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
