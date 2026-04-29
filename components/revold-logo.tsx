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
      {/* Logo mark — sablier réaliste avec sable amber + R subtil sur le côté */}
      <div className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600 shadow-lg shadow-purple-500/30">
        {/* Glossy highlight pour profondeur 3D */}
        <span className="pointer-events-none absolute inset-0 rounded-[10px] bg-gradient-to-tr from-white/0 via-white/5 to-white/25" />
        <span className="pointer-events-none absolute inset-x-1 top-0.5 h-2 rounded-t-[8px] bg-gradient-to-b from-white/30 to-transparent" />

        <svg
          viewBox="0 0 24 24"
          className="relative h-6 w-6"
          aria-hidden
        >
          <defs>
            {/* Sable amber/orange comme l'emoji ⏳ */}
            <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            {/* Frame blanc avec subtle gradient pour profondeur */}
            <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
          </defs>

          {/* Cap supérieur arrondi — frame blanc */}
          <rect x="2.5" y="2.5" width="19" height="1.8" rx="0.9" fill="url(#frame)" />

          {/* Cap inférieur arrondi — frame blanc */}
          <rect x="2.5" y="19.7" width="19" height="1.8" rx="0.9" fill="url(#frame)" />

          {/* Verre du sablier — outline blanc subtil (les 2 triangles qui se rejoignent) */}
          <path
            d="M3.5 4.3 L20.5 4.3 L12.5 11.7 L20.5 19.7 L3.5 19.7 L11.5 11.7 Z"
            fill="none"
            stroke="white"
            strokeWidth="0.6"
            strokeOpacity="0.5"
          />

          {/* SABLE — triangle haut rempli en amber gradient */}
          <path d="M4.5 4.7 L19.5 4.7 L12 11.4 Z" fill="url(#sand)" />

          {/* SABLE qui coule — colonne fine du pinch vers le bas */}
          <rect x="11.4" y="11.4" width="1.2" height="3.6" fill="url(#sand)" />

          {/* SABLE accumulé en bas — petit triangle pile */}
          <path d="M6.5 19.4 L12 15 L17.5 19.4 Z" fill="url(#sand)" />

          {/* R subtil — spine vertical à gauche, opacity 0.85 pour discret */}
          <rect
            x="3.2"
            y="4.3"
            width="1.5"
            height="15.4"
            fill="white"
            fillOpacity="0.92"
          />
          {/* Petite jambe diagonale du R sur le bas-droit, subtil */}
          <path
            d="M12 13.5 L19.2 18.5 L18.5 19.5 L11.4 14.5 Z"
            fill="white"
            fillOpacity="0.88"
          />
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
