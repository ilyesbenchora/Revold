type RevoldLogoProps = {
  companyName?: string;
  compact?: boolean;
  tone?: "light" | "dark";
};

export function RevoldLogo({
  companyName = "Revold",
  compact = false,
  tone = "light",
}: RevoldLogoProps) {
  const labelClass = tone === "dark" ? "text-white" : "text-slate-900";

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600 shadow-lg shadow-purple-500/30">
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
          <line x1="6" y1="4" x2="6" y2="20" strokeWidth="2.6" />
          <line x1="6" y1="4" x2="14" y2="4" strokeWidth="2.6" />
          <line x1="14" y1="4" x2="14" y2="11" strokeWidth="2.6" />
          <line x1="6" y1="11" x2="14" y2="11" strokeWidth="2.6" />
          <line x1="13" y1="11" x2="19" y2="20" strokeWidth="2.6" />
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
