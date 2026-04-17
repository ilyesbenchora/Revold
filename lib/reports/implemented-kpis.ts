/**
 * Source de vérité : KPIs réellement calculables par l'engine `report-kpis.ts`.
 *
 * Cette liste reflète exactement les clés `V["..."] = ...` (autres que `= null`)
 * dans `computeMetricValues()`. Toute KPI absente de ce Set est un placeholder
 * (données pas encore branchées : Stripe, Pennylane, ticket timestamps, etc.)
 * et ne doit pas être proposée à la sélection en production.
 *
 * Quand vous ajoutez/retirez une métrique dans `report-kpis.ts`, mettez ce Set à jour.
 */

export const IMPLEMENTED_KPIS = new Set<string>([
  // Attribution — contacts
  "Nb de contacts par owner",
  "% de la base par owner",
  "Contacts sans owner (non attribués)",
  "Évolution mensuelle de l'attribution",
  "% de contacts attribués par owner",
  "Nb de contacts orphelins (sans owner)",
  "Nb de contacts créés par source outbound",
  "Taux de conversion contact → deal par source",
  "Nb de contacts source SOCIAL",
  "% des contacts totaux issus du social",
  "% de contacts orphelins",
  "% de contacts enrichis dans la base",
  "% de contacts enrichis par owner",
  "Complétude par champ clé (%)",

  // Enrichissement par objet
  "Enrichissement Contacts (%)",
  "Enrichissement Entreprises (%)",
  "Enrichissement Transactions (%)",
  "Score global de qualité CRM (%)",

  // Attribution — deals
  "Nb de deals par owner",
  "Montant total du pipeline par owner (€)",
  "Nb de deals sans owner",
  "Deals par owner par pipeline",
  "Top owners — deals actifs",
  "Top owners — montant pipeline (€)",
  "Répartition pipeline par owner (€)",
  "Taux de conversion global pipeline → Won",
  "Nb de deals stagnants (>30j même stage)",
  "Montant total des deals stagnants (€)",
  "Top 10 deals bloqués par montant",
  "Stage où les deals bloquent le plus",
  "Taux de conversion entre chaque stage (%)",
  "Stage avec le plus de déperdition",
  "Évolution mensuelle des taux de conversion",

  // Companies
  "Nb de companies par owner",
  "Revenue annuel total des companies par owner (€)",
  "Companies sans owner",
  "Répartition par industrie par owner",

  // CA / Closed Won
  "Nb de deals Closed Won par mois",
  "CA total Closed Won par mois (€)",
  "Deal moyen Closed Won (€)",
  "Évolution vs mois précédent (%)",
  "CA Closed Won par pipeline (€)",
  "Nb de deals Won par pipeline",
  "Deal moyen par pipeline (€)",
  "Taux de conversion par pipeline (%)",
  "CA Closed Won par owner (€)",
  "Nb de deals Won par owner",
  "Deal moyen par owner (€)",
  "CA réalisé Closed Won (€)",
  "Écart forecast vs réalisé (%)",
  "Pipeline pondéré total (€)",
  "Pipeline pondéré par owner",

  // Outbound / sources
  "CA total Closed Won issu de l'outbound (€)",
  "Nb de deals Closed Won par campagne",
  "Durée moyenne first-touch → Closed Won (jours)",
  "Durée médiane par pipeline",
  "Temps par étape (hs_time_in_latest_deal_stage)",
  "Comparaison outbound vs inbound",

  // Activité — appels
  "Nb d'appels par owner / jour",
  "Durée totale d'appels par owner (h)",
  "Taux de connexion (décrochés / tentés)",
  "Nb de deals touchés par les appels par owner",
  "Nb moyen d'appels par deal gagné vs perdu",
  "Durée moyenne des appels sur deals won",
  "CA total des deals avec appels (€)",
  "CA moyen par deal avec appels vs sans appels",
  "% des deals won ayant eu un appel",
  "Top 5 commerciaux par CA influencé via appels",
  "Nb moyen de calls/meetings sur deals Won vs Lost",
  "Durée moyenne des calls sur deals Won",
  "Nb de notes logées (num_notes) sur deals gagnés",

  // Activité — emails
  "Ratio emails envoyés / réponses reçues (hs_sales_email_last_replied)",
  "Nb d'emails envoyés par owner / semaine",
  "Nb d'emails reçus (réponses) par owner",
  "Taux de réponse par owner (%)",
  "Top 5 commerciaux les plus actifs par email",
  "Nb moyen d'emails par deal",
  "Taux de réponse email par deal (hs_sales_email_last_replied)",
  "Nb de touchpoints email avant Closed Won",

  // Activité — meetings
  "Nb moyen de meetings par deal Won vs Lost",
  "CA moyen des deals avec 3+ meetings (€)",
  "Taux de conversion avec meeting vs sans",
  "Top commerciaux par CA influencé via meetings",
  "Nb de meetings tenus par période",
  "Taux de conversion meeting → deal créé",
  "Taux de show-up (meetings réalisés / planifiés)",
  "Nb moyen de meetings par deal fermé",

  // Données / qualité
  "Nb de contacts sans company associée",
  "Lifecycle stage des contacts orphelins",
  "Champs manquants les plus fréquents par owner",
  "Score de qualité moyen par portefeuille",
  "Nb de contacts à enrichir en priorité par owner",
  "Champs les moins remplis (bottom 5)",
  "Nb de deals sans contact associé",
  "Nb de deals sans company associée",
  "Montant total des deals orphelins (€)",
  "% de deals orphelins par pipeline",

  // Source SOCIAL (revenue)
  "Taux de conversion social → deal",
  "CA généré via contacts social (€)",
  "CA total Closed Won source SOCIAL (€)",
  "Nb de deals Won source SOCIAL",
  "Taille moyenne des deals SOCIAL vs autres sources",
  "Cycle moyen des deals SOCIAL (jours)",

  // Tickets / CS
  "Nb de tickets ouverts / fermés par période",
  "Nb de tickets ouverts / fermés par mois",
  "% de tickets haute priorité",
  "Tickets haute priorité ouverts",
  "Score CSAT proxy global (%)",
  "Taux de résolution au 1er contact (%)",
  "Tickets par pipeline support",
  "Nb de tickets par canal",
  "CSAT proxy par agent support",
  "Taux de réouverture de tickets (%)",

  // Facturation / RevOps
  "Nb de factures émises par mois",
  "Montant total facturé (€)",
  "Montant total encaissé (€)",
  "Nb de factures en attente de paiement",
  "Montant total impayé (€)",
  "CA forecast HubSpot vs facturé réel (€)",
  "Écart moyen forecast vs facturé (%)",
  "Nb de factures impayées > 90 jours",

  // MRR / ARR
  "MRR total actuel (€)",
  "ARR extrapolé (€)",
  "Taux de churn gross (%)",
  "Nb de paiements réussis vs échoués",
  "Taux de succès global (%)",
  "Montant total en échec (€)",

  // Cycle / vélocité
  "Durée moyenne par étape (jours)",
  "Étapes les plus lentes (>21 jours)",
  "Vélocité totale du pipeline (jours)",
  "Comparaison par pipeline",
  "Cycle moyen global (jours)",
  "Cycle moyen par pipeline",
  "Stage le plus bloquant",
  "Deals won par pipeline",

  // Activité — owners
  "Nb total d'appels par owner",
  "Nb total d'emails envoyés par owner",
  "Nb total de meetings par owner",
  "Ratio emails envoyés / reçus",

  // Pipeline — analyse
  "Deals avec meetings vs sans meetings",
  "CA pipeline avec meetings vs sans (€)",
  "Nb moyen de meetings par deal actif",
  "Deals won avec 3+ meetings",
  "Nb de deals par stage actuel",
  "Concentration du pipeline (%)",
  "Deals sans montant par stage",
  "Deals actifs par pipeline",
  "Montant actif par pipeline (€)",
  "Pipeline pondéré par pipeline (€)",
  "Nb d'owners actifs par pipeline",

  // Lifecycle / marketing
  "Répartition par lifecycle stage",
  "Contacts source Offline",
  "Contacts source Organic Search",
  "Contacts source Direct Traffic",
  "Contacts source Autres",
  "Contacts créés par mois (tendance)",
  "Contacts créés ce mois",
  "Contacts créés mois précédent",
  "Variation mois vs mois (%)",
  "Total contacts Lead",
  "Total contacts Opportunity",
  "Taux Lead → Opportunity (%)",
  "Deals créés par mois (tendance)",
  "Contacts avec email (%)",
  "Contacts avec téléphone (%)",
  "Contacts avec poste (%)",
  "Contacts rattachés à une entreprise (%)",

  // Pipeline montants
  "Pipeline total ouvert (€)",
  "Deals avec montant (%)",
  "Deal moyen ouvert (€)",
  "CA total par pipeline (€)",
  "Deal moyen par pipeline actif (€)",

  // Efficacité process
  "Deals won par mois (tendance)",
  "Ratio créés / closés",
  "Pipeline net (créés - closés)",
]);

