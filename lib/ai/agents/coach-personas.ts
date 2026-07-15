/**
 * Personas des coachs — un « visage » humain + une ambiance de fond distincte
 * par catégorie de coaching, pour humaniser l'approche et différencier chaque
 * coach. Utilisé dans la vue d'ensemble (cartes) et sur la page de l'agent.
 *
 * Le fond reste épuré (dégradé léger + silhouette emoji en filigrane discret) :
 * présent mais jamais mis trop en avant.
 */

export type CoachPersona = {
  /** Emoji humain représentant le coach (silhouette / avatar). */
  emoji: string;
  /** Dégradé de fond léger (Tailwind), pensé pour rester discret. */
  gradient: string;
  /** Couleur d'accent de la silhouette en filigrane. */
  tint: string;
};

export const COACH_PERSONAS: Record<string, CoachPersona> = {
  commercial: { emoji: "🧑‍💼", gradient: "from-blue-50 via-white to-white", tint: "text-blue-200" },
  marketing: { emoji: "🧑‍🎨", gradient: "from-amber-50 via-white to-white", tint: "text-amber-200" },
  data: { emoji: "🧑‍🔬", gradient: "from-emerald-50 via-white to-white", tint: "text-emerald-200" },
  integration: { emoji: "🧑‍🔧", gradient: "from-indigo-50 via-white to-white", tint: "text-indigo-200" },
  "cross-source": { emoji: "🧑‍🚀", gradient: "from-fuchsia-50 via-white to-white", tint: "text-fuchsia-200" },
  "data-model": { emoji: "🧑‍🏫", gradient: "from-violet-50 via-white to-white", tint: "text-violet-200" },
};

const FALLBACK: CoachPersona = { emoji: "🧑‍💼", gradient: "from-slate-50 via-white to-white", tint: "text-slate-200" };

export function getCoachPersona(category: string | null | undefined): CoachPersona {
  if (!category) return FALLBACK;
  return COACH_PERSONAS[category] ?? FALLBACK;
}
