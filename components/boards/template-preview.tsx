/**
 * Aperçu VISUEL d'un template de tableau de bord — un mini-dashboard fidèle à
 * la DA de l'app (tuiles blanches, accents indigo/fuchsia) : la rangée de
 * tuiles KPI puis les visualisations du template (barres, courbe, anneau,
 * table), dessinées en SVG net avec des données factices STABLES (graine
 * dérivée de l'id du template — l'aperçu ne « bouge » jamais entre deux
 * rendus). Composant pur, sans état : utilisable côté serveur comme client.
 */

type PreviewTile = { title: string; unit: "currency" | "count" | "percent" };
type PreviewTable = { title: string; view: "table" | "bar" | "line" | "donut" };

/* ── Pseudo-aléa DÉTERMINISTE (LCG) seedé par une chaîne ── */
function makeRand(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function fmtValue(unit: PreviewTile["unit"], r: () => number): string {
  if (unit === "currency") {
    const v = Math.round((12 + r() * 84) * 10) * 100; // 12 000 → 96 000 €
    return `${v.toLocaleString("fr-FR")} €`;
  }
  if (unit === "percent") return `${Math.round(8 + r() * 30)} %`;
  return String(Math.round(12 + r() * 380));
}

/* ── Série lissée (courbe) : marche aléatoire bornée, tendance douce ── */
function series(r: () => number, n: number): number[] {
  let v = 0.35 + r() * 0.3;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    v = Math.min(0.95, Math.max(0.12, v + (r() - 0.42) * 0.22));
    out.push(v);
  }
  return out;
}

/** Path SVG lissé (Catmull-Rom → Bézier) sur une boîte width × height. */
function smoothPath(values: number[], w: number, h: number): string {
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - v * h] as const);
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

const GRID = "#e2e8f0"; // slate-200
const INDIGO = "#6366f1"; // indigo-500
const FUCHSIA = "#d946ef"; // fuchsia-500

/* ── Visualisations miniatures (SVG 100 × 44, préservant le ratio) ── */

function MiniBars({ id }: { id: string }) {
  const r = makeRand(`${id}:bars`);
  const values = Array.from({ length: 7 }, () => 0.2 + r() * 0.75);
  return (
    <svg viewBox="0 0 100 44" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`bar-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={INDIGO} stopOpacity="0.95" />
          <stop offset="100%" stopColor={INDIGO} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {[14, 26, 38].map((y) => (
        <line key={y} x1="0" x2="100" y1={y} y2={y} stroke={GRID} strokeWidth="0.6" />
      ))}
      {values.map((v, i) => {
        const h = v * 38;
        return (
          <rect
            key={i}
            x={4 + i * 13.5}
            y={42 - h}
            width={8.5}
            height={h}
            rx={1.8}
            fill={i === values.length - 1 ? FUCHSIA : `url(#bar-${id})`}
            fillOpacity={i === values.length - 1 ? 0.9 : 1}
          />
        );
      })}
      <line x1="0" x2="100" y1="42" y2="42" stroke="#cbd5e1" strokeWidth="0.8" />
    </svg>
  );
}

