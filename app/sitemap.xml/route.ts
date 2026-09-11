import { articles } from "../blog/data";
import { KEYWORD_PAGES } from "@/lib/seo/keyword-pages";
import { COMPETITORS } from "@/lib/seo/competitors";

const BASE = "https://revold.ai";

// Indexation ciblée : home (requête de marque), pages de marque (à propos,
// pourquoi, tarifs), guides mots-clés, comparatifs, blog et pages produits/
// solutions (longue traîne). Le reste du site est noindex.
const STATIC_PAGES = [
  "",
  "/a-propos",
  "/pourquoi-revold",
  "/tarifs",
  "/comparatif",
  ...KEYWORD_PAGES.map((p) => `/${p.slug}`),
  ...COMPETITORS.map((c) => `/alternative/${c.slug}`),
  "/docs/hubspot",
  "/blog",
  "/produits/synchronisation",
  "/produits/reporting-cross-source",
  "/produits/resolution-entites",
  "/produits/insights-ia",
  "/produits/tableaux-de-bord",
  "/produits/alertes-previsions",
  "/solutions/optimiser-revenus",
  "/solutions/fiabiliser-donnees",
  "/solutions/accelerer-cycles-vente",
  "/solutions/piloter-performance",
  "/solutions/unifier-stack",
  "/solutions/reduire-churn",
];

export async function GET() {
  const staticEntries = STATIC_PAGES.map(
    (path) =>
      `  <url><loc>${BASE}${path}</loc><changefreq>${path === "" ? "weekly" : "monthly"}</changefreq><priority>${
        path === ""
          ? "1.0"
          : path.startsWith("/produits") || path.startsWith("/solutions") || path.startsWith("/alternative/") || KEYWORD_PAGES.some((p) => `/${p.slug}` === path)
            ? "0.8"
            : "0.6"
      }</priority></url>`
  );

  const blogEntries = articles.map(
    (a) =>
      `  <url><loc>${BASE}/blog/${a.slug}</loc><lastmod>${a.date}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries.join("\n")}
${blogEntries.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=86400, stale-while-revalidate",
    },
  });
}
