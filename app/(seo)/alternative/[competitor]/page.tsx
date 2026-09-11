import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COMPETITORS, getCompetitor } from "@/lib/seo/competitors";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd, SITE_URL } from "@/lib/seo/site";
import { JsonLd } from "@/components/seo/json-ld";
import { ComparisonPageView } from "@/components/seo/comparison-page";

type Props = { params: Promise<{ competitor: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ competitor: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { competitor } = await params;
  const c = getCompetitor(competitor);
  if (!c) return {};
  return {
    title: { absolute: c.title },
    description: c.description,
    keywords: [`alternative ${c.name}`, `Revold vs ${c.name}`, `${c.name} vs Revold`, ...(c.aka ? [`alternative ${c.aka}`] : []), "Revold"],
    alternates: { canonical: `/alternative/${c.slug}` },
    openGraph: {
      title: c.title,
      description: c.description,
      url: `${SITE_URL}/alternative/${c.slug}`,
      type: "article",
      locale: "fr_FR",
      siteName: "Revold",
    },
  };
}

export default async function AlternativeRoute({ params }: Props) {
  const { competitor } = await params;
  const c = getCompetitor(competitor);
  if (!c) notFound();
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({ path: `/alternative/${c.slug}`, name: c.title, description: c.description, about: [`alternative ${c.name}`, `Revold vs ${c.name}`] }),
          breadcrumbJsonLd([
            { name: "Accueil", path: "/" },
            { name: "Comparatifs", path: "/comparatif" },
            { name: `Revold vs ${c.name}`, path: `/alternative/${c.slug}` },
          ]),
          faqJsonLd(c.faq),
        ]}
      />
      <ComparisonPageView c={c} />
    </>
  );
}
