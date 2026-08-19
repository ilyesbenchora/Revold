"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { PLANS } from "@/lib/billing/plans";

/**
 * Home du site public — thème SOMBRE cockpit (même fond nuit que la tour de
 * contrôle de l'app) : slate-950, halos fuchsia/indigo/ambre, contenu aligné
 * sur le produit RÉEL (rapprochement Sirene, équipe IA 24/7, routines,
 * actions human-in-the-loop, tour de contrôle vocale, câblage vérifié).
 */

const ROTATING_WORDS = ["rapproche", "surveille", "pilote", "audite", "unifie", "fiabilise"];

function RotatingWord() {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
        setFade(true);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`inline-block bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent transition-all duration-300 ${fade ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
      style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
    >
      {ROTATING_WORDS[index]}
    </span>
  );
}

/* ─────────────── DATA ─────────────── */

const INTEGRATIONS = ["HubSpot", "Stripe", "Pennylane", "Chargebee", "GoCardless", "Sage"];

const FEATURES = [
  {
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    title: "Rapprochement de données à la française",
    desc: "SIREN, SIRET, N° TVA : Revold relie vos entreprises entre CRM, facturation et compta — et REMPLIT lui-même la donnée officielle manquante (identifiants, effectifs, CA, statut juridique, adresse du siège) depuis Sirene et l'INPI, jusque dans votre CRM.",
    href: "/produits/resolution-entites",
  },
  {
    icon: "M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7zM10 21v1a2 2 0 0 0 4 0v-1",
    title: "Mon équipe IA, disponible 24/7",
    desc: "Des agents experts par domaine (performance, trésorerie, service client, qualité des données), à briefer par écrit ou à la voix. Chaque chiffre affiché est câblé sur vos vraies données — jamais inventé.",
    href: "/produits/insights-ia",
  },
  {
    icon: "M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
    title: "Routines & récaps sur mesure",
    desc: "Choisissez la période (semaine → année) et les KPIs macro à couvrir : l'agent génère un récap complet (tuiles, courbes, donuts, synthèses), validé en aperçu, puis livré automatiquement — même app fermée.",
    href: "/produits/reporting-cross-source",
  },
  {
    icon: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
    title: "Actions exécutées dans vos outils",
    desc: "Deal silencieux depuis 21 jours → tâche HubSpot. Facture en retard → rappel Stripe officiel. Revold détecte, vous validez, l'action s'exécute — et chaque euro récupéré est attribué, ligne par ligne.",
    href: "/produits/alertes-previsions",
  },
  {
    icon: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
    title: "Tour de contrôle vocale",
    desc: "Une orbe sur votre accueil : demandez votre brief du jour à la voix (alertes en tension, objectifs, impayés, vos KPIs personnalisés), naviguez et créez des alertes en parlant. L'anneau de santé dit tout d'un coup d'œil.",
    href: "/produits/insights-ia",
  },
  {
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    title: "Alertes & objectifs au câblage vérifié",
    desc: "Avant de créer une alerte ou un objectif, Revold montre la donnée réellement suivie, l'outil source et la valeur actuelle calculée — la preuve chiffrée d'abord, le suivi automatique ensuite.",
    href: "/produits/alertes-previsions",
  },
];

const PERSONAS = [
  { role: "Direction / CEO", pain: "Croissance qui ralentit, sans comprendre pourquoi ni où agir", gain: "Brief vocal quotidien, KPIs câblés en temps réel et actions priorisées validées en un clic" },
  { role: "Sales / Directeur Commercial", pain: "Forecast au feeling, deals qui meurent en silence", gain: "Détection des deals silencieux → tâche HubSpot créée, projection pondérée du pipeline" },
  { role: "Marketing", pain: "Impossible de prouver le ROI jusqu'à la facture", gain: "Attribution cross-source : acquisition → pipeline → factures réellement encaissées" },
  { role: "RevOps", pain: "Des jours à compiler des rapports, données incohérentes entre outils", gain: "Rapprochement SIREN/TVA automatique, KPIs vérifiés sur données réelles, récaps de routine" },
  { role: "CSM / Customer Success", pain: "Aucune visibilité sur les signaux de churn avant qu'il soit trop tard", gain: "Croisement tickets × paiements × activité CRM, agent service client dédié et alertes câblées" },
  { role: "Finance / DAF", pain: "Écart permanent entre pipeline CRM et cash réellement encaissé", gain: "Trésorerie temps réel, relances d'impayés exécutées et cash récupéré attribué en euros" },
];

const STEPS = [
  { n: "1", title: "Connectez vos outils", desc: "HubSpot en un clic (OAuth), Stripe, Pennylane, Chargebee, GoCardless, Sage par clé API. Lecture seule, révocable à tout moment." },
  { n: "2", title: "Revold rapproche et fiabilise", desc: "Entités reliées par SIREN / SIRET / TVA / email, identifiants manquants remplis depuis la base Sirene, écarts CRM vs facturé chiffrés en euros." },
  { n: "3", title: "Votre équipe IA agit", desc: "Récaps de routine, alertes câblées, brief vocal — et des actions validées par vous, exécutées directement dans vos outils, avec l'impact mesuré." },
];

/* ─────────────── PAGE ─────────────── */

export default function HomePage() {
  const plans = [PLANS.starter, PLANS.growth, PLANS.scale];
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNavbar />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden">
        {/* Halos cockpit */}
        <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-40 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-amber-400/5 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 text-center sm:px-6 md:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Revenue Intelligence made in France
          </span>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
            Revold <RotatingWord /> votre revenue,
            <br className="hidden md:block" /> du CRM au compte en banque.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
            La seule plateforme qui relie votre CRM, votre facturation et votre compta par
            SIREN / SIRET / TVA, vous donne une équipe d&apos;agents IA disponible 24/7 — et exécute les
            actions validées directement dans vos outils.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/essai-gratuit" className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40 sm:w-auto">
              Essai gratuit 14 jours
            </Link>
            <Link href="/demo" className="w-full rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 sm:w-auto">
              Demander une démo
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">Sans carte bancaire · Connexion HubSpot en un clic · Données hébergées en UE</p>

          {/* Intégrations natives réelles */}
          <div className="mx-auto mt-14 max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Connecteurs natifs, câblés en profondeur</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              {INTEGRATIONS.map((name) => (
                <span key={name} className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-300">
                  {name}
                </span>
              ))}
              <span className="rounded-full border border-dashed border-white/15 px-4 py-1.5 text-sm text-slate-500">Excel / Sheets · Slack · Teams…</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="relative border-t border-white/10 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">Une plateforme qui ferme la boucle</h2>
            <p className="mt-4 text-slate-400">
              Constater ne suffit pas. Revold rapproche, corrige, alerte — et exécute les actions que vous validez,
              avec l&apos;impact mesuré en euros.
            </p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Link
                key={f.title}
                href={f.href}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-600/20 text-fuchsia-300 ring-1 ring-white/10">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-white transition group-hover:text-fuchsia-300">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ COMMENT ÇA MARCHE ═══ */}
      <section className="relative border-t border-white/10 py-20">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">Opérationnel en une matinée</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PERSONAS ═══ */}
      <section className="relative border-t border-white/10 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">Pensé pour chaque métier du revenue</h2>
            <p className="mt-4 text-slate-400">Des espaces de travail par pôle : chaque équipe voit ses pages, ses agents et ses KPIs.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PERSONAS.map((p) => (
              <div key={p.role} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-fuchsia-300">{p.role}</h3>
                <p className="mt-3 text-sm text-slate-500">
                  <span className="font-semibold text-slate-400">Avant : </span>{p.pain}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  <span className="font-semibold text-emerald-400">Avec Revold : </span>{p.gain}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING TEASER ═══ */}
      <section className="relative border-t border-white/10 py-20">
        <div className="pointer-events-none absolute left-0 bottom-0 h-72 w-72 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">Un tarif simple, un essai sans risque</h2>
            <p className="mt-4 text-slate-400">14 jours d&apos;essai gratuit sur tous les plans, sans carte bancaire.</p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-3">
            {plans.map((p) => (
              <Link
                key={p.key}
                href="/tarifs"
                className={`rounded-2xl border p-6 transition ${
                  p.featured
                    ? "border-fuchsia-400/50 bg-gradient-to-b from-fuchsia-500/10 to-indigo-600/10 shadow-lg shadow-fuchsia-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <p className="text-sm font-bold text-white">{p.name}</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {p.key === "scale" && <span className="text-sm font-medium text-slate-400">dès </span>}
                  {p.monthlyPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}&nbsp;€
                  <span className="text-sm font-medium text-slate-400"> HT/mois</span>
                </p>
                <p className="mt-2 text-xs text-slate-400">{p.description}</p>
                {p.featured && (
                  <span className="mt-3 inline-block rounded-full bg-fuchsia-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">
                    Recommandé
                  </span>
                )}
              </Link>
            ))}
          </div>
          <p className="mt-6 text-center">
            <Link href="/tarifs" className="text-sm font-medium text-fuchsia-300 transition hover:text-fuchsia-200">
              Comparer les plans en détail →
            </Link>
          </p>
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section className="relative overflow-hidden border-t border-white/10 py-24">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-[50rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-fuchsia-600/15 via-purple-600/15 to-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            La vérité revenue de votre entreprise, en une matinée.
          </h2>
          <p className="mt-4 text-slate-400">
            Connectez HubSpot, Stripe ou Pennylane et voyez immédiatement ce que vos outils ne vous disent pas.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/essai-gratuit" className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40 sm:w-auto">
              Démarrer l&apos;essai gratuit
            </Link>
            <Link href="/contact" className="w-full rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 sm:w-auto">
              Parler à l&apos;équipe
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
