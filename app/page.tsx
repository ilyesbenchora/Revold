"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";

const ROTATING_WORDS = ["surveille", "boost", "pilote", "audite", "unifie", "fiabilise"];

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
      className={`inline-block bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent transition-all duration-300 ${fade ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
      style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
    >
      {ROTATING_WORDS[index]}
    </span>
  );
}

/* ─────────────── DATA ─────────────── */

const FEATURES = [
  { icon: "M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3", title: "Synchronisation de données", desc: "Connecteurs natifs pour vos CRM, outils de facturation, support et projet. Sync bidirectionnelle toutes les 6h avec monitoring en temps réel.", href: "/produits/synchronisation" },
  { icon: "M3 3v18h18M7 16l4-8 4 4 4-8", title: "Reporting cross-source", desc: "80+ rapports pré-configurés. Croisez CRM × facturation × support dans un seul dashboard. Zéro export manuel.", href: "/produits/reporting-cross-source" },
  { icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75", title: "Réconciliation de vos données", desc: "7 méthodes de rapprochement (email, SIREN, TVA, domaine, LinkedIn). Un contact dans 3 outils = une seule fiche, automatiquement.", href: "/produits/resolution-entites" },
  { icon: "M13 10V3L4 14h7v7l9-11h-7z", title: "Insights IA", desc: "L'IA croise vos données CRM, facturation et support pour vous dire ce qui ne va pas, pourquoi, et quoi faire. En français.", href: "/produits/insights-ia" },
  { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", title: "Audit complet du CRM", desc: "Taux de remplissage, contacts orphelins, doublons et score de santé. L'IA génère un plan d'action personnalisé pour améliorer vos données.", href: "/produits/audit-crm" },
  { icon: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0", title: "Alertes & Prévisions de ventes", desc: "Détection automatique des deals à risque, forecast probabiliste et deal coaching IA. Agissez avant que votre performance ne soit impactée.", href: "/produits/alertes-previsions" },
];

const PERSONAS = [
  { role: "Direction / CEO", pain: "Croissance qui ralentit, sans comprendre pourquoi ni où agir", gain: "Dashboard exécutif avec forecast probabiliste, 3 scores de santé et actions priorisées" },
  { role: "Sales / Directeur Commercial", pain: "Forecast basé sur le feeling, deals qui meurent en silence", gain: "Détection de risque automatique, deal coaching IA, prévisions à ±7% de variance" },
  { role: "Marketing", pain: "Impossible de prouver le ROI jusqu'à la facture", gain: "Attribution cross-source : dépenses marketing → pipeline → factures Stripe" },
  { role: "RevOps", pain: "2 jours/mois à compiler des rapports. Données incohérentes entre outils", gain: "80+ rapports auto, 14 KPIs temps réel, entity resolution multi-source" },
  { role: "CSM / Customer Success", pain: "Aucune visibilité sur les signaux de churn avant qu'il soit trop tard", gain: "Croisement tickets support × paiements × activité CRM pour prédire et agir" },
  { role: "Finance", pain: "Écart permanent entre pipeline CRM et chiffre d'affaires réel", gain: "MRR, ARR, churn rate calculés en temps réel depuis Stripe/Pennylane × CRM" },
];

const TESTIMONIALS = [
  { quote: "Avant Revold, on passait 2 jours par mois à compiler nos KPIs dans des spreadsheets. Aujourd'hui, le dashboard est à jour en permanence et nos prévisions sont enfin fiables.", name: "Sophie M.", role: "Head of RevOps", company: "SaaS B2B — 85 collaborateurs" },
  { quote: "La détection de deals à risque nous a permis de sauver 3 opportunités majeures au Q1. On voit les signaux faibles 2 semaines avant qu'ils ne deviennent des problèmes.", name: "Thomas D.", role: "Directeur Commercial", company: "Scale-up — 150 collaborateurs" },
  { quote: "La connexion de notre CRM a pris 5 minutes. En 24h, on avait une vision complète de notre pipeline qu'on n'avait jamais eue avec un seul outil.", name: "Léa R.", role: "CEO & Co-fondatrice", company: "PME Tech — 30 collaborateurs" },
];

const FOOTER_LINKS = {
  Produit: [
    { label: "Synchronisation de données", href: "/produits/synchronisation" },
    { label: "Reporting cross-source", href: "/produits/reporting-cross-source" },
    { label: "Résolution d'entités", href: "/produits/resolution-entites" },
    { label: "Insights IA cross-source", href: "/produits/insights-ia" },
    { label: "Audit complet du CRM", href: "/produits/audit-crm" },
    { label: "Alertes & Prévisions", href: "/produits/alertes-previsions" },
    { label: "Intégrations", href: "/integrations" },
  ],
  Solutions: [
    { label: "Optimiser les revenus", href: "/solutions/optimiser-revenus" },
    { label: "Fiabiliser les données", href: "/solutions/fiabiliser-donnees" },
    { label: "Accélérer les cycles de vente", href: "/solutions/accelerer-cycles-vente" },
    { label: "Piloter la performance", href: "/solutions/piloter-performance" },
    { label: "Unifier le stack", href: "/solutions/unifier-stack" },
    { label: "Réduire le churn", href: "/solutions/reduire-churn" },
  ],
  Ressources: [
    { label: "Blog", href: "/blog" },
    { label: "Pourquoi Revold", href: "/pourquoi-revold" },
  ],
  Entreprise: [
    { label: "Contact", href: "/contact" },
  ],
  Légal: [
    { label: "Confidentialité", href: "/legal/confidentialite" },
    { label: "CGU", href: "/legal/cgu" },
    { label: "Sécurité", href: "/legal/securite" },
    { label: "RGPD", href: "/legal/rgpd" },
  ],
};

/* ─────────────── COMPONENT ─────────────── */

export default function LandingPage() {
  return (
    <div className="flex flex-col bg-background">
      {/* ═══ NAV ═══ */}
      <SiteNavbar />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/50 via-transparent to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-indigo-100/30 blur-[100px]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-20 text-center md:pb-28 md:pt-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-medium text-purple-700">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" /></span>
            Plateforme de pilotage de vos revenus propulsée par l&apos;IA
          </div>
          <h1 className="mt-8 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Votre CRM sait tout.<br />
            Revold <RotatingWord /> vos revenus 24/7.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-500">
            Revold connecte vos sources — CRM, facturation, support — et transforme vos données en diagnostics, alertes et recommandations propulsées par l&apos;IA. Automatiquement.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/essai-gratuit" className="group rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40">
              Essai gratuit<span className="ml-2 inline-block transition-transform group-hover:translate-x-1">&rarr;</span>
            </Link>
            <Link href="/demo" className="rounded-xl border border-slate-300 bg-white px-8 py-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
              Faire une démo
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">Setup en 5 min. Premier diagnostic instantané. Sans engagement.</p>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="border-y border-card-border bg-slate-900 py-8">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-6 px-6 sm:gap-12 md:gap-16">
          {[
            { value: "50+", suffix: "", label: "Intégrations possibles" },
            { value: "80+", suffix: "", label: "Indicateurs RevOps" },
            { value: "14", suffix: "", label: "KPIs temps réel" },
            { value: "3", suffix: "x", label: "Faster insights" },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-bold text-white">{s.value}{s.suffix}</p>
              <p className="mt-1 text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="solutions" className="bg-background py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Produit</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">6 fonctionnalités pour piloter votre croissance</h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Link key={i} href={f.href} className="card group p-6 transition hover:shadow-lg hover:shadow-accent/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon} /></svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900 transition group-hover:text-accent">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent opacity-0 transition group-hover:opacity-100">
                  En savoir plus <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PERSONAS ═══ */}
      <section className="border-y border-card-border bg-white py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Pour qui</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Pour chaque membre de votre équipe</h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
            {PERSONAS.map((p, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-card-border">
                <div className="bg-slate-900 px-5 py-4">
                  <p className="text-[15px] font-semibold text-white">{p.role}</p>
                </div>
                <div className="space-y-3 p-5">
                  <div className="flex gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50 text-[10px] text-red-500">x</span>
                    <span className="text-[13px] leading-relaxed text-slate-500">{p.pain}</span>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5"><path d="M2 5.5L4 7.5L8 3" stroke="#22c55e" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
                    </span>
                    <span className="text-[13px] font-medium leading-relaxed text-slate-900">{p.gain}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="bg-background py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Comment ça marche</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">4 étapes. 5 minutes.</h2>
          </div>
          <div className="mt-14 space-y-10">
            {[
              { step: "01", title: "Connectez vos outils", desc: "HubSpot, Salesforce, Pipedrive, Stripe, Pennylane, Zendesk — OAuth2 sécurisé, en quelques clics. Connectez 1 outil ou 50 : Revold s'adapte à votre stack. Aucune donnée n'est modifiée dans vos outils." },
              { step: "02", title: "Revold unifie et analyse", desc: "Toutes vos données sont normalisées dans un modèle de données unifié. Réconciliation automatique de vos contacts entre tous vos outils. 80+ métriques calculées. L'IA croise CRM × facturation × support pour détecter ce qu'aucun outil ne voit seul." },
              { step: "03", title: "Recevez vos insights", desc: "Dashboard temps réel avec 3 scores de santé. Alertes sur les deals à risque. Insights cross-source en langage naturel. Deal coaching contextuel par opportunité. Chaque personne reçoit ce qui la concerne." },
              { step: "04", title: "Agissez et mesurez", desc: "Forecast probabiliste pour votre direction. Rapports automatiques pour votre RevOps. Détection de churn pour votre CSM. Réconciliation financière pour votre DAF. L'impact est mesurable dès la première semaine." },
            ].map((s, i) => (
              <div key={i} className="flex gap-5">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md ${i === 1 ? "bg-accent" : "bg-slate-900"}`}>{s.step}</div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="border-y border-card-border bg-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Ils pilotent leur croissance avec Revold</h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="card flex flex-col p-8 transition hover:shadow-lg hover:shadow-accent/5">
                <div className="flex gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} viewBox="0 0 20 20" className="h-4 w-4 fill-current"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-600">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-6 border-t border-card-border pt-4">
                  <p className="font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role} — {t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ INTEGRATIONS ═══ */}
      <section className="border-y border-card-border bg-white py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Plus de 50 intégrations connectent{" "}
              <span className="text-accent">chaque donnée à vos outils</span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-slate-500">
              Les intégrations natives avec vos CRM, outils de facturation et plateformes de support synchronisent automatiquement les données commerciales dans tous vos systèmes.
            </p>
          </div>

          {/* Row 1 */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-4">
            {[
              { name: "Salesforce", domain: "salesforce.com" },
              { name: "HubSpot", domain: "hubspot.com" },
              { name: "Zendesk", domain: "zendesk.com" },
              { name: "Stripe", domain: "stripe.com" },
              { name: "monday", domain: "monday.com" },
              { name: "Pipedrive", domain: "pipedrive.com" },
              { name: "Intercom", domain: "intercom.com" },
            ].map((tool) => (
              <div key={tool.name} className="card flex h-14 w-24 flex-col items-center justify-center gap-1.5 transition hover:shadow-md sm:h-16 sm:w-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://www.google.com/s2/favicons?domain=${tool.domain}&sz=64`} alt={tool.name} width={24} height={24} className="rounded" />
                <span className="text-[11px] font-medium text-slate-600">{tool.name}</span>
              </div>
            ))}
          </div>

          {/* Row 2 */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            {[
              { name: "Pennylane", domain: "pennylane.com" },
              { name: "Crisp", domain: "crisp.chat" },
              { name: "Freshdesk", domain: "freshdesk.com" },
              { name: "Sellsy", domain: "sellsy.com" },
              { name: "Axonaut", domain: "axonaut.com" },
              { name: "QuickBooks", domain: "quickbooks.intuit.com" },
              { name: "Zoho", domain: "zoho.com" },
            ].map((tool) => (
              <div key={tool.name} className="card flex h-14 w-24 flex-col items-center justify-center gap-1.5 transition hover:shadow-md sm:h-16 sm:w-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://www.google.com/s2/favicons?domain=${tool.domain}&sz=64`} alt={tool.name} width={24} height={24} className="rounded" />
                <span className="text-[11px] font-medium text-slate-600">{tool.name}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 text-center">
            <Link href="/integrations" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:shadow-xl hover:shadow-purple-500/30">
              Voir nos intégrations
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-24 md:py-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
            Arrêtez de piloter votre croissance à l&apos;aveugle.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-purple-100">
            Connectez vos outils et recevez votre premier diagnostic en 5 minutes. Gratuit, sans engagement.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/essai-gratuit"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-semibold text-purple-600 shadow-lg transition hover:bg-purple-50"
            >
              Démarrer gratuitement
              <span className="inline-block transition-transform group-hover:translate-x-1">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </span>
            </Link>
            <Link
              href="/demo"
              className="rounded-xl border border-white/30 px-8 py-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              Demander une démo
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-card-border bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1">
              <RevoldLogo />
              <p className="mt-4 text-sm text-slate-500">
                Plateforme de Revenue Intelligence pour le marché B2B français.
              </p>
            </div>
            {/* Link columns */}
            {Object.entries(FOOTER_LINKS).map(([title, links]) => (
              <div key={title}>
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <ul className="mt-4 space-y-2.5">
                  {links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-sm text-slate-500 transition hover:text-slate-700"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-card-border pt-8 md:flex-row">
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} Revold. Tous droits réservés.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-slate-400 transition hover:text-slate-600" aria-label="LinkedIn">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
              </a>
              <a href="#" className="text-slate-400 transition hover:text-slate-600" aria-label="X / Twitter">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
