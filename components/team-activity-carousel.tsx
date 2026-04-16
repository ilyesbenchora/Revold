"use client";

import { useRef, useState } from "react";

type TeamStats = {
  team: string;
  members: number;
  total: number;
  types: Array<{ icon: string; label: string; count: number }>;
};

type Props = {
  teams: TeamStats[];
};

export function TeamActivityCarousel({ teams }: Props) {
  const visibleCount = 2;
  const visible = teams.slice(0, visibleCount);
  const overflow = teams.slice(visibleCount);

  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(overflow.length > 0);

  function updateScroll() {
    if (!ref.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = ref.current;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  }

  function scroll(dir: "left" | "right") {
    if (!ref.current) return;
    const w = ref.current.clientWidth * 0.85;
    ref.current.scrollBy({ left: dir === "left" ? -w : w, behavior: "smooth" });
    setTimeout(updateScroll, 350);
  }

  return (
    <div className="space-y-3">
      {/* First 2 teams stacked */}
      {visible.map((t) => (
        <TeamCard key={t.team} team={t} />
      ))}

      {/* Overflow teams in horizontal carousel */}
      {overflow.length > 0 && (
        <div className="relative">
          {canScrollLeft && (
            <button onClick={() => scroll("left")} aria-label="Précédent"
              className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-card-border bg-white text-slate-600 shadow-md transition hover:bg-slate-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}
          {canScrollRight && (
            <button onClick={() => scroll("right")} aria-label="Suivant"
              className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-card-border bg-white text-slate-600 shadow-md transition hover:bg-slate-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}

          <div ref={ref} onScroll={updateScroll}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 px-1"
            style={{ scrollbarWidth: "none" }}>
            {overflow.map((t) => (
              <div key={t.team} className="shrink-0 snap-start" style={{ width: "min(420px, 85vw)" }}>
                <TeamCard team={t} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamCard({ team: t }: { team: TeamStats }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{t.team}</p>
          <p className="text-xs text-slate-400">{t.members} membre{t.members > 1 ? "s" : ""} — {Math.round(t.total / t.members).toLocaleString("fr-FR")} act. moy./user</p>
        </div>
        <p className="text-sm font-semibold text-slate-600">{t.total.toLocaleString("fr-FR")} activités</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {t.types.map((at) => (
          <div key={at.label} className="rounded-lg bg-slate-50 p-2 text-center">
            <p className="text-base">{at.icon}</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900 tabular-nums">{at.count.toLocaleString("fr-FR")}</p>
            <p className="text-[9px] text-slate-500">{at.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
