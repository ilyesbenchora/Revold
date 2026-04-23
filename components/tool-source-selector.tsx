"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "./brand-logo";

export type ToolOption = {
  key: string;
  label: string;
  icon: string;
  domain: string;
};

export function ToolSourceSelector({
  pageKey,
  pageLabel,
  options,
  selectedKey,
}: {
  pageKey: string;
  pageLabel: string;
  options: ToolOption[];
  selectedKey: string | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<string | null>(selectedKey);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (options.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">Outil source — {pageLabel}</span>
        <span className="ml-2">
          Aucun outil connecté à Revold. Configurez une intégration depuis{" "}
          <a href="/dashboard/integration" className="text-accent underline">
            Intégrations
          </a>
          .
        </span>
      </div>
    );
  }

  const selected = options.find((o) => o.key === current) ?? null;

  function handlePick(toolKey: string) {
    if (toolKey === current) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/tool-mappings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageKey, toolKey }),
        });
        if (!res.ok) {
          setError("Impossible d'enregistrer le choix.");
          return;
        }
        setCurrent(toolKey);
        router.refresh();
      } catch {
        setError("Erreur réseau.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Outil source — {pageLabel}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {selected
              ? `Revold utilise « ${selected.label} » comme outil principal d'analyse pour cette page.`
              : "Choisissez l'outil principal d'analyse pour cette page."}
          </p>
        </div>
        {isPending && <span className="text-[11px] text-slate-400">Enregistrement…</span>}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => {
          const isActive = opt.key === current;
          return (
            <button
              key={opt.key}
              type="button"
              disabled={isPending}
              onClick={() => handlePick(opt.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              } disabled:opacity-50`}
            >
              <BrandLogo domain={opt.domain} alt={opt.label} fallback={opt.icon} size={14} />
              {opt.label}
              {isActive && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
