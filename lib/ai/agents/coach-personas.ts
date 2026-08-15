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
  /** Pitch concis : profil d'expert + valeur apportée (fenêtre de profil). */
  pitch: string;
  /** Dégradé de fond léger (Tailwind), pensé pour rester discret. */
  gradient: string;
  /** Couleur d'accent de la silhouette en filigrane. */
  tint: string;
};

/** Persona par clé d'agent — un personnage par agent de Mon équipe IA. */
export const AGENT_PERSONAS: Record<string, CoachPersona> = {
  performance: { name: "Chloé", emoji: "👩‍💻", role: "Analyste performance", pitch: "Je décortique tes deals, ton pipeline et ton win rate pour révéler où se cache la croissance — et les leviers concrets pour l'activer.", gradient: "from-amber-50 via-white to-white", tint: "text-amber-200" },
  "paiement-facturation": { name: "Inès", emoji: "👩‍💼", role: "Experte trésorerie", pitch: "Je réconcilie factures, paiements et impayés pour piloter le cash réel — pas seulement le pipeline théorique.", gradient: "from-emerald-50 via-white to-white", tint: "text-emerald-200" },
  "service-client": { name: "Hugo", emoji: "🙋‍♂️", role: "Référent relation client", pitch: "Je croise tickets et comptes pour anticiper le churn et protéger tes revenus récurrents avant qu'il ne soit trop tard.", gradient: "from-rose-50 via-white to-white", tint: "text-rose-200" },
};

const FALLBACK: CoachPersona = { name: "Revold", emoji: "🧑‍💻", role: "Agent IA", pitch: "Ton agent expert Revold : il analyse tes données et te propose des actions concrètes pour progresser.", gradient: "from-slate-50 via-white to-white", tint: "text-slate-200" };

/** Persona d'un agent par sa clé. */
export function getAgentPersona(agentKey: string | null | undefined): CoachPersona {
  if (!agentKey) return FALLBACK;
  return AGENT_PERSONAS[agentKey] ?? FALLBACK;
}

// Personnages au prénom féminin (pour l'accord grammatical il/elle).
const FEMININE_AGENTS = new Set([
  "performance",            // Chloé
  "paiement-facturation",   // Inès
]);

/** Vrai si le personnage de l'agent porte un prénom féminin (accord il/elle). */
export function agentIsFeminine(agentKey: string | null | undefined): boolean {
  return !!agentKey && FEMININE_AGENTS.has(agentKey);
}

/**
 * URL de l'avatar illustré du personnage — un personnage humain stylisé
 * (déterministe : même personnage = même visage), au rendu moderne et coloré.
 * Utilisé pour l'avatar ET le filigrane de fond des blocs.
 *
 * Pour coller pixel-près à une charte de portraits 3D sur-mesure : déposer les
 * images dans /public/personas/<clé-agent>.png et faire pointer cette fonction
 * (ou personaImagePath) dessus.
 */
export function personaAvatarUrl(name: string, size = 128): string {
  const seed = encodeURIComponent(`revold-${name}`);
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&size=${size}&radius=50&backgroundType=gradientLinear&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

/** Chemin d'un portrait sur-mesure hébergé (si fourni), par clé d'agent. */
export function personaImagePath(agentKey: string): string {
  return `/personas/${agentKey}.png`;
}
