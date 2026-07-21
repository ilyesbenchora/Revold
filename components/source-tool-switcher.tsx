"use client";

/**
 * Switcher d'outil(s) source pour les pages d'audit (ex : Trésorerie).
 *
 * Deux modes :
 *  - "single" : un seul outil actif à la fois (`?source=…`) — sous-pages.
 *  - "multi"  : champ UNIQUE à options (`?sources=…`) — une option à la fois :
 *    un outil (ses blocs) ou une combo croisée « A × B » (les vues croisées).
 *    Le nom du mode est historique : l'URL porte encore une liste, mais l'UI
 *    n'autorise plus le cumul manuel d'outils.
 *
 * Le rendu serveur est dynamique : la navigation se fait en transition
 * (router.replace) sans reload dur.
 */

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

export type SwitcherTool = { key: string; label: string; domain: string; icon: string };
export type SwitcherCombo = { keys: string[]; label: string };

export function SourceToolSwitcher({
  tools,
  activeKey,
  activeKeys,
  mode = "single",
  hint,
  combos = [],
}: {
  tools: SwitcherTool[];
  /** mode single : outil dont les données sont affichées. */
  activeKey?: string;
  /** mode multi : outils sélectionnés (≥ 1). */
  activeKeys?: string[];
  mode?: "single" | "multi";
  /** Phrase d'aide affichée sous les pills (mode multi). */
  hint?: string;
  /**
   * Raccourcis croisés (mode multi) : une pill « A × B » sélectionne la paire
   * d'un clic pour arriver directement sur les vues croisées. Dérivés des
   * croisements réellement possibles (availableCrossCombos), jamais en dur.
   */
  combos?: SwitcherCombo[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (tools.length === 0) return null;

  const selected = mode === "multi" ? (activeKeys ?? []) : activeKey ? [activeKey] : [];

  function navigate(params: URLSearchParams) {
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function onToggle(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "single") {
      if (key === activeKey) return;
      params.set("source", key);
      navigate(params);
      return;
    }
    // Champ UNIQUE : une option à la fois — un outil seul, ou une combo
    // croisée (bouton « A × B »). Cliquer une option remplace la sélection ;
    // re-cliquer l'option active revient à l'état neutre (zéro sélection).
    const next = selected.length === 1 && selected[0] === key ? [] : [key];
    if (next.length === 0) params.delete("sources");
    else params.set("sources", next.join(","));
    params.delete("source");
    navigate(params);
  }

  /** Une combo est active si la sélection est EXACTEMENT sa paire d'outils. */
  const comboActive = (c: SwitcherCombo) =>
    selected.length === c.keys.length && c.keys.every((k) => selected.includes(k));

  function onCombo(c: SwitcherCombo) {
    const params = new URLSearchParams(searchParams.toString());
    // Re-clic sur la combo active → retour à l'état neutre.
    if (comboActive(c)) params.delete("sources");
    else params.set("sources", c.keys.join(","));
    params.delete("source");
    navigate(params);
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-slate-500">
          {mode === "multi" ? "Sources des blocs :" : "Blocs alimentés par :"}
        </span>
        {tools.map((t) => {
          const on = selected.includes(t.key);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onToggle(t.key)}
              disabled={pending}
              title={on ? `Données affichées depuis ${t.label}` : `Afficher les données ${t.label}`}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                on
                  ? "border-accent bg-accent/10 text-accent shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-accent/40 hover:bg-slate-50"
              }`}
            >
              <BrandLogo domain={t.domain} alt={t.label} fallback={t.icon} size={14} />
              {t.label}
              {on && (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </button>
          );
        })}
        {/* Raccourcis croisés : un clic = la paire sélectionnée, vues croisées directes */}
        {mode === "multi" && combos.length > 0 && (
          <>
            <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden />
            {combos.map((c) => {
              const on = comboActive(c);
              return (
                <button
                  key={c.keys.join("+")}
                  type="button"
                  onClick={() => onCombo(c)}
                  disabled={pending}
                  title={on ? "Revenir à l'état neutre" : `Vues croisées ${c.label} en un clic`}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    on
                      ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700 shadow-sm"
                      : "border-fuchsia-200 bg-white text-fuchsia-600 hover:border-fuchsia-400 hover:bg-fuchsia-50/60"
                  }`}
                >
                  <span aria-hidden>⤫</span>
                  {c.label}
                  {on && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </button>
              );
            })}
          </>
        )}
        {pending && <span className="text-[10px] text-slate-400">Chargement…</span>}
      </div>
      {mode === "multi" && hint && (
        <p className="mt-1.5 text-[10px] text-slate-400">{hint}</p>
      )}
    </div>
  );
}
