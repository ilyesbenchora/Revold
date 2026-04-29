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

        {/* HAUT = sablier net (trait full-width + sable qui coule)
            BAS  = R géométrique (spine + jambe en formes pleines, edges nets)
            Modernité : aucun arrondi, aucun dot, full-width edges */}
        <svg
          viewBox="0 0 24 24"
          className="relative h-5 w-5 text-white"
          aria-hidden
        >
          {/* ═══ HAUT : SABLIER ═══ */}
          {/* Cap supérieur édge-to-edge (full-width sans coupure) */}
          <rect x="0" y="2.4" width="24" height="2" fill="currentColor" />

          {/* Sable rempli : triangle haut + colonne qui descend + pile basse */}
          <path
            d="M1.5 4.4
               L22.5 4.4
               L13 12
               L13 15.5
               L15 17.5
               L9 17.5
               L11 15.5
               L11 12
               Z"
            fill="currentColor"
          />

          {/* ═══ BAS : R GÉOMÉTRIQUE ═══ */}
          {/* Spine vertical du R — rectangle plein, edges nets */}
          <rect x="2.5" y="11" width="2.6" height="9" fill="currentColor" />

          {/* Jambe diagonale du R — parallélogramme plein, edges nets */}
          <path d="M10 14 L20.8 20.5 L19 22 L8.2 15.5 Z" fill="currentColor" />

          {/* ═══ BASE : trait fin full-width ═══ */}
          <rect x="0" y="20.7" width="24" height="0.8" fill="currentColor" />
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
