import Link from "next/link";
import type { Metadata } from "next";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Pourquoi Revold — Revenue Intelligence pour le B2B français",
  description:
    "Multi-source, rapprochement SIREN/SIRET/TVA, équipe IA 24/7, actions exécutées dans vos outils : pourquoi Revold est différent des outils de reporting classiques.",
};

/**
 * Page « Pourquoi Revold » — thème sombre cockpit, contenu aligné sur le
 * produit réel : rapprochement Sirene, équipe IA 24/7, routines & récaps,
 * actions human-in-the-loop, tour de contrôle vocale, câblage vérifié.
 */

const DIFFERENTIATORS = [
  {
    title: "Multi-source, pas mono-CRM",
    desc: "Les outils traditionnels sont construits autour d'un seul CRM. Revold croise CRM, facturation et compta — HubSpot, Stripe, Pennylane, Chargebee, GoCardless, Sage — dans un modèle unifié. L'intelligence naît du croisement, pas de la donnée isolée.",
    stat: "6",
    statLabel: "connecteurs natifs",
  },
  {
    title: "Rapprochement à la française",
    desc: "Revold relie vos entreprises entre outils par SIREN, SIRET et numéro de TVA — et remplit lui-même les identifiants manquants depuis la base Sirene officielle, avec validation par vous avant application. Un client dans 3 outils = une seule fiche.",
    stat: "3",
    statLabel: "identifiants FR (SIREN, SIRET, TVA)",
  },
  {
    title: "Mon équipe IA, disponible 24/7",
    desc: "Des agents experts par domaine (performance, trésorerie, service client, qualité des données), à briefer par écrit ou à la voix depuis la tour de contrôle. Chaque chiffre affiché est câblé sur vos vraies données — jamais inventé par l'IA.",
    stat: "24/7",
    statLabel: "agents experts par domaine",
  },
  {
    title: "Des actions, pas des dashboards",
    desc: "Deal silencieux → tâche HubSpot créée. Facture en retard → rappel Stripe officiel envoyé. Revold détecte, vous validez, l'action s'exécute dans vos outils — et chaque euro récupéré est attribué, ligne par ligne.",
    stat: "€",
    statLabel: "cash récupéré, mesuré",
  },
  {
    title: "Tour de contrôle vocale",
    desc: "Demandez votre brief du jour à la voix : alertes en tension, objectifs, impayés, vos KPIs personnalisés. Naviguez et créez des alertes en parlant. L'anneau de santé résume tout d'un coup d'œil.",
    stat: "1",
    statLabel: "brief vocal quotidien",
  },
  {
    title: "Câblage vérifié, chiffres prouvés",
    desc: "Avant de créer une alerte ou un objectif, Revold montre la donnée réellement suivie, l'outil source et la valeur actuelle calculée. La preuve chiffrée d'abord, le suivi automatique ensuite.",
    stat: "100%",
    statLabel: "des KPIs câblés sur vos données",
  },
];

const VS_OTHERS = [
  { label: "Données analysées", revold: "CRM + facturation + compta (multi-sources)", others: "CRM seul (mono-source)" },
  { label: "Rapprochement d'entités", revold: "SIREN, SIRET, TVA + enrichissement Sirene validé", others: "Email uniquement" },
  { label: "Fiabilité des chiffres", revold: "Câblage vérifié : source, outil et valeur prouvés avant création", others: "Boîte noire" },
  { label: "Passage à l'action", revold: "Actions exécutées dans vos outils (tâche HubSpot, rappel Stripe), cash récupéré en €", others: "Constat sans exécution" },
  { label: "Langue", revold: "Français natif", others: "Anglais (traduction partielle)" },
  { label: "Pilotage quotidien", revold: "Tour de contrôle vocale, routines & récaps programmés", others: "Dashboards statiques" },
  { label: "Pricing d'entrée", revold: "79,90 € HT/mois", others: "800$+ /mois" },
  { label: "Connecteurs", revold: "HubSpot (1 clic), Stripe, Pennylane, Chargebee, GoCardless, Sage + Excel/Sheets", others: "Verrouillé sur 1 écosystème" },
];

const PRINCIPLES = [
  {
    title: "Croisement > Résumé",
    desc: "La valeur n'est pas dans la donnée. Elle est dans le croisement entre les données. Un deal HubSpot n'a de sens que croisé avec la facture Stripe et l'écriture Pennylane du même client — rapprochés par SIREN.",
  },
  {
    title: "Preuve > Promesse",
    desc: "Aucun KPI, aucune alerte, aucun objectif n'est créé sans montrer d'abord la donnée réellement suivie, l'outil source et la valeur actuelle calculée. Les chiffres sont recalculés en déterministe — jamais inventés par l'IA.",
  },
  {
    title: "Neutre > Captif",
    desc: "Revold n'est pas un CRM. On ne vous enferme pas : accès en lecture seule, révocable à tout moment. Vous changez d'outil ? Revold continue. Votre intelligence revenue vous appartient.",
  },
  {
    title: "PME-first > Enterprise-down",
    desc: "On ne construit pas pour le Fortune 500 en espérant que ça ruisselle. On construit pour les PME et ETI françaises, avec un pricing, une UX et un accompagnement adaptés.",
  },
];

const MARKET_STATS = [
  { value: "55%", label: "des sales leaders n'ont pas confiance dans leur forecast", source: "Gartner" },
  { value: "76%", label: "des orgas ont <50% de données CRM fiables", source: "Validity" },
  { value: "61%", label: "des deals perdus par indécision, pas par la concurrence", source: "Challenger" },
  { value: "13h/sem", label: "perdues par commercial à chercher dans le CRM", source: "Validity" },
  { value: "44%", label: "des entreprises perdent +10% de CA à cause de mauvaises données", source: "RevOps 802" },
  { value: "68%", label: "des organisations citent les silos de données comme obstacle #1", source: "Agents for Hire" },
];

