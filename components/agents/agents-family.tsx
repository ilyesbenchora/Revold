import Link from "next/link";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";

/**
 * « Mon équipe d'agents IA » sur la home — des CARTES cliquables : vrai avatar
 * + prénom + spécialité de chaque agent construit. Un clic ouvre directement la
 * page de l'agent (plus de présentation orale : la valeur est dans l'accès
 * direct à l'expert et sa spécialité, pas dans une vidéo d'intro).
 */

const FAMILY_KEYS = ["performance", "paiement-facturation", "service-client", "proprietes"];

export function AgentsFamily() {
  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-br from-fuchsia-50 via-white to-indigo-50 p-6">
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-700 ring-1 ring-fuchsia-100">
          <span>✨</span> Ton équipe d&apos;agents IA
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Tes experts IA, un clic pour les ouvrir</h2>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Chaque agent a sa spécialité — performance, trésorerie, service client, données. Clique pour ouvrir son
          espace : il analyse tes vraies données et te propose des actions concrètes.
        </p>

        {/* Cartes agent : avatar réel + nom + rôle, cliquables vers leur page. */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FAMILY_KEYS.map((key) => {
            const p = getAgentPersona(key);
            return (
              <Link
                key={key}
                href={`/dashboard/agents/${key}`}
                className="group flex flex-col items-center gap-2 rounded-xl border border-card-border bg-white/80 p-4 text-center backdrop-blur transition hover:-translate-y-0.5 hover:border-fuchsia-300 hover:shadow-md"
              >
                <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-100 to-indigo-100 text-2xl ring-2 ring-white">
                  <span aria-hidden>{p.emoji}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={personaImagePath(key)} alt={p.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 transition group-hover:text-fuchsia-700">{p.name}</p>
                  <p className="text-[11px] leading-tight text-slate-500">{p.role}</p>
                </div>
                <span className="text-[10px] font-medium text-fuchsia-600 opacity-0 transition group-hover:opacity-100">Ouvrir l&apos;agent →</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
