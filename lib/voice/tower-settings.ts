"use client";

/**
 * Réglages de la tour de contrôle vocale — personnalisation par fonctionnalité
 * (Paramètres → Tour de contrôle). Rattachés au COMPTE utilisateur (table
 * voice_tower_settings via /api/voice/settings) : ils suivent l'utilisateur
 * d'un appareil à l'autre. Le localStorage sert de cache instantané au
 * chargement, et l'événement `revold:tower-settings` synchronise en direct le
 * formulaire, l'orbe et la file multi-agents.
 */

import { useEffect, useState } from "react";

/**
 * Donnée personnalisée du brief : un KPI câblé via le funnel de vérification
 * (proposition d'agent + recalcul réel). Le digest recalcule son total en
 * direct à chaque brief — même moteur déterministe que les tables de données.
 */
export type BriefCustomItem = {
  id: string;
  label: string;
  enabled: boolean;
  unit: string | null;
  query: { entity: string; groupBy: string; measure: string; field?: string | null };
};

export type TowerSettings = {
  /** Anneau de santé de l'orbe (vert / ambre / rouge). */
  healthRing: boolean;
  /** Brief vocal du jour (bouton + demande à la voix). */
  brief: boolean;
  /** Phrase personnalisée qui déclenche le brief à la dictée. */
  briefPhrase: string;
  /** Mode veille : le brief ne remonte que les exceptions. */
  veille: boolean;
  /** Contenu du brief — alertes en tension. */
  briefAlerts: boolean;
  /** Contenu du brief — objectifs en retard. */
  briefObjectives: boolean;
  /** Contenu du brief — synchronisations en échec. */
  briefSyncs: boolean;
  /** Contenu du brief — RDV de coaching à venir. */
  briefMeetings: boolean;
  /** Contenu du brief — données personnalisées (KPIs câblés, recalculés en direct). */
  briefCustom: BriefCustomItem[];
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
  briefAlerts: true,
  briefObjectives: true,
  briefSyncs: true,
  briefMeetings: true,
  briefCustom: [],
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
      ...Object.fromEntries(
        Object.entries(parsed).filter(
          ([k, v]) =>
            k in DEFAULT_TOWER_SETTINGS &&
            (typeof v === "boolean" || typeof v === "string" || (k === "briefCustom" && Array.isArray(v))),
        ),
      ),
    } as TowerSettings;
  } catch {
    return DEFAULT_TOWER_SETTINGS;
  }
}

/** Push serveur débouncé : la frappe dans le champ « phrase » ne spamme pas l'API. */
let pushTimer: ReturnType<typeof setTimeout> | null = null;
function pushToServer(next: TowerSettings) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void fetch("/api/voice/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: next }),
    }).catch(() => {});
  }, 600);
}

export function writeTowerSettings(next: TowerSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    localStorage.setItem(LEGACY_VEILLE_KEY, next.veille ? "1" : "0");
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  } catch {}
  pushToServer(next);
}

/**
 * Charge les réglages du COMPTE une seule fois par chargement de page, puis
 * les propage au cache local + à tous les consommateurs (événement).
 */
let serverLoad: Promise<void> | null = null;
function ensureServerSettings() {
  if (serverLoad) return;
  serverLoad = fetch("/api/voice/settings")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const s = d?.settings;
      if (!s || typeof s !== "object") return;
      const merged = { ...readTowerSettings(), ...s } as TowerSettings;
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
        localStorage.setItem(LEGACY_VEILLE_KEY, merged.veille ? "1" : "0");
        window.dispatchEvent(new Event(SETTINGS_EVENT));
      } catch {}
    })
    .catch(() => {});
}

/** Sections de données incluses dans le brief (`?sections=` du digest). */
export function briefSectionsParam(s: TowerSettings): string {
  const on: string[] = [];
  if (s.briefAlerts) on.push("alerts");
  if (s.briefObjectives) on.push("objectives");
  if (s.briefSyncs) on.push("syncs");
  if (s.briefMeetings) on.push("meetings");
  return on.join(",");
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
    // Réglages du compte (une seule requête par chargement de page).
    ensureServerSettings();
    window.addEventListener(SETTINGS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return settings;
}
