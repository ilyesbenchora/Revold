"use client";

/**
 * Generic sync orchestrator — runs whenever the integration page is loaded
 * with `?sync={provider}` (set right after a successful connect). Calls
 * /api/sync/{provider}, displays a modal with progress and the imported
 * counts, and removes the query param when finished.
 *
 * Works for every provider in the registry: Stripe today, Pipedrive /
 * Pennylane / Intercom / etc. as soon as their connector is implemented.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type StatCount = {
  contacts?: number;
  invoices?: number;
  subscriptions?: number;
  payments?: number;
  tickets?: number;
  companies?: number;
  deals?: number;
};

const STAT_LABELS: Record<keyof StatCount, string> = {
  contacts: "Contacts",
  companies: "Entreprises",
  invoices: "Factures",
  payments: "Paiements",
  subscriptions: "Abonnements",
  tickets: "Tickets",
  deals: "Deals",
};

export function ToolSyncOrchestrator() {
  const sp = useSearchParams();
  const router = useRouter();
  const provider = sp.get("sync");

  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [counts, setCounts] = useState<StatCount>({});
  const [notImplemented, setNotImplemented] = useState(false);

  // Track le provider déjà processé pour éviter qu'un setStatus("idle")
  // déclenché par close() ne relance une nouvelle sync via le useEffect
  // (race entre setStatus et useSearchParams qui n'a pas encore propagé
  // la suppression du param `sync`).
  const processedProvider = useRef<string | null>(null);
  // Garde une ref sur l'AbortController de la sync en cours pour pouvoir
  // l'abort proprement quand l'user clique "Fermer".
  const activeController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!provider) {
      processedProvider.current = null;
      return;
    }
    if (provider === processedProvider.current) return;
    if (status !== "idle") return;

    processedProvider.current = provider;
    let cancelled = false;
    setStatus("running");

    // AbortController côté client : si la sync n'a pas répondu en 4 min
    // on coupe proprement et on affiche un message d'erreur explicite
    // (Vercel kill la fonction à 5 min, on s'arrête avant pour laisser au
    // serveur le temps d'écrire son sync_log final).
    const controller = new AbortController();
    activeController.current = controller;
    const timeoutMs = 4 * 60 * 1000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    (async () => {
      try {
        const res = await fetch(`/api/sync/${provider}`, {
          method: "POST",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setMessage(data?.error || data?.message || "Erreur inconnue");
          return;
        }
        setCounts(data.counts ?? {});
        setMessage(data.message ?? "Synchronisation terminée");
        setNotImplemented(!!data.notImplemented);
        setStatus("done");
      } catch (err) {
        clearTimeout(timeoutId);
        if (cancelled) return;
        const e = err as Error;
        if (e.name === "AbortError") {
          // Distingue abort utilisateur (close) vs abort timeout
          if (controller.signal.reason === "user_cancelled") {
            return; // Pas de message d'erreur, l'user a fermé volontairement
          }
          setStatus("error");
          setMessage(
            `La synchronisation ${provider} a dépassé 4 minutes. ` +
              `Le compte est probablement très volumineux. ` +
              `Fermez cette fenêtre puis cliquez sur "Re-synchroniser" — ` +
              `les données déjà importées seront conservées et la sync reprendra.`,
          );
        } else {
          setStatus("error");
          setMessage(e.message || "Erreur réseau pendant la synchronisation.");
        }
      } finally {
        if (activeController.current === controller) {
          activeController.current = null;
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [provider, status]);

  function close() {
    // Si une sync est en cours, on l'abort tout de suite (pas d'attente
    // côté serveur, l'API continuera mais on ne reçoit plus la réponse).
    if (activeController.current) {
      activeController.current.abort("user_cancelled");
      activeController.current = null;
    }
    // Hide modal immédiatement avant le router.replace pour éviter un
    // flicker.
    setStatus("idle");
    setMessage("");
    setCounts({});
    // Nettoie l'URL — le useEffect réagira au changement de provider et
    // n'aura plus rien à faire.
    const url = new URL(window.location.href);
    url.searchParams.delete("sync");
    router.replace(url.pathname + (url.search ? url.search : ""));
  }

  if (!provider || status === "idle") return null;

  const importedEntries = Object.entries(counts).filter(([, n]) => (n ?? 0) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h2 className="text-lg font-semibold capitalize text-slate-900">
          {status === "running" && `Synchronisation ${provider} en cours...`}
          {status === "done" && (notImplemented ? `${provider} : connecteur en cours` : `Synchronisation ${provider} terminée`)}
          {status === "error" && `Erreur de synchronisation ${provider}`}
        </h2>

        {status === "running" && (
          <div className="mt-6 flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
            <p className="text-sm text-slate-600">Import des données depuis {provider}...</p>
          </div>
        )}

        {status === "done" && (
          <>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            {importedEntries.length > 0 && (
              <ul className="mt-4 space-y-2">
                {importedEntries.map(([key, value]) => (
                  <li key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-700">{STAT_LABELS[key as keyof StatCount] ?? key}</span>
                    <span className="font-semibold text-emerald-600">
                      {(value ?? 0).toLocaleString("fr-FR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {notImplemented && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Vos identifiants sont sécurisés dans Revold. L&apos;ingestion sera activée prochainement.
              </div>
            )}
          </>
        )}

        {status === "error" && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          {status === "running" && (
            <p className="mr-auto self-center text-[11px] text-slate-400">
              Vous pouvez fermer — la sync continue en arrière-plan.
            </p>
          )}
          <button
            type="button"
            onClick={close}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
              status === "running"
                ? "bg-slate-500 hover:bg-slate-600"
                : "bg-accent hover:bg-indigo-500"
            }`}
          >
            {status === "running" ? "Fermer (continuer en arrière-plan)" : "Fermer"}
          </button>
        </div>
      </div>
    </div>
  );
}
