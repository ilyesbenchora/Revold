type RevoldLogoProps = {
  companyName?: string;
  compact?: boolean;
  tone?: "light" | "dark";
};

/**
 * Revold logo — marque en « avatar » rond (dégradé fuchsia → purple → indigo)
 * avec un flocon fin en filigrane, et un wordmark ultra-fin/futuriste (Exo 2,
 * poids 100). Le « o » est un anneau incomplet évoquant un chargement.
 */
export function RevoldLogo({
  companyName = "Revold",
  compact = false,
  tone = "light",
}: RevoldLogoProps) {
  const labelClass = tone === "dark" ? "text-white" : "text-slate-900";

  return (
    <div className="inline-flex w-max shrink-0 items-center gap-2.5 whitespace-nowrap">
      {/* Marque — avatar rond avec flocon */}
      <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600 shadow-lg shadow-purple-500/30">
        <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-white/0 to-white/20 ring-1 ring-white/20" />
        {/* Flocon — même dessin que le filigrane de l'orbe (tour de contrôle) */}
        <svg
          viewBox="0 0 24 24"
          className="relative h-5 w-5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="4.2" y1="7.5" x2="19.8" y2="16.5" />
          <line x1="19.8" y1="7.5" x2="4.2" y2="16.5" />
          <path d="M12 3l-1.6 1.9M12 3l1.6 1.9M12 21l-1.6-1.9M12 21l1.6-1.9" />
          <path d="M4.2 7.5l2.4.3M4.2 16.5l2.4-.3M19.8 7.5l-2.4.3M19.8 16.5l-2.4-.3" />
        </svg>
      </div>

      {!compact && (
        <span
          aria-label={companyName}
          className={`inline-flex shrink-0 items-baseline whitespace-nowrap text-lg leading-none ${labelClass}`}
          style={{ fontFamily: "var(--font-wordmark)", fontWeight: 200, letterSpacing: "0.02em" }}
        >
          <span aria-hidden>Rev</span>
          {/* « o » = anneau incomplet (effet chargement), un peu plus gras.
              Alignement : items-baseline pose le BAS de l'anneau sur la ligne
              de base (comme un « o » réel), la hauteur ≈ hauteur d'x d'Exo 2
              et un léger translateY reproduit le dépassement optique des
              lettres rondes — au lieu du centrage sur la ligne entière qui
              faisait flotter l'anneau au-dessus de « Rev…ld ». */}
          <svg
            viewBox="0 0 32 32"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
            style={{ width: "0.54em", height: "0.54em", margin: "0 0.03em", transform: "translateY(0.02em)" }}
          >
            <circle cx="16" cy="16" r="13" strokeDasharray="63 18" transform="rotate(-58 16 16)" />
          </svg>
          <span aria-hidden>ld</span>
        </span>
      )}
    </div>
  );
}
