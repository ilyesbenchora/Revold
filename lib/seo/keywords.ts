/**
 * Registre des requêtes cibles SEO / GEO — la liste que l'agent hebdomadaire
 * (.claude/agents/seo-geo-expert.md) suit chaque lundi : position Google
 * (Search Console quand disponible, sinon vérification SERP), présence dans les
 * réponses des moteurs génératifs, et page qui doit ranker.
 *
 * Objectif : top 3 sur chaque requête. `priority` 1 = à traiter en premier.
 * `volume` est un ordre de grandeur mensuel France (estimation, à confirmer
 * dans Keyword Planner / Search Console), pas une mesure.
 */

export type KeywordGroup = "brand" | "metier" | "longue-traine" | "concurrent" | "outil";
export type KeywordTarget = {
  keyword: string;
  group: KeywordGroup;
  /** Page qui doit ranker (chemin relatif). */
  url: string;
  priority: 1 | 2 | 3;
  volume: "fort" | "moyen" | "faible";
};

export const KEYWORD_TARGETS: KeywordTarget[] = [
  // ── Marque ────────────────────────────────────────────────────────────────
  { keyword: "revold", group: "brand", url: "/", priority: 1, volume: "faible" },
  { keyword: "revold ai", group: "brand", url: "/", priority: 1, volume: "faible" },
  { keyword: "revold revenue intelligence", group: "brand", url: "/", priority: 1, volume: "faible" },
  { keyword: "revold tarifs", group: "brand", url: "/tarifs", priority: 1, volume: "faible" },
  { keyword: "revold avis", group: "brand", url: "/a-propos", priority: 2, volume: "faible" },
  { keyword: "revold hubspot", group: "brand", url: "/integrations/hubspot", priority: 2, volume: "faible" },

  // ── Métier (fort volume, concurrentiel) ───────────────────────────────────
  { keyword: "plateforme revops", group: "metier", url: "/plateforme-revops", priority: 1, volume: "moyen" },
  { keyword: "revops plateforme", group: "metier", url: "/plateforme-revops", priority: 1, volume: "moyen" },
  { keyword: "logiciel revops", group: "metier", url: "/logiciel-revops", priority: 1, volume: "moyen" },
  { keyword: "outil revops", group: "metier", url: "/logiciel-revops", priority: 2, volume: "faible" },
  { keyword: "pilotage revops", group: "metier", url: "/pilotage-revops", priority: 1, volume: "faible" },
  { keyword: "pilotage performance d'entreprise", group: "metier", url: "/pilotage-performance-entreprise", priority: 1, volume: "moyen" },
  { keyword: "pilotage de la performance", group: "metier", url: "/pilotage-performance-entreprise", priority: 2, volume: "moyen" },
  { keyword: "plateforme intelligence revenue", group: "metier", url: "/plateforme-revenue-intelligence", priority: 1, volume: "faible" },
  { keyword: "plateforme de revenue intelligence", group: "metier", url: "/plateforme-revenue-intelligence", priority: 1, volume: "faible" },
  { keyword: "revenue intelligence", group: "metier", url: "/revenue-intelligence", priority: 1, volume: "moyen" },
  { keyword: "revenue intelligence définition", group: "metier", url: "/revenue-intelligence", priority: 2, volume: "faible" },
  { keyword: "plateforme revenue", group: "metier", url: "/plateforme-revenue", priority: 1, volume: "faible" },
  { keyword: "revops", group: "metier", url: "/blog/qu-est-ce-que-le-revops-guide-complet-2026", priority: 2, volume: "fort" },
  { keyword: "qu'est-ce que le revops", group: "metier", url: "/blog/qu-est-ce-que-le-revops-guide-complet-2026", priority: 2, volume: "moyen" },
  { keyword: "revenue operations", group: "metier", url: "/plateforme-revops", priority: 2, volume: "moyen" },
  { keyword: "forecast commercial", group: "metier", url: "/forecast-commercial", priority: 1, volume: "moyen" },
  { keyword: "prévision des ventes", group: "metier", url: "/forecast-commercial", priority: 1, volume: "fort" },
  { keyword: "tableau de bord commercial", group: "metier", url: "/tableau-de-bord-commercial", priority: 1, volume: "fort" },
  { keyword: "kpi commerciaux", group: "metier", url: "/blog/kpi-commerciaux-2026-formules-benchmarks", priority: 1, volume: "fort" },
  { keyword: "tableau de bord revops", group: "metier", url: "/tableau-de-bord-revops", priority: 2, volume: "faible" },
  { keyword: "taux de churn", group: "metier", url: "/blog/bon-taux-de-churn-b2b-benchmarks-2026", priority: 2, volume: "fort" },
  { keyword: "calcul churn", group: "metier", url: "/outils/calculateur-churn", priority: 1, volume: "moyen" },
  { keyword: "calcul mrr", group: "metier", url: "/outils/calculateur-mrr", priority: 1, volume: "moyen" },
  { keyword: "mrr", group: "metier", url: "/blog/mrr-arr-net-new-mrr-guide-pme-saas", priority: 3, volume: "fort" },
  { keyword: "pipeline commercial", group: "metier", url: "/blog/pipeline-commercial-b2b-etapes-taux-conversion", priority: 2, volume: "fort" },
  { keyword: "taux de conversion commercial", group: "metier", url: "/blog/taux-de-conversion-commercial-benchmarks-b2b", priority: 2, volume: "moyen" },
  { keyword: "cycle de vente", group: "metier", url: "/blog/cycle-de-vente-b2b-calculer-comparer-raccourcir", priority: 3, volume: "moyen" },
  { keyword: "audit crm", group: "metier", url: "/audit-crm-hubspot", priority: 2, volume: "moyen" },

  // ── Longue traîne (faible concurrence, forte intention) ───────────────────
  { keyword: "fuite de revenus", group: "longue-traine", url: "/fuite-de-revenus", priority: 1, volume: "faible" },
  { keyword: "revenue leakage", group: "longue-traine", url: "/fuite-de-revenus", priority: 1, volume: "faible" },
  { keyword: "kpi revops", group: "longue-traine", url: "/kpi-revops", priority: 1, volume: "faible" },
  { keyword: "revops vs sales ops", group: "longue-traine", url: "/revops-vs-sales-ops", priority: 1, volume: "faible" },
  { keyword: "réconciliation crm facturation", group: "longue-traine", url: "/reconciliation-crm-facturation", priority: 1, volume: "faible" },
  { keyword: "intégration hubspot pennylane", group: "longue-traine", url: "/hubspot-pennylane", priority: 1, volume: "moyen" },
  { keyword: "hubspot pennylane", group: "longue-traine", url: "/hubspot-pennylane", priority: 1, volume: "moyen" },
  { keyword: "intégration hubspot stripe", group: "longue-traine", url: "/hubspot-stripe", priority: 2, volume: "faible" },
  { keyword: "intégration hubspot sage", group: "longue-traine", url: "/hubspot-sage", priority: 2, volume: "faible" },
  { keyword: "audit crm hubspot", group: "longue-traine", url: "/audit-crm-hubspot", priority: 1, volume: "faible" },
  { keyword: "nettoyer crm hubspot", group: "longue-traine", url: "/audit-crm-hubspot", priority: 2, volume: "faible" },
  { keyword: "doublons hubspot", group: "longue-traine", url: "/blog/doublons-hubspot-detecter-fusionner-entreprises", priority: 2, volume: "faible" },
  { keyword: "deals stagnants hubspot", group: "longue-traine", url: "/blog/deals-stagnants-hubspot-detecter-traiter", priority: 2, volume: "faible" },
  { keyword: "date de fermeture hubspot", group: "longue-traine", url: "/blog/date-de-fermeture-hubspot-forecast-faux", priority: 2, volume: "faible" },
  { keyword: "forecast pondéré", group: "longue-traine", url: "/outils/calculateur-forecast-pondere", priority: 1, volume: "faible" },
  { keyword: "précision du forecast", group: "longue-traine", url: "/blog/precision-du-forecast-mesurer-ameliorer", priority: 2, volume: "faible" },
  { keyword: "dso calcul", group: "longue-traine", url: "/blog/dso-reduire-delai-de-paiement-depuis-le-crm", priority: 2, volume: "moyen" },
  { keyword: "net revenue retention", group: "longue-traine", url: "/blog/nrr-retention-nette-calcul-et-leviers", priority: 2, volume: "moyen" },
  { keyword: "enrichir crm siren", group: "longue-traine", url: "/blog/enrichir-crm-siren-api-sirene", priority: 2, volume: "faible" },
  { keyword: "api sirene crm", group: "longue-traine", url: "/blog/enrichir-crm-siren-api-sirene", priority: 3, volume: "faible" },
  { keyword: "glossaire revops", group: "longue-traine", url: "/glossaire-revops", priority: 2, volume: "faible" },
  { keyword: "reporting hubspot", group: "longue-traine", url: "/blog/reporting-hubspot-limites-tableaux-de-bord-natifs", priority: 3, volume: "moyen" },

  // ── Concurrents (trafic de comparaison) ───────────────────────────────────
  { keyword: "alternative clari", group: "concurrent", url: "/alternative/clari", priority: 1, volume: "faible" },
  { keyword: "clari vs revold", group: "concurrent", url: "/alternative/clari", priority: 2, volume: "faible" },
  { keyword: "alternative gong", group: "concurrent", url: "/alternative/gong", priority: 2, volume: "faible" },
  { keyword: "forecastio", group: "concurrent", url: "/alternative/forecastio", priority: 1, volume: "faible" },
  { keyword: "alternative forecastio", group: "concurrent", url: "/alternative/forecastio", priority: 1, volume: "faible" },
  { keyword: "alternative looker studio", group: "concurrent", url: "/alternative/looker-studio", priority: 2, volume: "moyen" },
  { keyword: "alternative data studio", group: "concurrent", url: "/alternative/looker-studio", priority: 2, volume: "faible" },
  { keyword: "alternative grow bi", group: "concurrent", url: "/alternative/grow", priority: 3, volume: "faible" },
  { keyword: "alternative power bi", group: "concurrent", url: "/alternative/power-bi", priority: 3, volume: "moyen" },
  { keyword: "prévisions hubspot", group: "concurrent", url: "/alternative/hubspot-previsions", priority: 2, volume: "faible" },
  { keyword: "tableau de bord commercial excel", group: "concurrent", url: "/alternative/excel", priority: 2, volume: "moyen" },

  // ── Outils gratuits (aimants à liens) ─────────────────────────────────────
  { keyword: "calculateur mrr", group: "outil", url: "/outils/calculateur-mrr", priority: 1, volume: "faible" },
  { keyword: "calculateur churn", group: "outil", url: "/outils/calculateur-churn", priority: 1, volume: "faible" },
  { keyword: "calculateur forecast", group: "outil", url: "/outils/calculateur-forecast-pondere", priority: 2, volume: "faible" },
  { keyword: "estimer fuite de revenus", group: "outil", url: "/outils/calculateur-fuite-de-revenus", priority: 3, volume: "faible" },
];

/** Regroupe les cibles par page (pour l'audit : une page = ses requêtes). */
export function targetsByUrl(): Map<string, KeywordTarget[]> {
  const m = new Map<string, KeywordTarget[]>();
  for (const t of KEYWORD_TARGETS) m.set(t.url, [...(m.get(t.url) ?? []), t]);
  return m;
}
