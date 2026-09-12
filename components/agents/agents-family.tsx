import Link from "next/link";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";
import { AgentInsightsCounts } from "./agent-insights-counts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBoardViewer } from "@/lib/boards/visibility";
import type { WorkspaceId } from "@/lib/workspaces";

/**
 * « Mon équipe d'agents IA » sur la home — des CARTES COMPACTES cliquables
 * (avatar + prénom + spécialité), les MÊMES dimensions que les cartes agent
 * d'origine : les insights tiennent dans la carte en version condensée
 * (icône + nombre, libellé en tooltip, sans le compteur de séances). Un clic
 * sur la carte ouvre l'agent, un clic sur un compteur ouvre le bon onglet.
 *
 * Filtrage par pôle : un membre restreint à son pôle (profiles.pole) ne voit
 * QUE les agents de son équipe ; l'agent Data est transverse (la qualité de la
 * donnée concerne tous les pôles). Admin ou membre sans pôle → toute l'équipe.
 */

type AgentDef = {
  key: string;
  /** Pôles qui voient cet agent — "all" = transverse, visible par tous. */
  teams: WorkspaceId[] | "all";
};

const AGENTS: AgentDef[] = [
  { key: "performance", teams: ["sales", "marketing"] },
  { key: "paiement-facturation", teams: ["finance"] },
  { key: "service-client", teams: ["cs"] },
  { key: "proprietes", teams: "all" },
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
        <h2 className="text-lg font-semibold text-slate-900">Tes experts IA, un clic pour les ouvrir</h2>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Chaque agent a sa spécialité — performance, trésorerie, service client, données. Clique sur un agent pour
          ouvrir son espace, ou sur un compteur pour aller droit à ses suggestions, alertes, actions ou routines.
        </p>

        {/* Cartes agent compactes : avatar + prénom + spécialité + compteurs. */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visible.map((a) => {
            const p = getAgentPersona(a.key);
            return (
              <Link
                key={a.key}
                href={`/dashboard/agents/${a.key}`}
                className="group flex flex-col items-center gap-2 rounded-xl border border-card-border bg-white/80 p-4 text-center backdrop-blur transition hover:-translate-y-0.5 hover:border-fuchsia-300 hover:shadow-md"
              >
                <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-100 to-indigo-100 text-2xl ring-2 ring-white">
                  <span aria-hidden>{p.emoji}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={personaImagePath(a.key)} alt={p.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 transition group-hover:text-fuchsia-700">{p.name}</p>
                  <p className="text-[11px] leading-tight text-slate-500">{p.role}</p>
                </div>
                <AgentInsightsCounts agentKey={a.key} compact />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
