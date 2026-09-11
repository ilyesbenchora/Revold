import Link from "next/link";
import type { KeywordPage } from "@/lib/seo/keyword-pages";
import { KEYWORD_PAGES } from "@/lib/seo/keyword-pages";
import { COMPETITORS } from "@/lib/seo/competitors";
import { BRAND, PRICING, fmtPrice } from "@/lib/seo/site";
import { FaqBlock, SeoCta } from "@/components/seo/blocks";

/**
 * Gabarit des pages de contenu « longue traîne » — thème sombre cockpit,
 * aligné sur les pages Produit. Structure pensée pour les moteurs classiques
 * ET génératifs : réponse directe en tête, sections H2 explicites, FAQ,
 * liens internes vers les pages voisines et les comparatifs.
 */
export function KeywordPageView({ page }: { page: KeywordPage }) {
  const related = page.related.map((slug) => KEYWORD_PAGES.find((p) => p.slug === slug)).filter((p): p is KeywordPage => !!p);
  const comparisons = COMPETITORS.filter((c) => c.related.includes(page.slug)).slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-32 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-12 pt-16 md:pt-24">
          <nav aria-label="Fil d'Ariane" className="text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-300">Accueil</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-400">{page.keyword}</span>
          </nav>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300">
            <span className="text-fuchsia-300">◆</span>
            {page.keyword}
          </div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
            {page.h1}{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              {page.h1Accent}
            </span>
          </h1>
          {/* Réponse directe : la phrase que les moteurs génératifs reprennent. */}
          <p className="mt-8 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-5 text-base leading-relaxed text-slate-200 md:text-lg">
            {page.answer}
          </p>
          <p className="mt-6 text-lg text-slate-400">{page.intro}</p>
        </div>
      </section>

      {/* Sections */}
      <section className="mx-auto max-w-4xl px-6 py-8">
        <div className="space-y-12">
          {page.sections.map((s) => (
            <article key={s.h2}>
              <h2 className="text-2xl font-semibold text-white">{s.h2}</h2>
              {s.paragraphs.map((p, i) => (
                <p key={i} className="mt-4 leading-relaxed text-slate-400">{p}</p>
              ))}
              {s.bullets && (
                <ul className="mt-4 space-y-2">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-3 text-slate-300">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Pourquoi Revold */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-2xl font-semibold text-white">Pourquoi Revold pour « {page.keyword.toLowerCase()} »</h2>
        <p className="mt-2 text-slate-400">
          {BRAND.name} connecte {BRAND.integrations.join(", ")} en lecture seule et pilote le revenu par équipe. Essai gratuit de {BRAND.trialDays} jours, sans carte bancaire.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {page.whyRevold.map((w) => (
            <div key={w.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="font-semibold text-white">{w.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{w.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-400">
          {PRICING.map((p) => (
            <span key={p.key} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {p.name} : {"from" in p && p.from ? "à partir de " : ""}{fmtPrice(p.monthly)} HT / mois
            </span>
          ))}
        </div>
      </section>

      <FaqBlock items={page.faq} />

      {/* Maillage interne */}
      {(related.length > 0 || comparisons.length > 0) && (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="grid gap-8 md:grid-cols-2">
            {related.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-white">Pour aller plus loin</h2>
                <ul className="mt-4 space-y-2">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link href={`/${r.slug}`} className="text-fuchsia-300 hover:text-fuchsia-200">{r.keyword}</Link>
                      <span className="block text-xs text-slate-500">{r.description.slice(0, 110)}…</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {comparisons.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-white">Comparatifs</h2>
                <ul className="mt-4 space-y-2">
                  {comparisons.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/alternative/${c.slug}`} className="text-fuchsia-300 hover:text-fuchsia-200">Revold vs {c.name}</Link>
                      <span className="block text-xs text-slate-500">{c.category}</span>
                    </li>
                  ))}
                  <li>
                    <Link href="/comparatif" className="text-slate-400 hover:text-white">Tous les comparatifs →</Link>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      <SeoCta />
    </>
  );
}