/** Limite produit : 1 KPI par rapport pour garantir la cohérence analytique
 *  et permettre un format de visualisation adapté à l'indicateur. */
export const MAX_KPIS_PER_REPORT = 1;

/** Formats de visualisation supportés par <KpiVisual>. */
export const KPI_FORMATS = [
  { id: "auto", label: "Auto (recommandé)", hint: "Le format optimal est détecté à partir du KPI" },
  { id: "gauge", label: "Jauge", hint: "Barre horizontale colorée pour les pourcentages, taux, scores" },
  { id: "donut", label: "Anneau (donut)", hint: "Anneau circulaire avec % au centre — pour taux, scores, complétude" },
  { id: "bar_h", label: "Barres horizontales", hint: "Comparaison de plusieurs entités (owners, pipelines)" },
  { id: "bar_chart", label: "Histogramme", hint: "Barres verticales par période — comparaison temporelle" },
  { id: "line_chart", label: "Courbe d'évolution", hint: "Ligne avec grille pour tendances multi-mois" },
  { id: "area_chart", label: "Aire de tendance", hint: "Courbe avec aire remplie — volumes cumulés" },
  { id: "sparkline", label: "Sparkline (compact)", hint: "Mini-courbe condensée — tendance rapide" },
  { id: "evaluation", label: "Évaluation textuelle", hint: "Durée, cycle, délai — texte qualitatif coloré" },
] as const;

