/**
 * Tuiles KPI colorées (style cockpit) — serveur, zéro dépendance.
 *
 * Chaque tuile : libellé, valeur colorée selon la tonalité, sous-titre et
 * verdict optionnel (pastille Confortable / À surveiller / Critique…).
 * Utilisées en tête des pages Données pour donner la lecture en un coup d'œil
 * avant les blocs détaillés.
 */

export type StatTileVerdict = { label: string; tone: "pos" | "warn" | "neg" };

export type StatTile = {
  label: string;
  /** Valeur déjà formatée (ex : "12 500 €", "38 %", "4,2 mois"). */
  value: string;
  /** Couleur de la valeur. neutral = slate. */
  tone?: "pos" | "neg" | "accent" | "neutral";
  /** Précision courte sous la valeur. */
  sub?: string;
  verdict?: StatTileVerdict;
};

const VALUE_TONE: Record<NonNullable<StatTile["tone"]>, string> = {
  pos: "text-emerald-600",
  neg: "text-rose-600",
  accent: "text-indigo-600",
  neutral: "text-slate-900",
};

const VERDICT_TONE: Record<StatTileVerdict["tone"], string> = {
  pos: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  neg: "bg-rose-50 text-rose-700",
};

export function KpiStatTiles({ tiles }: { tiles: StatTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-medium text-slate-500">{t.label}</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${VALUE_TONE[t.tone ?? "neutral"]}`}>{t.value}</p>
          {t.sub && <p className="mt-0.5 text-[10px] text-slate-400">{t.sub}</p>}
          {t.verdict && (
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${VERDICT_TONE[t.verdict.tone]}`}>
              {t.verdict.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
