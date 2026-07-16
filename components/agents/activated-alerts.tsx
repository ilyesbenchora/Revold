"use client";

import { createContext, useContext } from "react";

export type ActivatedAlert = { title: string; at: number };

/**
 * Permet à n'importe quelle carte d'alerte du chat (suggestion OU alerte créée
 * depuis un rapport) de signaler une activation, pour l'afficher dans l'onglet
 * « Alertes » du chat.
 */
export const ActivatedAlertsContext = createContext<((a: ActivatedAlert) => void) | null>(null);

export function useNotifyActivatedAlert() {
  return useContext(ActivatedAlertsContext);
}
