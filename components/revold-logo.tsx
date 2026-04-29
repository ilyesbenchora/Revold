type RevoldLogoProps = {
  companyName?: string;
  compact?: boolean;
  tone?: "light" | "dark";
};

/**
 * Revold logo — gradient fuchsia → indigo, monogramme "R" stylisé en
 * sablier ⏳ pour signifier l'audit temporel & l'analyse RevOps.
 *
 * Construction du R-sablier :
 *   - Trait vertical épais à gauche = spine du R
 *   - Trait horizontal épais en haut = barre supérieure du R
 *   - Triangle supérieur rempli (sable) pointe vers le centre = bowl
 *     du R réimaginé en partie supérieure du sablier
 *   - Triangle inférieur en outline part du centre vers les coins bas
 *     = jambe du R réimaginée en partie inférieure du sablier
 *   - Trait HORIZONTAL FIN en bas = ferme le sablier (demandé)
 */
export function RevoldLogo({
  companyName = "Revold",
  compact = false,
  tone = "light",
}: RevoldLogoProps) {
  const labelClass = tone === "dark" ? "text-white" : "text-slate-900";

  return (
    <div className="flex items-center gap-2.5">
      {/* Logo mark — R dominant blanc + petit sablier accent en haut-droite,
          style cohérent avec les BlockHeaderIcon (stroke 2.4, rounded caps) */}
      <div className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600 shadow-lg shadow-purple-500/30">
        {/* Highlight glossy subtil */}
        <span className="pointer-events-none absolute inset-0 rounded-[10px] bg-gradient-to-tr from-white/0 to-white/15" />

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative h-[22px] w-[22px] text-white"
          aria-hidden
        >
          {/* ═══ R DOMINANT — letterform avec strokes épais ═══ */}
          {/* Spine vertical épais */}
          <line x1="5" y1="4" x2="5" y2="20" strokeWidth="2.6" />
          {/* Barre haute */}
          <line x1="5" y1="4" x2="12" y2="4" strokeWidth="2.6" />
          {/* Côté droit du bowl (vertical court) */}
          <line x1="12" y1="4" x2="12" y2="11" strokeWidth="2.6" />
          {/* Barre milieu (ferme le bowl) */}
          <line x1="5" y1="11" x2="12" y2="11" strokeWidth="2.6" />
          {/* Jambe diagonale */}
          <line x1="11" y1="11" x2="18" y2="20" strokeWidth="2.6" />

          {/* ═══ PETIT SABLIER — accent en haut-droite, traits doux ═══ */}
          <g transform="translate(15.5, 1.5)" strokeWidth="1.1">
            {/* Cap supérieur arrondi */}
            <line x1="0.3" y1="0.5" x2="6" y2="0.5" strokeLinecap="round" />
            {/* Verre = 2 diagonales qui se croisent au pinch */}
            <line x1="0.5" y1="1" x2="3.15" y2="3.5" />
            <line x1="5.85" y1="1" x2="3.15" y2="3.5" />
            <line x1="0.5" y1="6" x2="3.15" y2="3.5" />
            <line x1="5.85" y1="6" x2="3.15" y2="3.5" />
            {/* Sable rempli dans le triangle haut (subtle fill) */}
            <path
              d="M0.7 1.1 L5.65 1.1 L3.15 3.4 Z"
              fill="currentColor"
              fillOpacity="0.85"
              strokeWidth="0"
            />
            {/* Cap inférieur arrondi */}
            <line x1="0.3" y1="6.5" x2="6" y2="6.5" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      {!compact && (
        <span
          className={`flex items-baseline text-[17px] font-bold ${labelClass}`}
          style={{
            fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
            letterSpacing: "-0.04em",
          }}
        >
          {/* Premier caractère : le R en gradient (couleurs du logo) */}
          <span
            className="bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent"
          >
            {companyName.slice(0, 1)}
          </span>
          {/* Reste du wordmark — couleur neutre, tracking serré */}
          <span>{companyName.slice(1)}</span>
        </span>
      )}
    </div>
  );
}
