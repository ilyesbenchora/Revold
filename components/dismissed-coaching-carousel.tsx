"use client";

import { useRef, useState } from "react";

type DismissedItem = {
  id: string;
  template_key: string;
  title?: string;
  body?: string;
  recommendation?: string;
  severity?: string;
  category?: string;
  dismissed_at: string;
};

const sevConfig: Record<string, { bg: string; border: string; badge: string; label: string }> = {
  critical: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700", label: "Critique" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", label: "Attention" },
  info: { bg: "bg-indigo-50", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-700", label: "Info" },
};

const catLabels: Record<string, string> = {
  commercial: "Commercial",
  marketing: "Marketing",
  data: "Data",
  automation: "Workflow",
  integration: "Intégration",
  cross_source: "Cross-Source",
  data_model: "Modèle de données",
};

type Props = {
  items: DismissedItem[];
  variant: "done" | "removed";
};

export function DismissedCoachingCarousel({ items, variant }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(items.length > 1);

  function updateScroll() {
    if (!ref.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = ref.current;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  }

  function scroll(dir: "left" | "right") {
    if (!ref.current) return;
    const w = ref.current.clientWidth * 0.8;
    ref.current.scrollBy({ left: dir === "left" ? -w : w, behavior: "smooth" });
    setTimeout(updateScroll, 350);
  }

  const borderColor = variant === "done" ? "border-l-emerald-400" : "border-l-slate-300";

  return (
    <div className="relative">
      {/* Scroll buttons */}
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

      {/* Cards */}
      <div ref={ref} onScroll={updateScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-2"
        style={{ scrollbarWidth: "none" }}>
        {items.map((d) => {
          const sev = sevConfig[d.severity ?? "info"] ?? sevConfig.info;
          const catLabel = catLabels[d.category ?? ""] ?? d.category ?? "";

          return (
            <article key={d.id}
              className={`flex shrink-0 snap-start flex-col rounded-xl border border-l-4 ${borderColor} ${sev.border} ${sev.bg} p-4`}
              style={{ width: "min(340px, 85vw)" }}>
              {/* Header badges */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sev.badge}`}>{sev.label}</span>
                  {catLabel && (
                    <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-medium text-slate-600">{catLabel}</span>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-slate-400">{new Date(d.dismissed_at).toLocaleDateString("fr-FR")}</span>
              </div>

              {/* Title */}
              <h3 className="mt-2 text-sm font-semibold text-slate-900">{d.title || d.template_key}</h3>

              {/* Body */}
              {d.body && <p className="mt-1 text-xs text-slate-700 line-clamp-3">{d.body}</p>}

              {/* Recommendation */}
              {d.recommendation && (
                <div className="mt-auto pt-3">
                  <div className="rounded-lg bg-white/60 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Action à faire</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-800 line-clamp-2">{d.recommendation}</p>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
