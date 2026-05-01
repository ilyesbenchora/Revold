import { articles } from "../blog/data";

const BASE = "https://revold.io";

const STATIC_PAGES = [
  "",
  "/pourquoi-revold",
  "/demo",
  "/essai-gratuit",
  "/contact",
  "/integrations",
  "/blog",
  "/produits/synchronisation",
  "/produits/reporting-cross-source",
  "/produits/resolution-entites",
  "/produits/insights-ia",
  "/produits/audit-crm",
  "/produits/alertes-previsions",
  "/solutions/optimiser-revenus",
  "/solutions/fiabiliser-donnees",
  "/solutions/accelerer-cycles-vente",
  "/solutions/piloter-performance",
  "/solutions/unifier-stack",
  "/solutions/reduire-churn",
  "/equipes/direction",
  "/equipes/marketing",
  "/equipes/sales",
  "/equipes/revops",
  "/equipes/csm",
  "/equipes/finance",
  "/legal/confidentialite",
  "/legal/cgu",
  "/legal/securite",
  "/legal/rgpd",
  "/legal/dpa",
];

export async function GET() {
  const staticEntries = STATIC_PAGES.map(
    (path) =>
      `  <url><loc>${BASE}${path}</loc><changefreq>${path === "" ? "weekly" : "monthly"}</changefreq><priority>${path === "" ? "1.0" : path.startsWith("/produits") || path.startsWith("/solutions") ? "0.8" : "0.6"}</priority></url>`
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
