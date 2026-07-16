/**
 * POC « espaces de travail » (type Notion) — un espace par pôle métier.
 *
 * Chaque espace ne montre que les sections/agents pertinents pour le pôle.
 * L'admin voit tout (peut basculer d'espace via le switcher) ; un membre est
 * restreint à l'espace de son pôle (profiles.pole).
 */

export type WorkspaceId = "all" | "sales" | "marketing" | "cs" | "finance";

export type WorkspaceDef = { id: WorkspaceId; label: string; icon: string; desc: string };

export const WORKSPACES: WorkspaceDef[] = [
  { id: "all", label: "Tous les espaces", icon: "🌐", desc: "Vue globale — toutes les sections" },
  { id: "sales", label: "Ventes", icon: "💼", desc: "Pipeline, closing, prévisions" },
  { id: "marketing", label: "Marketing", icon: "📣", desc: "Acquisition, conversion, data" },
  { id: "cs", label: "Service client", icon: "🤝", desc: "Support, rétention, churn" },
  { id: "finance", label: "Paiement & Facturation", icon: "💳", desc: "MRR, encaissement, cash" },
];

/** Options de pôle proposées dans les réglages Équipe (hors « all »). */
export const POLE_OPTIONS = WORKSPACES.filter((w) => w.id !== "all");

export function workspaceDef(id: WorkspaceId): WorkspaceDef {
  return WORKSPACES.find((w) => w.id === id) ?? WORKSPACES[0];
}

/** pôle (profiles.pole) → espace de travail. */
export function poleToWorkspace(pole: string | null | undefined): WorkspaceId | null {
  switch (pole) {
    case "sales":
    case "marketing":
    case "cs":
    case "finance":
      return pole;
    default:
      return null;
  }
}

/** Espaces accessibles : admin → tous ; membre avec pôle → le sien ; sinon → global. */
export function availableWorkspaces(role: string | null | undefined, pole: string | null | undefined): WorkspaceId[] {
  if (role === "admin") return WORKSPACES.map((w) => w.id);
  const w = poleToWorkspace(pole);
  return w ? [w] : ["all"];
}

// ── Règles de navigation par espace ─────────────────────────────────────────
// Pour les groupes filtrables (audit=Données, coaching=Coaching IA,
// previsions=Prévisions) : "all" = tous les sous-liens, tableau = sous-liens
// autorisés, absent = groupe masqué. Dashboard et Intégrations sont toujours
// visibles en entier.

type NavRule = Partial<Record<"audit" | "coaching" | "previsions" | "dashboard" | "integrations", "all" | string[]>>;

const WORKSPACE_NAV: Record<WorkspaceId, NavRule> = {
  all: { audit: "all", coaching: "all", previsions: "all", dashboard: "all", integrations: "all" },
  sales: {
    audit: ["/dashboard/performances", "/dashboard/process"],
    coaching: ["/dashboard/insights-ia", "/dashboard/insights-ia/commercial"],
    previsions: "all",
    dashboard: "all",
    integrations: "all",
  },
  marketing: {
    audit: ["/dashboard/performances", "/dashboard/donnees"],
    coaching: ["/dashboard/insights-ia", "/dashboard/insights-ia/marketing", "/dashboard/insights-ia/data"],
    previsions: "all",
    dashboard: "all",
    integrations: "all",
  },
  cs: {
    audit: ["/dashboard/audit/service-client"],
    coaching: ["/dashboard/insights-ia"],
    dashboard: "all",
    integrations: "all",
  },
  finance: {
    audit: ["/dashboard/audit/paiement-facturation"],
    previsions: "all",
    dashboard: "all",
    integrations: "all",
  },
};

/** Liens de 1er niveau toujours visibles (Vue d'ensemble, Paramètres). */
const ALWAYS_LEAVES = new Set(["/dashboard", "/dashboard/parametres"]);

function ruleFor(ws: WorkspaceId, groupId: string): "all" | string[] | null {
  const rule = WORKSPACE_NAV[ws] ?? WORKSPACE_NAV.all;
  return (rule as Record<string, "all" | string[] | undefined>)[groupId] ?? null;
}

export function isLeafVisible(_ws: WorkspaceId, href: string): boolean {
  return ALWAYS_LEAVES.has(href) || true; // pas d'autre leaf de 1er niveau à filtrer pour l'instant
}

export function isGroupVisible(ws: WorkspaceId, groupId: string): boolean {
  return ruleFor(ws, groupId) !== null;
}

export function isChildVisible(ws: WorkspaceId, groupId: string, href: string): boolean {
  const r = ruleFor(ws, groupId);
  if (r === "all") return true;
  if (Array.isArray(r)) return r.includes(href);
  return false;
}
