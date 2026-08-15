import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Revold pour RevOps / Sales Ops — Revenue Intelligence",
  description: "Revold automatise les récaps cross-source, fiabilise les données par rapprochement SIREN/SIRET/TVA et enrichissement Sirene. Arrêtez la plomberie data, pilotez la stratégie.",
};

export default function RevOpsPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-40 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-fuchsia-300">RevOps / Sales Ops</div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
            Arrêtez la plomberie data.{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">Pilotez la stratégie.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">Récaps automatisés cross-source, qualité des données garantie par rapprochement SIREN / SIRET / TVA et enrichissement Sirene. Libérez-vous de l&apos;opérationnel pour vous concentrer sur la stratégie.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/demo" className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl">Faire une démo</Link>
            <Link href="/essai-gratuit" className="rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10">Essai gratuit</Link>
          </div>
          <div className="mt-12 overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-fuchsia-500/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/dashboard-overview.png" alt="Dashboard RevOps Revold" className="w-full" />
          </div>
        </div>
      </section>

      {/* Pains */}
      <section className="border-y border-white/10 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">Les défis des RevOps</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { pain: "2 jours/mois à compiler des rapports", desc: "Exports CSV, copier-coller entre outils, formules Excel fragiles. Votre temps est absorbé par la plomberie data au lieu de l'analyse stratégique." },
              { pain: "Données incohérentes entre outils", desc: "CRM, facturation, compta — chaque outil a ses propres chiffres. Impossible de savoir quelle source de vérité utiliser." },
              { pain: "87% trouvent l'adhésion au process difficile", desc: "Les équipes contournent les process, les champs obligatoires sont ignorés, la qualité des données se dégrade semaine après semaine." },
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
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">Ce que Revold apporte aux RevOps</h2>
          <div className="mt-12 space-y-6">
            {[
              { title: "Rapprochement SIREN / SIRET / TVA", desc: "Vos entreprises sont reliées entre CRM, facturation et compta par leurs identifiants officiels. Les identifiants manquants sont remplis automatiquement depuis la base Sirene, à valider en un clic.", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
              { title: "Routines & récaps programmés", desc: "Choisissez la période et les KPIs à couvrir : l'agent génère un récap complet (tuiles, courbes, synthèses), validé en aperçu puis livré automatiquement. Plus jamais un export CSV.", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
              { title: "Audit qualité automatique", desc: "Détection continue des champs vides, identifiants manquants, doublons et incohérences entre sources. Vous savez exactement où agir pour améliorer la qualité.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
              { title: "KPIs au câblage vérifié", desc: "Avant de créer un KPI, une alerte ou un objectif, Revold montre la donnée réellement suivie, l'outil source et la valeur actuelle calculée. Toujours à jour, jamais inventé.", icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" },
              { title: "Connecteurs natifs + import Excel/Sheets", desc: "HubSpot (OAuth en 1 clic), Stripe, Pennylane, Chargebee, GoCardless, Sage — et import Excel / Google Sheets pour les sources sans connecteur. Lecture seule, révocable à tout moment.", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
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
              { val: "6", desc: "connecteurs natifs + Excel/Sheets" },
              { val: "SIREN", desc: "rapprochement officiel + Sirene" },
              { val: "0", desc: "export manuel" },
              { val: "24/7", desc: "agents IA sur vos données" },
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
          <h2 className="text-3xl font-bold text-white">Prêt à automatiser votre stack RevOps ?</h2>
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
