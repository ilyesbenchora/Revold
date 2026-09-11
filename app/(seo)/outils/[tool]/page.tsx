import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TOOLS, getTool } from "@/lib/seo/tools";
import { KEYWORD_PAGES } from "@/lib/seo/keyword-pages";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd, SITE_URL } from "@/lib/seo/site";
import { JsonLd } from "@/components/seo/json-ld";
import { FaqBlock, SeoCta } from "@/components/seo/blocks";
import { Calculator } from "@/components/seo/calculators";

type Props = { params: Promise<{ tool: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool } = await params;
  const t = getTool(tool);
  if (!t) return {};
  return {
    title: { absolute: t.title },
    description: t.description,
    keywords: [t.keyword, ...t.secondaryKeywords, "Revold"],
    alternates: { canonical: `/outils/${t.slug}` },
    openGraph: { title: t.title, description: t.description, url: `${SITE_URL}/outils/${t.slug}`, type: "website", locale: "fr_FR", siteName: "Revold" },
  };
}

/** Schéma WebApplication : l'outil est une application gratuite, utilisable dans le navigateur. */
function webAppJsonLd(t: NonNullable<ReturnType<typeof getTool>>) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${SITE_URL}/outils/${t.slug}#app`,
    name: t.name,
    url: `${SITE_URL}/outils/${t.slug}`,
    description: t.description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "fr-FR",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export default async function ToolRoute({ params }: Props) {
  const { tool } = await params;
  const t = getTool(tool);
  if (!t) notFound();
  const related = t.related.map((s) => KEYWORD_PAGES.find((p) => p.slug === s)).filter((p): p is NonNullable<typeof p> => !!p);
  const others = TOOLS.filter((x) => x.slug !== t.slug);
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({ path: `/outils/${t.slug}`, name: t.title, description: t.description, about: [t.keyword, ...t.secondaryKeywords] }),
          breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Outils gratuits", path: "/outils" }, { name: t.name, path: `/outils/${t.slug}` }]),
          webAppJsonLd(t),
          faqJsonLd(t.faq),
        ]}
      />
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-8 pt-16 md:pt-20">
          <nav aria-label="Fil d'Ariane" className="text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-300">Accueil</Link><span className="mx-2">/</span>
            <Link href="/outils" className="hover:text-slate-300">Outils gratuits</Link><span className="mx-2">/</span>
            <span className="text-slate-400">{t.name}</span>
          </nav>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
            {t.name}{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">gratuit</span>
          </h1>
          <p className="mt-6 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-5 text-base leading-relaxed text-slate-200">{t.answer}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-6">
        <Calculator tool={t.slug} />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <div className="space-y-10">
          {t.method.map((m) => (
            <article key={m.h2}>
              <h2 className="text-2xl font-semibold text-white">{m.h2}</h2>
              {m.paragraphs.map((p, i) => <p key={i} className="mt-4 leading-relaxed text-slate-400">{p}</p>)}
            </article>
          ))}
        </div>
      </section>

      <FaqBlock items={t.faq} />

      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Autres calculateurs</h2>
            <ul className="mt-4 space-y-2">
              {others.map((o) => <li key={o.slug}><Link href={`/outils/${o.slug}`} className="text-fuchsia-300 hover:text-fuchsia-200">{o.name}</Link></li>)}
            </ul>
          </div>
          {related.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white">Pour aller plus loin</h2>
              <ul className="mt-4 space-y-2">
                {related.map((r) => <li key={r.slug}><Link href={`/${r.slug}`} className="text-fuchsia-300 hover:text-fuchsia-200">{r.keyword}</Link></li>)}
              </ul>
            </div>
          )}
        </div>
      </section>
      <SeoCta title="Le même calcul, sur vos vraies données, chaque matin" />
    </>
  );
}
