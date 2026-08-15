import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Revold pour la Finance / DAF — Revenue Intelligence",
  description: "Revold réconcilie automatiquement pipeline CRM et revenus facturés par SIREN/TVA. MRR/ARR temps réel, projection pondérée de trésorerie, échéances fiscales et relances d'impayés exécutées.",
};

export default function FinancePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-40 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-fuchsia-300">Finance / DAF</div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
            Réconciliez pipeline et revenus{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">automatiquement.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">MRR/ARR calculés en temps réel depuis Stripe et Pennylane, trésorerie en projection pondérée et réconciliation automatique par SIREN / TVA. Fini les tableurs et les écarts inexpliqués.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/demo" className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl">Faire une démo</Link>
            <Link href="/essai-gratuit" className="rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10">Essai gratuit</Link>
          </div>
          <div className="mt-12 overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-fuchsia-500/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/dashboard-overview.png" alt="Dashboard Finance Revold" className="w-full" />
          </div>
        </div>
      </section>

      {/* Pains */}
      <section className="border-y border-white/10 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">Les défis de la Finance</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { pain: "Écart permanent CRM vs facturation", desc: "Le CRM annonce un montant, la facturation en confirme un autre. L'écart est chronique et personne ne sait d'où il vient." },
              { pain: "MRR/ARR calculés manuellement", desc: "Chaque mois, vous recalculez le MRR dans un tableur en croisant abonnements, upgrades, downgrades et churns. Processus fragile et chronophage." },
              { pain: "Réconciliation mensuelle chronophage", desc: "Rapprocher deals CRM et factures prend des jours. Les erreurs se glissent, les écarts s'accumulent et le board pose des questions." },
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
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">Ce que Revold apporte à la Finance</h2>
          <div className="mt-12 space-y-6">
            {[
              { title: "MRR/ARR/churn rate temps réel", desc: "Calculés automatiquement depuis Stripe et Pennylane croisés avec votre CRM. Nouveaux clients, upgrades, downgrades, churns — tout est ventilé en temps réel.", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
              { title: "Pipeline vs facturation réelle", desc: "Visualisez l'écart entre ce que le CRM promet et ce que la facturation confirme. Par mois, par trimestre, par commercial. Zéro ambiguïté.", icon: "M3 3v18h18M7 16l4-8 4 4 4-8" },
              { title: "Trésorerie en projection pondérée", desc: "Encaissements attendus pondérés par leur probabilité, croisés avec vos échéances fiscales (TVA, IS, URSSAF). Vous voyez venir les tensions de trésorerie avant qu'elles n'arrivent.", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
              { title: "Réconciliation automatique factures × deals", desc: "Revold rapproche automatiquement chaque facture avec le deal CRM correspondant grâce au rapprochement SIREN / SIRET / TVA. Les écarts sont identifiés et expliqués.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
              { title: "Relances d'impayés exécutées", desc: "Facture en retard détectée → rappel Stripe officiel proposé. Vous validez, la relance part — et chaque euro récupéré est attribué, ligne par ligne, en euros.", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
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
              { val: "Temps réel", desc: "MRR/ARR calculés" },
              { val: "0", desc: "réconciliation manuelle" },
              { val: "CRM↔Fact", desc: "pipeline vs facturé" },
              { val: "€", desc: "cash récupéré attribué" },
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
          <h2 className="text-3xl font-bold text-white">Prêt à réconcilier pipeline et facturation automatiquement ?</h2>
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
