/**
 * Barres horizontales cockpit (style Lomed) — composant serveur, zéro dépendance.
 *
 * Une ligne par item : label à gauche, barre proportionnelle au max, valeur
 * (et part du total) à droite. À utiliser pour les répartitions (pipeline par
 * étape, contacts par source, tickets par priorité, charges par catégorie…).
 */

export type HBarItem = { label: string; value: number; color?: string };

// Même palette catégorielle validée que ReportChart (ordre fixe, daltonisme-
// safe par paire adjacente) — l'identité des barres reste portée par leur
// libellé, la couleur n'est jamais seule.
const PALETTE = ["#c026d3", "#0d9488", "#d97706", "#4f46e5", "#db2777", "#0284c7", "#4d7c0f"];

function fmtValue(v: number, unit: "currency" | "count" | "percent"): string {
  if (unit === "currency")
    return Math.abs(v) >= 1000
      ? `${Math.round(v / 1000).toLocaleString("fr-FR")} k€`
      : `${Math.round(v).toLocaleString("fr-FR")} €`;
  if (unit === "percent") return `${Math.round(v)} %`;
  return Math.round(v).toLocaleString("fr-FR");
}

export function HBarChart({
  items,
  unit = "count",
  showPct = true,
  colorize = false,
}: {
  items: HBarItem[];
  unit?: "currency" | "count" | "percent";
  /** Affiche la part du total à côté de la valeur. */
  showPct?: boolean;
  /** Une couleur différente par barre (sinon indigo uniforme). */
  colorize?: boolean;
}) {
  if (items.length === 0) return null;
  // En pourcentage, l'échelle est absolue (0-100) ; sinon relative au max.
  const max = unit === "percent" ? 100 : Math.max(...items.map((i) => Math.abs(i.value)), 1);
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => {
        const pct = total > 0 ? Math.round((Math.max(0, it.value) / total) * 100) : 0;
        const color = it.color ?? (colorize ? PALETTE[i % PALETTE.length] : "#6366f1");
        return (
          <div key={`${it.label}-${i}`}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-slate-700" title={it.label}>
                {it.label}
              </span>
              <span className="ml-2 shrink-0 text-[11px] tabular-nums text-slate-600">
                {fmtValue(it.value, unit)}
                {showPct && unit !== "percent" && <span className="text-slate-400"> ({pct} %)</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(1, (Math.abs(it.value) / max) * 100)}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
