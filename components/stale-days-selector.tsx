"use client";

import { useRouter, useSearchParams } from "next/navigation";

const daysOptions = [
  { value: "5", label: "5 jours" },
  { value: "10", label: "10 jours" },
  { value: "15", label: "15 jours" },
  { value: "30", label: "30 jours" },
  { value: "60", label: "60 jours" },
  { value: "90", label: "90 jours" },
];

type Props = {
  lifecycleStages?: Array<{ value: string; label: string }>;
  owners?: Array<{ id: string; name: string }>;
};

export function StaleDaysSelector({ lifecycleStages = [], owners = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentDays = searchParams.get("days") || "10";
  const currentLifecycle = searchParams.getAll("lc");
  const currentOwner = searchParams.get("owner") || "";

  function buildUrl(updates: Record<string, string | string[] | null>) {
    const params = new URLSearchParams();
    // Preserve existing
    const days = updates.days !== undefined ? updates.days : currentDays;
    if (days && days !== "10") params.set("days", days as string);

    const lc = updates.lc !== undefined ? updates.lc : currentLifecycle;
    if (Array.isArray(lc)) lc.forEach((v) => params.append("lc", v));

    const owner = updates.owner !== undefined ? updates.owner : currentOwner;
    if (owner) params.set("owner", owner as string);

    const qs = params.toString();
    return `/dashboard/conduite-changement/connexions${qs ? `?${qs}` : ""}`;
  }

  function setDays(value: string) {
    router.push(buildUrl({ days: value }));
  }

  function toggleLifecycle(value: string) {
    const next = currentLifecycle.includes(value)
      ? currentLifecycle.filter((v) => v !== value)
      : [...currentLifecycle, value];
    router.push(buildUrl({ lc: next }));
  }

  function setOwner(value: string) {
    router.push(buildUrl({ owner: value || null }));
  }

  return (
    <div className="space-y-3">
      {/* Days */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Inactifs depuis</span>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {daysOptions.map((o) => (
            <button key={o.value} type="button" onClick={() => setDays(o.value)}
              className={`px-3 py-1.5 text-xs font-medium transition ${currentDays === o.value ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lifecycle stages */}
      {lifecycleStages.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-500">Phase lifecycle</span>
          {lifecycleStages.map((lc) => {
            const selected = currentLifecycle.includes(lc.value);
            return (
              <button key={lc.value} type="button" onClick={() => toggleLifecycle(lc.value)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  selected ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}>
                {selected && <span className="mr-0.5">✓ </span>}
                {lc.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Owner */}
      {owners.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Propriétaire</span>
          <select value={currentOwner} onChange={(e) => setOwner(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 focus:border-accent focus:outline-none">
            <option value="">Tous les propriétaires</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
