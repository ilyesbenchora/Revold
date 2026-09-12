import type { Metadata } from "next";
import { BlogList } from "./blog-list";
import { publishedArticles } from "./published";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, webPageJsonLd, SITE_URL } from "@/lib/seo/site";

const TITLE = "Blog Revold — RevOps, forecast, churn et réconciliation CRM × facturation";
const DESCRIPTION =
  "Guides chiffrés pour les équipes revenue B2B françaises : KPI commerciaux, prévision des ventes, churn et rétention, MRR, fuite de revenus, HubSpot × Pennylane. Deux articles par semaine, flux RSS.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/blog", types: { "application/rss+xml": `${SITE_URL}/blog/rss.xml` } },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/blog`, type: "website", locale: "fr_FR", siteName: "Revold" },
};

// Publication programmée : la liste est régénérée chaque heure, un article
// dont la date est atteinte apparaît sans redéploiement.
export const revalidate = 3600;

export default function BlogPage() {
  const articles = publishedArticles();
  return (
    <>
      <JsonLd data={[webPageJsonLd({ path: "/blog", name: TITLE, description: DESCRIPTION }), breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Blog", path: "/blog" }])]} />
      <BlogList articles={articles} />
    </>
  );
}
