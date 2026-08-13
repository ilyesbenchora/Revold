"use client";

/**
 * Mode « personnalisation » partagé au niveau page : activé par le bouton
 * « Personnaliser les KPIs » (KpiTilesEditor), consommé par RemovableBlock
 * pour n'afficher les pastilles « ✕ Retirer » des blocs QUE pendant
 * l'édition — plus de bouton retrait au simple survol.
 *
 * Store module minimaliste (useSyncExternalStore) : pas de provider à câbler
 * dans chaque page serveur.
 */

import { useSyncExternalStore } from "react";

let editing = false;
const listeners = new Set<() => void>();

export function setPageEditMode(on: boolean) {
  if (editing === on) return;
  editing = on;
  listeners.forEach((l) => l());
}

export function usePageEditMode(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => editing,
    () => false,
  );
}
