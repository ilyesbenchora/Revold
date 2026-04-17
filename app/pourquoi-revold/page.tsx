import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";

const DIFFERENTIATORS = [
  {
    title: "Multi-source, pas mono-CRM",
    desc: "Les outils traditionnels sont construits autour d'un seul CRM. Revold croise vos sources — CRM, facturation, support — dans un modèle de données unifié. L'intelligence naît du croisement, pas de la donnée isolée.",
    stat: "+",
    statLabel: "sources connectées",
  },
  {
    title: "L'IA qui croise, pas qui résume",
    desc: "Les outils classiques analysent une seule source. Revold croise CRM × facturation × support pour vous dire que le client qui a 3 tickets ouverts, un paiement en retard et un deal en cours va churner dans 30 jours.",
    stat: "6",
    statLabel: "insights cross-source",
  },
  {
    title: "French-native, pas traduit",
    desc: "Interface, insights IA, rapports, terminologie — tout est pensé et écrit en français pour le marché B2B français. Pas de traduction approximative d'un outil US. Vos équipes comprennent tout, dès le premier jour.",
    stat: "100%",
    statLabel: "en français natif",
  },
  {
    title: "Réconciliation automatique de vos données",
    desc: "Revold réconcilie vos entités avec 7 méthodes : email, SIREN, SIRET, numéro de TVA, domaine, LinkedIn, external ID. Un contact dans 3 outils = une seule fiche, automatiquement.",
    stat: "7",
    statLabel: "méthodes de matching",
  },
  {
    title: "Pricing PME / Mid-Market",
    desc: "Les plateformes existantes démarrent à 50K$/an minimum. Revold démarre à 79\u202F\u20AC/mois. Pas de minimum de licences, pas de contrat annuel forcé, pas de surprises.",
    stat: "79\u202F\u20AC",
    statLabel: "par mois pour démarrer",
  },
  {
    title: "Méthodologie RevOps prête à l'emploi",
    desc: "Revold ne vous donne pas un outil vide à configurer. Pipeline stages, 14 KPIs, 3 scores de santé, 80+ rapports — tout est pré-configuré selon les best practices RevOps. Vous êtes opérationnel en 5 minutes.",
    stat: "80+",
    statLabel: "rapports pré-configurés",
  },
];

const VS_OTHERS = [
  { label: "Données analysées", revold: "CRM + Billing + Support (sources multiples)", others: "CRM seul (mono-source)" },
  { label: "Entity resolution", revold: "7 méthodes (email, SIREN, TVA, domaine...)", others: "Email uniquement" },
  { label: "Insights IA", revold: "Cross-source (CRM × billing × support)", others: "Intra-CRM uniquement" },
  { label: "Langue", revold: "Français natif", others: "Anglais (traduction partielle)" },
  { label: "Identifiants français", revold: "SIREN, SIRET, TVA intégrés", others: "Non supporté" },
  { label: "Audit qualité CRM", revold: "Audit externe multi-source", others: "Non disponible (conflit d'intérêt)" },
  { label: "Pricing entrée", revold: "79\u202F\u20AC/mois", others: "800$+ /mois" },
  { label: "CRM-agnostic", revold: "HubSpot, Salesforce, Pipedrive, Zoho...", others: "Verrouillé sur 1 CRM" },
];

