"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mini-tutoriels de prise en main (coach marks) — petites vignettes de 2-3
 * étapes maximum, ancrées sur un élément de la page via [data-tour="…"].
 * L'utilisateur peut Continuer ou Passer ; une fois terminé ou passé, le
 * tutoriel ne se remontre plus (flag localStorage par tourId).
 */

export type TourStep = {
  /** Valeur de l'attribut data-tour de l'élément à pointer (optionnel). */
  anchor?: string;
  title: string;
  text: string;
};

const STORAGE_PREFIX = "revold_tour_";

function isDone(tourId: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + tourId) != null;
  } catch {
    return true; // localStorage indisponible → ne jamais bloquer la page
  }
}

function markDone(tourId: string, how: "done" | "skipped") {
  try {
    localStorage.setItem(STORAGE_PREFIX + tourId, how);
  } catch {}
}

const CARD_W = 232; // largeur de la vignette (w-58) — volontairement petite
const GAP = 10;

export function FeatureTour({ tourId, steps }: { tourId: string; steps: TourStep[] }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchorElRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef(0);

  // Premier passage seulement : jamais en SSR, jamais si déjà vu.
  useEffect(() => {
    if (steps.length > 0 && !isDone(tourId)) setVisible(true);
  }, [tourId, steps.length]);

  const clearHighlight = useCallback(() => {
    const el = anchorElRef.current;
    if (el) {
      el.style.outline = "";
      el.style.outlineOffset = "";
      el.style.borderRadius = el.dataset.tourPrevRadius ?? "";
      delete el.dataset.tourPrevRadius;
    }
    anchorElRef.current = null;
  }, []);

  // Positionne la vignette près de l'ancre de l'étape courante (ou en bas à
  // droite si l'étape n'a pas d'ancre / l'élément est absent de la page).
  const place = useCallback(() => {
    const s = steps[step];
    const el = s?.anchor
      ? document.querySelector<HTMLElement>(`[data-tour="${s.anchor}"]`)
      : null;

    if (el !== anchorElRef.current) {
      clearHighlight();
      if (el) {
        anchorElRef.current = el;
        el.dataset.tourPrevRadius = el.style.borderRadius;
        el.style.outline = "2px solid var(--accent)";
        el.style.outlineOffset = "3px";
        if (!el.style.borderRadius) el.style.borderRadius = "8px";
      }
    }

    if (!el) {
      setPos(null); // repli : coin bas droit (position fixe via classes)
      return;
    }

    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // À droite de l'élément si la place existe (sidebar), sinon dessous.
    let top: number;
    let left: number;
    if (r.right + GAP + CARD_W <= vw) {
      left = r.right + GAP;
      top = r.top;
    } else {
      left = Math.min(Math.max(r.left, 12), vw - CARD_W - 12);
      top = r.bottom + GAP;
    }
    top = Math.min(Math.max(top, 12), vh - 150);
    setPos({ top, left });
  }, [step, steps, clearHighlight]);

  useEffect(() => {
    if (!visible) return;
    const s = steps[step];
    const el = s?.anchor
      ? document.querySelector<HTMLElement>(`[data-tour="${s.anchor}"]`)
      : null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Laisse le scroll se faire puis positionne, et suit scroll/resize.
    const t = setTimeout(place, 350);
    place();
    const onMove = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(place);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [visible, step, steps, place]);

  // Nettoyage du surlignage à la fermeture/démontage.
  useEffect(() => () => clearHighlight(), [clearHighlight]);

  if (!visible) return null;
  const s = steps[step];
  const last = step === steps.length - 1;

  function skip() {
    markDone(tourId, "skipped");
    clearHighlight();
    setVisible(false);
  }
  function next() {
    if (last) {
      markDone(tourId, "done");
      clearHighlight();
      setVisible(false);
    } else {
      setStep((v) => v + 1);
    }
  }

  return (
    <div
      role="dialog"
      aria-label={s.title}
      className="fixed z-[200] rounded-xl border border-card-border bg-white p-3 shadow-xl"
      style={
        pos
          ? { top: pos.top, left: pos.left, width: CARD_W }
          : { bottom: 20, right: 20, width: CARD_W }
      }
    >
      <p className="text-xs font-semibold text-slate-900">{s.title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{s.text}</p>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10px] tabular-nums text-slate-400">
          {step + 1}/{steps.length}
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={skip}
            className="text-[11px] font-medium text-slate-400 transition hover:text-slate-600"
          >
            Passer
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            {last ? "Terminer" : "Continuer"}
          </button>
        </span>
      </div>
    </div>
  );
}
