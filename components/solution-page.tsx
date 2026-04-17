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
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-medium text-purple-700">
            <span className="flex h-5 w-5 items-center justify-center text-purple-500">
              {heroIcon}
            </span>
            {badge}
          </div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            {title}{" "}
            <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
              {titleAccent}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{subtitle}</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/essai-gratuit"
              className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl"
            >
              Essayer gratuitement
            </Link>
            <Link
              href="/#pricing"
              className="rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Voir les tarifs
            </Link>
          </div>

          {/* Screenshot */}
          {screenshot && (
            <div className="mt-12">
              <div className="overflow-hidden rounded-xl border border-card-border shadow-2xl shadow-accent/10">
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
      <section className="border-y border-card-border bg-white py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">
            Pourquoi cette solution ?
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {keyBenefits.map((b) => (
              <div key={b.title} className="card p-6 transition hover:shadow-lg hover:shadow-accent/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* By team */}
      <section className="bg-background py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
              Par équipe
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500">
              Chaque équipe a ses propres enjeux. Voici comment Revold y répond.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            {teams.map((t) => (
              <div key={t.team} className="card overflow-hidden transition hover:shadow-lg hover:shadow-accent/5">
                <div className="flex items-center gap-3 border-b border-card-border bg-slate-50 px-6 py-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white">
                    {t.icon}
                  </span>
                  <h3 className="font-bold text-slate-900">{t.team}</h3>
                </div>
                <div className="space-y-4 p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Pain</p>
                    <p className="mt-1 text-sm text-slate-600">{t.pain}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent">Solution Revold</p>
                    <p className="mt-1 text-sm text-slate-600">{t.solution}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Résultat</p>
                    <p className="mt-1 text-sm text-slate-600">{t.result}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related products */}
      <section className="border-y border-card-border bg-white py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-xl font-bold text-slate-900">
            Produits associés
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {relatedProducts.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="rounded-lg border border-card-border bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-accent hover:bg-accent-soft hover:text-accent"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">
            Voyez l&apos;impact sur vos revenus en 5 minutes
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-purple-100">
            Connectez votre CRM en moins de 5 minutes. Vos premiers insights sont prêts instantanément.
          </p>
          <Link
            href="/essai-gratuit"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-purple-600 shadow-lg transition hover:bg-purple-50"
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
