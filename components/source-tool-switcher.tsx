"use client";

/**
 * Switcher d'outil(s) source pour les pages d'audit (ex : Trésorerie).
 *
 * Deux modes :
 *  - "single" : un seul outil actif à la fois (`?source=…`) — sous-pages.
 *  - "multi"  : sélection multiple (`?sources=a,b`) — la page recompose
 *    dynamiquement ses blocs selon les capacités couvertes (1 outil = ses
 *    blocs ; CRM + facturation = blocs croisés en plus).
 *
 * Le rendu serveur est dynamique : la navigation se fait en transition
 * (router.replace) sans reload dur.
 */

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

export type SwitcherTool = { key: string; label: string; domain: string; icon: string };

export function SourceToolSwitcher({
  tools,
  activeKey,
  activeKeys,
  mode = "single",
  hint,
}: {
  tools: SwitcherTool[];
  /** mode single : outil dont les données sont affichées. */
  activeKey?: string;
  /** mode multi : outils sélectionnés (≥ 1). */
  activeKeys?: string[];
  mode?: "single" | "multi";
  /** Phrase d'aide affichée sous les pills (mode multi). */
  hint?: string;
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
    // multi : toggle, minimum 1 outil sélectionné.
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : [...selected, key];
    if (next.length === 0) return;
    params.set("sources", next.join(","));
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
        {pending && <span className="text-[10px] text-slate-400">Chargement…</span>}
      </div>
      {mode === "multi" && hint && (
        <p className="mt-1.5 text-[10px] text-slate-400">{hint}</p>
      )}
    </div>
  );
}
