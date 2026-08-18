/**
 * POC « espaces de travail » (type Notion) — un espace par pôle métier.
 *
 * Chaque espace ne montre que les sections/agents pertinents pour le pôle.
 * L'admin voit tout (peut basculer d'espace via le switcher) ; un membre est
 * restreint à l'espace de son pôle (profiles.pole).
 */

export type WorkspaceId = "all" | "sales" | "marketing" | "cs" | "finance";

/**
 * Cookie miroir du choix d'espace (admin) : lisible côté serveur pour que les
 * pages (ex : vue d'ensemble Coaching) filtrent leur contenu comme la sidebar.
 */
export const WORKSPACE_COOKIE = "revold_workspace";

export type WorkspaceDef = { id: WorkspaceId; label: string; icon: string; desc: string };

export const WORKSPACES: WorkspaceDef[] = [
  { id: "all", label: "Tous les espaces", icon: "🌐", desc: "Vue globale — toutes les sections" },
  { id: "sales", label: "Ventes", icon: "💼", desc: "Pipeline, closing, prévisions" },
  { id: "marketing", label: "Marketing", icon: "📣", desc: "Acquisition, conversion, data" },
  { id: "cs", label: "Service client", icon: "🤝", desc: "Support, rétention, churn" },
  { id: "finance", label: "Comptabilité", icon: "💳", desc: "MRR, encaissement, cash" },
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

/**
 * Espaces accessibles : admin → tous (il supervise plusieurs équipes, le
 * switcher et « Tous les espaces » lui sont réservés) ; membre avec pôle →
 * le sien uniquement ; sinon → vue globale seule.
 */
export function availableWorkspaces(role: string | null | undefined, pole: string | null | undefined): WorkspaceId[] {
  if (role === "admin") return WORKSPACES.map((w) => w.id);
  const w = poleToWorkspace(pole);
  return w ? [w] : ["all"];
}

// ── Règles de navigation par espace ─────────────────────────────────────────
// Pour les groupes filtrables (audit=Données, coaching=Coaching IA) : "all" =
// tous les sous-liens, tableau = sous-liens autorisés, absent = groupe masqué.
// Dashboard et Intégrations sont toujours visibles en entier.

type NavRule = Partial<Record<"audit" | "dashboard" | "integrations" | "alertes", "all" | string[]>>;

const WORKSPACE_NAV: Record<WorkspaceId, NavRule> = {
  all: { audit: "all", dashboard: "all", integrations: "all", alertes: "all" },
  // Accessibles dans TOUS les espaces : « Mon équipe IA » (/dashboard/audit,
  // le hub des agents experts de la section Données) et le coach data — la
  // qualité des données concerne chaque pôle.
  sales: {
    audit: ["/dashboard/audit", "/dashboard/performances", "/dashboard/appels", "/dashboard/donnees"],
    dashboard: "all",
    integrations: "all",
    alertes: "all",
  },
  marketing: {
    audit: ["/dashboard/audit", "/dashboard/performances", "/dashboard/donnees"],
    dashboard: "all",
    integrations: "all",
    alertes: "all",
  },
  cs: {
    audit: ["/dashboard/audit", "/dashboard/audit/service-client"],
    dashboard: "all",
    integrations: "all",
    alertes: "all",
  },
  finance: {
    audit: ["/dashboard/audit", "/dashboard/audit/paiement-facturation", "/dashboard/donnees"],
    dashboard: "all",
    integrations: "all",
    alertes: "all",
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

// ── Contrôle d'accès SERVEUR par espace ─────────────────────────────────────
// Le masquage de la sidebar ne suffit pas : un membre restreint à son pôle ne
// doit pas pouvoir ouvrir une page hors périmètre en tapant l'URL. Chaque
// route filtrable est rattachée à son groupe ; les routes inconnues restent
// ouvertes (fail-open : on ne bloque jamais une page transverse par erreur).

const GUARDED_ROUTES: Array<{ group: string; href: string }> = [
  // Données — les préfixes les plus spécifiques d'abord.
  { group: "audit", href: "/dashboard/audit/paiement-facturation" },
  { group: "audit", href: "/dashboard/audit/service-client" },
  { group: "audit", href: "/dashboard/performances" },
  { group: "audit", href: "/dashboard/appels" },
  { group: "audit", href: "/dashboard/donnees" },
  // Section Coaching IA supprimée : ses anciennes routes redirigent vers
  // Mon équipe IA, plus rien à filtrer ici.
];

/**
 * Une page est-elle accessible dans cet espace ? (« /dashboard/audit » exact =
 * Mon équipe IA, accessible partout ; ses sous-pages suivent leurs règles.)
 */
export function isPathAllowed(ws: WorkspaceId, pathname: string): boolean {
  if (ws === "all") return true;
  if (pathname === "/dashboard/audit") return isChildVisible(ws, "audit", "/dashboard/audit");
  const match = GUARDED_ROUTES.find((r) => pathname === r.href || pathname.startsWith(`${r.href}/`));
  if (!match) return true;
  return isChildVisible(ws, match.group, match.href);
}
