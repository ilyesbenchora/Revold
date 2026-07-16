import type { ReportSpec, ChartProposal } from "@/lib/ai/agents/agent-runtime";

/**
 * Rapports enregistrés par l'utilisateur (au moment où il active une alerte de
 * suivi sur un rapport). Persistés en localStorage — affichés sur /dashboard/mes-rapports.
 * L'alerte elle-même est aussi créée côté Supabase (table alerts).
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
};

export const SAVED_REPORTS_KEY = "revold:saved-reports:v1";
/** Événement window émis quand la liste des rapports enregistrés change. */
export const REPORTS_UPDATED_EVENT = "revold:reports-updated";

function notifyReportsUpdated(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(REPORTS_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export function listSavedReports(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_REPORTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedReport[]) : [];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch {
    return [];
  }
}

export function addSavedReport(entry: Omit<SavedReport, "id" | "savedAt">): void {
  if (typeof window === "undefined") return;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `r_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const full: SavedReport = { ...entry, id, savedAt: Date.now() };
  try {
    const cur = listSavedReports();
    localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify([full, ...cur]));
    notifyReportsUpdated();
  } catch {
    /* quota / mode privé → ignore */
  }
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

export function removeSavedReport(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(listSavedReports().filter((r) => r.id !== id)));
    notifyReportsUpdated();
  } catch {
    /* ignore */
  }
}
