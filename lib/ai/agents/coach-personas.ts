/**
 * Personas des agents — un « visage » distinct par agent (emoji moderne à
 * connotation IA/tech) + une ambiance de fond épurée, pour humaniser l'approche
 * et différencier chaque agent. Utilisé dans la vue d'ensemble et sur la page
 * de l'agent. Le fond reste discret : présent mais jamais mis trop en avant.
 *
 * NB : les classes Tailwind sont écrites en littéral (le JIT ne détecte pas les
 * classes construites dynamiquement).
 */

export type CoachPersona = {
  /** Emoji représentant l'agent (silhouette / avatar), moderne et futuriste. */
  emoji: string;
  /** Dégradé de fond léger (Tailwind), pensé pour rester discret. */
  gradient: string;
  /** Couleur d'accent de la silhouette en filigrane. */
  tint: string;
};

/** Persona par clé d'agent (couvre coach + non-coach). */
export const AGENT_PERSONAS: Record<string, CoachPersona> = {
  // Données
  performance: { emoji: "⚡", gradient: "from-amber-50 via-white to-white", tint: "text-amber-200" },
  automatisations: { emoji: "🤖", gradient: "from-indigo-50 via-white to-white", tint: "text-indigo-200" },
  "paiement-facturation": { emoji: "💠", gradient: "from-emerald-50 via-white to-white", tint: "text-emerald-200" },
  "service-client": { emoji: "🛟", gradient: "from-rose-50 via-white to-white", tint: "text-rose-200" },
  equipes: { emoji: "🛰️", gradient: "from-sky-50 via-white to-white", tint: "text-sky-200" },
  proprietes: { emoji: "🧩", gradient: "from-violet-50 via-white to-white", tint: "text-violet-200" },
  // Coaching
  "coaching-ventes": { emoji: "🦾", gradient: "from-blue-50 via-white to-white", tint: "text-blue-200" },
  "coaching-marketing": { emoji: "📡", gradient: "from-amber-50 via-white to-white", tint: "text-amber-200" },
  "coaching-data": { emoji: "🧠", gradient: "from-emerald-50 via-white to-white", tint: "text-emerald-200" },
  "coaching-integration": { emoji: "🕹️", gradient: "from-indigo-50 via-white to-white", tint: "text-indigo-200" },
  "coaching-cross-source": { emoji: "🔮", gradient: "from-fuchsia-50 via-white to-white", tint: "text-fuchsia-200" },
  "coaching-data-model": { emoji: "🧬", gradient: "from-violet-50 via-white to-white", tint: "text-violet-200" },
  // Prévisions
  "prev-ventes": { emoji: "🔭", gradient: "from-blue-50 via-white to-white", tint: "text-blue-200" },
  "prev-marketing": { emoji: "🚀", gradient: "from-orange-50 via-white to-white", tint: "text-orange-200" },
  "prev-revenue": { emoji: "💫", gradient: "from-teal-50 via-white to-white", tint: "text-teal-200" },
  "prev-donnees": { emoji: "🛸", gradient: "from-sky-50 via-white to-white", tint: "text-sky-200" },
  // Dashboard
  reporting: { emoji: "🧭", gradient: "from-slate-50 via-white to-white", tint: "text-slate-200" },
};

const FALLBACK: CoachPersona = { emoji: "🤖", gradient: "from-slate-50 via-white to-white", tint: "text-slate-200" };

/** Persona d'un agent par sa clé. */
export function getAgentPersona(agentKey: string | null | undefined): CoachPersona {
  if (!agentKey) return FALLBACK;
  return AGENT_PERSONAS[agentKey] ?? FALLBACK;
}
