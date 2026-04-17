import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Revold pour le CSM / Customer Success — Revenue Intelligence",
  description: "Revold aide les équipes Customer Success à détecter le churn avant qu'il n'arrive grâce au croisement tickets × paiements × activité CRM et des alertes proactives.",
};

export default function CSMPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-medium text-purple-700">CSM / Customer Success</div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Détectez le churn{" "}
            <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">avant vos clients.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">Rétention proactive grâce au croisement de signaux cross-source. Identifiez les comptes à risque avant le non-renouvellement et agissez au bon moment.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/demo" className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl">Faire une démo</Link>
            <Link href="/essai-gratuit" className="rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">Essai gratuit</Link>
          </div>
          <div className="mt-12 overflow-hidden rounded-xl border border-card-border shadow-2xl shadow-accent/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/dashboard-alertes.png" alt="Dashboard CSM Revold" className="w-full" />
          </div>
        </div>
      </section>

      {/* Pains */}
      <section className="border-y border-card-border bg-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">Les défis du Customer Success</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { pain: "Churn découvert au non-renouvellement", desc: "Vous apprenez qu'un client churne quand il refuse de renouveler. À ce stade, il est déjà trop tard pour agir." },
              { pain: "Pas de visibilité sur la santé client", desc: "Aucun indicateur fiable pour savoir si un compte va bien ou mal. L'intuition remplace les données, les surprises s'accumulent." },
              { pain: "Fiches clients incomplètes", desc: "Les informations sont dispersées entre CRM, outil de support et facturation. Impossible d'avoir une vue complète du client en un seul endroit." },
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
          <h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">Ce que Revold apporte au Customer Success</h2>
          <div className="mt-12 space-y-6">
            {[
              { title: "Croisement tickets × paiements × activité CRM", desc: "Revold croise les signaux de votre outil de support, vos données de paiement et l'activité CRM pour détecter les premiers signes de désengagement.", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
              { title: "Score de risque par compte", desc: "Chaque compte reçoit un score de risque calculé en temps réel. Vous savez immédiatement quels clients nécessitent votre attention en priorité.", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
              { title: "Alertes proactives sur comptes à fort MRR", desc: "Recevez une alerte dès qu'un compte stratégique montre des signaux de risque. Plus le MRR est élevé, plus l'alerte est prioritaire.", icon: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" },
              { title: "Vue unifiée du client", desc: "Grâce à l'entity resolution, Revold réconcilie toutes les données d'un même client entre CRM, support et facturation. Une seule fiche, zéro trou.", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
              { title: "Historique complet deal → onboarding → support", desc: "Visualisez le parcours complet du client : du premier deal à l'onboarding, en passant par chaque interaction support. Le contexte est toujours là.", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
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
              { val: "30j", desc: "prédiction churn avant" },
              { val: "/compte", desc: "score de risque" },
              { val: "Real-time", desc: "alertes temps réel" },
              { val: "360°", desc: "vue client unifiée" },
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
          <h2 className="text-3xl font-bold text-white">Prêt à anticiper le churn avant qu&apos;il ne soit trop tard ?</h2>
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
