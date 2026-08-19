import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Revold pour la Direction / CEO — Revenue Intelligence",
  description: "Revold donne à la direction une visibilité complète sur la performance commerciale : KPIs câblés en temps réel, brief vocal quotidien, alertes vérifiées et actions priorisées validées en un clic.",
};

export default function DirectionPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-40 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-fuchsia-300">Direction / CEO</div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
            Prenez des décisions revenue{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">basées sur les données.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">Fini le pilotage au feeling. Revold relie CRM, facturation et compta par SIREN / SIRET / TVA, vous donne un brief vocal quotidien et des actions priorisées, validées en un clic.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/demo" className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl">Faire une démo</Link>
            <Link href="/essai-gratuit" className="rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10">Essai gratuit</Link>
          </div>
          <div className="mt-12 overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-fuchsia-500/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/dashboard-overview.png" alt="Dashboard Direction Revold" className="w-full" />
          </div>
        </div>
      </section>

      {/* Pains */}
      <section className="border-y border-white/10 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">Les défis de la Direction</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { pain: "Prévisions au feeling", desc: "Les chiffres changent chaque semaine selon qui les présente. 55% des sales leaders n'ont pas confiance dans leur forecast." },
              { pain: "Pas de vue unifiée", desc: "Chaque équipe a ses propres chiffres, ses propres dashboards. Impossible d'avoir la vérité en un coup d'oeil." },
              { pain: "Décisions à l'aveugle", desc: "La croissance ralentit mais personne ne sait pourquoi ni où agir. Les rapports arrivent trop tard." },
            ].map((p) => (
              <div key={p.pain} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <p className="font-semibold text-red-400">{p.pain}</p>
                <p className="mt-2 text-sm text-slate-400">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What Revold brings */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">Ce que Revold apporte à la Direction</h2>
          <div className="mt-12 space-y-6">
            {[
              { title: "Tour de contrôle vocale", desc: "Demandez votre brief du jour à la voix : alertes en tension, objectifs, impayés, vos KPIs personnalisés. L'anneau de santé dit tout d'un coup d'œil.", icon: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" },
              { title: "KPIs câblés en temps réel", desc: "Une seule source de vérité pour votre board : chaque chiffre affiché est relié à l'outil source et recalculé en déterministe — jamais inventé par l'IA.", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
              { title: "Revenue réel vs prévu", desc: "Croisement pipeline CRM × factures Stripe/Pennylane, rapprochées par SIREN / SIRET / TVA. Vous voyez l'écart entre ce que le CRM promet et ce que la facturation confirme.", icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
              { title: "Équipe IA 24/7", desc: "Des agents experts par domaine, pilotables à la voix depuis la tour de contrôle, analysent vos données cross-source et produisent des recommandations priorisées : où agir, pourquoi, quel impact attendu.", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
              { title: "Actions validées, exécutées dans vos outils", desc: "Deal silencieux → tâche HubSpot. Facture en retard → rappel Stripe. Vous validez, l'action s'exécute — et chaque euro récupéré est attribué, ligne par ligne.", icon: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" },
            ].map((f) => (
              <div key={f.title} className="flex gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-600/20 ring-1 ring-white/10">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-fuchsia-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon} /></svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className="border-y border-white/10 bg-white/[0.02] py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">Impact mesurable</h2>
          <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { val: "24/7", desc: "équipe IA disponible" },
              { val: "100%", desc: "des chiffres câblés" },
              { val: "0", desc: "exports manuels" },
              { val: "<5 min", desc: "pour être opérationnel" },
            ].map((m) => (
              <div key={m.desc} className="text-center">
                <p className="text-3xl font-black text-white">{m.val}</p>
                <p className="mt-2 text-xs text-slate-400">{m.desc}</p>
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
