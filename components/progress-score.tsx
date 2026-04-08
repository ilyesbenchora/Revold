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
        <svg width="110" height="110" viewBox="0 0 110 110" className="-rotate-90">
          <circle cx="55" cy="55" r={radius} stroke="#e2e8f0" strokeWidth="10" fill="none" />
          <circle
            cx="55"
            cy="55"
            r={radius}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={stroke}
          />
        </svg>
        <span className="absolute text-xl font-semibold text-slate-900">{clampedScore}/100</span>
      </div>
    </div>
  );
}
