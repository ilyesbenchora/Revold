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
  } catch {
    /* quota / mode privé → ignore */
  }
}

export function removeSavedReport(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(listSavedReports().filter((r) => r.id !== id)));
  } catch {
    /* ignore */
  }
}
