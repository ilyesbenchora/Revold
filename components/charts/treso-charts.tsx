/**
 * Graphiques Trésorerie — SVG pur, rendus côté serveur (zéro dépendance).
 *
 * - TresoLineChart : évolution du solde de trésorerie mois par mois
 *   (courbe + aire, ancrée sur le solde bancaire réel quand disponible).
 * - TresoFlowsChart : encaissements (vert) vs décaissements (rouge) par mois.
 */

const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

const fmtK = (v: number) =>
  Math.abs(v) >= 1000 ? `${Math.round(v / 1000).toLocaleString("fr-FR")} k€` : `${Math.round(v).toLocaleString("fr-FR")} €`;

export type SeriesPoint = { label: string; value: number };
export type FlowsPoint = { label: string; in: number; out: number };

function niceScale(min: number, max: number): { min: number; max: number } {
  if (min === max) return { min: min - 1, max: max + 1 };
  const pad = (max - min) * 0.12;
  return { min: Math.min(0, min - pad), max: max + pad };
}

export function TresoLineChart({ points }: { points: SeriesPoint[] }) {
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const { min, max } = niceScale(Math.min(...values), Math.max(...values));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - ((v - min) / (max - min)) * ih;

  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${PAD.left},${y(Math.max(min, 0)).toFixed(1)} ${line} ${x(points.length - 1).toFixed(1)},${y(Math.max(min, 0)).toFixed(1)}`;
  const zeroY = y(0);
  const last = points[points.length - 1];

  // Labels x : au plus 8, répartis.
  const step = Math.max(1, Math.ceil(points.length / 8));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Évolution de la trésorerie">
      {/* repères horizontaux */}
      {[max, (max + min) / 2, min].map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
          <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">{fmtK(v)}</text>
        </g>
      ))}
      {/* ligne zéro si le solde passe en négatif */}
      {min < 0 && <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} stroke="#cbd5e1" strokeWidth="1" />}
      {/* aire + courbe */}
      <polygon points={area} fill="url(#tresoArea)" opacity="0.35" />
      <polyline points={line} fill="none" stroke="#6366f1" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
      {/* points + labels x */}
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.5} fill={p.value >= 0 ? "#6366f1" : "#e11d48"} />
          {i % step === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">{p.label}</text>
          )}
        </g>
      ))}
      {/* valeur du dernier point */}
      <text x={Math.min(x(points.length - 1) + 6, W - PAD.right)} y={y(last.value) - 8} textAnchor="end" fontSize="11" fontWeight="600" fill={last.value >= 0 ? "#059669" : "#e11d48"}>
        {fmtK(last.value)}
      </text>
      <defs>
        <linearGradient id="tresoArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Barres mono-série (ex : CA signé par mois, tickets créés par mois…). */
export function SimpleBarsChart({ points, color = "#6366f1" }: { points: SeriesPoint[]; color?: string }) {
  if (points.length === 0) return null;
  const maxV = Math.max(1, ...points.map((p) => p.value));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const groupW = iw / points.length;
  const barW = Math.min(30, groupW * 0.55);
  const y = (v: number) => PAD.top + ih - (v / maxV) * ih;
  const step = Math.max(1, Math.ceil(points.length / 8));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Histogramme mensuel">
      {[maxV, maxV / 2].map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
          <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">{fmtK(v)}</text>
        </g>
      ))}
      <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth="1" />
      {points.map((p, i) => {
        const cx = PAD.left + groupW * i + groupW / 2;
        return (
          <g key={p.label}>
            <rect x={cx - barW / 2} y={y(p.value)} width={barW} height={Math.max(0, y(0) - y(p.value))} rx="3" fill={color} />
            {i % step === 0 && (
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">{p.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function TresoFlowsChart({ points }: { points: FlowsPoint[] }) {
  if (points.length === 0) return null;
  const maxV = Math.max(1, ...points.flatMap((p) => [p.in, p.out]));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const groupW = iw / points.length;
  const barW = Math.min(22, groupW * 0.32);
  const y = (v: number) => PAD.top + ih - (v / maxV) * ih;
  const step = Math.max(1, Math.ceil(points.length / 8));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Encaissements vs décaissements par mois">
      {[maxV, maxV / 2].map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
          <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">{fmtK(v)}</text>
        </g>
      ))}
      <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth="1" />
      {points.map((p, i) => {
        const cx = PAD.left + groupW * i + groupW / 2;
        return (
          <g key={p.label}>
            <rect x={cx - barW - 2} y={y(p.in)} width={barW} height={Math.max(0, y(0) - y(p.in))} rx="2.5" fill="#10b981" />
            <rect x={cx + 2} y={y(p.out)} width={barW} height={Math.max(0, y(0) - y(p.out))} rx="2.5" fill="#f43f5e" />
            {i % step === 0 && (
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">{p.label}</text>
            )}
          </g>
        );
      })}
      {/* légende */}
      <g transform={`translate(${W - PAD.right - 200}, ${PAD.top - 4})`} fontSize="10">
        <rect x="0" y="-8" width="9" height="9" rx="2" fill="#10b981" />
        <text x="13" y="0" fill="#64748b">Encaissements</text>
        <rect x="100" y="-8" width="9" height="9" rx="2" fill="#f43f5e" />
        <text x="113" y="0" fill="#64748b">Décaissements</text>
      </g>
    </svg>
  );
}
