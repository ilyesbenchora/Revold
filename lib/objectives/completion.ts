import { isSoon } from "@/lib/alerts/deadline";

export type ObjectiveLike = {
  target: number | null;
  current_value: number | null;
  computedValue?: number | null;
  direction: string | null;
  date_to: string | null;
};

/** Valeur actuelle effective (KPI auto-tracké prioritaire, sinon manuelle). */
export function currentOf(o: ObjectiveLike): number | null {
  return o.computedValue ?? o.current_value ?? null;
}

/** % de complétion (0-100), tenant compte du sens (above/below). */
export function completionPct(o: ObjectiveLike): number {
  const cur = currentOf(o);
  const tgt = o.target ?? null;
  if (tgt == null || cur == null || tgt === 0) return 0;
  const pct = o.direction === "below" ? (cur > 0 ? (tgt / cur) * 100 : 100) : (cur / tgt) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function isReached(o: ObjectiveLike): boolean {
  return completionPct(o) >= 100;
}

/** À risque : échéance proche (≤ withinDays) et objectif pas encore atteint. */
export function isAtRisk(o: ObjectiveLike, withinDays = 14): boolean {
  return isSoon(o.date_to, withinDays) && completionPct(o) < 100;
}
