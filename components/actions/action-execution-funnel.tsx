"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type FunnelResult = {
  done: number;
  total: number;
  hint?: string;
  results?: { name: string; ok: boolean; error?: string }[];
  error?: string;
};

type StepState = "pending" | "running" | "done" | "error";

const STEPS = [
  { id: "validate", label: "Validation des paramètres" },
  { id: "prepare", label: "Préparation des enregistrements" },
  { id: "write", label: "Écriture dans HubSpot" },
  { id: "verify", label: "Vérification des résultats" },
  { id: "finish", label: "Finalisation" },
] as const;

/**
 * FENÊTRE D'EXÉCUTION EN FUNNEL (B9) : à l'exécution d'une action, les étapes
 * clés défilent automatiquement — validation, préparation, écriture HubSpot
 * (l'appel réel), vérification, finalisation — jusqu'au résultat. L'utilisateur
 * voit CE QUI se passe au lieu d'un simple spinner.
 */
export function ActionExecutionFunnel({
  title,
  count,
  run,
  onClose,
}: {
  /** Titre de l'action exécutée (affiché en en-tête). */
  title: string;
  /** Nombre d'enregistrements concernés. */
  count: number;
  /** L'appel RÉEL (exécuté à l'étape « Écriture dans HubSpot »). */
  run: () => Promise<FunnelResult>;
  /** Fermé par l'utilisateur une fois terminé (résultat transmis). */
  onClose: (result: FunnelResult | null) => void;
}) {
  const [states, setStates] = useState<StepState[]>(STEPS.map(() => "pending"));
  const [result, setResult] = useState<FunnelResult | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    const setStep = (i: number, s: StepState) =>
      !cancelled && setStates((prev) => prev.map((x, j) => (j === i ? s : x)));
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    void (async () => {
      // 1. Validation — paramètres déjà validés côté carte (délai de lisibilité).
      setStep(0, "running");
      await wait(500);
      setStep(0, "done");
      // 2. Préparation des enregistrements.
      setStep(1, "running");
      await wait(600);
      setStep(1, "done");
      // 3. Écriture HubSpot — l'appel RÉEL.
      setStep(2, "running");
      let res: FunnelResult;
      try {
        res = await run();
      } catch (e) {
        res = { done: 0, total: count, error: e instanceof Error ? e.message : "Échec de l'exécution" };
      }
      if (cancelled) return;
      const failed = res.error != null || res.done === 0;
      setStep(2, failed ? "error" : "done");
      // 4. Vérification des résultats.
      setStep(3, "running");
      await wait(500);
      setStep(3, failed && res.done === 0 ? "error" : "done");
      // 5. Finalisation.
      setStep(4, "running");
      await wait(300);
      setStep(4, failed && res.done === 0 ? "error" : "done");
      setResult(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [run, count]);

  if (typeof document === "undefined") return null;
  const finished = result !== null;
  const success = finished && (result?.done ?? 0) > 0;

  return createPortal(
    <div className="dashboard-shell fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">⚡ Exécution en cours · HubSpot</p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-[11px] text-slate-500">{count.toLocaleString("fr-FR")} enregistrement{count > 1 ? "s" : ""} concerné{count > 1 ? "s" : ""}</p>
        </div>

        {/* Étapes clés — funnel auto-déroulant */}
        <ol className="space-y-0 px-5 py-4">
          {STEPS.map((s, i) => {
            const st = states[i];
            return (
              <li key={s.id} className="relative flex items-center gap-3 py-2">
                {i < STEPS.length - 1 && (
                  <span className={`absolute left-[11px] top-8 h-4 w-0.5 ${st === "done" ? "bg-emerald-300" : "bg-slate-200"}`} />
                )}
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    st === "done"
                      ? "bg-emerald-500 text-white"
                      : st === "running"
                        ? "bg-amber-500 text-white"
                        : st === "error"
                          ? "bg-rose-500 text-white"
                          : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {st === "done" ? "✓" : st === "error" ? "✕" : st === "running" ? (
                    <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={`text-sm ${st === "running" ? "font-semibold text-slate-900" : st === "done" ? "text-slate-600" : st === "error" ? "font-medium text-rose-600" : "text-slate-400"}`}>
                  {s.label}
                  {s.id === "prepare" && st !== "pending" && <span className="ml-1 text-[11px] text-slate-400">({count})</span>}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Résultat final */}
        {finished && (
          <div className="px-5 pb-4">
            <div className={`rounded-lg border px-3 py-2 text-xs ${success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
              <p className="font-medium">
                {success ? `✓ ${result!.done}/${result!.total} exécuté(s) dans HubSpot` : result?.error ?? "Aucune action exécutée"}
              </p>
              {result?.hint && <p className="mt-1">{result.hint}</p>}
              {result?.results?.some((r) => !r.ok) && (
                <ul className="mt-1 list-disc pl-4">
                  {result.results.filter((r) => !r.ok).slice(0, 4).map((r, i) => (
                    <li key={i}>{r.name} — {r.error}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            disabled={!finished}
            onClick={() => onClose(result)}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {finished ? "Fermer" : "Exécution…"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
