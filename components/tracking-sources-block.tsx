"use client";

type SourceStat = {
  source: string;
  label: string;
  count: number;
  pct: number;
};

export function TrackingSourcesBlock({ sources, total }: { sources: SourceStat[]; total: number }) {
  const maxCount = Math.max(...sources.map((s) => s.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{total.toLocaleString("fr-FR")} contacts avec une source analytique</p>
      </div>
      <div className="space-y-2">
        {sources.map((s) => (
          <div key={s.source} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-[11px] font-medium text-slate-700 truncate">{s.label}</span>
            <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden relative">
              <div
                className="h-full rounded bg-indigo-500 transition-all"
                style={{ width: `${Math.max(1, (s.count / maxCount) * 100)}%` }}
              />
              {s.count > 0 && (
                <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-semibold text-slate-600 tabular-nums">
                  {s.count.toLocaleString("fr-FR")}
                </span>
              )}
            </div>
            <span className="w-10 shrink-0 text-right text-[10px] font-medium text-slate-500 tabular-nums">{s.pct} %</span>
          </div>
        ))}
      </div>
    </div>
  );
}
