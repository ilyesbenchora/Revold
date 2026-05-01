"use client";

import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";
import { useState, type FormEvent } from "react";

export default function DemoPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    await fetch("https://formspree.io/f/xgorvpnr", {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    });
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNavbar />

      <div className="flex flex-1 items-start justify-center">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
          {/* Left — pitch */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-medium text-purple-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
              </span>
              Démo personnalisée
            </div>
            <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-4xl">
              Voyez Revold en action{" "}
              <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
                sur vos données.
              </span>
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              30 minutes pour comprendre comment Revold peut transformer votre approche revenue. Sans engagement.
            </p>

            <div className="mt-10 space-y-6">
              {[
                { title: "Vos données, pas un dataset fictif", desc: "On connecte votre CRM pendant la démo et vous voyez vos vrais KPIs en temps réel." },
                { title: "Personnalisé pour votre stack", desc: "HubSpot, Salesforce, Pipedrive, Stripe, Zendesk — on s'adapte à ce que vous utilisez." },
                { title: "Recommandations actionnables", desc: "Vous repartez avec un diagnostic de votre data quality et des actions prioritaires." },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4">
              {[
                { val: "30", unit: "min", desc: "de démo" },
                { val: "0", unit: "€", desc: "engagement" },
                { val: "<5", unit: "min", desc: "pour connecter" },
              ].map((m) => (
                <div key={m.desc} className="card p-4 text-center">
                  <p className="text-2xl font-black text-slate-900">{m.val}<span className="ml-0.5 text-sm font-bold text-accent">{m.unit}</span></p>
                  <p className="mt-1 text-[10px] text-slate-500">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div>
            {submitted ? (
              <div className="card flex flex-col items-center p-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h2 className="mt-6 text-2xl font-bold text-slate-900">Demande envoyée !</h2>
                <p className="mt-2 text-sm text-slate-500">Nous vous recontactons sous 24h pour planifier votre démo.</p>
                <Link href="/" className="mt-8 inline-block text-sm font-semibold text-accent hover:text-indigo-800">Retour à l&apos;accueil &rarr;</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="card space-y-5 p-8">
                <h2 className="text-xl font-bold text-slate-900">Réservez votre démo</h2>
                <p className="text-sm text-slate-500">Remplissez le formulaire, on revient vers vous sous 24h.</p>

                <input type="hidden" name="subject" value="Demande de démo Revold" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstname" className="mb-1.5 block text-sm font-medium text-slate-700">Prénom</label>
                    <input id="firstname" name="firstname" type="text" required className="w-full rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20" />
                  </div>
                  <div>
                    <label htmlFor="lastname" className="mb-1.5 block text-sm font-medium text-slate-700">Nom</label>
                    <input id="lastname" name="lastname" type="text" required className="w-full rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20" />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Email professionnel</label>
                  <input id="email" name="email" type="email" required className="w-full rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-slate-700">Téléphone</label>
                  <input id="phone" name="phone" type="tel" placeholder="+33 6 12 34 56 78" required className="w-full rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
                <div>
                  <label htmlFor="company" className="mb-1.5 block text-sm font-medium text-slate-700">Entreprise</label>
                  <input id="company" name="company" type="text" required className="w-full rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
                <div>
                  <label htmlFor="role" className="mb-1.5 block text-sm font-medium text-slate-700">Votre rôle</label>
                  <select id="role" name="role" required className="w-full rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20">
                    <option value="">Sélectionnez</option>
                    <option value="direction">Direction / CEO / COO</option>
                    <option value="sales">Sales / Directeur Commercial</option>
                    <option value="marketing">Marketing / CMO</option>
                    <option value="revops">RevOps / Sales Ops</option>
                    <option value="csm">CSM / Customer Success</option>
                    <option value="finance">Finance / DAF</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="crm" className="mb-1.5 block text-sm font-medium text-slate-700">CRM actuel</label>
                  <select id="crm" name="crm" required className="w-full rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20">
                    <option value="">Sélectionnez</option>
                    <option value="hubspot">HubSpot</option>
                    <option value="salesforce">Salesforce</option>
                    <option value="pipedrive">Pipedrive</option>
                    <option value="zoho">Zoho CRM</option>
                    <option value="autre">Autre</option>
                    <option value="aucun">Pas de CRM</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-slate-700">Votre message</label>
                  <textarea id="message" name="message" rows={3} required className="w-full rounded-lg border border-card-border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-60"
                >
                  {loading ? "Envoi en cours..." : "Réserver ma démo gratuite"}
                </button>
                <p className="text-center text-[10px] text-slate-400">En soumettant ce formulaire, vous acceptez notre <Link href="/legal/confidentialite" className="underline">politique de confidentialité</Link>.</p>
              </form>
            )}
          </div>
        </div>
      </div>

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
