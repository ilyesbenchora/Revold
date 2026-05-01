import type { Metadata } from "next";
import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";
import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = {
  title: "Revold pour Stripe — MRR / ARR / Churn croisés avec votre CRM",
  description:
    "Connectez Stripe à Revold pour croiser votre CA facturé avec votre pipeline CRM. Détectez les écarts CA CRM ↔ CA réel, le churn invisible et les comptes en expansion.",
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
    desc: "Identifiez les écarts entre votre CA CRM (deals won) et votre CA réellement facturé Stripe. Repérez les deals perdus en post-vente.",
    icon: "🔗",
  },
  {
    title: "Détection paiements en échec",
    desc: "Subscriptions past_due détectées automatiquement, alerte CSM avant le churn involontaire (~10% des churns SaaS).",
    icon: "⚠️",
  },
  {
    title: "Recouvrement intelligent",
    desc: "Liste des invoices open/uncollectible classées par DSO et montant. Plan d'action recouvrement priorisé.",
    icon: "📬",
  },
  {
    title: "Cohortes & expansion",
    desc: "Analyse par cohorte d'acquisition : qui upgrade, qui downgrade, churn par segment.",
    icon: "📈",
  },
  {
    title: "Restricted Key supportée",
    desc: "Connectez via une Restricted Key Stripe en lecture seule (Customers, Charges, Invoices, Subscriptions). Aucune écriture possible.",
    icon: "🔒",
  },
];

export default function StripeIntegrationPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNavbar />

      <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 via-white to-background">
        <div className="mx-auto max-w-5xl px-6 pt-16 pb-12 md:pt-24">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-violet-700">
            <BrandLogo domain="stripe.com" alt="Stripe" fallback="💳" size={20} />
            Stripe Partner
          </div>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            Revold pour Stripe
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            La couche d&apos;intelligence revenue qui croise votre Stripe avec votre CRM.
            MRR / ARR / churn temps réel, détection des paiements en échec, plan de
            recouvrement priorisé.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/essai-gratuit"
              className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
            >
              Connecter Stripe — Essai 14 jours
            </Link>
            <Link
              href="/demo"
              className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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

      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-slate-900">Ce que Revold ajoute à votre Stripe</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Stripe Dashboard est puissant pour la facturation. Revold ajoute la couche
            d&apos;intelligence : croisement CRM, prédiction de churn, plans d&apos;action.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-slate-900">Permissions demandées</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-600">
            Revold demande uniquement les accès <strong>en lecture seule</strong>. Une Restricted
            Key Stripe (rk_…) est recommandée.
          </p>
          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Ressource Stripe</th>
                  <th className="px-5 py-3">Accès</th>
                  <th className="px-5 py-3">Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td className="px-5 py-3 font-mono text-xs">customers</td><td className="px-5 py-3 text-xs">read</td><td className="px-5 py-3 text-slate-600">Croisement avec contacts CRM, attribution multi-source.</td></tr>
                <tr><td className="px-5 py-3 font-mono text-xs">invoices</td><td className="px-5 py-3 text-xs">read</td><td className="px-5 py-3 text-slate-600">Calcul du CA facturé, détection des impayés et du DSO.</td></tr>
                <tr><td className="px-5 py-3 font-mono text-xs">subscriptions</td><td className="px-5 py-3 text-xs">read</td><td className="px-5 py-3 text-slate-600">MRR, ARR, churn rate, détection past_due.</td></tr>
                <tr><td className="px-5 py-3 font-mono text-xs">charges</td><td className="px-5 py-3 text-xs">read</td><td className="px-5 py-3 text-slate-600">Détail paiements et historique pour les analyses cohort.</td></tr>
                <tr><td className="px-5 py-3 font-mono text-xs">balance</td><td className="px-5 py-3 text-xs">read</td><td className="px-5 py-3 text-slate-600">Validation de la connexion (ping initial).</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            <strong>Aucune donnée de carte bancaire</strong> n&apos;est lisible ni stockée par Revold.
            Stripe est PCI DSS Level 1 et gère lui-même cette donnée critique.
          </p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-slate-900">Installation en 3 étapes</h2>
          <ol className="mt-8 space-y-6">
            {[
              { n: 1, t: "Créer une Restricted Key Stripe", d: "Stripe Dashboard → Developers → API keys → Create restricted key. Cochez READ pour Customers, Charges, Invoices, Subscriptions et Balance." },
              { n: 2, t: "Coller la clé dans Revold", d: "Paramètres → Intégrations → Stripe → coller la rk_live_… (ou rk_test_… pour tester). Validation instantanée avec un ping /balance." },
              { n: 3, t: "Premier sync", d: "Revold synchronise jusqu'à 2000 invoices et 1000 subscriptions au premier passage. Cap configurable pour les comptes plus larges." },
            ].map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-sm font-bold text-white">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{s.t}</h3>
                  <p className="mt-1 text-sm text-slate-600">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-slate-900 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Prêt à croiser Stripe et votre CRM ?</h2>
          <p className="mt-3 text-sm text-slate-300">14 jours d&apos;essai gratuit, sans carte bancaire.</p>
          <Link
            href="/essai-gratuit"
            className="mt-6 inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Démarrer l&apos;essai gratuit →
          </Link>
        </div>
      </section>

      <footer className="border-t border-card-border bg-white py-12">
        <div className="mx-auto max-w-6xl px-6 flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <RevoldLogo />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/legal/securite" className="hover:text-slate-900">Sécurité</Link>
            <Link href="/legal/dpa" className="hover:text-slate-900">DPA</Link>
            <Link href="/legal/confidentialite" className="hover:text-slate-900">Confidentialité</Link>
            <Link href="/contact" className="hover:text-slate-900">Contact</Link>
          </div>
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Revold</p>
        </div>
      </footer>
    </div>
  );
}
