import Link from "next/link";

type TeamBenefit = {
  team: string;
  icon: React.ReactNode;
  pain: string;
  solution: string;
  result: string;
};

type SolutionPageProps = {
  badge: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  heroIcon: React.ReactNode;
  screenshot?: string;
  keyBenefits: { title: string; desc: string }[];
  teams: TeamBenefit[];
  relatedProducts: { label: string; href: string }[];
};

/**
 * Gabarit des pages Solution — thème SOMBRE cockpit (slate-950, halos
 * fuchsia/indigo, cartes bg-white/[0.03], bordures white/10), aligné sur
 * app/page.tsx et app/tarifs/page.tsx.
 */
export function SolutionPage({
  badge,
  title,
  titleAccent,
  subtitle,
  heroIcon,
  screenshot,
  keyBenefits,
  teams,
  relatedProducts,
}: SolutionPageProps) {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-32 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300">
            <span className="flex h-5 w-5 items-center justify-center text-fuchsia-300">
              {heroIcon}
            </span>
            {badge}
          </div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
            {title}{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              {titleAccent}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">{subtitle}</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/essai-gratuit"
              className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40"
            >
              Essayer gratuitement
            </Link>
            <Link
              href="/tarifs"
              className="rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Voir les tarifs
            </Link>
          </div>

          {/* Screenshot */}
          {screenshot && (
            <div className="mt-12">
              <div className="overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-purple-500/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshot}
                  alt="Aperçu de la solution dans Revold"
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Key benefits */}
      <section className="border-y border-white/10 bg-white/[0.02] py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">
            Pourquoi cette solution ?
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {keyBenefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-600/20 text-fuchsia-300 ring-1 ring-white/10">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="mt-4 font-semibold text-white">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* By team */}
      <section className="relative py-20 md:py-24">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              Par équipe
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              Chaque équipe a ses propres enjeux. Voici comment Revold y répond.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            {teams.map((t) => (
              <div key={t.team} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.05]">
                <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.04] px-6 py-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white">
                    {t.icon}
                  </span>
                  <h3 className="font-bold text-white">{t.team}</h3>
                </div>
                <div className="space-y-4 p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Pain</p>
                    <p className="mt-1 text-sm text-slate-400">{t.pain}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">Solution Revold</p>
                    <p className="mt-1 text-sm text-slate-300">{t.solution}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Résultat</p>
                    <p className="mt-1 text-sm text-slate-300">{t.result}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related products */}
      <section className="border-y border-white/10 bg-white/[0.02] py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-xl font-bold text-white">
            Produits associés
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {relatedProducts.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-fuchsia-400/40 hover:bg-white/10 hover:text-fuchsia-300"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-fuchsia-600/20 via-purple-600/20 to-indigo-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">
            Voyez l&apos;impact sur vos revenus en 5 minutes
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            Connectez vos outils en moins de 5 minutes. Lecture seule, révocable à tout moment, essai 14 jours sans carte bancaire.
          </p>
          <Link
            href="/essai-gratuit"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40"
          >
            Essayer gratuitement
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}
