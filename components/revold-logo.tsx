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

        {/* R DOMINANT — sablier suggéré par la géométrie bowl + leg + base */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative h-5 w-5 text-white"
          aria-hidden
        >
          {/* Spine vertical du R — épais et dominant */}
          <line x1="5" y1="3.5" x2="5" y2="19.5" strokeWidth="2.8" />

          {/* Barre horizontale haute du R */}
          <line x1="5" y1="3.5" x2="17.5" y2="3.5" strokeWidth="2.6" />

          {/* Diagonale droite du bowl (top-right → centre) — forme le haut du sablier */}
          <line x1="17.5" y1="3.5" x2="11" y2="11.5" strokeWidth="2.4" />

          {/* Barre horizontale du milieu (ferme le bowl du R) */}
          <line x1="5" y1="11.5" x2="11" y2="11.5" strokeWidth="2.4" />

          {/* Jambe diagonale du R (centre → bas-droite) — forme le bas du sablier */}
          <line x1="11" y1="11.5" x2="18.5" y2="19.5" strokeWidth="2.4" />

          {/* Trait FIN bas — base du sablier qui ferme la silhouette */}
          <line x1="5" y1="20" x2="18.5" y2="20" strokeWidth="0.9" />
        </svg>
      </div>

      {!compact && (
        <span
          className={`flex items-baseline font-[var(--font-space-grotesk),system-ui,sans-serif] text-[17px] font-bold ${labelClass}`}
          style={{ letterSpacing: "-0.04em", fontFamily: "var(--font-space-grotesk), system-ui, sans-serif" }}
        >
          {/* Premier caractère : le R en gradient (couleurs du logo) */}
          <span
            className="bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent"
            aria-hidden
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
