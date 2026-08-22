import { articles } from "../blog/data";

const BASE = "https://revold.ai";

// Stratégie d'indexation VOLONTAIREMENT resserrée : seule la home et le blog
// sont indexés (les autres pages sont noindex — layouts/metadata des sections).
const STATIC_PAGES = ["", "/blog"];

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
