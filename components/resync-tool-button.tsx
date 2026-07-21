"use client";

/**
 * CTA « Relancer la synchronisation » d'un outil connecté.
 *
 * Pose `?sync={tool}` sur la page courante : le <ToolSyncOrchestrator />
 * (monté sur la même page) détecte le paramètre, appelle POST /api/sync/{tool}
 * et affiche la modal de progression avec les compteurs importés.
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function ResyncToolButton({ toolKey, label }: { toolKey: string; label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const running = searchParams.get("sync") === toolKey;

  function launch() {
    if (running) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("sync", toolKey);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={launch}
      disabled={running}
      className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={running ? "animate-spin" : ""}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
      </svg>
      {running ? "Synchronisation…" : (label ?? "Relancer la synchronisation")}
    </button>
  );
}
