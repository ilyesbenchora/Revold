/**
 * Utilitaires d'échéance des alertes. Les dates sont en YYYY-MM-DD ; la fin de
 * suivi est considérée à la fin du jour (23:59:59). Ces helpers sont hors rendu
 * de composant (appel de fonction) pour rester compatibles avec la règle de
 * pureté ESLint côté server components.
 */

export function endOfDay(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999).getTime();
}

export function startOfDay(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0).getTime();
}

/** Jours restants avant la fin (arrondi au jour supérieur). Négatif si échue. */
export function daysUntil(dateTo: string): number {
  return Math.ceil((endOfDay(dateTo) - Date.now()) / 86_400_000);
}

/** Alerte à échéance proche : date de fin dans [0, withinDays] jours. */
export function isSoon(dateTo: string | null | undefined, withinDays = 7): boolean {
  if (!dateTo) return false;
  const du = daysUntil(dateTo);
  return du >= 0 && du <= withinDays;
}

/** Alerte échue (date de fin dépassée). */
export function isOverdue(dateTo: string | null | undefined): boolean {
  if (!dateTo) return false;
  return endOfDay(dateTo) < Date.now();
}