export default function PourquoiRevoldPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-40 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-amber-400/5 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-20 text-center md:pb-28 md:pt-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-fuchsia-400" />
            </span>
            Pourquoi Revold
          </div>
          <h1 className="mt-8 text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl lg:text-7xl">
            Votre CRM vous montre des données.{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Revold vous montre la vérité.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-400 md:text-xl">
            La plateforme de Revenue Intelligence construite pour le B2B français. Multi-source, rapprochée par
            SIREN / SIRET / TVA, avec une équipe d&apos;agents IA disponible 24/7 — qui exécute les actions que vous
            validez, directement dans vos outils.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/demo"
              className="group rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40"
            >
              Faire une démo
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">&rarr;</span>
            </Link>
            <Link
              href="/tarifs"
              className="rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ THE PROBLEM ═══ */}
      <section className="border-y border-white/10 py-20 md:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white md:text-4xl">
              Le marché B2B navigue à l&apos;aveugle
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Les études sont unanimes. Les équipes commerciales manquent de visibilité, de données fiables et d&apos;insights actionnables.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MARKET_STATS.map((s) => (
              <div key={s.value} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]">
                <p className="text-4xl font-black tracking-tight text-white">{s.value}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{s.label}</p>
                <p className="mt-3 text-xs font-medium text-fuchsia-300">Source : {s.source}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ OUR DNA ═══ */}
      <section className="relative py-20 md:py-24">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-fuchsia-300">Notre ADN</span>
            <h2 className="mt-4 text-2xl font-bold text-white md:text-4xl">
              4 convictions qui guident tout ce qu&apos;on construit
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="flex gap-5">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600 shadow-md shadow-black/40">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6 DIFFERENTIATORS ═══ */}
      <section className="border-y border-white/10 py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white md:text-4xl">
              Ce qui rend Revold{" "}
              <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">différent</span>
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {DIFFERENTIATORS.map((d) => (
              <div key={d.title} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">{d.stat}</span>
                  <span className="text-sm font-medium text-fuchsia-300">{d.statLabel}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">{d.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MID-PAGE CTA ═══ */}
      <section className="relative overflow-hidden py-16">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-fuchsia-600/20 via-purple-600/20 to-indigo-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Envie de voir Revold en action ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            30 minutes pour comprendre comment Revold peut transformer votre approche revenue. Sans engagement.
          </p>
          <Link
            href="/demo"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40"
          >
            Faire une démo
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ═══ VS OTHERS TABLE ═══ */}
      <section className="border-t border-white/10 py-20 md:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white md:text-4xl">
              Revold vs les outils existants
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-400">
              Comment Revold se différencie des approches traditionnelles
            </p>
          </div>
          <div className="mt-14 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg shadow-black/40">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="px-6 py-4 text-left font-medium text-slate-500" />
                    <th className="px-6 py-4 text-left">
                      <span className="font-bold text-fuchsia-300">Revold</span>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <span className="font-medium text-slate-500">Outils traditionnels</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {VS_OTHERS.map((row) => (
                    <tr key={row.label} className="border-b border-white/10 last:border-0">
                      <td className="px-6 py-4 font-medium text-slate-300">{row.label}</td>
                      <td className="px-6 py-4 text-white">{row.revold}</td>
                      <td className="px-6 py-4 text-slate-500">{row.others}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BUILT FOR FRANCE ═══ */}
      <section className="relative border-y border-white/10 py-20 md:py-24">
        <div className="pointer-events-none absolute left-0 bottom-0 h-72 w-72 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div>
              <span className="text-sm font-semibold uppercase tracking-widest text-fuchsia-300">Made for France</span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-white md:text-4xl">
                Construit pour le B2B français
              </h2>
              <p className="mt-4 leading-relaxed text-slate-400">
                Les solutions de pilotage existantes sont souvent anglophones et calibrées pour les grands groupes. Le marché français des PME et ETI mérite un outil à sa mesure.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Interface, agents IA et récaps 100% en français",
                  "SIREN, SIRET, numéro de TVA natifs + enrichissement base Sirene",
                  "Connecteurs adaptés : HubSpot, Stripe, Pennylane, Chargebee, GoCardless, Sage",
                  "Import Excel / Google Sheets, notifications Slack, Teams et email",
                  "Pricing adapté : à partir de 79,90 € HT/mois, essai 14 jours sans CB",
                  "Support et accompagnement en français",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { val: "6", unit: "connecteurs", desc: "CRM, facturation, compta" },
                { val: "3", unit: "identifiants", desc: "SIREN, SIRET, TVA" },
                { val: "24/7", unit: "", desc: "Équipe IA disponible" },
                { val: "14", unit: "jours", desc: "Essai gratuit, sans CB" },
              ].map((m) => (
                <div key={m.desc} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]">
                  <p className="text-3xl font-black text-white">
                    {m.val}{m.unit && <span className="ml-1 text-lg font-bold text-fuchsia-300">{m.unit}</span>}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="relative overflow-hidden py-24 md:py-28">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-[50rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-fuchsia-600/15 via-purple-600/15 to-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
            Prêt à voir vos données autrement ?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-400">
            30 minutes. Vos données. Vos insights. Sans engagement.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/demo"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40"
            >
              Faire une démo
              <span className="inline-block transition-transform group-hover:translate-x-1">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </span>
            </Link>
            <Link
              href="/tarifs"
              className="rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
