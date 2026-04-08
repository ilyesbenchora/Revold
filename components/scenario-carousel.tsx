"use client";

import { useRef } from "react";
import { AlertButton } from "@/components/alert-button";

type Scenario = {
  title: string;
  description: string;
  impact: string;
  category: string;
  color: string;
};

export function ScenarioCarousel({ scenarios }: { scenarios: Scenario[] }) {
  const ref = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    if (!ref.current) return;
    const w = ref.current.clientWidth;
    ref.current.scrollBy({ left: dir === "left" ? -w * 0.8 : w * 0.8, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
        style={{ scrollbarWidth: "thin" }}
      >
        {scenarios.map((s, i) => (
          <article
            key={i}
            className={`flex min-w-[300px] max-w-[340px] shrink-0 snap-start flex-col rounded-xl border p-5 md:min-w-[340px] ${s.color}`}
          >
            <p className="text-sm font-medium text-slate-800">{s.title}</p>
            <p className="mt-1.5 text-xs text-slate-600">{s.description}</p>
            <div className="mt-3 flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-slate-500">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              <p className="text-sm font-semibold text-slate-900">{s.impact}</p>
            </div>
            <div className="mt-auto pt-4">
              <AlertButton title={s.title} description={s.description} impact={s.impact} category={s.category} />
            </div>
          </article>
        ))}
      </div>

      {/* Nav buttons */}
      <button
        onClick={() => scroll("left")}
        aria-label="Précédent"
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 flex h-9 w-9 items-center justify-center rounded-full border border-card-border bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        onClick={() => scroll("right")}
        aria-label="Suivant"
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 flex h-9 w-9 items-center justify-center rounded-full border border-card-border bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