function MiniLine({ id }: { id: string }) {
  const r = makeRand(`${id}:line`);
  const values = series(r, 9);
  const d = smoothPath(values, 100, 36);
  const lastX = 100;
  const lastY = 36 - values[values.length - 1] * 36;
  return (
    <svg viewBox="0 0 100 44" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={INDIGO} stopOpacity="0.28" />
          <stop offset="100%" stopColor={INDIGO} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`stroke-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={INDIGO} />
          <stop offset="100%" stopColor={FUCHSIA} />
        </linearGradient>
      </defs>
      {[12, 24, 36].map((y) => (
        <line key={y} x1="0" x2="100" y1={y + 3} y2={y + 3} stroke={GRID} strokeWidth="0.6" />
      ))}
      <g transform="translate(0,3)">
        <path d={`${d} L 100,36 L 0,36 Z`} fill={`url(#area-${id})`} stroke="none" />
        <path d={d} fill="none" stroke={`url(#stroke-${id})`} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx={lastX - 1.2} cy={lastY} r="2.1" fill={FUCHSIA} stroke="#fff" strokeWidth="1" />
      </g>
    </svg>
  );
}

function MiniDonut({ id }: { id: string }) {
  const r = makeRand(`${id}:donut`);
  const a = 0.35 + r() * 0.25; // part indigo
  const b = 0.18 + r() * 0.18; // part fuchsia
  const C = 2 * Math.PI * 15;
  return (
    <svg viewBox="0 0 100 44" className="h-full w-full" aria-hidden>
      <g transform="translate(28,22)">
        <circle r="15" fill="none" stroke={GRID} strokeWidth="7" />
        <circle
          r="15"
          fill="none"
          stroke={INDIGO}
          strokeWidth="7"
          strokeDasharray={`${(a * C).toFixed(1)} ${C.toFixed(1)}`}
          strokeLinecap="round"
          transform="rotate(-90)"
        />
        <circle
          r="15"
          fill="none"
          stroke={FUCHSIA}
          strokeWidth="7"
          strokeDasharray={`${(b * C).toFixed(1)} ${C.toFixed(1)}`}
          strokeDashoffset={-(a * C).toFixed(1)}
          strokeLinecap="round"
          transform="rotate(-90)"
        />
      </g>
      {/* légende factice */}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(54,${11 + i * 10})`}>
          <circle r="2.4" cx="2.4" cy="2.4" fill={i === 0 ? INDIGO : i === 1 ? FUCHSIA : GRID} />
          <rect x="8.5" y="0.8" width={26 - i * 5} height="3.2" rx="1.6" fill="#e2e8f0" />
        </g>
      ))}
    </svg>
  );
}

function MiniTable({ id }: { id: string }) {
  const r = makeRand(`${id}:table`);
  return (
    <svg viewBox="0 0 100 44" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <rect x="2" y="2" width="96" height="8" rx="2" fill="#f1f5f9" />
      {[0, 1, 2].map((i) => {
        const y = 14 + i * 10;
        const w = 18 + r() * 22;
        return (
          <g key={i}>
            <rect x="4" y={y} width={w} height="3.6" rx="1.8" fill="#cbd5e1" />
            <rect x="66" y={y} width={30 - r() * 12} height="3.6" rx="1.8" fill={i === 0 ? INDIGO : "#e2e8f0"} fillOpacity={i === 0 ? 0.65 : 1} />
            <line x1="2" x2="98" y1={y + 7.4} y2={y + 7.4} stroke={GRID} strokeWidth="0.6" />
          </g>
        );
      })}
    </svg>
  );
}

/* ── L'aperçu complet : rangée de tuiles + visualisations du template ── */
export function TemplatePreview({
  id,
  tiles,
  tables,
}: {
  id: string;
  tiles: PreviewTile[];
  tables: PreviewTable[];
}) {
  // Garde-fou : quel que soit l'id fourni, on n'injecte que [a-zA-Z0-9_-]
  // dans les IDs de dégradés SVG (url(#…) est invalide sinon → rendu noir).
  id = id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const r = makeRand(`${id}:tiles`);
  const shownTiles = tiles.slice(0, 3);
  const shownTables = tables.slice(0, 2);
  // Classes Tailwind LITTÉRALES (le JIT ne compile pas les classes dynamiques).
  const tileCols = shownTiles.length >= 3 ? "grid-cols-3" : shownTiles.length === 2 ? "grid-cols-2" : "grid-cols-1";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5" aria-hidden>
      {/* Rangée de tuiles KPI — mêmes cartes blanches que la vraie page. */}
      <div className={`grid gap-1.5 ${tileCols}`}>
        {shownTiles.map((t) => (
          <div key={t.title} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="truncate text-[8px] font-medium leading-tight text-slate-400">{t.title}</p>
            <p className="mt-0.5 truncate text-[11px] font-bold tabular-nums leading-tight text-slate-900">
              {fmtValue(t.unit, r)}
            </p>
          </div>
        ))}
      </div>

      {/* Visualisations du template (les vraies vues : barres, courbe, anneau, table).
          ⚠ L'identifiant passé aux minis sert d'ID de DÉGRADÉ SVG : il doit
          rester [a-z0-9-] — un titre avec espaces/accents rendait la référence
          url(#…) invalide et les barres/courbes retombaient sur un NOIR par
          défaut au lieu des couleurs indigo/fuchsia des rapports. */}
      {shownTables.length > 0 && (
        <div className={`mt-1.5 grid gap-1.5 ${shownTables.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {shownTables.map((t, i) => (
            <div key={t.title} className="min-w-0 rounded-lg border border-slate-200 bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <p className="mb-1 truncate px-0.5 text-[8px] font-medium leading-tight text-slate-400">{t.title}</p>
              <div className="h-11">
                {t.view === "line" ? (
                  <MiniLine id={`${id}-v${i}`} />
                ) : t.view === "donut" ? (
                  <MiniDonut id={`${id}-v${i}`} />
                ) : t.view === "table" ? (
                  <MiniTable id={`${id}-v${i}`} />
                ) : (
                  <MiniBars id={`${id}-v${i}`} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
