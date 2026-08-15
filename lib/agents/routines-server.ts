/**
 * Helpers serveur des routines d'agents (table agent_routines) : mapping
 * ligne DB ↔ forme client (héritée de l'ancien module localStorage) et calcul
 * d'échéance utilisé par le cron /api/cron/run-routines.
 */

export type RoutineRow = {
  id: string;
  organization_id: string;
  agent_key: string;
  label: string;
  prompt: string;
  frequency: string;
  time_of_day: string;
  timezone: string;
  active: boolean;
  last_run_at: string | null;
  last_error: string | null;
  created_at: string;
};

export function routineToClient(r: RoutineRow) {
  return {
    id: r.id,
    agentKey: r.agent_key,
    label: r.label,
    prompt: r.prompt,
    frequency: r.frequency,
    time: r.time_of_day,
    active: r.active,
    createdAt: r.created_at ? Date.parse(r.created_at) : Date.now(),
    lastRunAt: r.last_run_at ? Date.parse(r.last_run_at) : null,
    lastError: r.last_error ?? null,
  };
}

const DAY_MS = 86_400_000;

/** Heure locale (h, min, date du jour) dans un fuseau IANA, sans dépendance. */
function nowInTimezone(now: Date, timeZone: string): { y: number; m: number; d: number; h: number; min: number } {
  try {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute") };
  } catch {
    return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate(), h: now.getUTCHours(), min: now.getUTCMinutes() };
  }
}

/**
 * Timestamp (ms UTC) de l'occurrence la plus récente de HH:MM dans le fuseau
 * de la routine : aujourd'hui si l'heure est passée, sinon hier. Approximation
 * sans bibliothèque tz : on mesure l'écart en minutes entre l'heure locale de
 * la routine et l'heure locale courante, appliqué au timestamp UTC courant.
 */
export function lastOccurrenceMs(now: Date, timeOfDay: string, timeZone: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(timeOfDay);
  const targetH = m ? Number(m[1]) : 9;
  const targetMin = m ? Number(m[2]) : 0;
  const local = nowInTimezone(now, timeZone);
  const minutesNow = local.h * 60 + local.min;
  const minutesTarget = targetH * 60 + targetMin;
  let deltaMin = minutesNow - minutesTarget;
  if (deltaMin < 0) deltaMin += 24 * 60; // heure pas encore passée aujourd'hui → occurrence d'hier
  return now.getTime() - deltaMin * 60_000;
}

/**
 * Routine échue (même sémantique que l'ancien client) : l'occurrence
 * programmée est passée, postérieure à la création, et le dernier rapport
 * date d'avant cette occurrence (avec l'espacement de la fréquence).
 */
export function isRoutineRowDue(r: RoutineRow, now: Date = new Date()): boolean {
  if (!r.active) return false;
  const occ = lastOccurrenceMs(now, r.time_of_day, r.timezone || "Europe/Paris");
  const createdAt = r.created_at ? Date.parse(r.created_at) : 0;
  if (occ <= createdAt) return false;
  const lastRunAt = r.last_run_at ? Date.parse(r.last_run_at) : null;
  if (!lastRunAt) return true;
  if (r.frequency === "daily") return lastRunAt < occ;
  const gapDays =
    r.frequency === "weekly" ? 7 : r.frequency === "monthly" ? 30 : r.frequency === "quarterly" ? 91 : 365;
  return lastRunAt < occ - (gapDays - 1) * DAY_MS;
}
