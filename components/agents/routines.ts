import type { RoutineFrequency } from "@/lib/ai/agents/routine-catalog";

/**
 * Routines de chat : questions récurrentes posées automatiquement à l'agent
 * (ex : « récap des ventes de la semaine tous les jours à 9h00 »). Le rapport
 * généré est enregistré dans « Rapports enregistrés » avec un badge Routine.
 *
 * SOURCE DE VÉRITÉ : la table agent_routines (partagée par l'organisation,
 * exécutée côté serveur par le cron /api/cron/run-routines — plus besoin
 * d'avoir la page ouverte). Ce module garde une API synchrone : cache mémoire
 * hydraté depuis l'API au premier accès (événement ROUTINES_UPDATED_EVENT à
 * l'arrivée), localStorage en cache de premier rendu + import automatique
 * UNIQUE de l'existant local vers la base.
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
const MIGRATED_KEY = "revold:agent-routines:migrated";
/** Événement window émis quand la liste des routines change. */
export const ROUTINES_UPDATED_EVENT = "revold:routines-updated";

let cache: Routine[] | null = null;
let loadPromise: Promise<void> | null = null;

function notify(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(ROUTINES_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

function readLocal(): Routine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROUTINES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Routine[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Miroir localStorage : premier rendu instantané + compteurs même appareil. */
function writeLocal(routines: Routine[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
  } catch {
    /* quota / mode privé → ignore */
  }
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";
  } catch {
    return "Europe/Paris";
  }
}

/** Hydrate le cache depuis l'API (une fois), avec import du legacy localStorage. */
function ensureLoaded(): void {
  if (typeof window === "undefined" || loadPromise) return;
  loadPromise = (async () => {
    try {
      const res = await fetch("/api/agent-routines");
      if (!res.ok) return; // hors-ligne / non connecté → fallback local
      const d = (await res.json()) as { routines?: Routine[]; unavailable?: boolean };
      if (d.unavailable) return; // migration DB non appliquée → fallback local
      let list = Array.isArray(d.routines) ? d.routines : [];

      // Import UNIQUE de l'existant localStorage (serveur vide uniquement).
      const local = readLocal();
      if (list.length === 0 && local.length > 0 && localStorage.getItem(MIGRATED_KEY) !== "1") {
        const imp = await fetch("/api/agent-routines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ import: local, timezone: browserTimezone() }),
        });
        if (imp.ok) {
          const again = await fetch("/api/agent-routines");
          const d2 = (await again.json().catch(() => ({}))) as { routines?: Routine[] };
          if (Array.isArray(d2.routines)) list = d2.routines;
        }
      }
      try {
        localStorage.setItem(MIGRATED_KEY, "1");
      } catch { /* ignore */ }

      cache = list;
      writeLocal(list);
      notify();
    } catch {
      /* réseau indisponible → on reste sur le fallback local */
    }
  })();
}

/** Recharge depuis le serveur (ex : après une exécution par le cron). */
export function refreshRoutines(): void {
  loadPromise = null;
  ensureLoaded();
}

export function listRoutines(): Routine[] {
  if (cache) return cache;
  ensureLoaded();
  return readLocal();
}

export function listAgentRoutines(agentKey: string): Routine[] {
  return listRoutines().filter((r) => r.agentKey === agentKey);
}

function setCache(routines: Routine[]): void {
  cache = routines;
  writeLocal(routines);
  notify();
}

export function addRoutine(entry: Omit<Routine, "id" | "createdAt" | "active"> & { active?: boolean }): Routine {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `rt_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const full: Routine = { active: true, ...entry, id, createdAt: Date.now() };
  // Optimiste : visible immédiatement, la base suit (le serveur réutilise l'id).
  setCache([full, ...listRoutines()]);
  void fetch("/api/agent-routines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...full, timezone: browserTimezone() }),
  }).catch(() => { /* hors-ligne : la routine restera locale jusqu'au prochain import */ });
  return full;
}

export function updateRoutine(id: string, patch: Partial<Routine>): void {
  setCache(listRoutines().map((r) => (r.id === id ? { ...r, ...patch } : r)));
  void fetch(`/api/agent-routines/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => { /* best-effort */ });
}

export function removeRoutine(id: string): void {
  setCache(listRoutines().filter((r) => r.id !== id));
  void fetch(`/api/agent-routines/${id}`, { method: "DELETE" }).catch(() => { /* best-effort */ });
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
 * d'avant cette occurrence (avec l'espacement de la fréquence). L'exécution
 * programmée est désormais faite CÔTÉ SERVEUR (cron run-routines) — ce calcul
 * sert à l'affichage et aux exécutions manuelles.
 */
export function isRoutineDue(r: Routine, now: Date = new Date()): boolean {
  if (!r.active) return false;
  const occ = lastOccurrence(now, r.time);
  if (occ <= r.createdAt) return false;
  if (!r.lastRunAt) return true;
  if (r.frequency === "daily") return r.lastRunAt < occ;
  const gapDays =
    r.frequency === "weekly" ? 7 : r.frequency === "monthly" ? 30 : r.frequency === "quarterly" ? 91 : 365;
  return r.lastRunAt < occ - (gapDays - 1) * DAY_MS;
}
