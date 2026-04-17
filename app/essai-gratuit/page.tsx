"use client";

import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";
import { useState, type FormEvent } from "react";

export default function EssaiGratuitPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    await fetch("https://formspree.io/f/xvzdgvwn", {
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
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700">
              14 jours gratuits — sans carte bancaire
            </div>
            <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-4xl">
              Essayez Revold{" "}
              <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
                gratuitement.
              </span>
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Connectez votre CRM en moins de 5 minutes. Vos premiers insights et KPIs sont prêts instantanément. Aucune carte bancaire requise.
            </p>

            <div className="mt-10 space-y-6">
              {[
                { title: "Prêt en 5 minutes", desc: "Connectez HubSpot, Salesforce ou Pipedrive via OAuth2. Aucune configuration technique." },
                { title: "14 jours de toutes les fonctionnalités", desc: "Dashboard, KPIs, insights IA, détection de risque, deal coaching — tout est inclus." },
                { title: "Vos données restent les vôtres", desc: "Suppression complète sous 30 jours si vous ne continuez pas. RGPD compliant." },
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
                { val: "14", unit: "jours", desc: "d'essai gratuit" },
                { val: "0", unit: "€", desc: "carte bancaire" },
                { val: "80+", unit: "rapports", desc: "dès la connexion" },
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
                <p className="mt-2 text-sm text-slate-500">Nous vous recontactons sous 24h pour activer votre essai gratuit.</p>
                <Link href="/" className="mt-8 inline-block text-sm font-semibold text-accent hover:text-indigo-800">Retour à l&apos;accueil &rarr;</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="card space-y-5 p-8">
                <h2 className="text-xl font-bold text-slate-900">Créez votre compte</h2>
                <p className="text-sm text-slate-500">Commencez votre essai gratuit de 14 jours.</p>

                <input type="hidden" name="subject" value="Essai gratuit Revold" />

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
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-60"
                >
                  {loading ? "Création en cours..." : "Démarrer mon essai gratuit"}
                </button>
                <p className="text-center text-[10px] text-slate-400">En créant votre compte, vous acceptez nos <Link href="/legal/cgu" className="underline">CGU</Link> et notre <Link href="/legal/confidentialite" className="underline">politique de confidentialité</Link>.</p>
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
