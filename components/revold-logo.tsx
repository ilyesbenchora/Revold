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
    <div className="flex items-center gap-2.5">
      {/* Marque — avatar rond avec flocon */}
      <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600 shadow-lg shadow-purple-500/30">
        <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-white/0 to-white/20 ring-1 ring-white/20" />
        {/* Flocon — traits fins, blanc */}
        <svg
          viewBox="0 0 24 24"
          className="relative h-5 w-5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {/* 6 branches */}
          <line x1="12" y1="2.5" x2="12" y2="21.5" />
          <line x1="3.8" y1="7.25" x2="20.2" y2="16.75" />
          <line x1="20.2" y1="7.25" x2="3.8" y2="16.75" />
          {/* chevrons aux 6 pointes */}
          <path d="M12 5.6 l-2 -1.9 M12 5.6 l2 -1.9" />
          <path d="M12 18.4 l-2 1.9 M12 18.4 l2 1.9" />
          <path d="M17.4 8.9 l0.6 -2.7 M17.4 8.9 l2.7 0.5" />
          <path d="M6.6 15.1 l-0.6 2.7 M6.6 15.1 l-2.7 -0.5" />
          <path d="M6.6 8.9 l-2.7 -0.5 M6.6 8.9 l0.6 -2.7" />
          <path d="M17.4 15.1 l2.7 0.5 M17.4 15.1 l0.6 2.7" />
        </svg>
      </div>

      {!compact && (
        <span
          aria-label={companyName}
          className={`text-lg ${labelClass}`}
          style={{ fontFamily: "var(--font-wordmark)", fontWeight: 100, letterSpacing: "0.16em" }}
        >
          <span aria-hidden>Rev</span>
          {/* « o » = anneau incomplet, effet chargement */}
          <svg
            viewBox="0 0 32 32"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            style={{ width: "0.58em", height: "0.58em", margin: "0 0.04em", verticalAlign: "-0.02em" }}
          >
            <circle cx="16" cy="16" r="13" strokeDasharray="63 18" transform="rotate(-58 16 16)" />
          </svg>
          <span aria-hidden>ld</span>
        </span>
      )}
    </div>
  );
}
