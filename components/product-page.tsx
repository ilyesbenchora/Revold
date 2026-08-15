import Link from "next/link";

type Stat = { value: string; label: string; source?: string };
type Feature = { title: string; desc: string };
type Pain = { value: string; label: string; source: string };
type CrmSetup = { crm: string; items: string[] };

type ProductPageProps = {
  badge: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  heroIcon: React.ReactNode;
  pains: Pain[];
  features: Feature[];
  howItWorks: { step: string; desc: string }[];
  stats: Stat[];
  cta?: string;
  ctaTitle?: string;
  crmSetups?: CrmSetup[];
};

/**
 * Gabarit des pages Produit — thème SOMBRE cockpit (slate-950, halos
 * fuchsia/indigo, cartes bg-white/[0.03], bordures white/10), aligné sur
 * app/page.tsx et app/tarifs/page.tsx.
 */
export function ProductPage({
  badge,
  title,
  titleAccent,
  subtitle,
  heroIcon,
  pains,
  features,
  howItWorks,
  stats,
  cta = "Essayer gratuitement",
  ctaTitle = "Passez à l'action maintenant",
  crmSetups,
}: ProductPageProps) {
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
              {cta}
            </Link>
            <Link
              href="/tarifs"
              className="rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section className="border-y border-white/10 bg-white/[0.02] py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              Le problème aujourd&apos;hui
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              Les chiffres parlent d&apos;eux-mêmes.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pains.map((p) => (
              <div
                key={p.value}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.06]"
              >
                <p className="text-4xl font-black tracking-tight text-white">
                  {p.value}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{p.label}</p>
                <p className="mt-3 text-xs font-medium text-fuchsia-300">
                  Source : {p.source}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-20 md:py-24">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              Ce que Revold vous apporte
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-600/20 text-fuchsia-300 ring-1 ring-white/10">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-white/10 bg-white/[0.02] py-20 md:py-24">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">
            Comment ça marche
          </h2>
          <div className="mt-12 space-y-8">
            {howItWorks.map((s, i) => (
              <div key={i} className="flex gap-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-sm font-bold text-white shadow-md">
                  {i + 1}
                </div>
                <div>
                  <p className="font-semibold text-white">{s.step}</p>
                  <p className="mt-1 text-sm text-slate-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compatible with your stack */}
      {crmSetups && (
        <section className="relative py-20 md:py-24">
          <div className="pointer-events-none absolute left-0 bottom-0 h-72 w-72 rounded-full bg-fuchsia-600/10 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white md:text-3xl">
                Vous utilisez déjà ces outils ?{" "}
                <span className="text-fuchsia-300">Voici ce qu&apos;on met en place pour vous.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-400">
                Revold se connecte à votre stack existant et ajoute une couche d&apos;intelligence par-dessus — sans rien remplacer.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {crmSetups.map((setup) => (
                <div key={setup.crm} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.05]">
                  <div className="border-b border-white/10 bg-white/[0.04] px-6 py-4">
                    <p className="text-sm font-bold text-white">
                      Vous êtes sur <span className="text-fuchsia-300">{setup.crm}</span>
                    </p>
                  </div>
                  <div className="p-6">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Ce qu&apos;on active pour vous
                    </p>
                    <ul className="space-y-3">
                      {setup.items.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                          <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300">
                            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Key metrics */}
      <section className="border-t border-white/10 bg-white/[0.02] py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-black text-white md:text-4xl">{s.value}</p>
                <p className="mt-2 text-xs text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-white/10 py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-fuchsia-600/20 via-purple-600/20 to-indigo-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">
            {ctaTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            Connectez vos outils en moins de 5 minutes. Lecture seule, révocable à tout moment, essai 14 jours sans carte bancaire.
          </p>
          <Link
            href="/essai-gratuit"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40"
          >
            {cta}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}
