"use client";

type SharedProp = {
  name: string;
  label: string;
  objects: string[];
  type: string;
  sameLabel: boolean;
  isCustom: boolean;
};

const OBJ_LABELS: Record<string, string> = {
  contacts: "Contacts",
  companies: "Entreprises",
  deals: "Transactions",
  tickets: "Tickets",
};

const OBJ_COLORS: Record<string, string> = {
  contacts: "bg-blue-100 text-blue-700",
  companies: "bg-violet-100 text-violet-700",
  deals: "bg-orange-100 text-orange-700",
  tickets: "bg-emerald-100 text-emerald-700",
};

export function SharedPropertiesBlock({ properties }: { properties: SharedProp[] }) {
  const onAll3 = properties.filter((p) => p.objects.length === 3).length;
  const on2 = properties.filter((p) => p.objects.length === 2).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-indigo-600 tabular-nums">{properties.length}</p>
          <p className="text-[9px] text-indigo-500">Propriétés partagées</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-slate-800 tabular-nums">{onAll3}</p>
          <p className="text-[9px] text-slate-500">Sur 3 objets</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-slate-800 tabular-nums">{on2}</p>
          <p className="text-[9px] text-slate-500">Sur 2 objets</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {properties.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-700 truncate">{p.label}</span>
                <span className={`shrink-0 rounded px-1 py-px text-[8px] font-bold ${
                  p.isCustom ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                }`}>
                  {p.isCustom ? "CUSTOM" : "HUBSPOT"}
                </span>
              </div>
              <p className="mt-0.5 text-[9px] text-slate-400">{p.name} · {p.type}{!p.sameLabel && " · labels différents"}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {p.objects.map((obj) => (
                <span key={obj} className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${OBJ_COLORS[obj] ?? "bg-slate-100 text-slate-600"}`}>
                  {OBJ_LABELS[obj] ?? obj}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
