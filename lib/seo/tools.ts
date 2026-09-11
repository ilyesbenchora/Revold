/**
 * Outils gratuits (calculateurs) — pages « aimants à liens » : une requête
 * précise (« calculateur MRR », « calcul du churn », « forecast pondéré »),
 * un outil qui répond immédiatement, la méthode expliquée dessous, et le pont
 * vers Revold qui calcule la même chose sur les vraies données.
 */

import type { FaqItem } from "@/lib/seo/site";

export type ToolId = "calculateur-mrr" | "calculateur-churn" | "calculateur-forecast-pondere" | "calculateur-fuite-de-revenus";

export type ToolPage = {
  slug: ToolId;
  name: string;
  keyword: string;
  secondaryKeywords: string[];
  title: string;
  description: string;
  answer: string;
  method: { h2: string; paragraphs: string[] }[];
  faq: FaqItem[];
  related: string[];
};

export const TOOLS: ToolPage[] = [
  {
    slug: "calculateur-mrr",
    name: "Calculateur MRR",
    keyword: "Calculateur MRR",
    secondaryKeywords: ["calcul MRR", "MRR formule", "calculateur ARR", "revenu mensuel récurrent", "net new MRR"],
    title: "Calculateur MRR gratuit : MRR, ARR et Net New MRR en quelques secondes",
    description:
      "Calculez votre MRR, votre ARR et votre Net New MRR à partir de vos abonnements : nouveaux clients, expansion, contraction, churn. Formules expliquées, calculateur gratuit, sans inscription.",
    answer:
      "Le MRR (Monthly Recurring Revenue) est la somme du revenu récurrent mensuel de tous les abonnements actifs, hors revenus ponctuels. L'ARR est le MRR multiplié par douze. Le Net New MRR d'une période est le nouveau MRR plus l'expansion, moins la contraction et le churn.",
    method: [
      { h2: "Comment calculer le MRR", paragraphs: ["Additionnez le montant mensuel de chaque abonnement actif. Un contrat annuel de 12 000 € compte pour 1 000 € de MRR. Les frais d'installation, les prestations et les revenus ponctuels n'entrent pas dans le MRR.", "Le Net New MRR mesure la dynamique du mois : nouveaux clients + expansion (upsell, sièges supplémentaires) − contraction (downgrade) − churn (résiliations)."] },
      { h2: "Lire le MRR avec le CRM", paragraphs: ["Le MRR vit dans Stripe, Chargebee, GoCardless ou Pennylane ; les deals vivent dans HubSpot. Tant que les deux ne sont pas rapprochés, un deal gagné sans abonnement actif ou un abonnement sans deal passent inaperçus. Revold lit les deux et restitue le MRR par client, rapproché du signé."] },
    ],
    faq: [
      { q: "Quelle différence entre MRR et ARR ?", a: "L'ARR est le MRR annualisé : MRR × 12. Les entreprises à contrats annuels raisonnent souvent en ARR, les modèles mensuels en MRR." },
      { q: "Les revenus ponctuels comptent-ils dans le MRR ?", a: "Non. Seul le revenu récurrent (abonnements) entre dans le MRR. Les frais d'installation, prestations et ventes uniques sont exclus." },
      { q: "Comment calculer le Net New MRR ?", a: "Nouveau MRR + expansion − contraction − churn, sur la période. C'est l'indicateur de croissance nette de la base d'abonnés." },
    ],
    related: ["kpi-revops", "hubspot-stripe", "plateforme-revenue"],
  },
  {
    slug: "calculateur-churn",
    name: "Calculateur de churn",
    keyword: "Calcul du taux de churn",
    secondaryKeywords: ["calculateur churn", "taux d'attrition formule", "churn revenu", "churn client", "NRR calcul"],
    title: "Calculateur de churn gratuit : churn client, churn revenu et rétention nette",
    description:
      "Calculez votre taux de churn client, votre churn revenu (MRR) et votre rétention nette (NRR) sur une période. Formules, interprétation et calculateur gratuit.",
    answer:
      "Le taux de churn client est le nombre de clients perdus sur une période divisé par le nombre de clients en début de période. Le churn revenu divise le MRR perdu par le MRR initial. La rétention nette (NRR) ajoute l'expansion : (MRR initial + expansion − contraction − churn) ÷ MRR initial.",
    method: [
      { h2: "Churn client ou churn revenu ?", paragraphs: ["Une entreprise peut perdre 5 % de ses clients et seulement 1 % de son revenu si les comptes partis étaient petits ; l'inverse est vrai avec un gros compte. Suivez les deux, et lisez le churn revenu avec l'expansion pour obtenir la rétention nette."] },
      { h2: "Détecter le churn avant qu'il n'arrive", paragraphs: ["Le churn se voit d'abord dans les tickets support, la baisse d'usage et les retards de paiement, avant la résiliation. Revold croise abonnements, tickets et facturation par client et déclenche des alertes de rétention."] },
    ],
    faq: [
      { q: "Quel est un bon taux de churn ?", a: "Cela dépend du marché et du panier : un SaaS B2B vise souvent moins de 1 % de churn revenu mensuel, une offre grand public tolère davantage. Le bon repère est votre propre tendance, mois après mois." },
      { q: "Comment calculer la rétention nette (NRR) ?", a: "(MRR en début de période + expansion − contraction − churn) ÷ MRR en début de période. Au-dessus de 100 %, la base existante croît sans nouveaux clients." },
      { q: "Faut-il compter les nouveaux clients dans le churn ?", a: "Non. Le churn se calcule sur les clients présents en début de période ; les nouveaux clients entrent dans le Net New MRR." },
    ],
    related: ["kpi-revops", "hubspot-stripe", "plateforme-revenue-intelligence"],
  },
  {
    slug: "calculateur-forecast-pondere",
    name: "Calculateur de forecast pondéré",
    keyword: "Forecast pondéré",
    secondaryKeywords: ["calcul forecast pondéré", "prévision des ventes pondérée", "pipeline pondéré", "forecast par étape"],
    title: "Calculateur de forecast pondéré : votre pipeline × probabilité d'étape",
    description:
      "Saisissez vos étapes de pipeline, leurs probabilités et le montant des deals : le calculateur donne le forecast pondéré de la période. Méthode, pièges (dates, stagnants) et outil gratuit.",
    answer:
      "Le forecast pondéré est la somme, pour chaque deal ouvert dont la date de fermeture tombe dans la période, du montant multiplié par la probabilité de son étape de pipeline. Il donne une prévision plus prudente que le pipeline brut et plus objective que le forecast déclaré par les commerciaux.",
    method: [
      { h2: "Comment calculer le forecast pondéré", paragraphs: ["Pour chaque étape, additionnez les montants des deals ouverts dont la date de fermeture tombe dans la période visée, puis multipliez par la probabilité de l'étape. La somme des étapes donne le forecast pondéré. Les probabilités doivent refléter les conversions réellement observées, pas une intuition."] },
      { h2: "Les trois pièges", paragraphs: ["Les dates de fermeture non maintenues déplacent les deals hors de la période. Les deals stagnants gonflent les étapes avancées sans jamais se signer. Les deals sans montant sont invisibles. Revold surveille ces trois signaux et calcule le forecast par pipeline, avec la propriété de date de votre choix."] },
    ],
    faq: [
      { q: "Quelle probabilité donner à chaque étape ?", a: "Le taux de conversion observé de cette étape vers la signature sur les 6 à 12 derniers mois. À défaut d'historique, une échelle prudente : 10 %, 25 %, 50 %, 75 %, 90 %." },
      { q: "Forecast pondéré ou forecast par engagement ?", a: "Les deux se complètent : le pondéré est objectif et recalculable, l'engagement (commit, best case) porte le jugement du commercial. Comparer les deux au réalisé chaque trimestre améliore les probabilités." },
      { q: "Peut-on pondérer sur une autre date que closedate ?", a: "Oui, si votre pipeline pilote sur une date de signature prévue ou de démarrage. Dans Revold, chaque bloc de prévision accepte une propriété de date personnalisée vérifiée dans le CRM." },
    ],
    related: ["forecast-commercial", "kpi-revops", "tableau-de-bord-commercial"],
  },
  {
    slug: "calculateur-fuite-de-revenus",
    name: "Estimateur de fuite de revenus",
    keyword: "Estimation de la fuite de revenus",
    secondaryKeywords: ["revenue leakage calcul", "revenus non facturés estimation", "écart signé facturé", "perte de revenu facturation"],
    title: "Estimateur de fuite de revenus : combien de revenu signé n'est jamais encaissé ?",
    description:
      "Estimez la fuite de revenus de votre entreprise à partir du signé, du facturé et de l'encaissé : deals sans facture, écarts de montant, factures en retard. Ordres de grandeur, méthode et estimateur gratuit.",
    answer:
      "La fuite de revenus se mesure en comparant, sur une même période, le revenu signé dans le CRM, le revenu facturé et le revenu encaissé. L'écart signé − facturé estime les deals non facturés ou sous-facturés ; l'écart facturé − encaissé estime les retards et impayés. Les études publiées situent la fuite totale entre 1 et 5 % du chiffre d'affaires.",
    method: [
      { h2: "Ce que l'estimateur calcule", paragraphs: ["À partir de trois montants (signé, facturé, encaissé) et du nombre de deals, l'estimateur donne l'écart à facturer, l'écart à recouvrer et la fuite totale en euros et en pourcentage. C'est une estimation nette : la réalité, mesurée deal par deal, est souvent plus élevée parce que les écarts se compensent."] },
      { h2: "Passer de l'estimation à la mesure", paragraphs: ["Revold rapproche chaque deal HubSpot des factures Pennylane, Stripe, Chargebee, GoCardless ou Sage par SIREN, calcule l'écart brut par deal, liste les deals signés sans facture et les factures en retard, et suit un score de santé de réconciliation dans le temps."] },
    ],
    faq: [
      { q: "Pourquoi l'écart net sous-estime-t-il la fuite ?", a: "Parce qu'un deal sur-facturé et un deal sous-facturé se compensent dans le total. Seul l'écart brut, calculé deal par deal en valeur absolue, révèle toutes les erreurs." },
      { q: "Quelles données faut-il pour mesurer la fuite réelle ?", a: "Les deals signés du CRM, les factures et les paiements de l'outil de facturation, et un identifiant commun par client (SIREN, SIRET, TVA). Revold enrichit et rapproche ces identifiants automatiquement." },
      { q: "Quel ordre de grandeur attendre ?", a: "Les études publiées donnent 1 à 5 % du chiffre d'affaires, davantage pour les modèles à abonnement avec options et dépassements non facturés." },
    ],
    related: ["fuite-de-revenus", "reconciliation-crm-facturation", "hubspot-pennylane"],
  },
];

export function getTool(slug: string): ToolPage | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
