"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { UnifiedCoaching } from "@/lib/reports/coaching-types";
import { buildBreezePrompt } from "@/lib/coaching/breeze-prompt";

const SEV_THEME: Record<UnifiedCoaching["severity"], { bar: string; pill: string; label: string }> = {
  critical: { bar: "from-red-500 to-rose-600", pill: "bg-red-100 text-red-700", label: "Critique" },
  warning: { bar: "from-amber-500 to-orange-600", pill: "bg-amber-100 text-amber-800", label: "Vigilance" },
  info: { bar: "from-indigo-500 to-violet-600", pill: "bg-indigo-100 text-indigo-700", label: "Info" },
};

type Props = {
  item: UnifiedCoaching;
  open: boolean;
  onClose: () => void;
};

export function BreezePromptDrawer({ item, open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const theme = SEV_THEME[item.severity];

  // Construit le prompt à la volée — pure fonction, pas de coût significatif
  const prompt = buildBreezePrompt(item);

  // Portal mounting (SSR safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC ferme + lock du scroll body quand ouvert
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  // Reset copied state à chaque réouverture
  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback : sélection manuelle
      const textarea = document.getElementById("breeze-prompt-textarea") as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.select();
        try {
          document.execCommand("copy");
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {}
      }
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fermer l'aperçu"
        onClick={onClose}
        className="flex-1 bg-slate-900/40 backdrop-blur-[2px] transition"
      />

      {/* Panel */}
      <div className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-slate-200 animate-[slideIn_0.18s_ease-out]">
        {/* Bandeau coloré selon sévérité */}
        <div className={`h-1.5 bg-gradient-to-r ${theme.bar}`} />

        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${theme.pill}`}>
                {theme.label}
              </span>
              <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-700">
                Aperçu LLM Breeze
              </span>
            </div>
            <h2 className="mt-2 truncate text-base font-semibold text-slate-900">
              {item.title}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Prompt prêt à coller dans HubSpot Breeze AI ou tout assistant IA HubSpot-aware.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Action bar */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">{prompt.length.toLocaleString("fr-FR")}</span> caractères ·{" "}
            <span className="font-semibold text-slate-700">{prompt.split(/\s+/).length.toLocaleString("fr-FR")}</span> mots
          </div>
          <button
            type="button"
            onClick={copyPrompt}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition ${
              copied
                ? "bg-emerald-600 text-white"
                : "bg-fuchsia-600 text-white hover:bg-fuchsia-700"
            }`}
          >
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                LLM copié
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copier le LLM
              </>
            )}
          </button>
        </div>

        {/* Prompt body — scroll interne */}
        <div className="relative flex-1 overflow-y-auto bg-slate-950 p-5">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-slate-100">
            {prompt}
          </pre>
          {/* textarea cachée pour le fallback execCommand */}
          <textarea
            id="breeze-prompt-textarea"
            value={prompt}
            readOnly
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute h-px w-px opacity-0"
          />
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white px-5 py-3">
          <p className="text-[11px] leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-700">Comment l&apos;utiliser :</span>{" "}
            cliquez sur <span className="font-semibold">Copier le LLM</span>, ouvrez HubSpot Breeze (ou n&apos;importe quel assistant IA HubSpot), collez le prompt dans la conversation. Breeze déroulera le plan d&apos;action étape par étape en demandant votre validation à chaque action irréversible.
          </p>
        </footer>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
