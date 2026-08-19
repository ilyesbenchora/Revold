/**
 * Navigation personnalisable des sous-pages (table page_nav) : les onglets
 * standard d'une page peuvent être RENOMMÉS, et des pages CUSTOM ajoutées.
 * Une page custom est rendue sur /p/[slug] et réutilise toute la mécanique
 * configurable existante (tuiles KPI page_tiles + tableaux page_tables) avec
 * la clé `<baseKey>_<slug>` — elle hérite donc du catalogue de KPIs et des
 * presets de sa page racine (basePageKey / baseTableKey par préfixe).
 */

/** Visibilité d'une page custom : soi-même, l'équipe de la section, ou tout l'espace. */
export type PageNavScope = "me" | "team" | "all";

export type PageNavItem = {
  /** "" = onglet racine ; sinon segment d'URL (standard) ou slug custom. */
  slug: string;
  label: string;
  /** true = page ajoutée par l'utilisateur (rendue sur /p/[slug], supprimable). */
  custom?: boolean;
  /** Pages custom : visibilité (absent = "all", tout l'espace de travail). */
  scope?: PageNavScope;
  /** Pages custom : créateur (filtre du scope "me") — posé côté serveur. */
  created_by?: string;
};

export type PageNavDef = {
  navKey: string;
  /** Base d'URL des onglets (l'onglet racine = base elle-même). */
  baseHref: string;
  /** Préfixe des clés page_tiles / page_tables des pages custom. */
  basePageKey: string;
  /** Équipe (pôle) propriétaire de la section — cible du scope "team". */
  team: string;
  teamLabel: string;
  defaults: PageNavItem[];
};

/** Page Ventes (Performances → commerciale). */
export const VENTES_NAV: PageNavDef = {
  navKey: "ventes",
  baseHref: "/dashboard/performances/commerciale",
  basePageKey: "perf_ventes",
  team: "sales",
  teamLabel: "Ventes",
  defaults: [
    { slug: "", label: "Cycle de ventes" },
    { slug: "deals-a-risque", label: "Transactions à risque" },
    { slug: "forecast-management", label: "Transactions expirées" },
  ],
};

/** Page Marketing (Performances → marketing). La sous-page Publicité vit ici
 * (deuxième rangée d'onglets) — le premier rang (PerformancesTabs) ne garde
 * que les sections. */
export const MARKETING_NAV: PageNavDef = {
  navKey: "marketing",
  baseHref: "/dashboard/performances/marketing",
  basePageKey: "perf_marketing",
  team: "marketing",
  teamLabel: "Marketing",
  defaults: [
    { slug: "", label: "Vue d'ensemble" },
    { slug: "publicite", label: "Publicité" },
  ],
};

export const PAGE_NAVS: Record<string, PageNavDef> = { ventes: VENTES_NAV, marketing: MARKETING_NAV };

/** URL d'un onglet : racine, sous-page standard, ou page custom (/p/slug). */
export function navItemHref(def: PageNavDef, item: PageNavItem): string {
  if (!item.slug) return def.baseHref;
  return item.custom ? `${def.baseHref}/p/${item.slug}` : `${def.baseHref}/${item.slug}`;
}

/** slug URL-safe depuis un libellé (page custom). */
export function slugifyNavLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Fusionne les items enregistrés dans les défauts : les libellés enregistrés
 * priment (renommage), les pages custom s'ajoutent à la suite. Un onglet
 * standard manquant dans l'enregistrement reste affiché (jamais supprimé).
 */
export function mergeNavItems(def: PageNavDef, saved: PageNavItem[] | null | undefined): PageNavItem[] {
  const list = Array.isArray(saved) ? saved : [];
  const std = def.defaults.map((d) => {
    const s = list.find((m) => !m.custom && m.slug === d.slug);
    return { ...d, label: s?.label?.trim() || d.label };
  });
  const customs = list
    .filter((m) => m.custom && m.slug && m.label?.trim())
    .map((m) => ({ ...m, label: m.label.trim(), custom: true as const }));
  return [...std, ...customs];
}

/**
 * Une page custom est-elle visible pour ce membre ? "all" (ou absent) = tout
 * l'espace ; "team" = équipe de la section (admins et membres sans pôle
 * compris) ; "me" = son créateur uniquement.
 */
export function isNavItemVisible(
  def: PageNavDef,
  item: PageNavItem,
  viewer: { userId: string; role: string | null; pole: string | null },
): boolean {
  if (!item.custom) return true;
  const scope = item.scope ?? "all";
  if (scope === "all") return true;
  if (scope === "me") return item.created_by === viewer.userId;
  // scope "team"
  if (viewer.role === "admin" || !viewer.pole) return true;
  return viewer.pole === def.team;
}
