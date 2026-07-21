"use client";

/**
 * Switcher d'outil source pour les pages d'audit (ex : Trésorerie).
 *
 * Affiche les outils connectés capables d'alimenter les blocs de la page ;
 * cliquer sur un outil recharge les blocs/tables sur cette source via le
 * paramètre d'URL `?source=…` (rendu serveur dynamique — pas de reload dur).
 */

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

export type SwitcherTool = { key: string; label: string; domain: string; icon: string };

export function SourceToolSwitcher({
  tools,
  activeKey,
}: {
  tools: SwitcherTool[];
  /** Outil dont les données sont actuellement affichées. */
  activeKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (tools.length === 0) return null;

  function switchTo(key: string) {
    if (key === activeKey) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("source", key);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  const active = tools.find((t) => t.key === activeKey);

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition ${pending ? "opacity-60" : ""}`}>
      <span className="text-[11px] font-medium text-slate-500">
        Blocs alimentés par{active ? " :" : ""}
      </span>
      {tools.map((t) => {
        const on = t.key === activeKey;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTo(t.key)}
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
  );
}
