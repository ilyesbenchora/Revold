"use client";

/**
 * Réglages de la tour de contrôle vocale — personnalisation par fonctionnalité
 * (Paramètres → Tour de contrôle). Stockés côté navigateur (localStorage) et
 * partagés en direct entre le formulaire, l'orbe et la file multi-agents via
 * l'événement `revold:tower-settings`.
 */

import { useEffect, useState } from "react";

export type TowerSettings = {
  /** Anneau de santé de l'orbe (vert / ambre / rouge). */
  healthRing: boolean;
  /** Brief vocal du jour (bouton + demande à la voix). */
  brief: boolean;
  /** Phrase personnalisée qui déclenche le brief à la dictée. */
  briefPhrase: string;
  /** Mode veille : le brief ne remonte que les exceptions. */
  veille: boolean;
  /** Réponse directe aux questions KPI simples. */
  quickAnswer: boolean;
  /** Création d'alertes et d'objectifs à la voix (toujours validée par boutons). */
  createActions: boolean;
  /** Navigation vocale (pages + rapports sauvegardés). */
  navigation: boolean;
  /** File d'exécution multi-agents (plusieurs demandes par phrase). */
  queue: boolean;
  /** Mémoire des 3 derniers échanges (enchaînements). */
  memory: boolean;
};

export const DEFAULT_TOWER_SETTINGS: TowerSettings = {
  healthRing: true,
  brief: true,
  briefPhrase: "quoi de neuf",
  veille: false,
  quickAnswer: true,
  createActions: true,
  navigation: true,
  queue: true,
  memory: true,
};

const SETTINGS_KEY = "revold:tower-settings";
const SETTINGS_EVENT = "revold:tower-settings";
/** Ancien réglage veille (v1) — migré au premier chargement. */
const LEGACY_VEILLE_KEY = "revold:tower-veille";

export function readTowerSettings(): TowerSettings {
  if (typeof window === "undefined") return DEFAULT_TOWER_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const legacyVeille = localStorage.getItem(LEGACY_VEILLE_KEY) === "1";
    if (!raw) return { ...DEFAULT_TOWER_SETTINGS, veille: legacyVeille };
    const parsed = JSON.parse(raw) as Partial<TowerSettings>;
    return {
      ...DEFAULT_TOWER_SETTINGS,
      ...Object.fromEntries(Object.entries(parsed).filter(([k, v]) => k in DEFAULT_TOWER_SETTINGS && (typeof v === "boolean" || typeof v === "string"))),
    } as TowerSettings;
  } catch {
    return DEFAULT_TOWER_SETTINGS;
  }
}

export function writeTowerSettings(next: TowerSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    localStorage.setItem(LEGACY_VEILLE_KEY, next.veille ? "1" : "0");
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  } catch {}
}

/** Outils du routeur vocal à désactiver côté serveur selon les réglages. */
export function disabledDispatchTools(s: TowerSettings): string[] {
  const off: string[] = [];
  if (!s.quickAnswer) off.push("quick_answer");
  if (!s.createActions) off.push("create_alert", "create_objective");
  if (!s.navigation) off.push("navigate");
  if (!s.brief) off.push("daily_brief");
  return off;
}

/** Normalisation souple pour matcher la phrase de brief dictée. */
export function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Réglages synchronisés en direct (formulaire ↔ orbe ↔ file). */
export function useTowerSettings(): TowerSettings {
  const [settings, setSettings] = useState<TowerSettings>(DEFAULT_TOWER_SETTINGS);
  useEffect(() => {
    const sync = () => setSettings(readTowerSettings());
    sync();
    window.addEventListener(SETTINGS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return settings;
}
