import Link from "next/link";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";
import { AgentInsightsCounts } from "./agent-insights-counts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBoardViewer } from "@/lib/boards/visibility";
import type { WorkspaceId } from "@/lib/workspaces";

/**
 * « Mon équipe d'agents IA » sur la home — l'ancien hub /dashboard/audit vit
 * désormais ici. Chaque agent = une carte : vrai avatar + prénom + spécialité,
 * son objectif, et ses insights (séances, suggestions, alertes, actions,
 * routines, cliquables vers le bon onglet). Un clic sur la carte ouvre l'agent.
 *
 * Filtrage par pôle : un membre restreint à son pôle (profiles.pole) ne voit
 * QUE les agents de son équipe ; l'agent Data est transverse (la qualité de la
 * donnée concerne tous les pôles). Admin ou membre sans pôle → toute l'équipe.
 */

type AgentDef = {
  key: string;
  title: string;
  description: string;
  objective: string;
  /** Pôles qui voient cet agent — "all" = transverse, visible par tous. */
  teams: WorkspaceId[] | "all";
};

const AGENTS: AgentDef[] = [
  {
    key: "performance",
    title: "Agent Performances",
    description: "Closing rate, cycle de vente, vélocité pipeline, pilotage commercial & marketing.",
    objective: "Identifier les leviers de croissance et les goulots d'étranglement business.",
    teams: ["sales", "marketing"],
  },
  {
    key: "paiement-facturation",
    title: "Agent Trésorerie",
    description: "Factures, abonnements, MRR/ARR, churn revenue et recouvrement.",
    objective: "Sécuriser le revenu récurrent et accélérer l'encaissement.",
    teams: ["finance"],
  },
  {
    key: "service-client",
    title: "Agent Service Client",
    description: "Tickets, satisfaction, signaux d'engagement et risque de churn.",
    objective: "Détecter les risques de churn et activer les bons leviers CSM avant qu'il soit trop tard.",
    teams: ["cs"],
  },
  {
    key: "proprietes",
    title: "Agent Data",
    description: "Qualité, complétude, doublons, enrichissement par objet CRM.",
    objective: "Fiabiliser la base pour que chaque reporting et scoring reflète la réalité.",
    teams: "all",
  },
];

export async function AgentsFamily() {
  const supabase = await createSupabaseServerClient();
  const viewer = await getBoardViewer(supabase);

  const visible = AGENTS.filter(
    (a) =>
      viewer.unrestricted ||
      a.teams === "all" ||
      (viewer.team !== null && (a.teams as WorkspaceId[]).includes(viewer.team as WorkspaceId)),
  );
  if (visible.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-br from-fuchsia-50 via-white to-indigo-50 p-6">
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-700 ring-1 ring-fuchsia-100">
          <span>✨</span> Ton équipe d&apos;agents IA
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Tes experts IA, disponibles 24/7</h2>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Chaque agent analyse tes vraies données en conversationnel et cross-source. Clique sur un agent pour ouvrir
          son espace, ou sur un compteur pour aller droit à ses suggestions, alertes, actions ou routines.
        </p>

        {/* Cartes agent : avatar réel + nom + objectif + insights, cliquables. */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((a) => {
            const p = getAgentPersona(a.key);
            return (
              <Link
                key={a.key}
                href={`/dashboard/agents/${a.key}`}
                className="group card relative overflow-hidden bg-white/80 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:border-fuchsia-300 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-100 to-indigo-100 text-lg ring-2 ring-white">
                    <span aria-hidden>{p.emoji}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={personaImagePath(a.key)} alt={p.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-400">✨ {p.name} · Agent IA</p>
                    <h3 className="text-base font-semibold text-slate-900 transition group-hover:text-fuchsia-700">{a.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{a.description}</p>
                    <p className="mt-2 text-[11px] italic text-slate-500">
                      <span className="font-medium text-slate-600">Objectif :</span> {a.objective}
                    </p>
                    <div className="mt-3">
                      <AgentInsightsCounts agentKey={a.key} discussionsLabel="séances faites" />
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-300 transition group-hover:text-fuchsia-600">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </Link>
            );
          })}

          {/* Carte de la PAGE Enrichissement — même famille visuelle que les
              agents : le moteur qui complète les fiches via les registres
              officiels mérite le même accès direct depuis la home. */}
          <Link
            href="/dashboard/enrichissement"
            className="group card relative overflow-hidden bg-white/80 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:border-fuchsia-300 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-100 to-indigo-100 text-lg ring-2 ring-white">
                <span aria-hidden>🏛️</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-slate-400">🏛️ Moteur Revold</p>
                <h3 className="text-base font-semibold text-slate-900 transition group-hover:text-fuchsia-700">Enrichissement</h3>
                <p className="mt-1 text-sm text-slate-600">Identifiants, effectifs, CA et secteur complétés via les registres officiels — jusque dans ton CRM.</p>
                <p className="mt-2 text-[11px] italic text-slate-500">
                  <span className="font-medium text-slate-600">Objectif :</span> une base 100&nbsp;% identifiée, prête pour la réconciliation.
                </p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-300 transition group-hover:text-fuchsia-600">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
