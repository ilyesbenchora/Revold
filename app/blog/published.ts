import { articles, type BlogArticle } from "./data";

/**
 * Publication PROGRAMMÉE du blog : un article dont la date est dans le futur
 * existe dans le code mais n'apparaît nulle part (liste, page, RSS, sitemap,
 * llms.txt) avant sa date. Le calendrier éditorial est donc porté par les
 * dates des articles (deux par semaine, mardi et jeudi) — aucune action
 * manuelle le jour J ; le flux RSS gagne un item à chaque date atteinte.
 */

/** Jour courant en France (YYYY-MM-DD) : la date de publication est lue à l'heure de Paris. */
export function todayParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isPublished(a: Pick<BlogArticle, "date">, now: Date = new Date()): boolean {
  return a.date <= todayParis(now);
}

/** Articles publiés, du plus récent au plus ancien. */
export function publishedArticles(now: Date = new Date()): BlogArticle[] {
  return articles.filter((a) => isPublished(a, now)).sort((a, b) => b.date.localeCompare(a.date));
}

/** Articles programmés (à venir), du plus proche au plus lointain. */
export function scheduledArticles(now: Date = new Date()): BlogArticle[] {
  return articles.filter((a) => !isPublished(a, now)).sort((a, b) => a.date.localeCompare(b.date));
}