export type KpiFormat = (typeof KPI_FORMATS)[number]["id"];

/** Vérifie qu'un nom de KPI est calculable par l'engine. */
export function isKpiImplemented(name: string): boolean {
  return IMPLEMENTED_KPIS.has(name);
}

/** Filtre une liste de KPIs pour ne garder que ceux implémentés. */
export function filterImplementedKpis(names: string[]): string[] {
  return names.filter((n) => IMPLEMENTED_KPIS.has(n));
}

/**
 * Recommande le format de visualisation optimal pour un KPI à partir de son
 * label. Logique alignée sur les sorties de `computeMetricValues()` :
 *
 *   - Tendances mensuelles ("→" en runtime) → line_chart
 *   - Pourcentages, taux, scores, complétude → donut
 *   - Comparaison d'entités (par owner / par pipeline / top X) → bar_h
 *   - Durée, cycle, délai, jours → evaluation
 *   - Montant simple (€) → currency (résolu par "auto")
 *   - Sinon → "auto" (laisse le renderer décider)
 */
export function recommendFormat(kpiLabel: string): KpiFormat {
  const l = kpiLabel.toLowerCase();

  // Time-series (produit "12/26 348 → 01/27 412 → ...")
  if (
    l.includes("(tendance)") ||
    l.includes("par mois") ||
    l.includes("évolution mensuelle") ||
    l.includes("évolution du") ||
    l.includes("variation mois")
  ) {
    return "line_chart";
  }

  // Pourcentages / scores / complétude → donut (plus visuel qu'une jauge)
  if (
    l.includes("(%)") ||
    l.includes(" % ") ||
    l.endsWith(" %") ||
    l.includes("taux ") ||
    l.includes("taux de ") ||
    l.includes("score ") ||
    l.includes("complétude") ||
    l.includes("enrichissement") ||
    l.includes("csat") ||
    l.includes("connexion")
  ) {
    return "donut";
  }

  // Cycles / durées / délais → évaluation textuelle colorée
  if (
    l.includes("cycle") ||
    l.includes("durée") ||
    l.includes("délai") ||
    l.includes("vélocité") ||
    l.includes("(jours)") ||
    l.includes("(h)") ||
    l.includes("temps ")
  ) {
    return "evaluation";
  }

  // Comparaison multi-entités → barres horizontales
  if (
    l.includes("par owner") ||
    l.includes("par pipeline") ||
    l.includes("par stage") ||
    l.includes("par canal") ||
    l.includes("par campagne") ||
    l.startsWith("top ") ||
    l.includes("répartition ") ||
    l.includes("comparaison ") ||
    l.includes("classement")
  ) {
    return "bar_h";
  }

  // Sinon : auto (resolveType à l'affichage selon la valeur)
  return "auto";
}
