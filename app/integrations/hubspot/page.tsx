import type { Metadata } from "next";
import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";
import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = {
  title: "Revold pour HubSpot — Audit CRM, Forecast & Coaching IA",
  description:
    "Connectez Revold à HubSpot en un clic OAuth. Auditez la qualité de vos propriétés, détectez les deals à risque et activez le coaching IA. Hébergement EU, RGPD-natif, essai 14 jours.",
  alternates: { canonical: "/integrations/hubspot" },
};

const FEATURES = [
  {
    title: "Audit complet du portail HubSpot",
    desc: "Taux de remplissage de chaque propriété, contacts orphelins, doublons, lifecycle stages incohérents — un score de santé par objet (Contacts / Companies / Deals / Tickets).",
    icon: "🔍",
  },
  {
    title: "Forecast pondéré + détection deals à risque",
    desc: "L'IA croise close_date, dernière activité, montant et stade pour prédire les deals à risque AVANT qu'ils glissent. Coaching CRO activable en 1 clic.",
    icon: "📊",
  },
  {
    title: "Performances par équipe",
    desc: "Pipelines multiples, vélocité par étape, attractivité des sources, audit MEDDIC/BANT, analyse owner par owner. Toutes les courbes que HubSpot Reports ne génère pas.",
    icon: "📈",
  },
  {
    title: "Cross-source HubSpot × Stripe × Pennylane",
    desc: "Croisez vos deals HubSpot avec votre billing réel pour identifier les écarts CA CRM ↔ CA facturé, le churn invisible et les comptes en expansion.",
    icon: "🔗",
  },
  {
    title: "Audit des automatisations",
    desc: "Workflows HubSpot analysés un par un : objet cible, complexité, re-enrollment, goals, erreurs de catégorisation v4. Repérez les workflows zombies et les boucles infinies.",
    icon: "⚙️",
  },
  {
    title: "Notifications intelligentes",
    desc: "Email + Slack/Teams quand un objectif est atteint, qu'un deal critique stagne ou qu'un insight critique est détecté. Plus besoin de regarder 5 dashboards.",
    icon: "🔔",
  },
];

const SCOPES = [
  { scope: "crm.objects.contacts.read", justification: "Lire les contacts pour l'audit qualité (taux de remplissage, doublons, orphelins)." },
  { scope: "crm.objects.companies.read", justification: "Lire les entreprises pour l'audit qualité et l'enrichissement SIREN/SIRET/TVA." },
  { scope: "crm.objects.deals.read", justification: "Lire les deals pour le pipeline analytics, forecast pondéré et détection deals à risque." },
  { scope: "crm.objects.line_items.read", justification: "Lire les line items pour le calcul ARPU et la décomposition revenue par produit." },
  { scope: "crm.objects.quotes.read", justification: "Lire les devis pour suivre la conversion devis → deal won." },
  { scope: "crm.lists.read", justification: "Lire les listes pour comprendre la segmentation marketing et les cohortes." },
  { scope: "crm.schemas.contacts.read", justification: "Lire le schéma propriétés contacts pour calculer les fill rates par champ." },
  { scope: "crm.schemas.companies.read", justification: "Lire le schéma propriétés companies (idem)." },
  { scope: "crm.schemas.deals.read", justification: "Lire le schéma propriétés deals (idem)." },
  { scope: "automation", justification: "Lire les workflows pour l'audit RevOps (re-enrollment, goals, complexité)." },
  { scope: "forms", justification: "Lire les formulaires pour l'audit du funnel d'acquisition marketing." },
  { scope: "tickets", justification: "Lire les tickets pour l'audit Service Client (volume, priorité, résolution)." },
  { scope: "e-commerce", justification: "Lire invoices et subscriptions pour le module Paiement & Facturation." },
];

