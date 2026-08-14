"use client";

/**
 * File d'exécution de la tour de contrôle vocale — chip flottante en bas à
 * droite du dashboard. Quand une dictée contient PLUSIEURS demandes, la
 * première est ouverte immédiatement et les suivantes attendent ici : un clic
 * briefe l'agent suivant (chat ouvert avec la demande exécutée via ?ask=…).
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readTowerQueue, writeTowerQueue, type QueuedDispatch } from "@/components/voice/revold-orb";

export function TowerQueue() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueuedDispatch[]>([]);

  useEffect(() => {
    const sync = () => setQueue(readTowerQueue());
    sync();
    window.addEventListener("revold:tower-queue", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("revold:tower-queue", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const runNext = useCallback(() => {
    const [next, ...rest] = readTowerQueue();
    if (!next) return;
    writeTowerQueue(rest);
    router.push(`/dashboard/agents/${next.agentKey}?ask=${encodeURIComponent(next.request)}`);
  }, [router]);

  const clear = useCallback(() => writeTowerQueue([]), []);

  if (queue.length === 0) return null;
  const next = queue[0];

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-amber-300/40 bg-slate-950/95 py-1.5 pl-4 pr-1.5 shadow-lg shadow-slate-950/40 backdrop-blur">
      <span className="text-[11px] text-slate-400">
        Tour de contrôle · {queue.length === 1 ? "1 demande en file" : `${queue.length} demandes en file`}
      </span>
      <button
        type="button"
        onClick={runNext}
        title={next.request}
        className="rounded-full bg-amber-300 px-3 py-1 text-[11px] font-semibold text-slate-900 transition hover:bg-amber-200"
      >
        Briefer {next.personaName || next.agentLabel} →
      </button>
      <button
        type="button"
        onClick={clear}
        title="Vider la file"
        aria-label="Vider la file"
        className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
      >
        ✕
      </button>
    </div>
  );
}
