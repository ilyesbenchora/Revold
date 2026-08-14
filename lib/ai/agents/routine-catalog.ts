export type RoutineFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

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
  quarterly: "Chaque trimestre",
  yearly: "Chaque année",
};

// ── Constructeur de RÉCAP sur mesure ────────────────────────────────────────
// L'utilisateur choisit la période du récap (semaine, mois, trimestre, année,
// dates personnalisées) PUIS les thèmes de KPIs MACRO à couvrir — le prompt de
// la routine est assemblé à la création.

export type RecapPeriodKind = "week" | "month" | "quarter" | "year" | "custom";

export const RECAP_PERIODS: { id: RecapPeriodKind; label: string; phrase: string; frequency: RoutineFrequency }[] = [
  { id: "week", label: "Récap de la semaine", phrase: "de la semaine écoulée", frequency: "weekly" },
  { id: "month", label: "Récap du mois", phrase: "du mois écoulé", frequency: "monthly" },
  { id: "quarter", label: "Récap du trimestre", phrase: "du trimestre écoulé", frequency: "quarterly" },
  { id: "year", label: "Récap de l'année", phrase: "de l'année écoulée", frequency: "yearly" },
  { id: "custom", label: "Période personnalisée", phrase: "", frequency: "monthly" },
];

export type RecapTopic = { id: string; label: string; detail: string };

// Thèmes MACRO par agent/coach — chaque thème décrit précisément à l'agent les
// KPIs agrégés attendus (jamais de listes détaillées : on parle de récap).
const SALES_TOPICS: RecapTopic[] = [
  { id: "ventes", label: "Récap des ventes", detail: "CA signé, deals gagnés / perdus, comparaison à la période précédente" },
  { id: "deals_en_cours", label: "Deals en cours", detail: "pipeline par étape (volume et montant), deals proches du closing" },
  { id: "commerciaux", label: "Performance des commerciaux", detail: "CA signé et deals gagnés par commercial, top / flop" },
  { id: "conversion", label: "Closing rate & cycle de vente", detail: "taux de closing, durée moyenne du cycle, évolution" },
  { id: "projection", label: "Projection", detail: "projection pondérée du pipeline et prévision de CA" },
];

const MARKETING_TOPICS: RecapTopic[] = [
  { id: "acquisition", label: "Acquisition", detail: "leads créés, MQL, SQL, comparaison à la période précédente" },
  { id: "tunnel", label: "Tunnel de conversion", detail: "taux de conversion lead → MQL → SQL → deal et principales fuites" },
  { id: "sources", label: "Sources", detail: "répartition des leads et deals par source, meilleures sources" },
  { id: "pipeline_genere", label: "Pipeline généré", detail: "deals créés et montant de pipeline généré par le marketing" },
];

const FINANCE_TOPICS: RecapTopic[] = [
  { id: "tresorerie", label: "Trésorerie", detail: "encaissements, décaissements, flux net et solde" },
  { id: "facturation", label: "Facturation", detail: "CA facturé, répartition payé / impayé" },
  { id: "impayes", label: "Impayés & DSO", detail: "créances en retard (montant agrégé), DSO, tendance" },
  { id: "mrr", label: "MRR & churn", detail: "MRR, nouveaux abonnements, churn revenue" },
  { id: "echeances", label: "Échéances", detail: "échéances fiscales et paiements à venir" },
];

const DATA_TOPICS: RecapTopic[] = [
  { id: "qualite", label: "Qualité des données", detail: "complétude des champs clés, doublons, évolution" },
  { id: "rapprochement", label: "Rapprochement multi-outils", detail: "entités réconciliées entre outils, taux de rapprochement" },
  { id: "ecarts", label: "Écarts cross-source", detail: "CA signé (CRM) vs CA facturé, deals gagnés sans facture, chiffré en euros" },
  { id: "volumes", label: "Volumes synchronisés", detail: "volumes importés par outil et par type d'entité, trous de synchronisation" },
];

const SUPPORT_TOPICS: RecapTopic[] = [
  { id: "tickets", label: "Tickets", detail: "volume de tickets par statut, délai de résolution, tendance" },
  { id: "satisfaction", label: "Satisfaction", detail: "signaux de satisfaction et d'engagement client" },
  { id: "churn", label: "Risque de churn", detail: "comptes à risque (vision agrégée), churn constaté" },
];

const TEAMS_TOPICS: RecapTopic[] = [
  { id: "activite", label: "Activité CRM", detail: "rythme de création et de clôture de deals par l'équipe" },
  { id: "discipline", label: "Discipline de saisie", detail: "complétude des fiches, qualification MQL/SQL, statuts à jour" },
  { id: "adoption", label: "Adoption des outils", detail: "usage réel de la stack par équipe" },
];

