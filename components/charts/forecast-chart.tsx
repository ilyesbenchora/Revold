/**
 * Graphique du prévisionnel de trésorerie — 3 scénarios (prudent / probable /
 * ambitieux) sur 12 mois. SVG pur rendu côté serveur, même convention que
 * treso-charts.tsx (zéro dépendance).
 */

const W = 640;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 30, left: 56 };

const fmtK = (v: number) =>
  Math.abs(v) >= 1000 ? `${Math.round(v / 1000).toLocaleString("fr-FR")} k€` : `${Math.round(v).toLocaleString("fr-FR")} €`;

export type ForecastChartPoint = {
  label: string;
  prudent: number;
  probable: number;
  ambitieux: number;
};

const SCENARIOS: Array<{ key: keyof Omit<ForecastChartPoint, "label">; label: string; color: string; dash?: string }> = [
  { key: "ambitieux", label: "Ambitieux (pipeline plein)", color: "#059669", dash: "4 3" },
  { key: "probable", label: "Probable (pipeline pondéré)", color: "#4f46e5" },
  { key: "prudent", label: "Prudent (factures seules)", color: "#e11d48", dash: "2 3" },
];

export function ForecastChart({ points }: { points: ForecastChartPoint[] }) {
  if (points.length === 0) return null;
  const values = points.flatMap((p) => [p.prudent, p.probable, p.ambitieux]);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.1;
  min -= pad; max += pad;

  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - ((v - min) / (max - min)) * ih;

  const path = (key: (typeof SCENARIOS)[number]["key"]) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  const zeroY = y(0);
  const gridVals = [min + (max - min) * 0.15, (min + max) / 2, max - (max - min) * 0.15];
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Prévisionnel de trésorerie sur 12 mois, trois scénarios">
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#e2e8f0" strokeDasharray="3 4" />
            <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{fmtK(v)}</text>
          </g>
        ))}
        {/* Ligne de flottaison : en dessous, la trésorerie est négative. */}
        {zeroY >= PAD.top && zeroY <= H - PAD.bottom && (
          <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} stroke="#f43f5e" strokeWidth="1" strokeDasharray="6 3" opacity="0.6" />
        )}
        {SCENARIOS.map((s) => (
          <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={s.key === "probable" ? 2.5 : 1.5} strokeDasharray={s.dash} strokeLinejoin="round" />
        ))}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.probable)} r="2.5" fill="#4f46e5" />
        ))}
        {points.map((p, i) =>
          i % labelStep === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">{p.label}</text>
          ) : null,
        )}
      </svg>
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
