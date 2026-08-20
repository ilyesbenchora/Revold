"use client";

import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { useState, type FormEvent } from "react";

const INPUT_CLASS =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-slate-300";

export default function EssaiGratuitPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFailed(false);
    const body = new FormData(e.currentTarget);
    body.set("_form", "essai-gratuit");
    const res = await fetch("/api/site-forms", { method: "POST", body }).catch(() => null);
    setLoading(false);
    if (res?.ok) setSubmitted(true);
    else setFailed(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />

      <div className="relative flex flex-1 items-start justify-center overflow-hidden">
        {/* Halos cockpit */}
        <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-40 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
          {/* Left — pitch */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-300">
              14 jours gratuits — sans carte bancaire
            </div>
            <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
              Essayez Revold{" "}
              <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                gratuitement.
              </span>
            </h1>
            <p className="mt-4 text-lg text-slate-400">
              Connectez vos outils en moins de 5 minutes : Revold rapproche vos données par SIREN / SIRET / TVA et votre équipe IA se met au travail. Aucune carte bancaire requise.
            </p>

            <div className="mt-10 space-y-6">
              {[
                { title: "Prêt en 5 minutes", desc: "HubSpot en un clic (OAuth), Stripe, Pennylane, Chargebee, GoCardless et Sage par clé API — ou import Excel / Google Sheets. Aucune configuration technique." },
                { title: "14 jours de toutes les fonctionnalités", desc: "Rapprochement SIREN/TVA + enrichissement Sirene, équipe IA 24/7, routines & récaps, alertes au câblage vérifié, tour de contrôle vocale — tout est inclus." },
                { title: "Vos données restent les vôtres", desc: "Accès en lecture seule, révocable à tout moment. Suppression complète sous 30 jours si vous ne continuez pas. RGPD compliant." },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4">
              {[
                { val: "14", unit: "jours", desc: "d'essai gratuit" },
                { val: "0", unit: "€", desc: "carte bancaire" },
                { val: "6", unit: "outils", desc: "connecteurs natifs + Excel/Sheets" },
              ].map((m) => (
                <div key={m.desc} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
                  <p className="text-2xl font-black text-white">{m.val}<span className="ml-0.5 text-sm font-bold text-fuchsia-300">{m.unit}</span></p>
                  <p className="mt-1 text-[10px] text-slate-400">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div>
            {submitted ? (
              <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h2 className="mt-6 text-2xl font-bold text-white">Demande envoyée !</h2>
                <p className="mt-2 text-sm text-slate-400">Nous vous recontactons sous 24h pour activer votre essai gratuit.</p>
                <Link href="/" className="mt-8 inline-block text-sm font-semibold text-fuchsia-300 transition hover:text-fuchsia-200">Retour à l&apos;accueil &rarr;</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
              <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              {failed && (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">L&apos;envoi a échoué — réessaie dans un instant.</p>
              )}
                <h2 className="text-xl font-bold text-white">Créez votre compte</h2>
                <p className="text-sm text-slate-400">Commencez votre essai gratuit de 14 jours.</p>

                <input type="hidden" name="subject" value="Essai gratuit Revold" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstname" className={LABEL_CLASS}>Prénom</label>
                    <input id="firstname" name="firstname" type="text" required className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label htmlFor="lastname" className={LABEL_CLASS}>Nom</label>
                    <input id="lastname" name="lastname" type="text" required className={INPUT_CLASS} />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className={LABEL_CLASS}>Email professionnel</label>
                  <input id="email" name="email" type="email" required className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor="phone" className={LABEL_CLASS}>Téléphone</label>
                  <input id="phone" name="phone" type="tel" placeholder="+33 6 12 34 56 78" required className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor="company" className={LABEL_CLASS}>Entreprise</label>
                  <input id="company" name="company" type="text" required className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor="crm" className={LABEL_CLASS}>CRM actuel</label>
                  <select id="crm" name="crm" required className={INPUT_CLASS}>
                    <option value="">Sélectionnez</option>
                    <option value="hubspot">HubSpot (connexion en 1 clic)</option>
                    <option value="salesforce">Salesforce (connecteur bientôt)</option>
                    <option value="pipedrive">Pipedrive (connecteur bientôt)</option>
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
                <p className="text-center text-[10px] text-slate-500">En créant votre compte, vous acceptez nos <Link href="/legal/cgu" className="underline">CGU</Link> et notre <Link href="/legal/confidentialite" className="underline">politique de confidentialité</Link>.</p>
              </form>
            )}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
