import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";

const FEATURES = [
  {
    icon: "🔗",
    title: "Connectez vos outils",
    desc: "HubSpot, Stripe, Pennylane, Zendesk, Salesforce… Revold se connecte à votre stack en quelques clics.",
  },
  {
    icon: "📊",
    title: "Rapports automatiques",
    desc: "80+ rapports pré-configurés qui se remplissent automatiquement avec vos données CRM en temps réel.",
  },
  {
    icon: "🔍",
    title: "Qualité de données",
    desc: "Auditez l'enrichissement de chaque propriété, détectez les orphelins et les champs manquants.",
  },
  {
    icon: "🏢",
    title: "Résolution d'entités",
    desc: "Rapprochez automatiquement vos contacts entre CRM, facturation et support via SIREN, TVA ou email.",
  },
  {
    icon: "📈",
    title: "KPIs en temps réel",
    desc: "Pipeline, CA, conversion, vélocité, CSAT — tous vos indicateurs RevOps dans un seul dashboard.",
  },
  {
    icon: "🛡️",
    title: "Données fiables",
    desc: "Aucun échantillonnage. Chaque métrique est calculée sur la totalité de votre base CRM.",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "79",
    desc: "Pour les équipes qui démarrent",
    features: ["Weekly revenue pulse", "8 métriques essentielles", "Dashboard pipeline", "Alertes email", "1 portail HubSpot"],
    featured: false,
  },
  {
    name: "Growth",
    price: "249",
    desc: "Pour les équipes qui scalent",
    features: ["Tout Starter inclus", "80+ métriques RevOps", "Diagnostic mensuel", "Recommandations IA", "Anomaly detection", "3 portails HubSpot"],
    featured: true,
  },
  {
    name: "Scale",
    price: "699",
    desc: "Pour les revenue teams ambitieuses",
    features: ["Tout Growth inclus", "Rapports trimestriels", "Simulations what-if", "Advisor dédié", "Portails illimités"],
    featured: false,
  },
];

const LOGOS = [
  { name: "HubSpot", icon: "🟠" },
  { name: "Stripe", icon: "💳" },
  { name: "Pennylane", icon: "📊" },
  { name: "Salesforce", icon: "☁️" },
  { name: "Zendesk", icon: "🎧" },
  { name: "Pipedrive", icon: "🟢" },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <RevoldLogo />
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900">Fonctionnalités</a>
            <a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900">Tarifs</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-slate-900">
              Connexion
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-purple-500/25 transition hover:opacity-90"
            >
              Essai gratuit
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-24 text-center md:pt-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-medium text-purple-700">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            Plateforme de Revenue Intelligence
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
            Vos données CRM.{" "}
            <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
              Enfin lisibles.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Revold connecte votre CRM, votre facturation et votre support pour vous donner une vision complète de votre revenue. Rapports automatiques, qualité de données et KPIs en temps réel.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:opacity-90"
            >
              Démarrer gratuitement
            </Link>
            <a
              href="#features"
              className="rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Voir les fonctionnalités
            </a>
          </div>
          <div className="mt-12 flex items-center justify-center gap-6">
            {LOGOS.map((l) => (
              <span key={l.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="text-base">{l.icon}</span>
                {l.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900">Tout ce dont votre équipe RevOps a besoin</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Revold remplace les exports manuels, les spreadsheets et les dashboards incomplets par une source de vérité unique.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-lg hover:shadow-purple-500/5">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="grid grid-cols-3 gap-8">
            <div>
              <p className="text-4xl font-bold text-slate-900">80+</p>
              <p className="mt-1 text-sm text-slate-500">Rapports automatiques</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-slate-900">13</p>
              <p className="mt-1 text-sm text-slate-500">Outils connectables</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-slate-900">100%</p>
              <p className="mt-1 text-sm text-slate-500">Données fiables</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900">Des tarifs simples et transparents</h2>
          <p className="mt-4 text-slate-600">14 jours d&apos;essai gratuit. Aucune carte bancaire requise.</p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 transition ${
                plan.featured
                  ? "border-purple-300 bg-gradient-to-b from-purple-50 to-white shadow-lg shadow-purple-500/10 ring-1 ring-purple-200"
                  : "border-slate-200 bg-white hover:shadow-md"
              }`}
            >
              {plan.featured && (
                <span className="inline-block rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                  Populaire
                </span>
              )}
              <h3 className={`${plan.featured ? "mt-3" : ""} text-xl font-bold text-slate-900`}>{plan.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{plan.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">{plan.price}€</span>
                <span className="text-sm text-slate-500">/mois</span>
              </div>
              <ul className="mt-8 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-0.5 text-emerald-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-8 block w-full rounded-lg py-3 text-center text-sm font-semibold transition ${
                  plan.featured
                    ? "bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 text-white shadow-md hover:opacity-90"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {plan.featured ? "Démarrer l'essai gratuit" : `Choisir ${plan.name}`}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Prêt à reprendre le contrôle de vos données revenue ?</h2>
          <p className="mx-auto mt-4 max-w-xl text-purple-100">
            Connectez votre CRM en 2 minutes. Vos premiers rapports sont prêts instantanément.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-purple-600 shadow-lg transition hover:bg-purple-50"
          >
            Essayer Revold gratuitement
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 md:flex-row md:justify-between">
          <RevoldLogo />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#features" className="hover:text-slate-900">Fonctionnalités</a>
            <a href="#pricing" className="hover:text-slate-900">Tarifs</a>
            <Link href="/login" className="hover:text-slate-900">Connexion</Link>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Revold. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
