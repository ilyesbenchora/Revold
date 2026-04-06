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
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white">
        R
      </div>
      {!compact && (
        <div className="flex flex-col leading-tight">
          <span className={`text-base font-semibold ${labelClass}`}>{companyName}</span>
        </div>
      )}
    </div>
  );
}
