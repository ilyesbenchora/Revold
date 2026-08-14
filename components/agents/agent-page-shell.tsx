"use client";

import { useEffect, useState, type ReactNode } from "react";
import { listSavedReports, REPORTS_UPDATED_EVENT } from "./saved-reports";

/**
 * Conteneur de la page d'un agent/coach. Dès qu'un rapport de ROUTINE existe :
 *  - la page passe en PLEINE LARGEUR pour que le rapport (tuiles KPI, courbes,
 *    donuts, tables) occupe tout l'espace ;
 *  - le chat se replie derrière un bouton « Discuter avec … » (réouvrable).
 *
 * Le chat replié reste MONTÉ (simplement masqué) : les routines programmées
 * continuent de tourner et l'état de conversation est conservé.
 */
export function AgentPageShell({
  agentKey,
  chatLabel,
  header,
  chat,
  reports,
}: {
  agentKey: string;
  /** Nom affiché sur le bouton de réouverture du chat (persona). */
  chatLabel: string;
  header: ReactNode;
  chat: ReactNode;
  reports?: ReactNode;
}) {
  const [hasRoutineReports, setHasRoutineReports] = useState(false);
  // En présence de rapports de routine, le chat est replié par défaut.
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const refresh = () =>
      setHasRoutineReports(listSavedReports().some((r) => r.agentKey === agentKey && r.origin === "routine"));
    refresh();
    window.addEventListener(REPORTS_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(REPORTS_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [agentKey]);

  const collapsed = hasRoutineReports && !chatOpen;

  return (
    // Pleine largeur EN PERMANENCE (avec ou sans rapport) : le chat occupe le
    // même espace que lorsque des rapports de routine existent.
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      {header}

      {collapsed ? (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="mb-4 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-fuchsia-300 hover:bg-fuchsia-50/40"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span aria-hidden>💬</span> Discuter avec {chatLabel}
          </span>
          <span className="text-xs font-medium text-fuchsia-600">Ouvrir le chat →</span>
        </button>
      ) : (
        hasRoutineReports && (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="text-xs font-medium text-slate-400 transition hover:text-fuchsia-600"
            >
              ▲ Réduire le chat — plein écran pour les rapports
            </button>
          </div>
        )
      )}

      {/* Chat masqué (jamais démonté) : routines et état conservés. */}
      <div className={collapsed ? "hidden" : undefined}>{chat}</div>

      {reports}
    </div>
  );
}
