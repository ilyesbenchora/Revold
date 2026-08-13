import type { RoutineFrequency } from "@/lib/ai/agents/routine-catalog";

/**
 * Routines de chat : questions récurrentes posées automatiquement à l'agent
 * (ex : « récap des ventes de la semaine tous les jours à 9h00 »). Le rapport
 * généré est enregistré dans « Rapports enregistrés » avec un badge Routine.
 * Persistées en localStorage, exécutées côté client à l'ouverture de la page
 * de l'agent quand l'heure est passée.
 */
export type Routine = {
  id: string;
  agentKey: string;
  label: string;
  prompt: string;
  frequency: RoutineFrequency;
  time: string; // HH:MM (heure locale)
  active: boolean;
  createdAt: number;
  lastRunAt?: number | null;
  lastError?: string | null;
};

export const ROUTINES_KEY = "revold:agent-routines:v1";
/** Événement window émis quand la liste des routines change. */
export const ROUTINES_UPDATED_EVENT = "revold:routines-updated";

function notify(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(ROUTINES_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export function listRoutines(): Routine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROUTINES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Routine[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listAgentRoutines(agentKey: string): Routine[] {
  return listRoutines().filter((r) => r.agentKey === agentKey);
}

function write(routines: Routine[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
    notify();
  } catch {
    /* quota / mode privé → ignore */
  }
}

export function addRoutine(entry: Omit<Routine, "id" | "createdAt" | "active"> & { active?: boolean }): Routine {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `rt_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const full: Routine = { active: true, ...entry, id, createdAt: Date.now() };
  write([full, ...listRoutines()]);
  return full;
}

export function updateRoutine(id: string, patch: Partial<Routine>): void {
  write(listRoutines().map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export function removeRoutine(id: string): void {
  write(listRoutines().filter((r) => r.id !== id));
}

/** Timestamp de l'occurrence la plus récente de HH:MM (aujourd'hui si passée, sinon hier). */
function lastOccurrence(now: Date, time: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  const h = m ? Number(m[1]) : 9;
  const min = m ? Number(m[2]) : 0;
  const occ = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, 0, 0);
  if (occ.getTime() > now.getTime()) occ.setDate(occ.getDate() - 1);
  return occ.getTime();
}

const DAY_MS = 86_400_000;

/**
 * Routine « échue » : l'heure programmée est passée et le dernier rapport date
 * d'avant cette occurrence (avec l'espacement de la fréquence). Une routine
 * créée APRÈS l'occurrence du jour attend la prochaine — pas de rapport
 * surprise à l'activation.
 */
export function isRoutineDue(r: Routine, now: Date = new Date()): boolean {
  if (!r.active) return false;
  const occ = lastOccurrence(now, r.time);
  if (occ <= r.createdAt) return false;
  if (!r.lastRunAt) return true;
  if (r.frequency === "daily") return r.lastRunAt < occ;
  const gapDays = r.frequency === "weekly" ? 7 : 30;
  return r.lastRunAt < occ - (gapDays - 1) * DAY_MS;
}
