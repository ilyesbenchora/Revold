export type RoutineFrequency = "daily" | "weekly" | "monthly";

export type RoutineSuggestion = {
  label: string;
  prompt: string;
  frequency: RoutineFrequency;
  time: string; // HH:MM
};

export const FREQUENCY_LABELS: Record<RoutineFrequency, string> = {
  daily: "Tous les jours",
  weekly: "Chaque semaine",
  monthly: "Chaque mois",
};

/**
 * Directive ajoutée au prompt d'une routine : impose un rapport VISUEL
 * EXHAUSTIF (même exigence de qualité que les tables de données) doublé d'une
 * analyse écrite détaillée — le rapport de routine est lu sans conversation,
 * il doit se suffire à lui-même.
 */
export const ROUTINE_REPORT_DIRECTIVE = `

Ce rapport est généré par une ROUTINE : il sera lu tel quel, sans conversation — il doit se suffire à lui-même. Rends ta réponse en DEUX volets complémentaires, sans te limiter en longueur :
1) Un RAPPORT VISUEL COMPLET via render_report — sois EXHAUSTIF : une rangée de blocs kpi avec TOUS les chiffres clés pertinents du périmètre (pas seulement 2-3), PLUSIEURS graphiques (bar/line/area pour la tendance ou la comparaison, donut pour la répartition) et une table détaillée ligne à ligne (les deals, factures ou enregistrements concrets qui composent les chiffres). Sur CHAQUE bloc issu d'aggregate_canonical, ajoute son champ query (entity/groupBy/measure/field) pour le recalcul déterministe. Ne mets JAMAIS la période dans le titre.
2) Une ANALYSE ÉCRITE détaillée et structurée dans ta réponse texte : les chiffres marquants et ce qu'ils signifient, la tendance vs la période précédente, les écarts et anomalies détectés, les causes probables, les risques, et 2-3 recommandations concrètes et priorisées. Sois le plus exhaustif possible dans cette analyse.
Chiffres réels uniquement — si une donnée manque pour la période, dis-le franchement.`;

/** Routines suggérées par coach — habitudes de chat adaptées au métier. */
const SUGGESTIONS: Record<string, RoutineSuggestion[]> = {
  "coaching-ventes": [
    {
      label: "Récap des ventes de la semaine",
      prompt:
        "Fais le récap des ventes de la semaine en cours : CA signé, deals gagnés et perdus, pipeline créé, closing rate — et compare à la semaine précédente.",
      frequency: "daily",
      time: "09:00",
    },
    {
      label: "Récap des ventes du mois",
      prompt:
        "Fais le récap des ventes du mois en cours : CA signé, deals gagnés et perdus, répartition du pipeline par étape, closing rate — et compare au mois précédent.",
      frequency: "daily",
      time: "09:00",
    },
    {
      label: "Récap des ventes du semestre",
      prompt:
        "Fais le récap des ventes du semestre en cours : CA signé par mois, deals gagnés, évolution du closing rate et du cycle de vente — avec la tendance sur 6 mois.",
      frequency: "daily",
      time: "09:00",
    },
  ],
  "coaching-marketing": [
    {
      label: "Récap acquisition de la semaine",
      prompt:
        "Fais le récap acquisition de la semaine : leads créés, MQL, conversion MQL→SQL, meilleures sources — et compare à la semaine précédente.",
      frequency: "daily",
      time: "09:00",
    },
    {
      label: "Récap du tunnel du mois",
      prompt:
        "Fais le récap du tunnel d'acquisition du mois : volume par étape (lead → MQL → SQL → deal), taux de conversion et fuites principales.",
      frequency: "daily",
      time: "09:00",
    },
  ],
  "coaching-data-model": [
    {
      label: "Point trésorerie du jour",
      prompt:
        "Fais le point trésorerie du jour : encaissements récents, factures impayées et en retard, DSO, échéances à venir.",
      frequency: "daily",
      time: "09:00",
    },
    {
      label: "Récap facturation du mois",
      prompt:
        "Fais le récap facturation du mois : CA facturé, répartition payé/impayé, MRR et churn revenue — et compare au mois précédent.",
      frequency: "daily",
      time: "09:00",
    },
  ],
  "coaching-data": [
    {
      label: "État qualité des données de la semaine",
      prompt:
        "Fais l'état hebdomadaire de la qualité des données : complétude, doublons, entités réconciliées entre les outils — et les écarts à corriger en priorité.",
      frequency: "weekly",
      time: "09:00",
    },
    {
      label: "Écarts cross-source du mois",
      prompt:
        "Fais le récap mensuel des écarts cross-source : CA signé (CRM) vs CA facturé, deals gagnés sans facture, chiffré en euros.",
      frequency: "daily",
      time: "09:00",
    },
  ],
};

/** Routines génériques pour les agents sans catalogue dédié. */
const DEFAULT_SUGGESTIONS: RoutineSuggestion[] = [
  {
    label: "Récap de la semaine",
    prompt:
      "Fais le récap de la semaine sur ton périmètre : chiffres clés, évolutions notables et points d'attention.",
    frequency: "daily",
    time: "09:00",
  },
  {
    label: "Récap du mois",
    prompt:
      "Fais le récap du mois sur ton périmètre : chiffres clés, tendance par rapport au mois précédent et points d'attention.",
    frequency: "daily",
    time: "09:00",
  },
];

export function routineSuggestionsFor(agentKey: string): RoutineSuggestion[] {
  return SUGGESTIONS[agentKey] ?? DEFAULT_SUGGESTIONS;
}
