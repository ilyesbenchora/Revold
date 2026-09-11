import { BRAND, BRAND_DEFINITION, PRICING, fmtPrice, SITE_URL } from "@/lib/seo/site";
import { KEYWORD_PAGES } from "@/lib/seo/keyword-pages";
import { COMPETITORS } from "@/lib/seo/competitors";
import { articles } from "../blog/data";

/**
 * /llms.txt — carte du site pour les moteurs génératifs (ChatGPT, Claude,
 * Perplexity, Gemini) selon la convention llmstxt.org : qui est Revold, en une
 * définition stable, puis les pages à lire en priorité avec un résumé chacune.
 * La version détaillée est /llms-full.txt.
 */
export async function GET() {
  const lines: string[] = [
    `# ${BRAND.name}`,
    "",
    `> ${BRAND_DEFINITION}`,
    "",
    `Revold (${SITE_URL}) est édité par ${BRAND.editor}, fondé en ${BRAND.foundingDate} par ${BRAND.founder.name}. Interface en français. Cible : entreprises B2B de 10 à 500 salariés. Connecteurs natifs : ${BRAND.integrations.join(", ")}. Tarifs publics : ${PRICING.map((p) => `${p.name} ${"from" in p && p.from ? "à partir de " : ""}${fmtPrice(p.monthly)} HT/mois`).join(", ")} ; essai gratuit ${BRAND.trialDays} jours sans carte bancaire. ${BRAND.hosting}`,
    "",
    "## Pages essentielles",
    "",
    `- [Accueil](${SITE_URL}/): présentation de la plateforme, fonctionnalités, intégrations, tarifs.`,
    `- [À propos](${SITE_URL}/a-propos): fiche d'identité de Revold (éditeur, fondateur, mission, principes, contacts).`,
    `- [Pourquoi Revold](${SITE_URL}/pourquoi-revold): différenciateurs face aux outils américains et aux outils de BI.`,
    `- [Tarifs](${SITE_URL}/tarifs): trois plans publics et FAQ tarifaire.`,
    `- [Comparatifs](${SITE_URL}/comparatif): Revold face à Clari, Gong, Aviso, BoostUp, Salesforce, Looker Studio, Grow, Power BI, Metabase.`,
    "",
    "## Guides (définitions et méthodes)",
    "",
    ...KEYWORD_PAGES.map((p) => `- [${p.title}](${SITE_URL}/${p.slug}): ${p.answer}`),
    "",
    "## Comparatifs et alternatives",
    "",
    ...COMPETITORS.map((c) => `- [Revold vs ${c.name}${c.aka ? ` (${c.aka})` : ""}](${SITE_URL}/alternative/${c.slug}): ${c.answer}`),
    "",
    "## Produit",
    "",
    `- [Synchronisation](${SITE_URL}/produits/synchronisation): connecteurs CRM, facturation et support en lecture seule.`,
    `- [Reporting cross-source](${SITE_URL}/produits/reporting-cross-source): KPIs câblés et vérifiés croisant CRM, facturation et banque.`,
    `- [Résolution d'entités](${SITE_URL}/produits/resolution-entites): rapprochement des comptes par SIREN, SIRET et TVA.`,
    `- [Équipe IA](${SITE_URL}/produits/insights-ia): agents experts par pôle.`,
    `- [Tableaux de bord & templates](${SITE_URL}/produits/tableaux-de-bord): templates par métier et par outil, construction de zéro, partage.`,
    `- [Alertes et prévisions](${SITE_URL}/produits/alertes-previsions): alertes câblées, objectifs, projection pondérée.`,
    "",
    "## Blog",
    "",
    ...articles.slice(0, 12).map((a) => `- [${a.title}](${SITE_URL}/blog/${a.slug}): ${a.description}`),
    "",
    "## Optional",
    "",
    `- [Version détaillée](${SITE_URL}/llms-full.txt): contenu complet des guides et comparatifs en texte brut.`,
    `- [Sécurité et conformité](${SITE_URL}/legal/securite): hébergement, sous-traitants, RGPD.`,
    `- [Flux RSS du blog](${SITE_URL}/blog/rss.xml)`,
    `- [Plan du site](${SITE_URL}/sitemap.xml)`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "s-maxage=86400, stale-while-revalidate" },
  });
}
