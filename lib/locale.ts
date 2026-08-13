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

/** Lundi de la semaine ISO w de l'année y (le 4 janvier est toujours en semaine 1). */
function isoWeekStart(y: number, w: number): Date {
  const jan4 = new Date(y, 0, 4);
  const day = jan4.getDay() || 7;
  return new Date(y, 0, 4 - day + 1 + (w - 1) * 7);
}

/**
 * Libellé humain d'un bucket temporel du moteur d'agrégat, dans la langue
 * choisie. Les clés restent triables côté moteur (« 2026-01 », « 2026-W03 »,
 * « 2026-T1 », « 2026-S1 », « 2026-01-15 ») — SEUL L'AFFICHAGE est traduit :
 *   2026-01    → « Janvier 2026 »
 *   2026-01-15 → « 15/01/2026 » (format numérique de la langue)
 *   2026-W03   → date du lundi de la semaine, « 12/01/2026 »
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
  // Fréquence JOUR : format numérique jj/mm/aaaa (selon la langue).
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString(locale);
  }
  // Fréquence SEMAINE : date du lundi en jj/mm/aaaa — les libellés successifs
  // sont naturellement espacés de 7 jours.
  m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (m) {
    const d = isoWeekStart(Number(m[1]), Number(m[2]));
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString(locale);
  }
  m = /^(\d{4})-T([1-4])$/.exec(key);
  if (m) return `${fr ? "T" : "Q"}${m[2]} ${m[1]}`;
  m = /^(\d{4})-S([12])$/.exec(key);
  if (m) return `${fr ? "S" : "H"}${m[2]} ${m[1]}`;
  return key;
}

/**
 * Espacement des ticks de l'axe X selon la nature des buckets (prop `interval`
 * recharts = nombre de ticks SAUTÉS entre deux affichés) :
 *   jour    → un tick tous les 5 jours (interval 4),
 *   semaine → un tick par semaine (interval 0, libellés espacés de 7 jours).
 * Au-delà de ~24 ticks visibles, l'espacement est multiplié pour rester
 * lisible (toujours en multiples de 5 j / 7 j). undefined = laisser recharts
 * gérer (buckets non journaliers/hebdomadaires).
 */
export function bucketTickInterval(rawKeys: string[]): number | undefined {
  if (rawKeys.length < 2) return undefined;
  const MAX_TICKS = 24;
  if (rawKeys.every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))) {
    let iv = 4; // 5 jours
    while (rawKeys.length / (iv + 1) > MAX_TICKS) iv += 5;
    return iv;
  }
  if (rawKeys.every((k) => /^\d{4}-W\d{2}$/.test(k))) {
    let iv = 0; // 7 jours
    while (rawKeys.length / (iv + 1) > MAX_TICKS) iv += 1;
    return iv;
  }
  return undefined;
}
