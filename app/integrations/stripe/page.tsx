import type { Metadata } from "next";
import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = {
  title: "Revold pour Stripe — MRR / ARR / Churn croisés avec votre CRM",
  description:
    "Connectez Stripe à Revold pour croiser votre CA facturé avec votre pipeline CRM. Détectez les écarts CA CRM ↔ CA réel, les impayés — et déclenchez le rappel Stripe officiel après validation.",
  alternates: { canonical: "/integrations/stripe" },
};

const FEATURES = [
  {
    title: "MRR / ARR / Churn temps réel",
    desc: "Calcul natif depuis vos subscriptions Stripe avec décomposition mensuelle/annuelle. Pas de re-saisie manuelle.",
    icon: "💰",
  },
  {
    title: "Cross-source CRM × Stripe",
    desc: "Identifiez les écarts entre votre CA CRM (deals won) et votre CA réellement facturé Stripe, entreprises rapprochées par SIREN / N° TVA. Repérez les deals perdus en post-vente.",
    icon: "🔗",
  },
  {
    title: "Détection paiements en échec",
    desc: "Subscriptions past_due et factures en retard détectées automatiquement, alerte avant le churn involontaire (~10% des churns SaaS).",
    icon: "⚠️",
  },
  {
    title: "Impayé → rappel Stripe officiel",
    desc: "Revold propose la relance dans votre boîte d'actions : vous validez, le rappel officiel Stripe part — et chaque euro récupéré est attribué, ligne par ligne.",
    icon: "📬",
  },
  {
    title: "Trésorerie & projection pondérée",
    desc: "Encaissements réels croisés avec le pipeline pondéré et les échéances fiscales : une vision de trésorerie appuyée sur la donnée.",
    icon: "📈",
  },
  {
    title: "Restricted Key supportée",
    desc: "Connectez via une Restricted Key Stripe en lecture seule (Customers, Charges, Invoices, Subscriptions). Aucune écriture sans votre validation.",
    icon: "🔒",
  },
];

export default function StripeIntegrationPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-32 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 pt-16 pb-12 md:pt-24">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-violet-300">
            <BrandLogo domain="stripe.com" alt="Stripe" fallback="💳" size={20} />
            Stripe
          </div>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-white md:text-5xl">
            Revold pour Stripe
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-400">
            La couche d&apos;intelligence revenue qui croise votre Stripe avec votre CRM.
            MRR / ARR / churn temps réel, détection des paiements en échec — et rappels
            Stripe officiels déclenchés après votre validation, avec le cash récupéré attribué en euros.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/essai-gratuit"
              className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40"
            >
              Connecter Stripe — Essai 14 jours
            </Link>
            <Link
              href="/demo"
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Voir une démo
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-500">
            <span>🔒 Hébergement UE (Frankfurt)</span>
            <span>✓ Lecture seule (Restricted Key)</span>
            <span>✓ Aucune donnée carte bancaire stockée</span>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-white">Ce que Revold ajoute à votre Stripe</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            Stripe Dashboard est puissant pour la facturation. Revold ajoute la couche
            d&apos;intelligence : croisement CRM, alertes câblées, actions de relance validées par vous.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.06]">
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-3 text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-white/[0.02] py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-white">Permissions demandées</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-400">
            Revold demande uniquement les accès <strong className="text-slate-200">en lecture seule</strong>. Une Restricted
            Key Stripe (rk_…) est recommandée.
          </p>
          <div className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.04]">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3">Ressource Stripe</th>
                    <th className="px-5 py-3">Accès</th>
                    <th className="px-5 py-3">Justification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  <tr><td className="px-5 py-3 font-mono text-xs text-slate-200">customers</td><td className="px-5 py-3 text-xs text-slate-300">read</td><td className="px-5 py-3 text-slate-400">Croisement avec contacts CRM, attribution multi-source.</td></tr>
                  <tr><td className="px-5 py-3 font-mono text-xs text-slate-200">invoices</td><td className="px-5 py-3 text-xs text-slate-300">read</td><td className="px-5 py-3 text-slate-400">Calcul du CA facturé, détection des impayés et du DSO.</td></tr>
                  <tr><td className="px-5 py-3 font-mono text-xs text-slate-200">subscriptions</td><td className="px-5 py-3 text-xs text-slate-300">read</td><td className="px-5 py-3 text-slate-400">MRR, ARR, churn rate, détection past_due.</td></tr>
                  <tr><td className="px-5 py-3 font-mono text-xs text-slate-200">charges</td><td className="px-5 py-3 text-xs text-slate-300">read</td><td className="px-5 py-3 text-slate-400">Détail paiements et historique pour les analyses cohort.</td></tr>
                  <tr><td className="px-5 py-3 font-mono text-xs text-slate-200">balance</td><td className="px-5 py-3 text-xs text-slate-300">read</td><td className="px-5 py-3 text-slate-400">Validation de la connexion (ping initial).</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            <strong className="text-slate-300">Aucune donnée de carte bancaire</strong> n&apos;est lisible ni stockée par Revold.
            Stripe est PCI DSS Level 1 et gère lui-même cette donnée critique. Les rappels d&apos;impayés
            sont les rappels officiels Stripe, déclenchés uniquement après votre validation explicite.
          </p>
        </div>
      </section>

      <section className="border-t border-white/10 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-white">Installation en 3 étapes</h2>
          <ol className="mt-8 space-y-6">
            {[
              { n: 1, t: "Créer une Restricted Key Stripe", d: "Stripe Dashboard → Developers → API keys → Create restricted key. Cochez READ pour Customers, Charges, Invoices, Subscriptions et Balance." },
              { n: 2, t: "Coller la clé dans Revold", d: "Paramètres → Intégrations → Stripe → coller la rk_live_… (ou rk_test_… pour tester). Validation instantanée avec un ping /balance." },
              { n: 3, t: "Premier sync + audit d'onboarding", d: "Revold synchronise jusqu'à 2000 invoices et 1000 subscriptions au premier passage, rapproche vos clients par SIREN / N° TVA et génère le rapport d'audit d'onboarding. Cap configurable pour les comptes plus larges." },
            ].map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-sm font-bold text-white">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">{s.t}</h3>
                  <p className="mt-1 text-sm text-slate-400">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-white/10 py-16">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-fuchsia-600/20 via-purple-600/20 to-indigo-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Prêt à croiser Stripe et votre CRM ?</h2>
          <p className="mt-3 text-sm text-slate-400">14 jours d&apos;essai gratuit, sans carte bancaire.</p>
          <Link
            href="/essai-gratuit"
            className="mt-6 inline-block rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40"
          >
            Démarrer l&apos;essai gratuit →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
