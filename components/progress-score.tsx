import { getStrokeColor } from "@/lib/score-utils";

type ProgressScoreProps = {
  label: string;
  score: number;
  colorClass?: string;
};

export function ProgressScore({ label, score, colorClass }: ProgressScoreProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;
  const stroke = colorClass ?? getStrokeColor(clampedScore);

  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <div className="relative mt-4 flex items-center justify-center">
        <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
          <circle cx="60" cy="60" r={radius} stroke="#e2e8f0" strokeWidth="8" fill="none" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={stroke}
          />
        </svg>
        <div className="absolute flex flex-col items-center leading-none">
          <span
            className="font-semibold tabular-nums text-slate-900"
            style={{ fontSize: "1.75rem", letterSpacing: "-0.04em" }}
          >
            {clampedScore}
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            sur 100
          </span>
        </div>
      </div>
    </div>
  );
}
