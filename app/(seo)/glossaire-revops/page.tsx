import type { Metadata } from "next";
import Link from "next/link";
import { GLOSSARY } from "@/lib/seo/glossary";
import { breadcrumbJsonLd, webPageJsonLd, SITE_URL } from "@/lib/seo/site";
import { JsonLd } from "@/components/seo/json-ld";
import { SeoCta } from "@/components/seo/blocks";

const TITLE = "Glossaire RevOps et Revenue Intelligence : 40 définitions avec formules";
const DESCRIPTION =
  "Les termes du RevOps, de la Revenue Intelligence et du pilotage du revenu définis en français : pipeline, forecast pondéré, MRR, churn, NRR, écart signé / facturé, fuite de revenus, résolution d'entités, DSO… avec formules.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/glossaire-revops" },
  keywords: ["glossaire RevOps", "lexique revenue operations", "définition MRR", "définition churn", "forecast pondéré définition", "Revold"],
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/glossaire-revops`, type: "article", locale: "fr_FR", siteName: "Revold" },
};

/** Schéma DefinedTermSet : un DefinedTerm par entrée, ancré sur la page. */
function definedTermSetJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${SITE_URL}/glossaire-revops#set`,
    name: "Glossaire RevOps et Revenue Intelligence — Revold",
    inLanguage: "fr-FR",
    hasDefinedTerm: GLOSSARY.map((t) => ({
      "@type": "DefinedTerm",
      "@id": `${SITE_URL}/glossaire-revops#${t.slug}`,
      name: t.term,
      description: t.formula ? `${t.definition} Formule : ${t.formula}.` : t.definition,
      ...(t.aliases ? { alternateName: t.aliases } : {}),
      inDefinedTermSet: `${SITE_URL}/glossaire-revops#set`,
    })),
  };
}

export default function GlossairePage() {
  const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, "fr"));
  return (
    <>
      <JsonLd data={[webPageJsonLd({ path: "/glossaire-revops", name: TITLE, description: DESCRIPTION }), breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Glossaire RevOps", path: "/glossaire-revops" }]), definedTermSetJsonLd()]} />
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-8 pt-16 md:pt-24">
          <nav aria-label="Fil d'Ariane" className="text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-300">Accueil</Link><span className="mx-2">/</span><span className="text-slate-400">Glossaire RevOps</span>
          </nav>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
            Glossaire RevOps :{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">{GLOSSARY.length} définitions, avec formules</span>
          </h1>
          <p className="mt-6 text-lg text-slate-400">
            Le vocabulaire du pilotage du revenu, défini en français et en une à trois phrases. Chaque terme a son ancre : citez-le, partagez-le.
          </p>
          <ul className="mt-6 flex flex-wrap gap-1.5">
            {sorted.map((t) => (
              <li key={t.slug}>
                <a href={`#${t.slug}`} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:border-fuchsia-400/40 hover:text-white">{t.term}</a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <dl className="space-y-4">
          {sorted.map((t) => (
            <div key={t.slug} id={t.slug} className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <dt className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-lg font-semibold text-white">{t.term}</h2>
                {t.aliases && <span className="text-xs text-slate-500">aussi : {t.aliases.join(", ")}</span>}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-slate-400">
                {t.definition}
                {t.formula && (
                  <p className="mt-2 rounded-lg border border-fuchsia-400/20 bg-fuchsia-500/5 px-3 py-2 font-mono text-xs text-slate-200">{t.formula}</p>
                )}
                {t.link && (
                  <p className="mt-2 text-xs"><Link href={t.link.href} className="text-fuchsia-300 hover:text-fuchsia-200">{t.link.label} →</Link></p>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <SeoCta title="Mesurez ces indicateurs sur vos vraies données" />
    </>
  );
}
