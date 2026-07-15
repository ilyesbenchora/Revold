/**
 * Personas des agents — de vrais personnages : un humain (augmenté par l'IA)
 * avec un prénom, une expertise et une ambiance de fond épurée. Objectif :
 * humaniser chaque agent et le rendre reconnaissable. Le fond reste discret.
 *
 * NB : les classes Tailwind sont écrites en littéral (le JIT ne détecte pas les
 * classes construites dynamiquement).
 */

export type CoachPersona = {
  /** Prénom du personnage. */
  name: string;
  /** Emoji humain représentant le personnage. */
  emoji: string;
  /** Rôle court (pour le sous-titre du personnage). */
  role: string;
  /** Dégradé de fond léger (Tailwind), pensé pour rester discret. */
  gradient: string;
  /** Couleur d'accent de la silhouette en filigrane. */
  tint: string;
};

/** Persona par clé d'agent (couvre coach + non-coach). */
export const AGENT_PERSONAS: Record<string, CoachPersona> = {
  // Données
  performance: { name: "Chloé", emoji: "👩‍💻", role: "Analyste performance", gradient: "from-amber-50 via-white to-white", tint: "text-amber-200" },
  automatisations: { name: "Théo", emoji: "👨‍🔧", role: "Ingénieur workflows", gradient: "from-indigo-50 via-white to-white", tint: "text-indigo-200" },
  "paiement-facturation": { name: "Inès", emoji: "👩‍💼", role: "Experte facturation", gradient: "from-emerald-50 via-white to-white", tint: "text-emerald-200" },
  "service-client": { name: "Hugo", emoji: "🙋‍♂️", role: "Référent relation client", gradient: "from-rose-50 via-white to-white", tint: "text-rose-200" },
  equipes: { name: "Sarah", emoji: "🧑‍🤝‍🧑", role: "Coach d'équipes", gradient: "from-sky-50 via-white to-white", tint: "text-sky-200" },
  proprietes: { name: "Karim", emoji: "🕵️", role: "Auditeur CRM", gradient: "from-violet-50 via-white to-white", tint: "text-violet-200" },
  // Coaching
  "coaching-ventes": { name: "Marc", emoji: "👨‍💼", role: "Coach des ventes", gradient: "from-blue-50 via-white to-white", tint: "text-blue-200" },
  "coaching-marketing": { name: "Léa", emoji: "👩‍🎨", role: "Coach marketing", gradient: "from-amber-50 via-white to-white", tint: "text-amber-200" },
  "coaching-data": { name: "Sofia", emoji: "👩‍🔬", role: "Coach data", gradient: "from-emerald-50 via-white to-white", tint: "text-emerald-200" },
  "coaching-integration": { name: "Yanis", emoji: "👨‍💻", role: "Coach intégration", gradient: "from-indigo-50 via-white to-white", tint: "text-indigo-200" },
  "coaching-cross-source": { name: "Nina", emoji: "👩‍🚀", role: "Coach cross-source", gradient: "from-fuchsia-50 via-white to-white", tint: "text-fuchsia-200" },
  "coaching-data-model": { name: "Adam", emoji: "👨‍🏫", role: "Coach modèle de données", gradient: "from-violet-50 via-white to-white", tint: "text-violet-200" },
  // Prévisions
  "prev-ventes": { name: "Emma", emoji: "🧑‍🚀", role: "Prévisionniste ventes", gradient: "from-blue-50 via-white to-white", tint: "text-blue-200" },
  "prev-marketing": { name: "Lucas", emoji: "👨‍🚀", role: "Prévisionniste marketing", gradient: "from-orange-50 via-white to-white", tint: "text-orange-200" },
  "prev-revenue": { name: "Maya", emoji: "👩‍💼", role: "Prévisionniste revenue", gradient: "from-teal-50 via-white to-white", tint: "text-teal-200" },
  "prev-donnees": { name: "Noah", emoji: "👨‍🔬", role: "Prévisionniste données", gradient: "from-sky-50 via-white to-white", tint: "text-sky-200" },
  // Dashboard
  reporting: { name: "Alix", emoji: "🧑‍💻", role: "Analyste reporting", gradient: "from-slate-50 via-white to-white", tint: "text-slate-200" },
};

const FALLBACK: CoachPersona = { name: "Revold", emoji: "🧑‍💻", role: "Agent IA", gradient: "from-slate-50 via-white to-white", tint: "text-slate-200" };

/** Persona d'un agent par sa clé. */
export function getAgentPersona(agentKey: string | null | undefined): CoachPersona {
  if (!agentKey) return FALLBACK;
  return AGENT_PERSONAS[agentKey] ?? FALLBACK;
}

/**
 * URL de l'avatar photoréaliste du personnage — une vraie photo humaine,
 * déterministe (même personnage = même visage). Utilisé pour l'avatar et pour
 * le filigrane de fond des blocs.
 */
export function personaAvatarUrl(name: string, size = 128): string {
  return `https://i.pravatar.cc/${size}?u=${encodeURIComponent(`revold-${name}`)}`;
}
