import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KEYWORD_PAGES, getKeywordPage } from "@/lib/seo/keyword-pages";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd, SITE_URL } from "@/lib/seo/site";
import { JsonLd } from "@/components/seo/json-ld";
import { KeywordPageView } from "@/components/seo/keyword-page";

type Props = { params: Promise<{ slug: string }> };

// Une route par requête cible, générée statiquement ; tout autre slug → 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return KEYWORD_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getKeywordPage(slug);
  if (!page) return {};
  return {
    title: { absolute: page.title },
    description: page.description,
    keywords: [page.keyword, ...page.secondaryKeywords, "Revold"],
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${SITE_URL}/${page.slug}`,
      type: "article",
      locale: "fr_FR",
      siteName: "Revold",
    },
  };
}

export default async function KeywordRoute({ params }: Props) {
  const { slug } = await params;
  const page = getKeywordPage(slug);
  if (!page) notFound();
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({ path: `/${page.slug}`, name: page.title, description: page.description, about: [page.keyword, ...page.secondaryKeywords] }),
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: page.keyword, path: `/${page.slug}` }]),
          faqJsonLd(page.faq),
        ]}
      />
      <KeywordPageView page={page} />
    </>
  );
}
