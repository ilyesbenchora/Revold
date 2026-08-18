/**
 * Cohortes par équipe : chaque cohorte (mapping de propriété CRM) appartient à
 * une équipe (espace de travail) — ou à aucune (transverse, visible par tous).
 * Les droits par équipe (visualisation / modification / création) sont stockés
 * dans la table page_access existante, sous des pseudo-hrefs par groupe
 * (/dashboard/parametres/cohortes#sales…) — aucune migration nécessaire.
 */

export type CohortTeamId = "sales" | "marketing" | "cs" | "finance";

export const COHORT_TEAMS: { id: CohortTeamId; label: string; icon: string }[] = [
  { id: "sales", label: "Ventes", icon: "💼" },
  { id: "marketing", label: "Marketing", icon: "📣" },
  { id: "cs", label: "Service client", icon: "🤝" },
  { id: "finance", label: "Comptabilité", icon: "💳" },
];

export const COHORT_TEAM_IDS = COHORT_TEAMS.map((t) => t.id);

export const isCohortTeam = (v: string): v is CohortTeamId =>
  (COHORT_TEAM_IDS as string[]).includes(v);

/** Pseudo-href page_access du groupe de cohortes d'une équipe. */
export const cohortAccessHref = (team: CohortTeamId) => `/dashboard/parametres/cohortes#${team}`;

/** Équipe par défaut des cohortes standard (clé du mapping → équipe). */
export const STANDARD_COHORT_TEAMS: Record<string, CohortTeamId> = {
  industry: "marketing",
  segment: "marketing",
  source: "marketing",
  priority: "sales",
};

export type CohortRight = "view" | "edit" | "create";

/**
 * Droit d'une équipe (pôle du membre) sur un groupe de cohortes : règle
 * enregistrée sinon défaut — chaque équipe a tous les droits sur SON groupe,
 * aucun sur les autres (c'est tout l'intérêt : une personne marketing ne voit
 * pas les cohortes de vente). L'admin court-circuite tout (géré à l'appel).
 */
export function cohortTeamRight(
  rules: Record<string, Record<string, Record<string, boolean>>>,
  group: CohortTeamId,
  memberTeam: CohortTeamId,
  right: CohortRight,
): boolean {
  const saved = rules[cohortAccessHref(group)]?.[memberTeam]?.[right];
  return saved ?? group === memberTeam;
}
