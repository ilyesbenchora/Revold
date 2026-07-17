/**
 * Catalogue de suggestions d'ANALYSE pertinentes selon la/les source(s)
 * connectée(s) et sélectionnée(s). Affichées dans l'onglet « Suggestions » du
 * chat pour aider l'utilisateur à explorer ses vraies données sans surcharger
 * le fil de discussion. Cliquer une suggestion lance la question dans le chat.
 */

export const ANALYSIS_SUGGESTIONS: Record<string, string[]> = {
  crm: [
    "Quel est mon closing rate et où est mon principal goulot d'étranglement ?",
    "Répartis mes deals par étape de pipeline et montre le montant pondéré",
    "Quels deals sont stagnants (sans activité) et combien de CA cela représente ?",
    "Mon cycle de vente est-il trop long vs les benchmarks ?",
    "Quelle est ma couverture de pipeline pour atteindre l'objectif ?",
    "Montre l'évolution des deals gagnés par mois",
    "Quels deals à fort montant risquent de glisser ce trimestre ?",
    "Quelle est la performance par commercial (propriétaire) ?",
  ],
  billing: [
    "Quel est mon MRR, mon ARR et mon taux de churn ?",
    "Montre-moi mes plus grosses factures impayées et l'encours total",
    "Répartis mes factures par statut (payé / impayé / en retard)",
    "Quelle est l'évolution de mon revenu récurrent sur 12 mois ?",
    "Quel est mon DSO (délai moyen de paiement) ?",
    "Quels abonnements sont à risque de churn ?",
  ],
  support: [
    "Combien de tickets ouverts et quelle est leur ancienneté moyenne ?",
    "Quels comptes à fort enjeu ont des tickets non résolus ?",
    "Répartis mes tickets par priorité et par statut",
    "Quel est le MRR à risque lié aux tickets support ?",
  ],
  ads: [
    "Quel est mon ROAS réel jusqu'au revenu encaissé, par plateforme ?",
    "Quelle est ma dépense pub et mon coût par conversion (30 j) ?",
    "Quelle plateforme publicitaire performe le mieux ?",
  ],
  cross: [
    "Compare mon CA signé (CRM) vs mon CA réellement facturé",
    "Quels deals gagnés ne sont pas encore facturés ?",
    "Où je perds du revenu entre le closing et l'encaissement ?",
    "Croise mes dépenses pub avec le revenu encaissé (ROAS 360°)",
    "Quels clients à fort MRR ont des tickets support ouverts ?",
    "Rapport performance : pipeline (CRM) croisé au facturé",
  ],
};

/**
 * Suggestions à afficher selon les catégories de sources sélectionnées.
 * 2 catégories ou plus → on ajoute les suggestions CROISÉES en tête.
 */
export function suggestionsForCategories(cats: Set<string>): string[] {
  const out: string[] = [];
  const list = [...cats];
  if (list.length >= 2) out.push(...(ANALYSIS_SUGGESTIONS.cross ?? []));
  for (const c of list) out.push(...(ANALYSIS_SUGGESTIONS[c] ?? []));
  // Dédup en conservant l'ordre.
  return [...new Set(out)];
}
