import type { Metadata } from "next";
import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";

export const metadata: Metadata = {
  title: "Intégrations — Revold",
  description: "Connectez vos CRM, outils de facturation et plateformes de support en quelques clics. Plus de 50 intégrations disponibles pour créer une source de vérité unique.",
};

type Integration = {
  name: string;
  desc: string;
  domain: string;
  available: boolean;
};

const CATEGORIES: { name: string; color: string; integrations: Integration[] }[] = [
  {
    name: "CRM",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    integrations: [
      { name: "HubSpot", desc: "CRM, Marketing Hub, Sales Hub", domain: "hubspot.com", available: true },
      { name: "Salesforce", desc: "CRM, Sales Cloud", domain: "salesforce.com", available: false },
      { name: "Pipedrive", desc: "CRM orienté pipeline", domain: "pipedrive.com", available: true },
      { name: "Zoho CRM", desc: "CRM tout-en-un", domain: "zoho.com", available: true },
    ],
  },
  {
    name: "Facturation & Paiement",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    integrations: [
      { name: "Stripe", desc: "Paiements, abonnements, factures", domain: "stripe.com", available: true },
      { name: "Pennylane", desc: "Comptabilité et facturation", domain: "pennylane.com", available: true },
      { name: "Sellsy", desc: "CRM et facturation", domain: "sellsy.com", available: true },
      { name: "Axonaut", desc: "ERP et facturation PME", domain: "axonaut.com", available: true },
      { name: "QuickBooks", desc: "Comptabilité et facturation", domain: "quickbooks.intuit.com", available: true },
    ],
  },
  {
    name: "Support Client",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    integrations: [
      { name: "Zendesk", desc: "Helpdesk et support client", domain: "zendesk.com", available: true },
      { name: "Intercom", desc: "Messagerie client et support", domain: "intercom.com", available: true },
      { name: "Crisp", desc: "Messagerie et chatbot", domain: "crisp.chat", available: true },
      { name: "Freshdesk", desc: "Helpdesk cloud", domain: "freshdesk.com", available: true },
    ],
  },
  {
    name: "Gestion de Projet",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    integrations: [
      { name: "monday.com", desc: "Work management", domain: "monday.com", available: true },
    ],
  },
];

const TOTAL = CATEGORIES.reduce((sum, c) => sum + c.integrations.length, 0);

export default function IntegrationsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-16 text-center md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-medium text-purple-700">
            {TOTAL} intégrations disponibles
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Connectez votre stack{" "}
            <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">en quelques clics</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Revold se connecte à vos CRM, outils de facturation et plateformes de support pour créer une source de vérité unique. Aucun code nécessaire.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-24">
        {CATEGORIES.map((cat) => (
          <div key={cat.name} className="mt-16 first:mt-0">
            <div className="flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${cat.color}`}>{cat.name}</span>
              <span className="text-xs text-slate-400">{cat.integrations.length} intégration{cat.integrations.length > 1 ? "s" : ""}</span>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cat.integrations.map((integ) => (
                <div key={integ.name} className="card flex items-start gap-4 p-5 transition hover:shadow-lg hover:shadow-accent/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${integ.domain}&sz=64`}
                    alt={integ.name}
                    width={32}
                    height={32}
                    className="mt-0.5 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{integ.name}</p>
                      {integ.available ? (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Connecter</span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Bientôt</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{integ.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Votre outil n&apos;est pas dans la liste ?</h2>
          <p className="mx-auto mt-4 max-w-xl text-purple-100">Contactez-nous — on ajoute régulièrement de nouveaux connecteurs selon les besoins de nos clients.</p>
          <Link href="/contact" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-purple-600 shadow-lg transition hover:bg-purple-50">
            Nous contacter
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </Link>
        </div>
      </section>

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
