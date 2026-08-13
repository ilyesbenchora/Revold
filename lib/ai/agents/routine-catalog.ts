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
 * Directive ajoutée au prompt d'une routine : impose un rapport VISUEL avec la
 * même exigence de qualité que les tables de données (KPIs, graphique, table,
 * et query sur chaque bloc pour le recalcul déterministe par période).
 */
export const ROUTINE_REPORT_DIRECTIVE = `

Rends ta réponse sous forme de RAPPORT VISUEL via render_report — même exigence de qualité que les tables de données : des blocs kpi pour les chiffres clés, un graphique (bar, line ou donut) pour la tendance ou la répartition, et un bloc table pour le détail. Sur CHAQUE bloc issu d'aggregate_canonical, ajoute son champ query (entity/groupBy/measure/field) pour le recalcul déterministe par période. Chiffres réels uniquement — si une donnée manque, dis-le. Ne mets JAMAIS la période dans le titre.`;

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
