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

/** Persona par clé d'agent (couvre coach + non-coach). */
export const AGENT_PERSONAS: Record<string, CoachPersona> = {
  // Données
  performance: { name: "Chloé", emoji: "👩‍💻", role: "Analyste performance", pitch: "Je décortique tes deals, ton pipeline et ton win rate pour révéler où se cache la croissance — et les leviers concrets pour l'activer.", gradient: "from-amber-50 via-white to-white", tint: "text-amber-200" },
  automatisations: { name: "Théo", emoji: "👨‍🔧", role: "Ingénieur workflows", pitch: "Je repère les tâches manuelles et répétitives à automatiser pour faire gagner des heures à ton équipe, sans rien casser.", gradient: "from-indigo-50 via-white to-white", tint: "text-indigo-200" },
  "paiement-facturation": { name: "Inès", emoji: "👩‍💼", role: "Experte facturation", pitch: "Je réconcilie factures, paiements et impayés pour piloter le cash réel — pas seulement le pipeline théorique.", gradient: "from-emerald-50 via-white to-white", tint: "text-emerald-200" },
  "service-client": { name: "Hugo", emoji: "🙋‍♂️", role: "Référent relation client", pitch: "Je croise tickets et comptes pour anticiper le churn et protéger tes revenus récurrents avant qu'il ne soit trop tard.", gradient: "from-rose-50 via-white to-white", tint: "text-rose-200" },
  equipes: { name: "Sarah", emoji: "🧑‍🤝‍🧑", role: "Coach d'équipes", pitch: "J'analyse la performance commercial par commercial pour équilibrer la charge et faire monter chacun en compétence.", gradient: "from-sky-50 via-white to-white", tint: "text-sky-200" },
  proprietes: { name: "Karim", emoji: "🕵️", role: "Auditeur CRM", pitch: "Je traque les champs manquants et incohérents qui faussent tes analyses et bloquent tes automatisations.", gradient: "from-violet-50 via-white to-white", tint: "text-violet-200" },
  // Coaching
  "coaching-ventes": { name: "Marc", emoji: "👨‍💼", role: "Coach des ventes", pitch: "Je traque les deals qui bloquent, muscle ton closing et fluidifie ton pipeline pour accélérer le chiffre.", gradient: "from-blue-50 via-white to-white", tint: "text-blue-200" },
  "coaching-marketing": { name: "Léa", emoji: "👩‍🎨", role: "Coach marketing", pitch: "J'optimise tes sources d'acquisition et ton taux de conversion pour des leads plus qualifiés, à moindre coût.", gradient: "from-amber-50 via-white to-white", tint: "text-amber-200" },
  "coaching-data": { name: "Sofia", emoji: "👩‍🔬", role: "Coach data", pitch: "Je fiabilise et enrichis tes données pour que tes décisions reposent sur du solide, pas sur du bruit.", gradient: "from-emerald-50 via-white to-white", tint: "text-emerald-200" },
  "coaching-integration": { name: "Yanis", emoji: "👨‍💻", role: "Coach intégration", pitch: "Je maximise l'adoption de tes outils et connecte ta stack pour une donnée unifiée et vraiment exploitable.", gradient: "from-indigo-50 via-white to-white", tint: "text-indigo-200" },
  "coaching-cross-source": { name: "Nina", emoji: "👩‍🚀", role: "Coach cross-source", pitch: "Je croise CRM, facturation et support pour révéler des insights invisibles source par source.", gradient: "from-fuchsia-50 via-white to-white", tint: "text-fuchsia-200" },
  "coaching-data-model": { name: "Adam", emoji: "👨‍🏫", role: "Coach modèle de données", pitch: "J'audite ton CRM et structure tes objets pour un socle de données propre, cohérent et évolutif.", gradient: "from-violet-50 via-white to-white", tint: "text-violet-200" },
  // Prévisions
  "prev-ventes": { name: "Emma", emoji: "🧑‍🚀", role: "Prévisionniste ventes", pitch: "Je projette ton atterrissage commercial à partir de ton historique pour anticiper — au lieu de subir.", gradient: "from-blue-50 via-white to-white", tint: "text-blue-200" },
  "prev-marketing": { name: "Lucas", emoji: "👨‍🚀", role: "Prévisionniste marketing", pitch: "Je modélise tes leads et conversions futurs pour caler budget et objectifs d'acquisition avec confiance.", gradient: "from-orange-50 via-white to-white", tint: "text-orange-200" },
  "prev-revenue": { name: "Maya", emoji: "👩‍💼", role: "Prévisionniste revenue", pitch: "Je projette ton MRR/ARR et ton churn pour sécuriser ta trajectoire de revenus et repérer les risques tôt.", gradient: "from-teal-50 via-white to-white", tint: "text-teal-200" },
  "prev-donnees": { name: "Noah", emoji: "👨‍🔬", role: "Prévisionniste données", pitch: "J'anticipe la dérive de qualité de tes données pour agir avant qu'elle n'impacte tes décisions.", gradient: "from-sky-50 via-white to-white", tint: "text-sky-200" },
  // Dashboard
  reporting: { name: "Alix", emoji: "🧑‍💻", role: "Analyste reporting", pitch: "Je transforme tes données cross-source en rapports clairs et visuels, prêts à décider en un coup d'œil.", gradient: "from-slate-50 via-white to-white", tint: "text-slate-200" },
};

const FALLBACK: CoachPersona = { name: "Revold", emoji: "🧑‍💻", role: "Agent IA", pitch: "Ton agent expert Revold : il analyse tes données et te propose des actions concrètes pour progresser.", gradient: "from-slate-50 via-white to-white", tint: "text-slate-200" };

/** Persona d'un agent par sa clé. */
export function getAgentPersona(agentKey: string | null | undefined): CoachPersona {
  if (!agentKey) return FALLBACK;
  return AGENT_PERSONAS[agentKey] ?? FALLBACK;
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
