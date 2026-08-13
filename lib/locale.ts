"use client";

import { useEffect, useState } from "react";

/**
 * Préférence de LANGUE de la plateforme (Mon compte → Langue & formats).
 * Pilote le format des dates (« janvier 2026 » au lieu de « 2026-01 ») et des
 * nombres partout où la donnée temporelle est affichée. Persistée en
 * localStorage, appliquée DYNAMIQUEMENT (événement window, sans rechargement).
 */
export const LOCALE_KEY = "revold:locale";
export const LOCALE_UPDATED_EVENT = "revold:locale-updated";
export const DEFAULT_LOCALE = "fr-FR";

export const SUPPORTED_LOCALES: { id: string; label: string; flag: string }[] = [
  { id: "fr-FR", label: "Français", flag: "🇫🇷" },
  { id: "en-US", label: "English", flag: "🇺🇸" },
  { id: "es-ES", label: "Español", flag: "🇪🇸" },
  { id: "de-DE", label: "Deutsch", flag: "🇩🇪" },
  { id: "it-IT", label: "Italiano", flag: "🇮🇹" },
];

/** Locale courante — lecture directe (SSR-safe : défaut français). */
export function currentLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    return v && SUPPORTED_LOCALES.some((l) => l.id === v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function setLocale(locale: string): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* stockage indisponible : vaut pour la session courante */
  }
  try {
    window.dispatchEvent(new Event(LOCALE_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

/** Hook : locale courante, re-rendu automatique au changement (dynamique). */
export function useLocale(): string {
  const [locale, setLoc] = useState(DEFAULT_LOCALE);
  useEffect(() => {
    const refresh = () => setLoc(currentLocale());
    refresh();
    window.addEventListener(LOCALE_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCALE_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return locale;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Libellé humain d'un bucket temporel du moteur d'agrégat, dans la langue
 * choisie. Les clés restent triables côté moteur (« 2026-01 », « 2026-W03 »,
 * « 2026-T1 », « 2026-S1 », « 2026-01-15 ») — SEUL L'AFFICHAGE est traduit :
 *   2026-01    → « Janvier 2026 »
 *   2026-01-15 → « 15 janv. 2026 »
 *   2026-W03   → « Sem. 3 2026 » / « Wk 3 2026 »
 *   2026-T1    → « T1 2026 » / « Q1 2026 »
 *   2026-S1    → « S1 2026 » / « H1 2026 »
 * Toute clé non temporelle (étape, statut…) est renvoyée telle quelle.
 */
export function formatBucketLabel(key: string, locale: string): string {
  const fr = locale.toLowerCase().startsWith("fr");
  let m = /^(\d{4})-(\d{2})$/.exec(key);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    if (!Number.isNaN(d.getTime()))
      return cap(d.toLocaleDateString(locale, { month: "long", year: "numeric" }));
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  }
  m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (m) return `${fr ? "Sem." : "Wk"} ${Number(m[2])} ${m[1]}`;
  m = /^(\d{4})-T([1-4])$/.exec(key);
  if (m) return `${fr ? "T" : "Q"}${m[2]} ${m[1]}`;
  m = /^(\d{4})-S([12])$/.exec(key);
  if (m) return `${fr ? "S" : "H"}${m[2]} ${m[1]}`;
  return key;
}
