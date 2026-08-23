"use client";

/**
 * Mois de début d'exercice comptable (1-12) — lu une seule fois par page
 * (cache module) pour les presets « Exercice » des barres de période.
 * Défaut janvier (1) si non configuré ou en cas d'erreur.
 */
let cached: Promise<number> | null = null;

export function fetchFiscalYearStart(): Promise<number> {
  if (!cached) {
    cached = fetch("/api/settings/fiscal-year")
      .then((r) => r.json())
      .then((d) => {
        const n = Number(d?.fiscalYearStart);
        return Number.isInteger(n) && n >= 1 && n <= 12 ? n : 1;
      })
      .catch(() => 1);
  }
  return cached;
}
