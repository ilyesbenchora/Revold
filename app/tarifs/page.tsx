import Link from "next/link";
import type { Metadata } from "next";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";

export const metadata: Metadata = {
  title: "Tarifs — Revold",
  description: "Des tarifs simples et transparents. 14 jours d'essai gratuit, sans carte bancaire. Starter à 79€/mois, Growth à 249€/mois, Scale à 699€/mois.",
};

const PRICING = [
  {
    name: "Starter",
    price: "79",
    desc: "Pour les équipes qui démarrent leur journey RevOps",
    features: [
      "Weekly revenue pulse",
      "8 métriques essentielles",
      "Dashboard pipeline",
      "Alertes email",
      "1 connexion CRM",
      "Support email",
    ],
    featured: false,
    cta: "Démarrer avec Starter",
  },
  {
    name: "Growth",
    price: "249",
    desc: "Pour les équipes qui veulent scaler intelligemment",
    features: [
      "Tout Starter inclus",
      "80+ métriques RevOps",
      "Diagnostic mensuel IA",
      "Recommandations contextuelles",
      "Détection de deals à risque",
      "Détection d'anomalies",
      "3 connexions CRM",
      "Support prioritaire",
    ],
    featured: true,
    cta: "Essayer Growth gratuitement",
  },
  {
    name: "Scale",
    price: "699",
    desc: "Pour les revenue teams ambitieuses",
    features: [
      "Tout Growth inclus",
      "Rapports trimestriels",
      "Simulations what-if",
      "Deal coaching IA avancé",
      "Advisor RevOps dédié",
      "API & webhooks",
      "Connexions illimitées",
      "SLA garanti",
    ],
    featured: false,
    cta: "Contacter l'équipe Scale",
  },
];

const FAQS = [
  { q: "Y a-t-il un engagement ?", a: "Non. Tous les plans sont mensuels et sans engagement. Vous pouvez annuler à tout moment depuis vos paramètres." },
  { q: "Faut-il une carte bancaire pour l'essai gratuit ?", a: "Non. L'essai de 14 jours est gratuit et sans carte bancaire. Vous ne serez jamais facturé sans votre accord." },
  { q: "Puis-je changer de plan en cours de route ?", a: "Oui. Vous pouvez upgrader ou downgrader votre plan à tout moment. Le changement prend effet immédiatement." },
  { q: "Quels CRM sont supportés ?", a: "HubSpot est entièrement supporté. Salesforce, Pipedrive et Zoho sont disponibles via nos connecteurs natifs. D'autres CRM arrivent régulièrement." },
  { q: "Mes données sont-elles en sécurité ?", a: "Oui. Vos données sont hébergées sur Supabase (PostgreSQL sur AWS), chiffrées en transit (TLS) et au repos (AES-256). Chaque organisation est isolée par Row Level Security." },
  { q: "Qu'est-ce qui est inclus dans le support prioritaire ?", a: "Réponse sous 4h en jours ouvrés, accès à un channel Slack dédié, et session de onboarding personnalisée." },
];

export default function TarifsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-16 text-center md:pt-24">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Des tarifs simples{" "}
            <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">et transparents</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-600">
            14 jours d&apos;essai gratuit. Aucune carte bancaire requise. Annulez à tout moment.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 transition ${
                plan.featured
                  ? "border-accent/30 bg-accent-soft/30 shadow-lg shadow-accent/10 ring-1 ring-accent/20"
                  : "border-card-border bg-white hover:shadow-lg"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-4 py-1 text-xs font-semibold text-white shadow-md">
                  Le plus populaire
                </span>
              )}
              <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{plan.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-black text-slate-900">{plan.price}</span>
                <span className="text-lg text-slate-500">&euro;/mois</span>
              </div>
              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="mt-0.5 text-emerald-500">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/essai-gratuit"
                className={`mt-8 block w-full rounded-xl py-3.5 text-center text-sm font-semibold transition ${
                  plan.featured
                    ? "bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30"
                    : "border border-card-border bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Enterprise */}
        <div className="mt-12 rounded-2xl border border-card-border bg-white p-8 text-center md:p-12">
          <h3 className="text-xl font-bold text-slate-900">Enterprise</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
            Vous avez des besoins spécifiques ? SSO, SLA custom, volume de données important, accompagnement dédié — contactez-nous pour un plan sur mesure.
          </p>
          <Link href="/demo" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:shadow-xl">
            Contacter l&apos;équipe commerciale
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-y border-card-border bg-white py-20 md:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">Questions fréquentes</h2>
          <div className="mt-12 space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.q} className="border-b border-card-border pb-6 last:border-0">
                <h3 className="font-semibold text-slate-900">{faq.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Testez Revold gratuitement pendant 14 jours</h2>
          <p className="mx-auto mt-4 max-w-xl text-purple-100">Aucune carte bancaire. Aucun engagement. Vos premiers insights en 5 minutes.</p>
          <Link href="/essai-gratuit" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-purple-600 shadow-lg transition hover:bg-purple-50">
            Démarrer l&apos;essai gratuit
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
            <div className="col-span-2 md:col-span-1">
              <RevoldLogo />
              <p className="mt-4 text-sm text-slate-500">Plateforme de Revenue Intelligence pour le marché B2B français.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Produit</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/produits/synchronisation" className="text-sm text-slate-500 transition hover:text-slate-700">Synchronisation</Link></li>
                <li><Link href="/produits/reporting-cross-source" className="text-sm text-slate-500 transition hover:text-slate-700">Reporting</Link></li>
                <li><Link href="/produits/insights-ia" className="text-sm text-slate-500 transition hover:text-slate-700">Insights IA</Link></li>
                <li><Link href="/produits/audit-crm" className="text-sm text-slate-500 transition hover:text-slate-700">Audit CRM</Link></li>
                <li><Link href="/integrations" className="text-sm text-slate-500 transition hover:text-slate-700">Intégrations</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Solutions</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/solutions/optimiser-revenus" className="text-sm text-slate-500 transition hover:text-slate-700">Optimiser les revenus</Link></li>
                <li><Link href="/solutions/fiabiliser-donnees" className="text-sm text-slate-500 transition hover:text-slate-700">Fiabiliser les données</Link></li>
                <li><Link href="/solutions/accelerer-cycles-vente" className="text-sm text-slate-500 transition hover:text-slate-700">Accélérer les ventes</Link></li>
                <li><Link href="/solutions/reduire-churn" className="text-sm text-slate-500 transition hover:text-slate-700">Réduire le churn</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Ressources</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/blog" className="text-sm text-slate-500 transition hover:text-slate-700">Blog</Link></li>
                <li><Link href="/pourquoi-revold" className="text-sm text-slate-500 transition hover:text-slate-700">Pourquoi Revold</Link></li>
                <li><Link href="/contact" className="text-sm text-slate-500 transition hover:text-slate-700">Contact</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Légal</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/legal/confidentialite" className="text-sm text-slate-500 transition hover:text-slate-700">Confidentialité</Link></li>
                <li><Link href="/legal/cgu" className="text-sm text-slate-500 transition hover:text-slate-700">CGU</Link></li>
                <li><Link href="/legal/securite" className="text-sm text-slate-500 transition hover:text-slate-700">Sécurité</Link></li>
                <li><Link href="/legal/rgpd" className="text-sm text-slate-500 transition hover:text-slate-700">RGPD</Link></li>
                <li><Link href="/legal/dpa" className="text-sm text-slate-500 transition hover:text-slate-700">DPA</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-card-border pt-8 md:flex-row">
            <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Revold. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
