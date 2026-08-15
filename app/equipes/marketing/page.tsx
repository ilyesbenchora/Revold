import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Revold pour le Marketing — Revenue Intelligence",
  description: "Revold donne au marketing une attribution cross-source complète : dépenses → pipeline → factures. Prouvez le ROI de chaque euro investi.",
};

export default function MarketingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-40 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-fuchsia-300">Marketing</div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
            Prouvez le ROI de chaque euro marketing{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">jusqu&apos;à la facture.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">Attribution cross-source de la dépense à la facture. Suivez chaque MQL jusqu&apos;aux revenus réellement encaissés et prouvez l&apos;impact de chaque campagne sur le chiffre d&apos;affaires.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/demo" className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl">Faire une démo</Link>
            <Link href="/essai-gratuit" className="rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10">Essai gratuit</Link>
          </div>
          <div className="mt-12 overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-fuchsia-500/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/dashboard-performances.png" alt="Dashboard Marketing Revold" className="w-full" />
          </div>
        </div>
      </section>

      {/* Pains */}
      <section className="border-y border-white/10 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">Les défis du Marketing</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { pain: "ROI impossible à prouver", desc: "Les dépenses marketing augmentent mais personne ne peut relier un euro investi au chiffre d'affaires généré. Le CFO doute, le budget est menacé." },
              { pain: "40% de leads invalides", desc: "Doublons, données incomplètes, leads hors cible. Votre équipe sales perd du temps et la confiance inter-équipes s'effrite." },
              { pain: "Attribution dernier clic", desc: "Votre modèle d'attribution ne capture qu'une fraction du parcours. Les canaux top-of-funnel sont systématiquement sous-évalués." },
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
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">Ce que Revold apporte au Marketing</h2>
          <div className="mt-12 space-y-6">
            {[
              { title: "Attribution cross-source", desc: "Reliez l'acquisition au pipeline généré puis aux factures réellement encaissées, grâce au rapprochement SIREN / SIRET / TVA entre CRM et facturation. De la campagne au CA, chaque euro est tracé.", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
              { title: "Coach Marketing IA 24/7", desc: "Un coach dédié à votre métier qui répond sur vos vraies données : quelles campagnes rapportent, où se perd le funnel, quoi tester ensuite. Jamais un chiffre inventé.", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
              { title: "Qualité des leads mesurée", desc: "Taux de conversion, doublons détectés, données manquantes remplies depuis la base Sirene. Améliorez la qualité avant de scaler le volume.", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
              { title: "Campagnes × facturation réelle", desc: "Chaque campagne est reliée au chiffre d'affaires réellement facturé, pas seulement aux opportunités créées. Vous savez ce qui rapporte vraiment.", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
              { title: "Routines & récaps programmés", desc: "Un récap marketing complet (tuiles, courbes, synthèses) généré à la fréquence de votre choix et livré automatiquement — même app fermée.", icon: "M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
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
              { val: "+40%", desc: "lead quality" },
              { val: "E2E", desc: "attribution end-to-end" },
              { val: "0", desc: "spreadsheet" },
              { val: "24/7", desc: "coach Marketing IA" },
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
          <h2 className="text-3xl font-bold text-white">Prêt à prouver le ROI de chaque campagne ?</h2>
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
