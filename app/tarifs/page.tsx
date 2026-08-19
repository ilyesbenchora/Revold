import Link from "next/link";
import type { Metadata } from "next";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Tarifs — Revold",
  description: "Des tarifs simples et transparents. Starter à 79,90€/mois, Business à 149,90€/mois, Scale à partir de 490,90€/mois. Essai 14 jours, sans carte bancaire.",
};

/**
 * Page Tarifs — thème sombre cockpit, alignée sur lib/billing/plans.ts
 * (Starter / Business / Scale) et sur les capacités RÉELLES du produit.
 */

const PRICING = [
  {
    name: "Starter",
    price: "79,90",
    priceFrom: false,
    credits: "300 analyses & actions IA multi-sources / mois",
    desc: "Découvre l'impact de Revold sur ton business",
    features: [
      "3 intégrations incluses (HubSpot en 1 clic, Stripe, Pennylane…)",
      "Rapprochement SIREN / SIRET / TVA + enrichissement Sirene",
      "Agents experts IA par domaine, pilotables à la voix",
      "Rapports & graphiques câblés sur tes vraies données (jusqu'à 20)",
      "Alertes, objectifs et calendrier avec câblage vérifié",
      "5 utilisateurs · support email",
    ],
    featured: false,
    cta: "Essayer 14 jours gratuits",
  },
  {
    name: "Business",
    price: "149,90",
    priceFrom: false,
    credits: "5 000 analyses & actions IA / mois",
    desc: "Pour les équipes qui veulent piloter et agir",
    features: [
      "Tout Starter inclus",
      "6 intégrations incluses",
      "Routines & récaps programmés (générés même app fermée)",
      "Tour de contrôle vocale (brief du jour, navigation, création à la voix)",
      "Actions exécutées dans tes outils (tâches HubSpot, rappels Stripe) + cash récupéré",
      "Espaces de travail par équipe (Ventes, Marketing, CS, Finance)",
      "Plus de rapports (jusqu'à 200) · alertes & objectifs illimités",
      "5 utilisateurs · support prioritaire",
    ],
    featured: true,
    cta: "Essayer 14 jours gratuits",
  },
  {
    name: "Scale",
    price: "490,90",
    priceFrom: true,
    credits: "Volume élevé — analyses & actions illimitées",
    desc: "Pour les revenue teams multi-pôles",
    features: [
      "Tout Business inclus",
      "Intégrations illimitées",
      "Rapports illimités",
      "Utilisateurs illimités · rôles & permissions",
      "Participation au développement produit",
      "Advisor RevOps dédié · SLA",
    ],
    featured: false,
    cta: "Essayer 14 jours gratuits",
  },
];

const FAQS = [
  { q: "Y a-t-il un engagement ?", a: "Non. Tous les plans sont mensuels et sans engagement. Vous pouvez annuler à tout moment depuis vos paramètres." },
  { q: "Faut-il une carte bancaire pour l'essai gratuit ?", a: "Non. L'essai de 14 jours est gratuit et sans carte bancaire. Vous ne serez jamais facturé sans votre accord." },
  { q: "Puis-je changer de plan en cours de route ?", a: "Oui. Vous pouvez upgrader ou downgrader votre plan à tout moment. Le changement prend effet immédiatement." },
  { q: "Quelles intégrations sont supportées ?", a: "Les connecteurs natifs câblés en profondeur : HubSpot (OAuth en 1 clic), Stripe, Pennylane, Chargebee, GoCardless et Sage — plus l'import Excel / Google Sheets et les canaux de notification (Slack, Teams, email). D'autres connecteurs (Pipedrive, Sellsy, Zendesk…) arrivent : on ne liste jamais un outil que Revold ne sait pas réellement synchroniser." },
  { q: "Les chiffres affichés sont-ils fiables ?", a: "C'est le principe de Revold : chaque KPI, alerte ou rapport est CÂBLÉ sur vos données réelles avec vérification avant création (source, outil, valeur actuelle calculée). Les briefs et récaps sont recalculés en déterministe — jamais un chiffre inventé par l'IA." },
  { q: "Mes données sont-elles en sécurité ?", a: "Oui. Données hébergées sur Supabase (PostgreSQL, UE), chiffrées en transit (TLS) et au repos (AES-256), isolation par organisation (Row Level Security). Export JSON et suppression sur demande depuis les paramètres. Accès à vos outils en lecture seule, révocable à tout moment." },
  { q: "Qu'est-ce qui est inclus dans le support prioritaire ?", a: "Réponse sous 4h en jours ouvrés, accès à un channel Slack dédié, et session d'onboarding personnalisée." },
];

export default function TarifsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-0 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-20 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-16 text-center md:pt-24">
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
            Des tarifs simples{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">et transparents</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-400">
            Un tarif selon ton usage. <span className="font-semibold text-slate-200">14 jours d&apos;essai gratuit</span>,
            sans carte bancaire. Vois l&apos;impact sur ton business en 5 minutes.
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
                  ? "border-fuchsia-400/50 bg-gradient-to-b from-fuchsia-500/10 to-indigo-600/10 shadow-lg shadow-fuchsia-500/10"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-4 py-1 text-xs font-semibold text-white shadow-md">
                  Le plus populaire
                </span>
              )}
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <p className="mt-1 text-sm text-slate-400">{plan.desc}</p>
              <div className="mt-6">
                {plan.priceFrom && <p className="text-xs font-medium text-slate-400">À partir de</p>}
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-white">{plan.price}</span>
                  <span className="text-lg text-slate-400">&euro; HT/mois</span>
                </div>
              </div>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-300">
                ⚡ {plan.credits}
              </p>
              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <span className="mt-0.5 text-emerald-400">
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
                    ? "bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/40"
                    : "border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-slate-500">
          Le tarif s&apos;adapte à ton usage (analyses &amp; actions IA par mois), au nombre d&apos;utilisateurs et aux
          intégrations connectées. Besoin de plus de volume sur un plan ? On ajuste sans te faire changer de logique.
        </p>
      </section>

      {/* FAQ */}
      <section className="border-y border-white/10 bg-white/[0.02] py-20 md:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">Questions fréquentes</h2>
          <div className="mt-12 space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.q} className="border-b border-white/10 pb-6 last:border-0">
                <h3 className="font-semibold text-slate-100">{faq.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-fuchsia-600/20 via-purple-600/20 to-indigo-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Testez Revold gratuitement pendant 14 jours</h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">Aucune carte bancaire. Aucun engagement. Vos premiers insights en 5 minutes.</p>
          <Link href="/essai-gratuit" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40">
            Démarrer l&apos;essai gratuit
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
