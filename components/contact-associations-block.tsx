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

const OBJ_NAMES: Record<string, string> = {
  companies: "entreprises",
  deals: "transactions",
};

export function ContactAssociationsBlock({ stats }: { stats: AssociationStat[] }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {stats.map((s) => {
          const color = s.rate >= 80 ? "text-emerald-600" : s.rate >= 50 ? "text-amber-600" : "text-red-500";
          const barColor = s.rate >= 80 ? "bg-emerald-500" : s.rate >= 50 ? "bg-amber-400" : "bg-red-400";
          const without = s.totalContacts - s.withAssociation;
          const objName = OBJ_NAMES[s.targetObject] ?? s.targetObject;
          return (
            <div key={s.targetObject} className="rounded-lg bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.targetLabel}</p>
                    <p className="text-[10px] text-slate-400">
                      {s.withAssociation.toLocaleString("fr-FR")} sur {s.totalContacts.toLocaleString("fr-FR")} {objName}
                    </p>
                  </div>
                </div>
                <span className={`text-lg font-bold tabular-nums ${color}`}>{s.rate} %</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${s.rate}%` }} />
              </div>
              {without > 0 && (
                <p className="mt-2 text-[10px] text-red-500">
                  {without.toLocaleString("fr-FR")} {objName} sans aucun contact associé
                </p>
              )}
              {s.labels.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                  <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Types d&apos;association</p>
                  {s.labels.map((l) => (
                    <div key={l.label} className="flex items-center gap-2 text-[10px]">
                      <span className="h-1 w-1 rounded-full bg-indigo-400 shrink-0" />
                      <span className="text-slate-600">{l.label}</span>
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
