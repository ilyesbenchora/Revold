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

        {/* R-sablier en SVG (blanc sur le gradient) */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative h-5 w-5 text-white"
          aria-hidden
        >
          {/* Spine vertical du R (gauche) */}
          <line x1="4.5" y1="3.5" x2="4.5" y2="20.5" strokeWidth="2.4" />

          {/* Barre horizontale haute du R (= cap supérieur du sablier) */}
          <line x1="4" y1="3.5" x2="19.5" y2="3.5" strokeWidth="2.2" />

          {/* Triangle supérieur du sablier — REMPLI (sable) */}
          <path
            d="M4.5 4 L19 4 L12 12 Z"
            fill="currentColor"
            fillOpacity="0.85"
            strokeWidth="0"
          />

          {/* Triangle inférieur du sablier — outline (vide / temps restant) */}
          <path d="M4.5 20 L12 12 L19 20" strokeWidth="2" />

          {/* Trait FIN bas qui ferme le sablier (la ligne demandée) */}
          <line x1="4.5" y1="20.5" x2="19.5" y2="20.5" strokeWidth="0.9" />
        </svg>
      </div>

      {!compact && (
        <span
          className={`text-base font-bold tracking-tight ${labelClass}`}
          style={{ letterSpacing: "-0.02em" }}
        >
          {companyName}
        </span>
      )}
    </div>
  );
}
