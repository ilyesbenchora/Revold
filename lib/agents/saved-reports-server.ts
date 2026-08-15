/**
 * Helpers serveur des rapports enregistrés (table saved_reports) : mapping
 * ligne DB ↔ forme client SavedReport (héritée de l'ancien module localStorage).
 * Utilisés par les routes /api/saved-reports et le cron des routines.
 */

export type SavedReportRow = {
  id: string;
  organization_id: string;
  agent_key: string;
  agent_label: string | null;
  title: string;
  summary: string | null;
  report: unknown;
  chart: unknown;
  alert: unknown;
  alert_id: string | null;
  origin: string;
  routine_label: string | null;
  routine_id: string | null;
  analysis: string | null;
  hidden: boolean;
  saved_at: string;
};

export function savedReportToClient(r: SavedReportRow) {
  return {
    id: r.id,
    agentKey: r.agent_key,
    agentLabel: r.agent_label ?? r.agent_key,
    title: r.title,
    summary: r.summary ?? undefined,
    report: r.report ?? null,
    chart: r.chart ?? null,
    alert: (r.alert as { title: string; description: string }) ?? { title: r.title, description: "" },
    alertId: r.alert_id ?? undefined,
    savedAt: r.saved_at ? Date.parse(r.saved_at) : Date.now(),
    origin: (r.origin === "routine" ? "routine" : "chat") as "chat" | "routine",
    routineLabel: r.routine_label ?? undefined,
    analysis: r.analysis ?? undefined,
    hidden: r.hidden || undefined,
  };
}

export type SavedReportInput = {
  id?: string;
  agentKey?: string;
  agentLabel?: string;
  title?: string;
  summary?: string;
  report?: unknown;
  chart?: unknown;
  alert?: unknown;
  alertId?: string;
  savedAt?: number;
  origin?: string;
  routineLabel?: string;
  routineId?: string;
  analysis?: string;
  hidden?: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function savedReportToRow(input: SavedReportInput, orgId: string, userId: string | null): Record<string, unknown> {
  return {
    ...(input.id && UUID_RE.test(input.id) ? { id: input.id } : {}),
    organization_id: orgId,
    created_by: userId,
    agent_key: String(input.agentKey ?? "").slice(0, 80),
    agent_label: input.agentLabel ? String(input.agentLabel).slice(0, 200) : null,
    title: String(input.title ?? "Rapport").slice(0, 300),
    summary: input.summary ? String(input.summary).slice(0, 2000) : null,
    report: input.report ?? null,
    chart: input.chart ?? null,
    alert: input.alert ?? null,
    alert_id: input.alertId && UUID_RE.test(input.alertId) ? input.alertId : null,
    origin: input.origin === "routine" ? "routine" : "chat",
    routine_label: input.routineLabel ? String(input.routineLabel).slice(0, 200) : null,
    routine_id: input.routineId && UUID_RE.test(input.routineId) ? input.routineId : null,
    analysis: input.analysis ? String(input.analysis).slice(0, 20000) : null,
    hidden: input.hidden === true,
    ...(typeof input.savedAt === "number" ? { saved_at: new Date(input.savedAt).toISOString() } : {}),
  };
}
