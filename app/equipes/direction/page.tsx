import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Revold pour la Direction / CEO — Revenue Intelligence",
  description: "Revold donne à la direction une visibilité complète sur la performance commerciale : forecast fiable, scores de santé, insights actionnables et prévisions financières.",
};

export default function DirectionPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-medium text-purple-700">Direction / CEO</div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Prenez des décisions revenue{" "}
            <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">basées sur les données.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">Fini les forecasts basés sur le feeling. Revold vous donne une vision 360° de votre performance avec des scores de santé, des prévisions fiables et des actions priorisées.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/demo" className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl">Faire une démo</Link>
            <Link href="/essai-gratuit" className="rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">Essai gratuit</Link>
          </div>
          <div className="mt-12 overflow-hidden rounded-xl border border-card-border shadow-2xl shadow-accent/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/dashboard-overview.png" alt="Dashboard Direction Revold" className="w-full" />
          </div>
        </div>
      </section>

      {/* Pains */}
      <section className="border-y border-card-border bg-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">Les défis de la Direction</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { pain: "Forecast imprécis", desc: "Les prévisions changent chaque semaine. 55% des sales leaders n'ont pas confiance dans leur forecast." },
              { pain: "Pas de vue unifiée", desc: "Chaque équipe a ses propres chiffres, ses propres dashboards. Impossible d'avoir la vérité en un coup d'oeil." },
              { pain: "Décisions à l'aveugle", desc: "La croissance ralentit mais personne ne sait pourquoi ni où agir. Les rapports arrivent trop tard." },
            ].map((p) => (
              <div key={p.pain} className="card p-6">
                <p className="font-semibold text-red-500">{p.pain}</p>
                <p className="mt-2 text-sm text-slate-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What Revold brings */}
      <section className="bg-background py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">Ce que Revold apporte à la Direction</h2>
          <div className="mt-12 space-y-6">
            {[
              { title: "Dashboard exécutif unifié", desc: "3 scores de santé (Sales, Marketing, CRM) + 14 KPIs temps réel + tendances historiques. Une seule source de vérité pour votre board.", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
              { title: "Forecast probabiliste", desc: "Prévisions basées sur vos probabilités par stage × historique win rate × données de facturation réelles. Variance réduite de ±18% à ±7%.", icon: "M3 3v18h18M7 16l4-8 4 4 4-8" },
              { title: "Revenue réel vs prévu", desc: "Croisement pipeline CRM × factures Stripe/Pennylane. Vous voyez l'écart entre ce que le CRM promet et ce que la facturation confirme.", icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
              { title: "Insights IA actionnables", desc: "L'IA analyse vos données cross-source et produit des recommandations priorisées : où agir, pourquoi, quel impact attendu.", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
              { title: "Alertes proactives", desc: "Notification quand un indicateur se dégrade : pipeline qui shrink, win rate en baisse, churn en hausse. Vous agissez avant l'impact.", icon: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" },
            ].map((f) => (
              <div key={f.title} className="card flex gap-5 p-6 transition hover:shadow-lg hover:shadow-accent/5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon} /></svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className="border-y border-card-border bg-white py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">Impact mesurable</h2>
          <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { val: "±7%", desc: "de variance forecast" },
              { val: "3", desc: "scores de santé temps réel" },
              { val: "0", desc: "exports manuels" },
              { val: "<5 min", desc: "pour être opérationnel" },
            ].map((m) => (
              <div key={m.desc} className="text-center">
                <p className="text-3xl font-black text-slate-900">{m.val}</p>
                <p className="mt-2 text-xs text-slate-500">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Prêt à piloter votre croissance avec confiance ?</h2>
          <p className="mx-auto mt-4 max-w-xl text-purple-100">30 minutes de démo sur vos données. Sans engagement.</p>
          <Link href="/demo" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-purple-600 shadow-lg transition hover:bg-purple-50">
            Faire une démo
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </Link>
        </div>
      </section>
    </>
  );
}
