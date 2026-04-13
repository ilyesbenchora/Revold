"use client";

type AssociationStat = {
  targetObject: string;
  targetLabel: string;
  icon: string;
  totalContacts: number;
  withAssociation: number;
  rate: number;
  labels: Array<{ label: string; count: number }>;
};

export function ContactAssociationsBlock({ stats }: { stats: AssociationStat[] }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => {
          const color = s.rate >= 80 ? "text-emerald-600" : s.rate >= 50 ? "text-amber-600" : "text-red-500";
          const barColor = s.rate >= 80 ? "bg-emerald-500" : s.rate >= 50 ? "bg-amber-400" : "bg-red-400";
          return (
            <div key={s.targetObject} className="rounded-lg bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.targetLabel}</p>
                    <p className="text-[10px] text-slate-400">{s.withAssociation.toLocaleString("fr-FR")} sur {s.totalContacts.toLocaleString("fr-FR")} contacts</p>
                  </div>
                </div>
                <span className={`text-lg font-bold tabular-nums ${color}`}>{s.rate} %</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${s.rate}%` }} />
              </div>
              {s.labels.length > 0 && (
                <div className="mt-3 space-y-1">
                  {s.labels.map((l) => (
                    <div key={l.label} className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-600">{l.label}</span>
                      <span className="font-medium text-slate-800 tabular-nums">{l.count.toLocaleString("fr-FR")} contacts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
