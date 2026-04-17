import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Revold pour les Sales / Direction Commerciale — Revenue Intelligence",
  description: "Revold aide les équipes commerciales à closer plus de deals avec le deal coaching IA, la détection de risque automatique et un forecast probabiliste fiable.",
};

export default function SalesPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-medium text-purple-700">Sales / Direction Commerciale</div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Closez plus de deals.{" "}
            <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">Perdez moins de temps.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">Deal coaching IA contextuel, détection de risque automatique et forecast probabiliste. Concentrez votre énergie sur les deals qui vont closer.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/demo" className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl">Faire une démo</Link>
            <Link href="/essai-gratuit" className="rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">Essai gratuit</Link>
          </div>
          <div className="mt-12 overflow-hidden rounded-xl border border-card-border shadow-2xl shadow-accent/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/dashboard-pipeline.png" alt="Dashboard Sales Revold" className="w-full" />
          </div>
        </div>
      </section>

      {/* Pains */}
      <section className="border-y border-card-border bg-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">Les défis des Sales</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { pain: "13h/sem perdues", desc: "Les commerciaux passent 13 heures par semaine à chercher l'information au lieu de vendre. CRM, emails, Slack, fichiers — tout est dispersé." },
              { pain: "61% de deals perdus par indécision", desc: "Les deals ne sont pas perdus face à un concurrent mais par indécision du prospect. Sans signaux de risque, vous réagissez trop tard." },
              { pain: "Forecast basé sur le feeling", desc: "Chaque commercial a sa propre lecture du pipeline. Le forecast est un exercice politique, pas une prévision fiable." },
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
          <h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">Ce que Revold apporte aux Sales</h2>
          <div className="mt-12 space-y-6">
            {[
              { title: "Pipeline Kanban temps réel", desc: "Visualisez l'ensemble de votre pipeline avec les montants, probabilités et dates de close mis à jour automatiquement depuis votre CRM.", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" },
              { title: "Détection de risque automatique", desc: "3 signaux de risque analysés en continu : stagnation de stage, absence de next step, engagement en baisse. Vous êtes alerté avant que le deal ne décroche.", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
              { title: "Deal coaching IA contextuel", desc: "Pour chaque deal, l'IA analyse les données cross-source et suggère les prochaines actions : qui contacter, quel argument utiliser, quand relancer.", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
              { title: "Forecast probabiliste", desc: "Prévisions basées sur vos probabilités par stage × historique win rate × données de facturation réelles. Fini le forecast au doigt mouillé.", icon: "M3 3v18h18M7 16l4-8 4 4 4-8" },
              { title: "Sales Engine Score", desc: "Un score global qui évalue la santé de votre machine commerciale : vélocité, win rate, couverture pipeline, qualité des données CRM.", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
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
              { val: "+17%", desc: "win rate" },
              { val: "-22%", desc: "cycle de vente" },
              { val: "±7%", desc: "forecast" },
              { val: "3", desc: "signaux de risque auto" },
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
          <h2 className="text-3xl font-bold text-white">Prêt à closer plus de deals avec moins d&apos;effort ?</h2>
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
