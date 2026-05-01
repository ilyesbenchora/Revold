export const dynamic = "force-dynamic";

import Link from "next/link";

const modules = [
  {
    href: "/dashboard/performances",
    title: "Performances",
    description: "Closing rate, cycle de vente, vélocité pipeline, pilotage commercial & marketing.",
    objective: "Identifier les leviers de croissance et les goulots d'étranglement business.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    color: "from-emerald-500 to-teal-500",
  },
  {
    href: "/dashboard/process",
    title: "Automatisations",
    description: "Cohérence des cycles, handoffs, règles de qualification, alignement sales-marketing.",
    objective: "Supprimer les frictions entre équipes pour fluidifier le parcours prospect → client.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4" /><path d="M12 18v4" />
        <path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" />
        <path d="M2 12h4" /><path d="M18 12h4" />
        <path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    color: "from-amber-500 to-rose-500",
  },
  {
    href: "/dashboard/audit/paiement-facturation",
    title: "Paiement & Facturation",
    description: "Factures, subscriptions, MRR/ARR, churn revenue et recouvrement.",
    objective: "Sécuriser le revenu récurrent et accélérer l'encaissement.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
    color: "from-cyan-500 to-blue-600",
  },
  {
    href: "/dashboard/audit/service-client",
    title: "Service Client",
    description: "Tickets, satisfaction, signaux d'engagement et risque de churn.",
    objective: "Détecter les risques de churn et activer les bons leviers CSM avant qu'il soit trop tard.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1v-7h3v5z" />
        <path d="M3 19a2 2 0 0 0 2 2h1v-7H3v5z" />
      </svg>
    ),
    color: "from-blue-500 to-indigo-500",
  },
  {
    href: "/dashboard/conduite-changement",
    title: "Équipes",
    description: "Usage de la stack par équipe, connexions utilisateurs, activités loguées, discipline CRM.",
    objective: "Mesurer l'adoption réelle des outils par les équipes pour maximiser le ROI de la stack.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    color: "from-fuchsia-500 to-purple-500",
  },
  {
    href: "/dashboard/donnees",
    title: "Propriétés",
    description: "Qualité, complétude, doublons, enrichissement par objet CRM.",
    objective: "Fiabiliser la base pour que chaque reporting et scoring reflète la réalité.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
      </svg>
    ),
    color: "from-sky-500 to-indigo-500",
  },
  {
    href: "/dashboard/audit/recommandations",
    title: "Recommandations IA",
    description: "Diagnostic CRO/RevOps complet : pain points, plans d'action, activation coachings IA.",
    objective: "Transformer l'audit en plans d'action concrets et activables en 1 clic.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
        <path d="M10 21v1a2 2 0 0 0 4 0v-1" />
      </svg>
    ),
    color: "from-fuchsia-500 to-indigo-600",
  },
];

export default async function AuditPage() {
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Données</h1>
        <p className="mt-1 text-sm text-slate-500">
          Diagnostic complet de votre stack revenue : données, process, performances et adoption.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group card overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className={`h-1 bg-gradient-to-r ${m.color}`} />
            <div className="p-5">
              <div className="flex items-start gap-3">
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${m.color} text-white`}>
                  {m.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-slate-900 group-hover:text-accent transition">
                    {m.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{m.description}</p>
                  <p className="mt-3 text-[11px] italic text-slate-500">
                    <span className="font-medium text-slate-600">Objectif :</span> {m.objective}
                  </p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-300 group-hover:text-accent transition">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
