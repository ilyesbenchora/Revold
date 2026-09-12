import type { Metadata } from "next";
import Link from "next/link";
import { COMPETITORS } from "@/lib/seo/competitors";
import { KEYWORD_PAGES } from "@/lib/seo/keyword-pages";
import { breadcrumbJsonLd, webPageJsonLd, BRAND } from "@/lib/seo/site";
import { JsonLd } from "@/components/seo/json-ld";
import { SeoCta } from "@/components/seo/blocks";

const TITLE = "Comparatifs : Revold face à Clari, Gong, Looker Studio, Grow, Power BI…";
const DESCRIPTION =
  "Revold comparé aux plateformes de Revenue Intelligence (Clari, Gong, Aviso, BoostUp, Salesforce) et aux outils de BI (Looker Studio, Grow, Power BI, Metabase) : périmètre, rapprochement des comptes, tarification, hébergement.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/comparatif" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${BRAND.url}/comparatif`, type: "website", locale: "fr_FR", siteName: "Revold" },
};

export default function ComparatifHub() {
  const ri = COMPETITORS.filter((c) => !/Business Intelligence|Reporting/i.test(c.category));
  const bi = COMPETITORS.filter((c) => /Business Intelligence|Reporting/i.test(c.category));
  return (
    <>
      <JsonLd data={[webPageJsonLd({ path: "/comparatif", name: TITLE, description: DESCRIPTION }), breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Comparatifs", path: "/comparatif" }])]} />
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-10 pt-16 md:pt-24">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
            Revold face aux{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">autres outils de pilotage du revenu</span>
          </h1>
          <p className="mt-6 text-lg text-slate-400">
            Des comparatifs factuels, critère par critère : périmètre du revenu suivi, CRM cible, rapprochement des comptes, langue, tarification et hébergement.
            Chaque page indique aussi dans quel cas l&apos;autre outil est le meilleur choix.
          </p>
        </div>
      </section>

      {[
        { title: "Plateformes de Revenue Intelligence et RevOps", items: ri },
        { title: "Outils de Business Intelligence et de reporting", items: bi },
      ].filter((group) => group.items.length > 0).map((group) => (
        <section key={group.title} className="mx-auto max-w-5xl px-6 py-8">
          <h2 className="text-2xl font-semibold text-white">{group.title}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((c) => (
              <Link key={c.slug} href={`/alternative/${c.slug}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-fuchsia-400/40 hover:bg-white/[0.05]">
                <p className="text-xs uppercase tracking-wide text-slate-500">{c.category}</p>
                <h3 className="mt-2 font-semibold text-white">Revold vs {c.name}{c.aka ? ` (${c.aka})` : ""}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-slate-400">{c.summary}</p>
                <span className="mt-3 inline-block text-sm text-fuchsia-300">Lire le comparatif →</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="mx-auto max-w-5xl px-6 py-8">
        <h2 className="text-2xl font-semibold text-white">Guides</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {KEYWORD_PAGES.map((p) => (
            <li key={p.slug}>
              <Link href={`/${p.slug}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300 hover:border-fuchsia-400/40 hover:text-white">
                {p.keyword}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <SeoCta />
    </>
  );
}
