/**
 * Navigation personnalisable des sous-pages (table page_nav) : les onglets
 * standard d'une page peuvent être RENOMMÉS, et des pages CUSTOM ajoutées.
 * Une page custom est rendue sur /p/[slug] et réutilise toute la mécanique
 * configurable existante (tuiles KPI page_tiles + tableaux page_tables) avec
 * la clé `<baseKey>_<slug>` — elle hérite donc du catalogue de KPIs et des
 * presets de sa page racine (basePageKey / baseTableKey par préfixe).
 */

export type PageNavItem = {
  /** "" = onglet racine ; sinon segment d'URL (standard) ou slug custom. */
  slug: string;
  label: string;
  /** true = page ajoutée par l'utilisateur (rendue sur /p/[slug], supprimable). */
  custom?: boolean;
};

export type PageNavDef = {
  navKey: string;
  /** Base d'URL des onglets (l'onglet racine = base elle-même). */
  baseHref: string;
  /** Préfixe des clés page_tiles / page_tables des pages custom. */
  basePageKey: string;
  defaults: PageNavItem[];
};

/** Page Ventes (Performances → commerciale). */
export const VENTES_NAV: PageNavDef = {
  navKey: "ventes",
  baseHref: "/dashboard/performances/commerciale",
  basePageKey: "perf_ventes",
  defaults: [
    { slug: "", label: "Cycle de ventes" },
    { slug: "deals-a-risque", label: "Transactions à risque" },
    { slug: "forecast-management", label: "Transactions expirées" },
  ],
};

export const PAGE_NAVS: Record<string, PageNavDef> = { ventes: VENTES_NAV };

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
    .map((m) => ({ slug: m.slug, label: m.label.trim(), custom: true as const }));
  return [...std, ...customs];
}
