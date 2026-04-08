type RevoldLogoProps = {
  companyName?: string;
  compact?: boolean;
  tone?: "light" | "dark";
};

/**
 * Revold logo — fuchsia → purple → indigo gradient with a stylised "R"
 * mark and a small upward arrow accent reinforcing the revenue-uplift idea.
 * Distinct visual identity, no overlap with the underlying AI vendor.
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
        {/* Bold "R" letterform */}
        <span className="relative text-base font-black tracking-tighter text-white">
          R
        </span>
        {/* Upward-arrow accent — revenue uplift signature */}
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white shadow-sm">
          <svg
            viewBox="0 0 24 24"
            className="h-2 w-2 text-fuchsia-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 14 L12 6 L18 14" />
            <path d="M12 6 L12 20" />
          </svg>
        </span>
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
