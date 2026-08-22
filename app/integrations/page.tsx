import type { Metadata } from "next";
import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Intégrations",
  description: "HubSpot (OAuth), Stripe, Pennylane, Chargebee, GoCardless, Sage : des connecteurs natifs câblés en profondeur, plus l'import Excel / Google Sheets et les notifications Slack, Teams et email.",
};

type Integration = {
  name: string;
  desc: string;
  domain: string;
  available: boolean;
  href?: string;
};

const CATEGORIES: { name: string; color: string; integrations: Integration[] }[] = [
  {
    name: "CRM",
    color: "border-sky-400/30 bg-sky-400/10 text-sky-300",
    integrations: [
      { name: "HubSpot", desc: "CRM — connexion OAuth en un clic, lecture seule", domain: "hubspot.com", available: true, href: "/integrations/hubspot" },
      { name: "Salesforce", desc: "CRM, Sales Cloud", domain: "salesforce.com", available: false },
      { name: "Pipedrive", desc: "CRM orienté pipeline", domain: "pipedrive.com", available: false },
      { name: "Sellsy", desc: "CRM et facturation", domain: "sellsy.com", available: false },
    ],
  },
  {
    name: "Facturation, paiement & compta",
    color: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    integrations: [
      { name: "Stripe", desc: "Paiements, abonnements, factures", domain: "stripe.com", available: true, href: "/integrations/stripe" },
      { name: "Pennylane", desc: "Comptabilité et facturation", domain: "pennylane.com", available: true },
      { name: "Chargebee", desc: "Gestion des abonnements", domain: "chargebee.com", available: true },
      { name: "GoCardless", desc: "Prélèvements bancaires", domain: "gocardless.com", available: true },
      { name: "Sage", desc: "Comptabilité et gestion", domain: "sage.com", available: true },
    ],
  },
  {
    name: "Import de fichiers",
    color: "border-purple-400/30 bg-purple-400/10 text-purple-300",
    integrations: [
      { name: "Excel", desc: "Import de vos fichiers de suivi (.xlsx)", domain: "microsoft.com", available: true },
      { name: "Google Sheets", desc: "Import de vos feuilles de calcul", domain: "google.com", available: true },
    ],
  },
  {
    name: "Notifications",
    color: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    integrations: [
      { name: "Slack", desc: "Alertes, récaps et notifications dans vos channels", domain: "slack.com", available: true },
      { name: "Microsoft Teams", desc: "Alertes et récaps dans vos équipes", domain: "microsoft.com", available: true },
    ],
  },
  {
    name: "Support client",
    color: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    integrations: [
      { name: "Zendesk", desc: "Helpdesk et support client", domain: "zendesk.com", available: false },
      { name: "Intercom", desc: "Messagerie client et support", domain: "intercom.com", available: false },
    ],
  },
];

const AVAILABLE = CATEGORIES.reduce(
  (sum, c) => sum + c.integrations.filter((i) => i.available).length,
  0
);

export default function IntegrationsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-32 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-16 text-center md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {AVAILABLE} connecteurs & canaux réellement câblés — d&apos;autres arrivent
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
            Connectez votre stack{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">en quelques clics</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Revold se connecte à votre CRM, votre facturation et votre compta pour créer une source de vérité unique,
            rapprochée par SIREN / SIRET / TVA. Lecture seule, révocable à tout moment. On ne liste jamais un outil
            que Revold ne sait pas réellement synchroniser.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-24">
        {CATEGORIES.map((cat) => (
          <div key={cat.name} className="mt-16 first:mt-0">
            <div className="flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${cat.color}`}>{cat.name}</span>
              <span className="text-xs text-slate-500">{cat.integrations.length} intégration{cat.integrations.length > 1 ? "s" : ""}</span>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cat.integrations.map((integ) => {
                const inner = (
                  <>
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
                        <p className="font-semibold text-white">{integ.name}</p>
                        {integ.available ? (
                          <span className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            {integ.href ? "Voir détails" : "Disponible"}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Bientôt disponible</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{integ.desc}</p>
                    </div>
                  </>
                );
                const className = "flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]";
                return integ.href ? (
                  <Link key={integ.name} href={integ.href} className={className}>
                    {inner}
                  </Link>
                ) : (
                  <div key={integ.name} className={className}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-white/10 py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-fuchsia-600/20 via-purple-600/20 to-indigo-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Votre outil n&apos;est pas dans la liste ?</h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            Contactez-nous — on ajoute régulièrement de nouveaux connecteurs selon les besoins de nos clients,
            et on ne les liste qu&apos;une fois réellement câblés.
          </p>
          <Link href="/contact" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40">
            Nous contacter
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
