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
      {/* Logo mark */}
      <div className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600 shadow-lg shadow-purple-500/30">
        {/* Subtle inner highlight for depth */}
        <span className="pointer-events-none absolute inset-0 rounded-[10px] bg-gradient-to-tr from-white/0 to-white/15" />

        {/* HAUT = SABLIER complet (cap + 2 diagonales + sable rempli)
            BAS  = R classique (spine vertical + jambe diagonale)
            Touches modernes : opacity layering, dot accent, gradient fill */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative h-5 w-5 text-white"
          aria-hidden
        >
          {/* ═══ HAUT : SABLIER ═══ */}
          {/* Cap supérieur épais */}
          <line x1="3.5" y1="3.5" x2="18.5" y2="3.5" strokeWidth="2.6" />
          {/* Sable rempli (triangle pointant vers le centre) */}
          <path
            d="M4 4 L18 4 L11 11 Z"
            fill="currentColor"
            fillOpacity="0.95"
            stroke="none"
          />
          {/* Diagonale gauche (renforce silhouette sablier) */}
          <line x1="4" y1="4" x2="11" y2="11" strokeWidth="1" opacity="0.5" />
          {/* Diagonale droite (renforce silhouette sablier) */}
          <line x1="18" y1="4" x2="11" y2="11" strokeWidth="1" opacity="0.5" />
          {/* Petit point au pinch — grain de sable qui passe (touche moderne) */}
          <circle cx="11" cy="12" r="0.7" fill="currentColor" />

          {/* ═══ BAS : R CLASSIQUE ═══ */}
          {/* Spine vertical du R — du pinch au bas */}
          <line x1="4.5" y1="11.5" x2="4.5" y2="19.5" strokeWidth="2.8" />
          {/* Jambe diagonale du R — du pinch vers bas-droite */}
          <line x1="11" y1="13" x2="19" y2="20" strokeWidth="2.6" />

          {/* ═══ TOUCHES MODERNES ═══ */}
          {/* Trait fin de base qui ferme le sablier */}
          <line x1="4" y1="20.5" x2="18.5" y2="20.5" strokeWidth="0.9" opacity="0.85" />
          {/* Dot accent en bas-droite — signature moderne (style i moderne) */}
          <circle cx="20.2" cy="20.4" r="1" fill="currentColor" />
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
