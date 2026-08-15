import type { ReportSpec, ChartProposal } from "@/lib/ai/agents/agent-runtime";

/**
 * Rapports enregistrés (chat + routines) — affichés sur /dashboard/mes-rapports
 * et dans les carrousels d'agents.
 *
 * SOURCE DE VÉRITÉ : la table saved_reports, partagée par l'ORGANISATION
 * (le dirigeant partage ses récaps à l'équipe, multi-appareils). Ce module
 * garde une API synchrone : cache mémoire hydraté depuis l'API au premier
 * accès (événement REPORTS_UPDATED_EVENT à l'arrivée), localStorage en cache
 * de premier rendu + import automatique UNIQUE de l'existant local.
 */
export type SavedReport = {
  id: string;
  agentKey: string;
  agentLabel: string;
  title: string;
  summary?: string;
  report: ReportSpec | null;
  chart: ChartProposal | null;
  alert: { title: string; description: string; impact?: string; category?: string; channels?: string[] };
  alertId?: string;
  savedAt: number;
  /** Provenance : rapport généré automatiquement par une routine de chat. */
  origin?: "chat" | "routine";
  /** Libellé de la routine à l'origine du rapport (badge dans les listes). */
  routineLabel?: string;
  /** Analyse écrite détaillée de l'agent (rapports de routine, affichage pleine largeur). */
  analysis?: string;
  /** Retiré de l'affichage de la page agent — reste visible dans « Mes rapports ». */
  hidden?: boolean;
};

export const SAVED_REPORTS_KEY = "revold:saved-reports:v1";
const MIGRATED_KEY = "revold:saved-reports:migrated";
/** Événement window émis quand la liste des rapports enregistrés change. */
export const REPORTS_UPDATED_EVENT = "revold:reports-updated";

let cache: SavedReport[] | null = null;
let loadPromise: Promise<void> | null = null;

function notifyReportsUpdated(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(REPORTS_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

function readLocal(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_REPORTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedReport[]) : [];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch {
    return [];
  }
}

function writeLocal(reports: SavedReport[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(reports.slice(0, 100)));
  } catch {
    /* quota / mode privé → ignore (les gros rapports restent en base) */
  }
}

/** Hydrate le cache depuis l'API (une fois), avec import du legacy localStorage. */
function ensureLoaded(): void {
  if (typeof window === "undefined" || loadPromise) return;
  loadPromise = (async () => {
    try {
      const res = await fetch("/api/saved-reports");
      if (!res.ok) return; // hors-ligne / non connecté → fallback local
      const d = (await res.json()) as { reports?: SavedReport[]; unavailable?: boolean };
      if (d.unavailable) return; // migration DB non appliquée → fallback local
      let list = Array.isArray(d.reports) ? d.reports : [];

      // Import UNIQUE de l'existant localStorage (serveur vide uniquement).
      const local = readLocal();
      if (list.length === 0 && local.length > 0 && localStorage.getItem(MIGRATED_KEY) !== "1") {
        const imp = await fetch("/api/saved-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ import: local }),
        });
        if (imp.ok) {
          const again = await fetch("/api/saved-reports");
          const d2 = (await again.json().catch(() => ({}))) as { reports?: SavedReport[] };
          if (Array.isArray(d2.reports)) list = d2.reports;
        }
      }
      try {
        localStorage.setItem(MIGRATED_KEY, "1");
      } catch { /* ignore */ }

      cache = list.sort((a, b) => b.savedAt - a.savedAt);
      writeLocal(cache);
      notifyReportsUpdated();
    } catch {
      /* réseau indisponible → on reste sur le fallback local */
    }
  })();
}

/** Recharge depuis le serveur (ex : après un rapport généré par le cron). */
export function refreshSavedReports(): void {
  loadPromise = null;
  ensureLoaded();
}

export function listSavedReports(): SavedReport[] {
  if (cache) return cache;
  ensureLoaded();
  return readLocal();
}

function setCache(reports: SavedReport[]): void {
  cache = reports.sort((a, b) => b.savedAt - a.savedAt);
  writeLocal(cache);
  notifyReportsUpdated();
}

export function addSavedReport(entry: Omit<SavedReport, "id" | "savedAt">): void {
  if (typeof window === "undefined") return;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `r_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const full: SavedReport = { ...entry, id, savedAt: Date.now() };
  // Optimiste : visible immédiatement, la base suit (le serveur réutilise l'id).
  setCache([full, ...listSavedReports()]);
  void fetch("/api/saved-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(full),
  }).catch(() => { /* hors-ligne : le rapport restera local jusqu'au prochain import */ });
}

// ── Suivi « ce rapport a déjà été enregistré » (persiste l'état du CTA) ──
const SAVED_KEYS_KEY = "revold:saved-report-keys:v1";

/** Clé stable d'un rapport (agent + titre + signature des données). */
export function reportKey(agentKey: string, title: string, data: { name: string; value: number }[]): string {
  const sig = data
    .slice(0, 30)
    .map((d) => `${d.name}:${d.value}`)
    .join("|");
  return `${agentKey}::${title}::${sig}`;
}

function readSavedKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_KEYS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isReportSaved(key: string): boolean {
  return readSavedKeys().includes(key);
}

export function markReportSaved(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const cur = readSavedKeys();
    if (!cur.includes(key)) localStorage.setItem(SAVED_KEYS_KEY, JSON.stringify([key, ...cur].slice(0, 500)));
  } catch {
    /* ignore */
  }
}

/** Met à jour un rapport enregistré (ex : le masquer de la page agent). */
export function updateSavedReport(id: string, patch: Partial<SavedReport>): void {
  if (typeof window === "undefined") return;
  setCache(listSavedReports().map((r) => (r.id === id ? { ...r, ...patch } : r)));
  void fetch(`/api/saved-reports/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hidden: patch.hidden, alertId: patch.alertId, title: patch.title }),
  }).catch(() => { /* best-effort */ });
}

export function removeSavedReport(id: string): void {
  if (typeof window === "undefined") return;
  setCache(listSavedReports().filter((r) => r.id !== id));
  void fetch(`/api/saved-reports/${id}`, { method: "DELETE" }).catch(() => { /* best-effort */ });
}
