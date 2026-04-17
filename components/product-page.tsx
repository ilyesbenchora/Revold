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
              className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40"
            >
              {cta}
            </Link>
            <Link
              href="/#pricing"
              className="rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section className="border-y border-card-border bg-white py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
              Le problème aujourd&apos;hui
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500">
              Les chiffres parlent d&apos;eux-mêmes.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pains.map((p) => (
              <div
                key={p.value}
                className="card p-6 transition hover:shadow-lg hover:shadow-accent/5"
              >
                <p className="text-4xl font-black tracking-tight text-slate-900">
                  {p.value}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{p.label}</p>
                <p className="mt-3 text-xs font-medium text-accent">
                  Source : {p.source}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-background py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
              Ce que Revold vous apporte
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="card p-6 transition hover:shadow-lg hover:shadow-accent/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-card-border bg-white py-20 md:py-24">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">
            Comment ça marche
          </h2>
          <div className="mt-12 space-y-8">
            {howItWorks.map((s, i) => (
              <div key={i} className="flex gap-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-sm font-bold text-white shadow-md">
                  {i + 1}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{s.step}</p>
                  <p className="mt-1 text-sm text-slate-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compatible with your CRM */}
      {crmSetups && (
        <section className="bg-background py-20 md:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
                Vous utilisez déjà un CRM ?{" "}
                <span className="text-accent">Voici ce qu&apos;on met en place pour vous.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-500">
                Revold se connecte à votre stack existant et ajoute une couche d&apos;intelligence par-dessus — sans rien remplacer.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {crmSetups.map((setup) => (
                <div key={setup.crm} className="card overflow-hidden transition hover:shadow-lg hover:shadow-accent/5">
                  <div className="border-b border-card-border bg-slate-50 px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">
                      Vous êtes sur <span className="text-accent">{setup.crm}</span>
                    </p>
                  </div>
                  <div className="p-6">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Ce qu&apos;on active pour vous
                    </p>
                    <ul className="space-y-3">
                      {setup.items.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
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
      <section className="border-t border-card-border bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-black text-slate-900 md:text-4xl">{s.value}</p>
                <p className="mt-2 text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">
            {ctaTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-purple-100">
            Connectez votre CRM en moins de 5 minutes. Vos premiers insights sont prêts instantanément.
          </p>
          <Link
            href="/essai-gratuit"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-purple-600 shadow-lg transition hover:bg-purple-50"
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