const ALIGN_TOPICS: RecapTopic[] = [
  { id: "relais", label: "Relais entre services", detail: "conversion MQL → deal → facture, points de rupture" },
  { id: "process", label: "Process & workflows", detail: "workflows actifs, automatisations en échec ou manquantes" },
];

const DEFAULT_TOPICS: RecapTopic[] = [
  { id: "chiffres", label: "Chiffres clés", detail: "les chiffres clés agrégés du périmètre et leur tendance" },
  { id: "attention", label: "Points d'attention", detail: "écarts, anomalies et risques détectés" },
];

const AGENT_RECAP_TOPICS: Record<string, RecapTopic[]> = {
  performance: SALES_TOPICS,
  "coaching-ventes": SALES_TOPICS,
  "coaching-marketing": MARKETING_TOPICS,
  "paiement-facturation": FINANCE_TOPICS,
  "coaching-data-model": FINANCE_TOPICS,
  proprietes: DATA_TOPICS,
  "coaching-data": DATA_TOPICS,
  "service-client": SUPPORT_TOPICS,
  equipes: TEAMS_TOPICS,
  automatisations: ALIGN_TOPICS,
};

export function recapTopicsFor(agentKey: string): RecapTopic[] {
  return AGENT_RECAP_TOPICS[agentKey] ?? DEFAULT_TOPICS;
}

const fmtFr = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Assemble le libellé + le prompt d'une routine de récap sur mesure : période
 * choisie + thèmes MACRO cochés. Le prompt insiste sur l'agrégé (chiffres
 * clés, tendances, comparaisons) — jamais de listes détaillées ligne à ligne.
 */
export function buildRecapRoutine(opts: {
  agentKey: string;
  periodKind: RecapPeriodKind;
  from?: string;
  to?: string;
  topicIds: string[];
}): { label: string; prompt: string; frequency: RoutineFrequency } {
  const period = RECAP_PERIODS.find((p) => p.id === opts.periodKind) ?? RECAP_PERIODS[0];
  const phrase =
    period.id === "custom" && opts.from && opts.to
      ? `de la période du ${fmtFr(opts.from)} au ${fmtFr(opts.to)}`
      : period.phrase;
  const all = recapTopicsFor(opts.agentKey);
  const picked = all.filter((t) => opts.topicIds.includes(t.id));
  const topics = picked.length > 0 ? picked : all;
  const label =
    period.id === "custom" && opts.from && opts.to
      ? `Récap ${fmtFr(opts.from)} → ${fmtFr(opts.to)} — ${topics.map((t) => t.label.toLowerCase()).join(", ")}`
      : `${period.label} — ${topics.map((t) => t.label.toLowerCase()).join(", ")}`;
  const prompt =
    `Fais le récap ${phrase} sur ton périmètre, centré EXCLUSIVEMENT sur ces thèmes : ` +
    topics.map((t) => `${t.label} (${t.detail})`).join(" ; ") +
    ". Reste MACRO : uniquement des chiffres clés agrégés, des tendances et des comparaisons à la période précédente — c'est un récap, pas un inventaire.";
  return { label, prompt, frequency: period.frequency };
}

/**
 * Directive ajoutée au prompt d'une routine : impose un rapport VISUEL
 * EXHAUSTIF (même exigence de qualité que les tables de données) doublé d'une
 * analyse écrite détaillée — le rapport de routine est lu sans conversation,
 * il doit se suffire à lui-même.
 */
export const ROUTINE_REPORT_DIRECTIVE = `

Ce rapport est généré par une ROUTINE : il sera lu tel quel, sans conversation — il doit se suffire à lui-même. C'est un RÉCAP : reste MACRO. Rends ta réponse en DEUX volets complémentaires :
1) Un RAPPORT VISUEL via render_report, COMPLET et VARIÉ dans ses visualisations : une rangée de blocs kpi (tuiles) avec les chiffres clés AGRÉGÉS du périmètre demandé, puis des graphiques VARIÉS — au moins UNE courbe/aire (tendance dans le temps), UN donut (répartition), et des barres (comparaison) dès que la donnée s'y prête — et une table de SYNTHÈSE agrégée (par étape, par mois, par commercial, par statut…). JAMAIS de liste exhaustive ligne à ligne des enregistrements, et jamais deux graphiques du même type quand un autre type raconte mieux la donnée. Sur CHAQUE bloc issu d'aggregate_canonical, ajoute son champ query (entity/groupBy/measure/field) pour le recalcul déterministe. Ne mets JAMAIS la période dans le titre.
2) Une ANALYSE ÉCRITE structurée dans ta réponse texte : les chiffres marquants et ce qu'ils signifient, la tendance vs la période précédente, les écarts et anomalies détectés, les causes probables, les risques, et 2-3 recommandations concrètes et priorisées.
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