const PRINCIPLES = [
  {
    title: "Croisement > Résumé",
    desc: "La valeur n'est pas dans la donnée. Elle est dans le croisement entre les données. Un insight sur un deal HubSpot n'a de sens que quand il est croisé avec la facture Stripe et le ticket Zendesk.",
  },
  {
    title: "Opinionated > Configurable",
    desc: "On ne vous donne pas un outil vide. On vous donne une méthodologie. Les bons KPIs, les bons scores, les bons rapports — dès le premier jour. Vous pouvez customiser ensuite.",
  },
  {
    title: "Neutre > Captif",
    desc: "Revold n'est pas un CRM. On ne vous enferme pas. Vous changez de HubSpot à Salesforce ? Revold continue. Votre intelligence commerciale vous appartient.",
  },
  {
    title: "PME-first > Enterprise-down",
    desc: "On ne construit pas pour le Fortune 500 en espérant que ça trickle-down. On construit pour les PME et ETI françaises, avec un pricing, une UX et une méthodologie adaptés.",
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
    <div className="flex flex-col bg-background">
      <SiteNavbar />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/50 via-transparent to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-indigo-100/30 blur-[120px]" />
        <div className="pointer-events-none absolute -left-20 top-40 h-[500px] w-[500px] rounded-full bg-fuchsia-100/20 blur-[100px]" />

        <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-20 text-center md:pb-28 md:pt-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-medium text-purple-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
            </span>
            Pourquoi Revold
          </div>
          <h1 className="mt-8 text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
            Votre CRM vous montre des données.{" "}
            <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
              Revold vous montre la vérité.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-600 md:text-xl">
            La première plateforme de Revenue Intelligence construite pour le marché B2B français. Multi-source. Intelligence artificielle intégrée. Compatible avec tous les CRM. Parce que l&apos;intelligence revenus ne peut pas vivre dans un seul outil.
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
              href="/#pricing"
              className="rounded-xl border border-slate-300 bg-white px-8 py-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ THE PROBLEM ═══ */}
      <section className="border-y border-card-border bg-white py-20 md:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 md:text-4xl">
              Le marché B2B navigue à l&apos;aveugle
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600">
              Les études sont unanimes. Les équipes commerciales manquent de visibilité, de données fiables et d&apos;insights actionnables.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MARKET_STATS.map((s) => (
              <div key={s.value} className="card p-6 transition hover:shadow-lg hover:shadow-accent/5">
                <p className="text-4xl font-black tracking-tight text-slate-900">{s.value}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.label}</p>
                <p className="mt-3 text-xs font-medium text-accent">Source : {s.source}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ OUR DNA ═══ */}
      <section className="bg-background py-20 md:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-accent">Notre ADN</span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900 md:text-4xl">
              4 convictions qui guident tout ce qu&apos;on construit
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="flex gap-5">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600 shadow-md">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6 DIFFERENTIATORS ═══ */}
      <section className="border-y border-card-border bg-white py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 md:text-4xl">
              Ce qui rend Revold{" "}
              <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">différent</span>
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {DIFFERENTIATORS.map((d) => (
              <div key={d.title} className="card flex flex-col p-6 transition hover:shadow-lg hover:shadow-accent/5">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">{d.stat}</span>
                  <span className="text-sm font-medium text-accent">{d.statLabel}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{d.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MID-PAGE CTA ═══ */}
      <section className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Envie de voir Revold en action ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-purple-100">
            30 minutes pour comprendre comment Revold peut transformer votre approche revenue. Sans engagement.
          </p>
          <Link
            href="/demo"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-semibold text-purple-600 shadow-lg transition hover:bg-purple-50"
          >
            Faire une démo
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ═══ VS OTHERS TABLE ═══ */}
      <section className="bg-background py-20 md:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 md:text-4xl">
              Revold vs les outils existants
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-500">
              Comment Revold se différencie des approches traditionnelles
            </p>
          </div>
          <div className="mt-14 overflow-hidden rounded-2xl border border-card-border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50">
                  <th className="px-6 py-4 text-left font-medium text-slate-500" />
                  <th className="px-6 py-4 text-left">
                    <span className="font-bold text-accent">Revold</span>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <span className="font-medium text-slate-400">Outils traditionnels</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {VS_OTHERS.map((row) => (
                  <tr key={row.label} className="border-b border-card-border last:border-0">
                    <td className="px-6 py-4 font-medium text-slate-700">{row.label}</td>
                    <td className="px-6 py-4 text-slate-900">{row.revold}</td>
                    <td className="px-6 py-4 text-slate-400">{row.others}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ BUILT FOR FRANCE ═══ */}
      <section className="border-y border-card-border bg-white py-20 md:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div>
              <span className="text-sm font-semibold uppercase tracking-widest text-accent">Made for France</span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Construit pour le B2B français
              </h2>
              <p className="mt-4 leading-relaxed text-slate-600">
                Les solutions de pilotage existantes sont souvent anglophones et calibrées pour les grands groupes. Le marché français des PME et ETI mérite un outil à sa mesure.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Interface et insights 100% en français",
                  "SIREN, SIRET, numéro de TVA natifs",
                  "Intégrations françaises (Pennylane, Sellsy, Axonaut)",
                  "Pricing adapté : à partir de 79\u202F\u20AC/mois",
                  "Méthodologie RevOps pré-configurée",
                  "Support et accompagnement en français",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
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
                { val: "+", unit: "sources", desc: "CRM, billing, support" },
                { val: "14", unit: "KPIs", desc: "Calculés quotidiennement" },
                { val: "3", unit: "scores", desc: "Sales, Marketing, CRM" },
                { val: "<5", unit: "min", desc: "Pour être opérationnel" },
              ].map((m) => (
                <div key={m.desc} className="card p-6 text-center transition hover:shadow-md">
                  <p className="text-3xl font-black text-slate-900">
                    {m.val}<span className="ml-1 text-lg font-bold text-accent">{m.unit}</span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-24 md:py-28">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
            Prêt à voir vos données autrement ?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-purple-100">
            30 minutes. Vos données. Vos insights. Sans engagement.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/demo"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-semibold text-purple-600 shadow-lg transition hover:bg-purple-50"
            >
              Faire une démo
              <span className="inline-block transition-transform group-hover:translate-x-1">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </span>
            </Link>
            <Link
              href="/#pricing"
              className="rounded-xl border border-white/30 px-8 py-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
            <div className="col-span-2 md:col-span-1">
              <RevoldLogo />
              <p className="mt-4 text-sm text-slate-500">Plateforme de Revenue Intelligence pour le marché B2B français.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Produit</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/produits/synchronisation" className="text-sm text-slate-500 transition hover:text-slate-700">Synchronisation</Link></li>
                <li><Link href="/produits/reporting-cross-source" className="text-sm text-slate-500 transition hover:text-slate-700">Reporting</Link></li>
                <li><Link href="/produits/insights-ia" className="text-sm text-slate-500 transition hover:text-slate-700">Insights IA</Link></li>
                <li><Link href="/produits/audit-crm" className="text-sm text-slate-500 transition hover:text-slate-700">Audit CRM</Link></li>
                <li><Link href="/integrations" className="text-sm text-slate-500 transition hover:text-slate-700">Intégrations</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Solutions</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/solutions/optimiser-revenus" className="text-sm text-slate-500 transition hover:text-slate-700">Optimiser les revenus</Link></li>
                <li><Link href="/solutions/fiabiliser-donnees" className="text-sm text-slate-500 transition hover:text-slate-700">Fiabiliser les données</Link></li>
                <li><Link href="/solutions/accelerer-cycles-vente" className="text-sm text-slate-500 transition hover:text-slate-700">Accélérer les ventes</Link></li>
                <li><Link href="/solutions/reduire-churn" className="text-sm text-slate-500 transition hover:text-slate-700">Réduire le churn</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Ressources</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/blog" className="text-sm text-slate-500 transition hover:text-slate-700">Blog</Link></li>
                <li><Link href="/pourquoi-revold" className="text-sm text-slate-500 transition hover:text-slate-700">Pourquoi Revold</Link></li>
                <li><Link href="/contact" className="text-sm text-slate-500 transition hover:text-slate-700">Contact</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Légal</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/legal/confidentialite" className="text-sm text-slate-500 transition hover:text-slate-700">Confidentialité</Link></li>
                <li><Link href="/legal/cgu" className="text-sm text-slate-500 transition hover:text-slate-700">CGU</Link></li>
                <li><Link href="/legal/securite" className="text-sm text-slate-500 transition hover:text-slate-700">Sécurité</Link></li>
                <li><Link href="/legal/rgpd" className="text-sm text-slate-500 transition hover:text-slate-700">RGPD</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-card-border pt-8 md:flex-row">
            <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Revold. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
