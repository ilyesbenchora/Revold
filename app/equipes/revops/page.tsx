import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Revold pour RevOps / Sales Ops — Revenue Intelligence",
  description: "Revold automatise le reporting cross-source, garantit la qualité des données et standardise les process revenue. Arrêtez la plomberie data, pilotez la stratégie.",
};

export default function RevOpsPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-medium text-purple-700">RevOps / Sales Ops</div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Arrêtez la plomberie data.{" "}
            <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">Pilotez la stratégie.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">Reporting automatisé cross-source, qualité des données garantie par entity resolution et process standardisés. Libérez-vous de l&apos;opérationnel pour vous concentrer sur la stratégie.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/demo" className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl">Faire une démo</Link>
            <Link href="/essai-gratuit" className="rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">Essai gratuit</Link>
          </div>
          <div className="mt-12 overflow-hidden rounded-xl border border-card-border shadow-2xl shadow-accent/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/dashboard-overview.png" alt="Dashboard RevOps Revold" className="w-full" />
          </div>
        </div>
      </section>

      {/* Pains */}
      <section className="border-y border-card-border bg-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">Les défis des RevOps</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { pain: "2 jours/mois à compiler des rapports", desc: "Exports CSV, copier-coller entre outils, formules Excel fragiles. Votre temps est absorbé par la plomberie data au lieu de l'analyse stratégique." },
              { pain: "Données incohérentes entre outils", desc: "CRM, facturation, marketing automation — chaque outil a ses propres chiffres. Impossible de savoir quelle source de vérité utiliser." },
              { pain: "87% trouvent l'adhésion au process difficile", desc: "Les équipes contournent les process, les champs obligatoires sont ignorés, la qualité des données se dégrade semaine après semaine." },
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
          <h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">Ce que Revold apporte aux RevOps</h2>
          <div className="mt-12 space-y-6">
            {[
              { title: "80+ rapports auto cross-source", desc: "Rapports générés automatiquement en croisant CRM, facturation, marketing et support. Plus jamais un export CSV ou une formule Excel cassée.", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
              { title: "Entity resolution 7 méthodes", desc: "Dédupliquez et réconciliez vos contacts et comptes avec 7 méthodes de matching : email, domaine, nom, téléphone, SIREN, fuzzy et custom.", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
              { title: "Audit CRM automatique", desc: "Détection continue des champs vides, données obsolètes, doublons et incohérences. Vous savez exactement où agir pour améliorer la qualité.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
              { title: "14 KPIs calculés quotidiennement", desc: "Pipeline velocity, win rate, cycle de vente, MRR, churn rate et 9 autres KPIs calculés chaque jour automatiquement. Toujours à jour, sans intervention.", icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" },
              { title: "9 règles de résolution configurables", desc: "Définissez vos propres règles de priorité entre sources de données. Quand CRM et facturation divergent, Revold sait quelle valeur retenir.", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
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
              { val: "80+", desc: "rapports auto" },
              { val: "7", desc: "méthodes de matching" },
              { val: "0", desc: "export manuel" },
              { val: "14", desc: "KPIs /jour" },
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