export default function HubSpotIntegrationPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-orange-50 via-white to-background">
        <div className="mx-auto max-w-5xl px-6 pt-16 pb-12 md:pt-24">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-orange-700">
            <BrandLogo domain="hubspot.com" alt="HubSpot" fallback="🔶" size={20} />
            HubSpot App
          </div>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            Revold pour HubSpot
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            La couche d&apos;intelligence externe que votre portail HubSpot ne peut pas générer
            sur lui-même. Audit, forecast pondéré, deal coaching IA et cross-source HubSpot ×
            Stripe / Pennylane. Connexion OAuth en 1 clic.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/essai-gratuit"
              className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
            >
              Connecter HubSpot — Essai 14 jours
            </Link>
            <Link
              href="/demo"
              className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Voir une démo (15 min)
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">🔒 Hébergement UE (Frankfurt)</span>
            <span className="inline-flex items-center gap-1">✓ RGPD natif</span>
            <span className="inline-flex items-center gap-1">✓ Aucune donnée modifiée dans HubSpot (lecture seule par défaut)</span>
            <span className="inline-flex items-center gap-1">✓ Time-to-value &lt; 5 min</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-slate-900">Ce que Revold ajoute à votre HubSpot</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            HubSpot est une excellente plateforme transactionnelle. Revold est la couche
            d&apos;intelligence et d&apos;audit qui transforme vos données HubSpot en plans
            d&apos;action concrets pour vos équipes RevOps.
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

      {/* OAuth scopes */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-slate-900">Permissions demandées</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-600">
            Revold demande uniquement les scopes <strong>en lecture seule</strong> nécessaires à
            son fonctionnement. Vous gardez le contrôle total : révocation à tout moment depuis
            HubSpot Settings → Integrations → Connected Apps.
          </p>
          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Scope HubSpot</th>
                  <th className="px-5 py-3">Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SCOPES.map((s) => (
                  <tr key={s.scope}>
                    <td className="px-5 py-3 font-mono text-xs text-slate-900">{s.scope}</td>
                    <td className="px-5 py-3 text-slate-600">{s.justification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Installation steps */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-slate-900">Installation en 4 étapes</h2>
          <ol className="mt-8 space-y-6">
            {[
              { n: 1, t: "Créer un compte Revold", d: "Inscription en 30 secondes via /essai-gratuit. Pas de carte bancaire." },
              { n: 2, t: "Connecter HubSpot via OAuth", d: "Cliquez sur 'Connecter HubSpot' depuis l'onboarding. Vous êtes redirigé vers HubSpot pour autoriser les scopes en lecture. Aucune donnée n'est modifiée dans HubSpot." },
              { n: 3, t: "Premier sync automatique", d: "Revold synchronise vos contacts, companies, deals, tickets, workflows, factures et subscriptions. Selon la taille du portail, le premier sync prend 30 sec à 5 min." },
              { n: 4, t: "Voir votre 1er insight", d: "Le wizard vous redirige vers la page la plus pertinente selon vos équipes (Sales / Marketing / Revenue / Service). Time-to-first-insight : moins de 5 minutes." },
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

      {/* Pricing teaser */}
      <section className="bg-gradient-to-br from-fuchsia-50 to-indigo-50 py-16">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Pricing simple et transparent</h2>
          <p className="mt-3 text-sm text-slate-600">
            3 plans à partir de 79 €/mois. Essai 14 jours sans carte bancaire.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/tarifs"
              className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
            >
              Voir les tarifs détaillés
            </Link>
          </div>
        </div>
      </section>

      {/* Trust + Support */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Sécurité & conformité</h3>
            <p className="mt-3 text-sm text-slate-600">
              Données hébergées exclusivement en Union européenne (Frankfurt). RGPD natif.
              Tokens OAuth chiffrés au repos. SOC 2 Type 1 visé Q4 2026.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="/legal/securite" className="text-accent hover:underline">→ Page Sécurité complète (sous-processeurs, RTO/RPO, bug bounty)</Link></li>
              <li><Link href="/legal/dpa" className="text-accent hover:underline">→ Data Processing Agreement (DPA) RGPD</Link></li>
              <li><Link href="/legal/rgpd" className="text-accent hover:underline">→ Politique RGPD</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Support</h3>
            <p className="mt-3 text-sm text-slate-600">
              Réponse sous 4 h en jours ouvrés sur les plans payants. Documentation publique et
              équipe basée à Paris (FR).
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>📧 <a href="mailto:support@revold.io" className="text-accent hover:underline">support@revold.io</a> — questions produit</li>
              <li>🔒 <a href="mailto:security@revold.io" className="text-accent hover:underline">security@revold.io</a> — vulnérabilités, divulgation responsable</li>
              <li>⚖️ <a href="mailto:dpo@revold.io" className="text-accent hover:underline">dpo@revold.io</a> — RGPD, DPA, demandes d&apos;accès</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-slate-900 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Prêt à connecter votre HubSpot ?</h2>
          <p className="mt-3 text-sm text-slate-300">
            14 jours d&apos;essai gratuit, aucune carte bancaire requise. Désinstallation en 1 clic.
          </p>
          <div className="mt-6">
            <Link
              href="/essai-gratuit"
              className="inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Démarrer l&apos;essai gratuit →
            </Link>
          </div>
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
