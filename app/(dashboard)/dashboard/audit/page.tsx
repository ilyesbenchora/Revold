export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getToolKeysBatch } from "@/lib/integrations/tool-mappings";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";
import { AgentProfileAvatar } from "@/components/agents/agent-profile-avatar";
import { AgentInsightsCounts } from "@/components/agents/agent-insights-counts";

// Pages « Outil source par page » couvertes par chaque agent : l'agent est
// GRISÉ tant qu'aucune source n'est sélectionnée sur au moins une de ses pages
// (onboarding d'un nouveau client : les agents s'activent page par page).
const AGENT_SOURCE_PAGES: Record<string, string[]> = {
  performance: ["audit_perf_ventes", "audit_perf_marketing", "audit_perf_ads"],
  "paiement-facturation": [
    "audit_paiement_facturation",
    "audit_paiement_facturation_facturation",
    "audit_paiement_facturation_paiement",
    "audit_paiement_facturation_comptabilite",
    "audit_paiement_facturation_previsionnel",
  ],
  // La page Appels n'est reliée à aucun agent — elle n'active pas Service Client.
  "service-client": ["audit_service_client"],
  proprietes: ["audit_donnees"],
};

const modules = [
  {
    href: "/dashboard/agents/performance",
    title: "Agent Performances",
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
    href: "/dashboard/agents/paiement-facturation",
    title: "Agent Trésorerie",
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
    href: "/dashboard/agents/service-client",
    title: "Agent Service Client",
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
    href: "/dashboard/agents/proprietes",
    title: "Agent Rapprochement de données",
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
];

export default async function AuditPage() {
  // Sources sélectionnées par page (Paramètres → Intégrations → Outil source
  // par page) : un agent sans AUCUNE source sur ses pages est grisé.
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();
  const allPageKeys = [...new Set(Object.values(AGENT_SOURCE_PAGES).flat())];
  const mappings = orgId ? await getToolKeysBatch(supabase, orgId, allPageKeys) : {};
  const agentEnabled = (key: string): boolean => {
    const pages = AGENT_SOURCE_PAGES[key];
    if (!pages) return true;
    return pages.some((p) => (mappings[p] ?? []).length > 0);
  };

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mon équipe disponible 24/7</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choisis un agent expert pour analyser ta donnée en conversationnel et cross-source.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {modules.map((m) => {
          const key = m.href.replace("/dashboard/agents/", "");
          const persona = getAgentPersona(key);
          const enabled = agentEnabled(key);
          if (!enabled) {
            // Agent grisé : aucune source sélectionnée sur ses pages — on guide
            // vers les Paramètres au lieu d'ouvrir un chat sans données.
            return (
              <div
                key={m.href}
                className={`card relative overflow-hidden bg-gradient-to-br ${persona.gradient} opacity-55 grayscale`}
                title="Aucune source sélectionnée pour les pages de cet agent"
              >
                <div className={`h-1 bg-gradient-to-r ${m.color}`} />
                <div className="relative z-10 p-5">
                  <div className="flex items-start gap-3">
                    <AgentProfileAvatar
                      name={persona.name}
                      emoji={persona.emoji}
                      image={personaImagePath(key)} agentKey={key}
                      role={persona.role}
                      pitch={persona.pitch}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-400">✨ {persona.name} · Agent IA</p>
                      <h2 className="text-base font-semibold text-slate-900">{m.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">{m.description}</p>
                      <p className="mt-3 text-[11px] font-medium text-slate-600">
                        Aucune source sélectionnée —{" "}
                        <Link href="/dashboard/parametres/integrations" className="pointer-events-auto underline hover:text-accent">
                          choisis les outils de ses pages dans Paramètres → Intégrations
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`group card relative overflow-hidden bg-gradient-to-br ${persona.gradient} transition hover:shadow-lg hover:-translate-y-0.5`}
            >
              <div className={`h-1 bg-gradient-to-r ${m.color}`} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={personaImagePath(key)}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -right-4 -bottom-6 h-32 w-32 select-none rounded-full object-cover opacity-[0.1] transition group-hover:opacity-[0.2]"
              />
              <div className="relative z-10 p-5">
                <div className="flex items-start gap-3">
                  <AgentProfileAvatar
                    name={persona.name}
                    emoji={persona.emoji}
                    image={personaImagePath(key)} agentKey={key}
                    role={persona.role}
                    pitch={persona.pitch}
                    size={44}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-400">✨ {persona.name} · Agent IA</p>
                    <h2 className="text-base font-semibold text-slate-900 group-hover:text-accent transition">
                      {m.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">{m.description}</p>
                    <p className="mt-3 text-[11px] italic text-slate-500">
                      <span className="font-medium text-slate-600">Objectif :</span> {m.objective}
                    </p>
                    <div className="mt-3">
                      <AgentInsightsCounts agentKey={key} discussionsLabel="discussions faites" />
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-300 group-hover:text-accent transition">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
