"use client";

import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { useState, type FormEvent } from "react";

const INPUT_CLASS =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-slate-300";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    await fetch("https://formspree.io/f/xwpbvzad", {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    });
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-0 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-20 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-2xl px-6 pb-16 pt-16 text-center md:pt-24">
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl">Contactez-nous</h1>
          <p className="mt-4 text-lg text-slate-400">Une question, une demande de démo ou un projet de partenariat ? On vous répond sous 24h.</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-xl px-6 pb-24">
        {submitted ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h2 className="mt-6 text-xl font-bold text-white">Message envoyé !</h2>
            <p className="mt-2 text-sm text-slate-400">Nous reviendrons vers vous dans les plus brefs délais.</p>
            <Link href="/" className="mt-6 inline-block text-sm font-semibold text-fuchsia-300 transition hover:text-fuchsia-200">Retour à l&apos;accueil &rarr;</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <div>
              <label htmlFor="name" className={LABEL_CLASS}>Nom</label>
              <input id="name" name="name" type="text" required className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="email" className={LABEL_CLASS}>Email</label>
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
              <label htmlFor="subject" className={LABEL_CLASS}>Sujet</label>
              <select id="subject" name="subject" required className={INPUT_CLASS}>
                <option value="">Sélectionnez un sujet</option>
                <option value="demo">Demande de démo</option>
                <option value="question">Question produit</option>
                <option value="partenariat">Partenariat</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label htmlFor="message" className={LABEL_CLASS}>Message</label>
              <textarea id="message" name="message" rows={5} required className={INPUT_CLASS} />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-60"
            >
              {loading ? "Envoi en cours..." : "Envoyer le message"}
            </button>
          </form>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
