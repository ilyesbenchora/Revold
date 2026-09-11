/**
 * Pages de contenu « longue traîne » — une page par requête cible, à la racine
 * du site (/plateforme-revops, /pilotage-revops…). Chaque page répond d'abord
 * à la question (définition en une phrase citable par les moteurs génératifs),
 * développe le sujet, positionne Revold, puis termine par une FAQ (schema
 * FAQPage) et des liens internes vers les pages voisines.
 *
 * Règle éditoriale : des faits vérifiables, des chiffres sourcés, jamais de
 * promesse invérifiable — un contenu que ChatGPT, Claude ou Google peuvent
 * reprendre tel quel sans risque.
 */

import type { FaqItem } from "@/lib/seo/site";

export type KeywordSection = { h2: string; paragraphs: string[]; bullets?: string[] };
export type KeywordPage = {
  slug: string;
  /** Requête cible principale (affichée en badge). */
  keyword: string;
  /** Requêtes secondaires couvertes par la page. */
  secondaryKeywords: string[];
  title: string;
  description: string;
  h1: string;
  h1Accent: string;
  /** Réponse directe — première phrase reprise par les moteurs (GEO). */
  answer: string;
  intro: string;
  sections: KeywordSection[];
  whyRevold: { title: string; desc: string }[];
  faq: FaqItem[];
  related: string[];
};

export const KEYWORD_PAGES: KeywordPage[] = [
  {
    slug: "plateforme-revops",
    keyword: "Plateforme RevOps",
    secondaryKeywords: ["RevOps plateforme", "logiciel RevOps", "outil RevOps", "solution RevOps"],
    title: "Plateforme RevOps : définition, fonctions et choix (guide 2026)",
    description:
      "Qu'est-ce qu'une plateforme RevOps ? Fonctions indispensables, différences avec un CRM ou un outil de BI, critères de choix et positionnement de Revold, plateforme RevOps française.",
    h1: "Plateforme RevOps :",
    h1Accent: "piloter le revenu de bout en bout",
    answer:
      "Une plateforme RevOps est un logiciel qui centralise les données des ventes, du marketing, du service client et de la finance pour aligner ces équipes sur un même revenu mesuré, prévu et piloté. Revold est une plateforme RevOps française qui connecte le CRM, la facturation et la banque, réconcilie les comptes par SIREN et transforme ces données en prévisions, alertes et actions.",
    intro:
      "Le Revenue Operations (RevOps) consiste à faire travailler ventes, marketing, service client et finance sur un seul processus de revenu. Une plateforme RevOps est l'outil qui rend cet alignement concret : une donnée unique, des indicateurs partagés et des actions coordonnées, là où chaque équipe travaillait auparavant dans son propre outil.",
    sections: [
      {
        h2: "À quoi sert une plateforme RevOps ?",
        paragraphs: [
          "Un CRM montre ce que les commerciaux ont saisi. Un outil de facturation montre ce qui a été facturé. Une banque montre ce qui a été encaissé. Aucun des trois ne connaît les deux autres. Une plateforme RevOps se place au-dessus de ces outils pour reconstituer la chaîne complète : lead, opportunité, signature, facture, paiement, renouvellement.",
          "Elle sert ensuite trois usages : mesurer (KPIs cohérents entre équipes), prévoir (forecast fondé sur des données réconciliées) et agir (alertes, objectifs, tâches poussées dans les outils).",
        ],
        bullets: [
          "Unifier les données de revenu de plusieurs outils (CRM, facturation, support, banque).",
          "Fiabiliser les indicateurs : un même chiffre pour la direction, les ventes et la finance.",
          "Détecter les fuites de revenu : deals signés non facturés, factures non payées, churn silencieux.",
          "Automatiser le pilotage : alertes de seuil, objectifs suivis, récaps d'équipe.",
        ],
      },
      {
        h2: "Plateforme RevOps, CRM ou outil de BI : quelle différence ?",
        paragraphs: [
          "Le CRM (HubSpot, Salesforce, Pipedrive) est un outil de saisie et de suivi commercial. Il est la source de la donnée ventes, pas le lieu où elle se réconcilie avec la facturation.",
          "Un outil de BI (Looker Studio, Power BI, Metabase) affiche ce qu'on lui donne. Il faut modéliser soi-même les jointures, entretenir les connecteurs et vérifier chaque chiffre. La donnée n'est pas rapprochée par défaut.",
          "Une plateforme RevOps embarque la logique métier : elle sait qu'un deal HubSpot et une facture Pennylane parlent du même client parce qu'ils partagent un SIREN, et elle mesure l'écart entre les deux.",
        ],
      },
      {
        h2: "Les fonctions indispensables d'une plateforme RevOps",
        paragraphs: ["Les critères ci-dessous distinguent une vraie plateforme RevOps d'un tableau de bord."],
        bullets: [
          "Connecteurs natifs CRM et facturation, en lecture seule, sans export manuel.",
          "Résolution d'entités : rapprochement des comptes entre outils (en France, par SIREN, SIRET et TVA).",
          "Réconciliation signé / facturé / encaissé, avec l'écart chiffré.",
          "Prévisions pondérées par étape de pipeline et par date de fermeture.",
          "Alertes et objectifs câblés sur des KPIs vérifiés, pas sur des formules libres.",
          "Restitution par équipe : chaque pôle voit ses indicateurs, la direction voit l'ensemble.",
          "Hébergement et conformité adaptés à l'Europe (RGPD, données en UE).",
        ],
      },
      {
        h2: "Pour quelles entreprises ?",
        paragraphs: [
          "Les plateformes RevOps historiques (Clari, Gong, BoostUp) sont conçues pour des équipes commerciales enterprise anglophones, souvent centrées sur Salesforce et facturées sur devis. Les PME et ETI françaises utilisent majoritairement HubSpot, Pennylane, Stripe ou Sage, et ont besoin d'un outil qui parle leur langue, leurs identifiants d'entreprise et leur budget.",
          "Revold est conçu pour ces entreprises : de 10 à 500 salariés, un CRM et un outil de facturation déjà en place, et l'envie de piloter le revenu sans monter une équipe data.",
        ],
      },
    ],
    whyRevold: [
      { title: "Rapprochement à la française", desc: "Comptes réconciliés par SIREN, SIRET et TVA via l'API Sirene, pas par un nom d'entreprise approximatif." },
      { title: "CRM × facturation × banque", desc: "Signé, facturé, encaissé sur une même ligne, avec l'écart révélé au lieu d'être masqué par la compensation." },
      { title: "Tarif public, essai gratuit", desc: "Trois plans affichés à partir de 79,90 € HT par mois, 14 jours d'essai sans carte bancaire." },
      { title: "Données hébergées en Europe", desc: "Application à Paris, base de données à Francfort, IA Anthropic en zone EU sans rétention." },
    ],
    faq: [
      { q: "Qu'est-ce qu'une plateforme RevOps ?", a: "C'est un logiciel qui centralise les données des ventes, du marketing, du service client et de la finance pour mesurer, prévoir et piloter un même revenu. Elle se place au-dessus du CRM et des outils de facturation qu'elle connecte." },
      { q: "Quelle différence entre une plateforme RevOps et un CRM ?", a: "Le CRM est la source de la donnée commerciale. La plateforme RevOps réconcilie cette donnée avec la facturation, le support et la banque, puis produit prévisions, alertes et actions. Elle ne remplace pas le CRM, elle le complète." },
      { q: "Revold est-il une plateforme RevOps ?", a: "Oui. Revold est une plateforme française de Revenue Intelligence et de pilotage RevOps : elle connecte HubSpot, Stripe, Pennylane, Chargebee, GoCardless et Sage, rapproche les comptes par SIREN et pilote le revenu par équipe." },
      { q: "Combien coûte une plateforme RevOps ?", a: "Les acteurs enterprise facturent sur devis, généralement plusieurs dizaines de milliers d'euros par an. Revold affiche ses tarifs : Starter 79,90 € HT par mois, Business 149,90 € HT par mois, Scale à partir de 490,90 € HT par mois, avec 14 jours d'essai gratuit." },
      { q: "Faut-il une équipe data pour déployer une plateforme RevOps ?", a: "Pas avec Revold : les connecteurs sont natifs, la synchronisation est en lecture seule et le rapprochement des comptes est automatique. Une organisation est opérationnelle en une matinée." },
    ],
    related: ["pilotage-revops", "logiciel-revops", "plateforme-revenue-intelligence", "tableau-de-bord-revops"],
  },
  {
    slug: "pilotage-revops",
    keyword: "Pilotage RevOps",
    secondaryKeywords: ["piloter le RevOps", "pilotage des revenus", "pilotage commercial et financier", "gouvernance revenue"],
    title: "Pilotage RevOps : méthode, indicateurs et outil pour piloter le revenu",
    description:
      "Le pilotage RevOps aligne ventes, marketing, service client et finance sur un revenu mesuré et prévu. Méthode en 5 étapes, KPIs à suivre, rituels d'équipe et outil Revold.",
    h1: "Pilotage RevOps :",
    h1Accent: "un seul revenu, quatre équipes alignées",
    answer:
      "Le pilotage RevOps est la pratique qui consiste à suivre le revenu comme un processus continu, du lead à l'encaissement, avec des indicateurs partagés entre ventes, marketing, service client et finance. Revold outille ce pilotage en réconciliant les données de ces équipes et en lisant chaque jour, par pôle, ce qui avance, ce qui stagne et ce qui bloque.",
    intro:
      "Piloter le RevOps, ce n'est pas produire plus de rapports. C'est décider chaque semaine à partir de chiffres que toutes les équipes reconnaissent : combien a été signé, combien a été facturé, combien a été encaissé, et où se situe l'écart.",
    sections: [
      {
        h2: "Pourquoi le pilotage du revenu échoue dans la plupart des entreprises",
        paragraphs: [
          "Chaque équipe pilote son propre indicateur : le marketing ses MQL, les ventes leur pipeline, la finance son chiffre facturé. Ces indicateurs ne se parlent pas, parce qu'ils vivent dans des outils différents et désignent les clients avec des identifiants différents.",
          "Résultat : des réunions de direction où les chiffres se contredisent, un forecast commercial déconnecté de la trésorerie, et des revenus qui fuient entre la signature et l'encaissement sans que personne ne soit responsable de l'écart.",
        ],
      },
      {
        h2: "La méthode de pilotage RevOps en 5 étapes",
        paragraphs: ["Le pilotage RevOps se met en place par étapes, chacune ajoutant une couche de fiabilité à la précédente."],
        bullets: [
          "1. Connecter les sources : CRM, facturation, support, banque, en lecture seule.",
          "2. Réconcilier les comptes : un même client reconnu partout grâce à un identifiant stable (SIREN, SIRET, TVA en France).",
          "3. Définir les indicateurs partagés : pipeline pondéré, signé, facturé, encaissé, MRR, churn, cycle de vente.",
          "4. Fixer les objectifs et les seuils d'alerte par équipe, câblés sur ces indicateurs.",
          "5. Installer les rituels : brief quotidien, récap hebdomadaire, revue mensuelle par pôle.",
        ],
      },
      {
        h2: "Les indicateurs d'un pilotage RevOps",
        paragraphs: ["Un bon tableau de pilotage RevOps tient sur une page et couvre toute la chaîne de revenu."],
        bullets: [
          "Acquisition : contacts créés, MQL, taux MQL → SQL, coût par lead par source.",
          "Ventes : pipeline en cours, forecast pondéré, deals prêts à signer, deals stagnants, signé par propriétaire.",
          "Facturation : facturé, encaissé, factures en retard, écart signé / facturé.",
          "Rétention : MRR, churn, tickets ouverts, SLA dépassés, satisfaction client.",
        ],
      },
      {
        h2: "Les rituels qui font vivre le pilotage",
        paragraphs: [
          "Le pilotage RevOps tient autant aux rituels qu'aux indicateurs. Revold les automatise : un brief du jour par équipe lu à voix haute depuis la tour de contrôle, un récap hebdomadaire, mensuel ou trimestriel comparé à la période précédente, et des alertes envoyées sur Slack, Teams ou par e-mail dès qu'un seuil est franchi.",
          "Chaque annonce nomme l'outil source (« via Pennylane », « dans HubSpot ») et ne se répète jamais : une bonne nouvelle déjà entendue n'est pas relue le lendemain.",
        ],
      },
    ],
    whyRevold: [
      { title: "Brief par équipe", desc: "Ventes, marketing, service client et comptabilité reçoivent chacun leur brief, avec pipelines, périodes et seuils configurables." },
      { title: "Écart signé / facturé chiffré", desc: "La réconciliation révèle les deals signés non facturés et les factures non encaissées, deal par deal." },
      { title: "Alertes au câblage vérifié", desc: "Chaque alerte est testée sur les vraies données avant d'être enregistrée : pas de faux positifs par formule." },
      { title: "Actions dans vos outils", desc: "Les tâches proposées sont exécutées dans le CRM ou la facturation après validation humaine." },
    ],
    faq: [
      { q: "Qu'est-ce que le pilotage RevOps ?", a: "C'est le suivi du revenu comme un processus continu, du lead à l'encaissement, avec des indicateurs partagés entre ventes, marketing, service client et finance, des objectifs communs et des rituels de décision réguliers." },
      { q: "Quels KPIs suivre pour piloter le RevOps ?", a: "Pipeline pondéré, forecast, deals stagnants, signé par propriétaire, facturé, encaissé, factures en retard, MRR, churn, tickets ouverts et satisfaction client. L'indicateur le plus révélateur reste l'écart entre signé et facturé." },
      { q: "Quel outil pour piloter le RevOps ?", a: "Une plateforme qui connecte le CRM et la facturation, réconcilie les comptes et produit prévisions et alertes. Revold le fait pour les entreprises françaises, avec un rapprochement par SIREN et des briefs par équipe." },
      { q: "Le pilotage RevOps est-il réservé aux grandes entreprises ?", a: "Non. Une PME avec un CRM et un outil de facturation a déjà les données nécessaires. Revold est conçu pour les entreprises de 10 à 500 salariés, sans équipe data." },
    ],
    related: ["plateforme-revops", "pilotage-performance-entreprise", "tableau-de-bord-revops", "forecast-commercial"],
  },
  {
    slug: "pilotage-performance-entreprise",
    keyword: "Pilotage de la performance d'entreprise",
    secondaryKeywords: ["pilotage de performance", "piloter la performance de l'entreprise", "indicateurs de performance", "tableau de bord de direction"],
    title: "Pilotage de la performance d'entreprise : méthode et outil pour le B2B",
    description:
      "Comment piloter la performance d'une entreprise B2B à partir de données réconciliées : indicateurs par équipe, fréquence des revues, erreurs fréquentes et rôle d'une plateforme comme Revold.",
    h1: "Pilotage de la performance d'entreprise :",
    h1Accent: "des chiffres vrais, lus par tout le monde",
    answer:
      "Le pilotage de la performance d'entreprise consiste à mesurer régulièrement des indicateurs choisis (revenu, marge, acquisition, rétention, trésorerie), à les comparer aux objectifs et à décider des actions correctives. Revold outille ce pilotage pour les entreprises B2B en réconciliant CRM, facturation, banque et support, puis en restituant à chaque équipe ses indicateurs et à la direction la vue d'ensemble.",
    intro:
      "Piloter la performance, c'est répondre chaque semaine à trois questions : où en est-on, par rapport à quoi, et que fait-on. La difficulté n'est pas de trouver des indicateurs, mais d'en avoir peu, justes, et partagés.",
    sections: [
      {
        h2: "Les indicateurs de performance d'une entreprise B2B",
        paragraphs: ["Un pilotage efficace couvre toute la chaîne de valeur et non seulement le chiffre d'affaires."],
        bullets: [
          "Croissance : nouveau revenu signé, MRR ou ARR, panier moyen, cycle de vente.",
          "Efficacité commerciale : taux de conversion par étape, pipeline pondéré, deals stagnants.",
          "Acquisition : MQL, coût par lead, part de chaque source.",
          "Rétention : churn, renouvellements, satisfaction client, tickets par client.",
          "Trésorerie : facturé, encaissé, retards de paiement, échéances à venir, prévision pondérée.",
        ],
      },
      {
        h2: "Pourquoi la donnée réconciliée change le pilotage",
        paragraphs: [
          "La plupart des tableaux de bord de direction agrègent des exports. Ils sont justes au moment de l'export, faux une semaine plus tard, et personne ne sait lequel des trois fichiers est la référence.",
          "Avec des données réconciliées en continu, l'indicateur ne dépend plus d'un fichier : un deal signé dans HubSpot est suivi jusqu'à sa facture dans Pennylane et son paiement en banque. L'écart entre les étapes devient lui-même un indicateur de performance, souvent le plus actionnable.",
        ],
      },
      {
        h2: "La fréquence des revues de performance",
        paragraphs: ["Chaque niveau de décision a sa fréquence. L'outil doit produire la restitution adaptée sans travail manuel."],
        bullets: [
          "Quotidien : brief d'exception par équipe (alertes en tension, échéances, deals prêts à signer).",
          "Hebdomadaire : récap par pôle comparé à la semaine précédente, axes d'amélioration.",
          "Mensuel et trimestriel : revue direction, objectifs, prévisions, écarts signé / facturé / encaissé.",
        ],
      },
      {
        h2: "Les erreurs fréquentes",
        paragraphs: ["Trois erreurs reviennent dans les dispositifs de pilotage."],
        bullets: [
          "Trop d'indicateurs : au-delà d'une dizaine, personne ne les lit.",
          "Des indicateurs non réconciliés : chaque équipe défend son chiffre.",
          "Aucune action attachée : un tableau de bord sans alerte ni objectif ne change rien.",
        ],
      },
    ],
    whyRevold: [
      { title: "Une vue par équipe, une vue direction", desc: "Chaque pôle voit ses indicateurs ; l'admin voit toutes les équipes et bascule d'espace en un clic." },
      { title: "Objectifs et alertes suivis automatiquement", desc: "Le seuil est détecté par le moteur déterministe, la notification est rédigée et envoyée sur le canal choisi." },
      { title: "Récaps comparés à la période précédente", desc: "Semaine, mois, trimestre : chiffres, variation et axes d'amélioration déduits des écarts." },
      { title: "Prévision de trésorerie", desc: "Projection pondérée des encaissements et échéances fiscales sur la page Trésorerie." },
    ],
    faq: [
      { q: "Qu'est-ce que le pilotage de la performance d'entreprise ?", a: "C'est la mesure régulière d'indicateurs choisis, leur comparaison aux objectifs et la décision d'actions correctives. En B2B, il couvre la croissance, l'efficacité commerciale, l'acquisition, la rétention et la trésorerie." },
      { q: "Quels outils pour piloter la performance d'une entreprise ?", a: "Un CRM et un outil de facturation fournissent la donnée ; une plateforme de pilotage comme Revold la réconcilie et la restitue par équipe avec objectifs, alertes et récaps. Les outils de BI généralistes demandent de construire soi-même cette logique." },
      { q: "À quelle fréquence revoir les indicateurs de performance ?", a: "Quotidiennement pour les exceptions, chaque semaine par équipe, chaque mois et chaque trimestre pour la direction. Revold produit ces trois niveaux automatiquement." },
      { q: "Revold convient-il à une PME ?", a: "Oui. Revold s'adresse aux entreprises B2B de 10 à 500 salariés qui utilisent déjà un CRM (HubSpot) et un outil de facturation (Pennylane, Stripe, Chargebee, GoCardless, Sage)." },
    ],
    related: ["pilotage-revops", "tableau-de-bord-revops", "plateforme-revenue", "forecast-commercial"],
  },
  {
    slug: "plateforme-revenue-intelligence",
    keyword: "Plateforme de Revenue Intelligence",
    secondaryKeywords: ["plateforme intelligence revenue", "revenue intelligence platform", "logiciel revenue intelligence", "revenue intelligence France"],
    title: "Plateforme de Revenue Intelligence : définition et comparatif 2026",
    description:
      "Une plateforme de Revenue Intelligence collecte, réconcilie et analyse les données de revenu pour prévoir et agir. Définition, fonctions, acteurs (Clari, Gong, Revold) et critères de choix pour une entreprise française.",
    h1: "Plateforme de Revenue Intelligence :",
    h1Accent: "la vérité revenue, du CRM au compte en banque",
    answer:
      "Une plateforme de Revenue Intelligence est un logiciel qui collecte automatiquement les données de revenu (CRM, facturation, support, banque), les réconcilie et les analyse pour prévoir le chiffre d'affaires, détecter les risques et recommander des actions. Revold est la plateforme de Revenue Intelligence conçue pour les entreprises B2B françaises, avec un rapprochement des comptes par SIREN et des connecteurs HubSpot, Stripe, Pennylane, Chargebee, GoCardless et Sage.",
    intro:
      "Le terme Revenue Intelligence est né aux États-Unis autour de Clari et Gong, pour désigner des outils qui exploitent automatiquement l'activité commerciale (e-mails, appels, CRM) afin de fiabiliser le forecast. En Europe, le besoin est plus large : la donnée de revenu ne s'arrête pas au CRM, elle passe par la facture et la banque.",
    sections: [
      {
        h2: "Ce que fait une plateforme de Revenue Intelligence",
        paragraphs: ["Quatre fonctions caractérisent la catégorie."],
        bullets: [
          "Collecte automatique : synchronisation continue des outils, sans export ni saisie.",
          "Réconciliation : un même client et un même deal reconnus dans tous les outils.",
          "Analyse et prévision : forecast pondéré, détection des deals à risque, écarts entre étapes.",
          "Action : alertes, objectifs, tâches, recommandations poussées aux équipes.",
        ],
      },
      {
        h2: "Revenue Intelligence américaine et Revenue Intelligence européenne",
        paragraphs: [
          "Clari, Gong, Aviso ou BoostUp sont centrés sur Salesforce, sur l'analyse des conversations commerciales et sur des cycles de vente enterprise. Leur tarif est communiqué sur devis et leur interface est en anglais.",
          "Une entreprise française de taille intermédiaire a d'autres priorités : un CRM HubSpot, une facturation Pennylane ou Sage, des clients identifiés par SIREN, une obligation RGPD, et un budget de quelques centaines d'euros par mois. C'est le périmètre de Revold.",
        ],
      },
      {
        h2: "Le rôle de l'IA dans une plateforme de Revenue Intelligence",
        paragraphs: [
          "L'IA générative est utile pour rédiger, résumer et expliquer. Elle est dangereuse pour calculer. Revold sépare les deux : un moteur déterministe calcule les indicateurs, les seuils et les prévisions ; des agents experts par pôle rédigent les briefs, répondent aux questions et proposent des actions à partir de ces chiffres vérifiés.",
          "Chaque suggestion d'indicateur passe par une étape de vérification (« câblage ») : la proposition est recalculée sur les vraies données avant d'être enregistrée.",
        ],
      },
      {
        h2: "Comment choisir sa plateforme de Revenue Intelligence",
        paragraphs: ["Cinq questions suffisent à qualifier un outil."],
        bullets: [
          "Se connecte-t-il nativement à mon CRM et à mon outil de facturation ?",
          "Comment reconnaît-il qu'un client du CRM et un client facturé sont la même entreprise ?",
          "Le forecast repose-t-il sur des données réconciliées ou seulement sur le CRM ?",
          "Où sont hébergées les données, et l'IA conserve-t-elle mes données ?",
          "Le tarif est-il public et adapté à ma taille ?",
        ],
      },
    ],
    whyRevold: [
      { title: "Résolution d'entités par SIREN", desc: "Le rapprochement s'appuie sur les identifiants légaux français, enrichis via l'API Sirene et l'INPI." },
      { title: "Six connecteurs natifs", desc: "HubSpot, Stripe, Pennylane, Chargebee, GoCardless, Sage, plus l'import Excel et Google Sheets." },
      { title: "IA déterministe puis générative", desc: "Les chiffres viennent du moteur, les mots viennent des agents. Jamais l'inverse." },
      { title: "Made in France, hébergé en Europe", desc: "Interface en français, données à Paris et Francfort, conformité RGPD documentée." },
    ],
    faq: [
      { q: "Qu'est-ce qu'une plateforme de Revenue Intelligence ?", a: "Un logiciel qui collecte, réconcilie et analyse automatiquement les données de revenu d'une entreprise (CRM, facturation, support, banque) pour prévoir le chiffre d'affaires, détecter les risques et déclencher des actions." },
      { q: "Quelles sont les principales plateformes de Revenue Intelligence ?", a: "Clari, Gong, Aviso et BoostUp aux États-Unis, centrées sur Salesforce et les grandes équipes commerciales ; Revold en France, centrée sur le rapprochement CRM × facturation × banque pour les PME et ETI." },
      { q: "Quelle différence entre Revenue Intelligence et Business Intelligence ?", a: "La BI affiche des données qu'il faut modéliser soi-même. La Revenue Intelligence embarque la logique du revenu : réconciliation des comptes, forecast, détection des risques, actions." },
      { q: "Revold utilise-t-il l'IA pour calculer les prévisions ?", a: "Non. Les prévisions et les indicateurs sont calculés par un moteur déterministe. L'IA rédige les briefs, répond aux questions et propose des actions à partir de ces chiffres vérifiés." },
    ],
    related: ["revenue-intelligence", "plateforme-revops", "plateforme-revenue", "forecast-commercial"],
  },
  {
    slug: "plateforme-revenue",
    keyword: "Plateforme revenue",
    secondaryKeywords: ["plateforme de revenu", "revenue platform", "plateforme de gestion du revenu", "outil de suivi du revenu"],
    title: "Plateforme revenue : suivre le revenu du CRM à l'encaissement",
    description:
      "Une plateforme revenue unifie CRM, facturation et banque pour suivre chaque euro du devis à l'encaissement. Fonctions, bénéfices, différences avec un CRM et présentation de Revold.",
    h1: "Plateforme revenue :",
    h1Accent: "chaque euro suivi du devis à l'encaissement",
    answer:
      "Une plateforme revenue est un logiciel qui suit le revenu d'une entreprise sur toute sa chaîne, de l'opportunité commerciale à l'encaissement, en connectant le CRM, la facturation et la banque. Revold est une plateforme revenue française qui réconcilie ces sources par SIREN et mesure l'écart entre signé, facturé et encaissé.",
    intro:
      "Le revenu n'existe pas dans un seul outil. Il naît dans le CRM, se concrétise dans la facturation et se vérifie en banque. Une plateforme revenue relie ces trois moments pour qu'une entreprise sache, à tout instant, combien elle a réellement gagné et combien elle risque de perdre.",
    sections: [
      {
        h2: "Les trois étapes du revenu, et ce qui se perd entre elles",
        paragraphs: [
          "Entre la signature et la facture, des deals sont oubliés, facturés en retard ou pour un montant différent. Entre la facture et l'encaissement, des paiements traînent, des avoirs s'accumulent, des abonnements se résilient sans que le CRM le sache.",
          "Chacun de ces écarts est invisible tant que les outils ne sont pas rapprochés. Une plateforme revenue les rend visibles, deal par deal, client par client.",
        ],
      },
      {
        h2: "Ce qu'apporte une plateforme revenue",
        paragraphs: ["Au-delà du reporting, la plateforme revenue sert à récupérer du revenu et à sécuriser la trésorerie."],
        bullets: [
          "Deals signés non facturés : montant à facturer, client par client.",
          "Factures en retard et échéances à venir : relances priorisées par montant.",
          "MRR, churn et renouvellements : rétention lue avec les données de facturation, pas seulement du CRM.",
          "Prévision de trésorerie pondérée par la probabilité de signature et les délais de paiement observés.",
          "Score de santé de réconciliation : part du revenu suivie de bout en bout.",
        ],
      },
      {
        h2: "Plateforme revenue ou CRM enrichi ?",
        paragraphs: [
          "Les CRM proposent des modules de reporting et parfois de facturation. Mais dès que la facturation vit dans un outil comptable (Pennylane, Sage) ou un outil d'abonnement (Stripe, Chargebee), le CRM ne voit plus le revenu réel.",
          "La plateforme revenue reste neutre : elle lit chaque outil en lecture seule, conserve la source de vérité de chacun (le CRM pour le signé, la facturation pour le facturé, la banque pour l'encaissé) et rapproche les trois.",
        ],
      },
    ],
    whyRevold: [
      { title: "Réconciliation signé / facturé / encaissé", desc: "Écart brut par deal, pour révéler les compensations qui masquent les fuites." },
      { title: "Page Trésorerie", desc: "Projection pondérée des encaissements, échéances fiscales, factures en retard." },
      { title: "Sources nommées", desc: "Chaque chiffre porte son outil d'origine : « via Pennylane », « dans HubSpot »." },
      { title: "Lecture seule, sans risque", desc: "Aucune écriture dans vos outils sans validation explicite d'un utilisateur." },
    ],
    faq: [
      { q: "Qu'est-ce qu'une plateforme revenue ?", a: "Un logiciel qui suit le revenu sur toute sa chaîne, du CRM à la banque, en réconciliant les outils pour mesurer ce qui est signé, facturé et encaissé, et l'écart entre les trois." },
      { q: "Une plateforme revenue remplace-t-elle mon CRM ou ma facturation ?", a: "Non. Elle les connecte en lecture seule et conserve chaque outil comme source de vérité de son étape. Revold ne modifie vos outils qu'après validation humaine d'une action." },
      { q: "Quels outils Revold connecte-t-il ?", a: "HubSpot pour le CRM ; Stripe, Pennylane, Chargebee, GoCardless et Sage pour la facturation et les abonnements ; l'import Excel et Google Sheets pour le reste ; Slack, Teams, e-mail, SMS et WhatsApp pour les notifications." },
      { q: "Comment Revold sait-il qu'un client du CRM et un client facturé sont la même entreprise ?", a: "Par résolution d'entités : SIREN, SIRET et numéro de TVA, complétés par l'API Sirene et l'INPI, puis par des règles de rapprochement validées par l'utilisateur." },
    ],
    related: ["plateforme-revenue-intelligence", "reconciliation-crm-facturation", "forecast-commercial", "plateforme-revops"],
  },
  {
    slug: "logiciel-revops",
    keyword: "Logiciel RevOps",
    secondaryKeywords: ["outil RevOps", "solution RevOps", "logiciel revenue operations", "meilleur logiciel RevOps"],
    title: "Logiciel RevOps : les 7 critères pour choisir en 2026",
    description:
      "Comment choisir un logiciel RevOps : connecteurs, réconciliation des comptes, forecast, alertes, restitution par équipe, hébergement, prix. Comparatif des approches et présentation de Revold.",
    h1: "Logiciel RevOps :",
    h1Accent: "7 critères pour choisir sans se tromper",
    answer:
      "Un logiciel RevOps est un outil qui unifie les données des ventes, du marketing, du service client et de la finance pour piloter un revenu commun. Pour le choisir, sept critères comptent : les connecteurs natifs, la réconciliation des comptes, la qualité du forecast, les alertes, la restitution par équipe, l'hébergement des données et la transparence du prix. Revold coche ces sept critères pour les entreprises françaises.",
    intro:
      "Le marché des logiciels RevOps mélange des plateformes enterprise américaines, des outils de BI généralistes et des modules de CRM. Ce guide donne une grille de lecture simple pour comparer ces approches.",
    sections: [
      {
        h2: "Les 7 critères d'un logiciel RevOps",
        paragraphs: ["Chaque critère élimine une catégorie d'outils inadaptés."],
        bullets: [
          "1. Connecteurs natifs à vos outils réels (HubSpot, Pennylane, Stripe…), sans intégrateur.",
          "2. Résolution d'entités : comment l'outil reconnaît un même client entre CRM et facturation.",
          "3. Forecast fondé sur des données réconciliées, pondéré par étape et date de fermeture.",
          "4. Alertes et objectifs vérifiés sur les vraies données avant enregistrement.",
          "5. Restitution par équipe : chaque pôle son brief, la direction la vue d'ensemble.",
          "6. Hébergement en Europe, RGPD, IA sans rétention des données.",
          "7. Tarif public, essai gratuit, sans engagement annuel imposé.",
        ],
      },
      {
        h2: "Trois familles d'outils, trois compromis",
        paragraphs: [
          "Les plateformes enterprise (Clari, Gong, BoostUp, Aviso) offrent des fonctions avancées de forecast et d'analyse de conversations, mais visent Salesforce, l'anglais et des budgets sur devis.",
          "Les outils de BI (Looker Studio, Power BI, Metabase, Grow) sont flexibles et parfois gratuits, mais la logique RevOps (réconciliation, forecast, alertes) est à construire et à maintenir soi-même.",
          "Les plateformes RevOps de nouvelle génération comme Revold embarquent la logique métier et visent les PME et ETI avec un tarif public.",
        ],
      },
      {
        h2: "Le déploiement d'un logiciel RevOps",
        paragraphs: [
          "Un logiciel RevOps ne doit pas exiger un projet. Avec Revold : connexion OAuth au CRM en un clic, connecteurs facturation par clé API, synchronisation en lecture seule, rapprochement automatique des comptes, puis choix des indicateurs et des alertes par équipe. Une organisation est opérationnelle en une matinée, sans équipe data.",
        ],
      },
    ],
    whyRevold: [
      { title: "Six connecteurs natifs", desc: "HubSpot, Stripe, Pennylane, Chargebee, GoCardless, Sage — et Salesforce, Pipedrive, Zendesk en développement." },
      { title: "Prix public", desc: "Starter, Business, Scale : trois plans affichés, 14 jours d'essai sans carte bancaire." },
      { title: "Audit CRM inclus", desc: "Complétude, doublons, contacts sans entreprise, deals stagnants — corrigés dans le CRM après validation." },
      { title: "Agents experts par pôle", desc: "Une équipe IA qui connaît vos chiffres et vos outils, disponible 24/7." },
    ],
    faq: [
      { q: "Quel est le meilleur logiciel RevOps ?", a: "Cela dépend de la taille et de la stack. Pour une entreprise enterprise sur Salesforce, Clari ou Gong. Pour une PME ou ETI française sur HubSpot avec Pennylane, Stripe ou Sage, Revold est conçu pour ce périmètre, avec rapprochement par SIREN et tarif public." },
      { q: "Combien coûte un logiciel RevOps ?", a: "De quelques dizaines d'euros par mois à plusieurs dizaines de milliers d'euros par an. Revold démarre à 79,90 € HT par mois (Starter), 149,90 € HT (Business) et à partir de 490,90 € HT (Scale)." },
      { q: "Un logiciel RevOps remplace-t-il le CRM ?", a: "Non. Il se connecte au CRM en lecture seule et le complète avec la facturation, la banque et le support. Le CRM reste la source de vérité commerciale." },
      { q: "Combien de temps pour déployer Revold ?", a: "Une matinée : connexion des outils, synchronisation initiale, rapprochement des comptes, puis configuration des briefs et alertes par équipe." },
    ],
    related: ["plateforme-revops", "pilotage-revops", "tableau-de-bord-revops", "plateforme-revenue-intelligence"],
  },
  {
    slug: "revenue-intelligence",
    keyword: "Revenue Intelligence",
    secondaryKeywords: ["revenue intelligence définition", "qu'est-ce que la revenue intelligence", "revenue intelligence B2B", "revenue intelligence français"],
    title: "Revenue Intelligence : définition, exemples et outils (guide 2026)",
    description:
      "La Revenue Intelligence exploite automatiquement les données de revenu pour prévoir, détecter les risques et agir. Définition, origine, cas d'usage concrets, outils et spécificités françaises.",
    h1: "Revenue Intelligence :",
    h1Accent: "définition, cas d'usage et outils",
    answer:
      "La Revenue Intelligence est l'exploitation automatique des données de revenu d'une entreprise (CRM, facturation, support, banque, activité commerciale) pour prévoir le chiffre d'affaires, détecter les risques et recommander des actions. En France, Revold applique cette approche aux PME et ETI B2B en réconciliant leurs outils par SIREN.",
    intro:
      "Née aux États-Unis à la fin des années 2010, la Revenue Intelligence a d'abord désigné l'analyse automatique des conversations commerciales et du CRM pour fiabiliser le forecast. Le terme s'est élargi : il couvre aujourd'hui toute exploitation automatique des données de revenu, jusqu'à la facture et l'encaissement.",
    sections: [
      {
        h2: "Ce que la Revenue Intelligence change par rapport au reporting",
        paragraphs: [
          "Le reporting décrit le passé à partir de données saisies. La Revenue Intelligence capte automatiquement les données, les réconcilie, et en tire des prévisions et des recommandations. La différence tient en trois mots : automatique, réconcilié, actionnable.",
        ],
      },
      {
        h2: "Cas d'usage concrets",
        paragraphs: ["Voici des usages observés chez les entreprises B2B qui adoptent la Revenue Intelligence."],
        bullets: [
          "Forecast commercial pondéré par étape et par date de fermeture, comparé au réalisé.",
          "Détection des deals stagnants ou à risque avant la fin du trimestre.",
          "Écart entre revenu signé et revenu facturé, deal par deal.",
          "Alertes de churn croisant tickets support, usage et facturation.",
          "Brief quotidien par équipe : ce qui avance, ce qui bloque, ce qui est à traiter.",
        ],
      },
      {
        h2: "La Revenue Intelligence en France",
        paragraphs: [
          "Les outils américains (Clari, Gong, ZoomInfo) sont conçus pour Salesforce, en anglais, pour des équipes enterprise, avec des budgets de plusieurs dizaines de milliers d'euros par an. Les entreprises françaises ont un tissu d'outils différent (HubSpot, Pennylane, Sage, Stripe), des identifiants légaux (SIREN, SIRET, TVA) qui permettent un rapprochement fiable, et des exigences RGPD.",
          "Revold est la première plateforme de Revenue Intelligence pensée pour ce contexte : interface en français, rapprochement par SIREN, connecteurs français, hébergement en Europe, tarif public.",
        ],
      },
      {
        h2: "Revenue Intelligence et intelligence artificielle",
        paragraphs: [
          "L'IA a deux rôles distincts. Un rôle de calcul, qui doit rester déterministe et vérifiable (indicateurs, seuils, prévisions). Un rôle de langage, où l'IA générative excelle (rédiger un brief, répondre à une question, expliquer un écart). Revold sépare strictement les deux pour que chaque chiffre soit recalculable.",
        ],
      },
    ],
    whyRevold: [
      { title: "Première plateforme française de la catégorie", desc: "Conçue pour HubSpot, Pennylane, Stripe, Sage et les identifiants d'entreprise français." },
      { title: "Du CRM au compte en banque", desc: "Là où les acteurs américains s'arrêtent au CRM, Revold suit le revenu jusqu'à l'encaissement." },
      { title: "Agents experts par domaine", desc: "Ventes, marketing, service client, comptabilité : chaque agent connaît ses données et ses outils." },
      { title: "Tarif accessible", desc: "À partir de 79,90 € HT par mois, essai gratuit de 14 jours." },
    ],
    faq: [
      { q: "Qu'est-ce que la Revenue Intelligence ?", a: "L'exploitation automatique des données de revenu d'une entreprise (CRM, facturation, support, banque, activité commerciale) pour prévoir le chiffre d'affaires, détecter les risques et recommander des actions." },
      { q: "Quelle différence entre Revenue Intelligence et Sales Intelligence ?", a: "La Sales Intelligence fournit des données sur les prospects (contacts, entreprises, signaux d'achat). La Revenue Intelligence analyse les données internes de revenu pour piloter le pipeline, le forecast et l'encaissement." },
      { q: "Quels sont les outils de Revenue Intelligence ?", a: "Clari, Gong, Aviso, BoostUp aux États-Unis ; Revold en France, avec une approche CRM × facturation × banque et un rapprochement par SIREN." },
      { q: "La Revenue Intelligence convient-elle aux PME ?", a: "Oui, à condition que l'outil soit compatible avec leur stack et leur budget. Revold cible les entreprises de 10 à 500 salariés avec un tarif public et un déploiement en une matinée." },
    ],
    related: ["plateforme-revenue-intelligence", "plateforme-revops", "forecast-commercial", "reconciliation-crm-facturation"],
  },
  {
    slug: "forecast-commercial",
    keyword: "Forecast commercial",
    secondaryKeywords: ["prévision des ventes", "forecast de vente", "prévision commerciale B2B", "forecast pondéré"],
    title: "Forecast commercial : méthode de prévision des ventes fiable en B2B",
    description:
      "Comment construire un forecast commercial fiable : pondération par étape, dates de fermeture, propriétés personnalisées, données réconciliées avec la facturation. Méthode et outil Revold.",
    h1: "Forecast commercial :",
    h1Accent: "une prévision des ventes qui tient la route",
    answer:
      "Le forecast commercial est la prévision du chiffre d'affaires attendu sur une période, calculée à partir du pipeline (montant des opportunités, probabilité par étape, date de fermeture) et confrontée au réalisé. Revold calcule un forecast pondéré à partir du CRM, le rapproche de la facturation et de l'encaissement, et signale les deals prêts à signer ou stagnants.",
    intro:
      "La plupart des forecasts sont faux parce qu'ils reposent sur des dates de fermeture jamais mises à jour et sur des probabilités déclarées par les commerciaux. Un forecast fiable repose sur des règles explicites, des données réconciliées et une comparaison régulière avec le réalisé.",
    sections: [
      {
        h2: "Les trois méthodes de forecast commercial",
        paragraphs: ["Chaque méthode a son usage ; les entreprises matures les combinent."],
        bullets: [
          "Forecast par étape : montant × probabilité de l'étape du pipeline. Simple, dépend de la qualité des étapes.",
          "Forecast par engagement : le commercial classe chaque deal (engagé, probable, possible). Subjectif mais lisible.",
          "Forecast historique : taux de conversion observés par étape et par cycle. Robuste avec assez d'historique.",
        ],
      },
      {
        h2: "La date de fermeture, maillon faible du forecast",
        paragraphs: [
          "Un forecast est daté : il compte les deals dont la fermeture prévue tombe dans la période. Si la date de fermeture n'est pas maintenue, ou si l'entreprise pilote en réalité sur une autre propriété (date de signature prévue, date de démarrage), le forecast se décale sans que personne ne le voie.",
          "Revold permet de choisir la propriété CRM qui fait office de date de fermeture, de la vérifier sur les données réelles, puis de lire les deals prêts à signer par échéance : cette semaine, ce mois-ci, le mois prochain, ce trimestre, le trimestre suivant, cette année.",
        ],
      },
      {
        h2: "Confronter le forecast au facturé et à l'encaissé",
        paragraphs: [
          "Un forecast ne s'arrête pas à la signature. Le revenu prévu doit se retrouver dans la facturation puis en banque. Revold rapproche les deals signés des factures et des paiements, ce qui permet de mesurer l'écart entre prévu, signé, facturé et encaissé, et d'alimenter une prévision de trésorerie pondérée.",
        ],
      },
      {
        h2: "Les signaux qui dégradent un forecast",
        paragraphs: ["Un bon outil de forecast surveille ces signaux en continu."],
        bullets: [
          "Deals stagnants dans la même étape au-delà d'un seuil de jours.",
          "Dates de fermeture dépassées sur des deals encore ouverts.",
          "Deals sans montant ou sans prochaine activité planifiée.",
          "Écart croissant entre pipeline pondéré et signé sur les périodes précédentes.",
        ],
      },
    ],
    whyRevold: [
      { title: "Prévision pondérée par échéance", desc: "Montant × probabilité d'étape, par pipeline et par période, avec la propriété de date de votre choix." },
      { title: "Deals prêts à signer et stagnants", desc: "Lus chaque jour dans le brief Ventes, par pipeline, avec seuil de stagnation configurable." },
      { title: "Forecast rapproché de la facturation", desc: "Prévu, signé, facturé, encaissé : l'écart entre chaque étape est chiffré." },
      { title: "Gestion des dates de fermeture", desc: "Deals à date dépassée et répartition par trimestre, lus directement dans HubSpot." },
    ],
    faq: [
      { q: "Qu'est-ce qu'un forecast commercial ?", a: "La prévision du chiffre d'affaires attendu sur une période, calculée à partir du pipeline : montant des opportunités, probabilité par étape et date de fermeture prévue, puis confrontée au réalisé." },
      { q: "Comment calculer un forecast pondéré ?", a: "Pour chaque deal ouvert dont la date de fermeture tombe dans la période, multiplier le montant par la probabilité de son étape, puis additionner. Revold applique ce calcul par pipeline avec la propriété de date choisie." },
      { q: "Pourquoi mon forecast est-il faux ?", a: "Le plus souvent parce que les dates de fermeture ne sont pas maintenues, que les probabilités d'étape ne reflètent pas les conversions réelles, ou que les deals stagnants restent comptés. Ces trois signaux sont surveillés par Revold." },
      { q: "Peut-on utiliser une autre propriété que la date de fermeture ?", a: "Oui. Dans Revold, chaque bloc de prévision accepte une propriété CRM personnalisée (date de signature prévue, date de démarrage…), vérifiée dans le CRM avant enregistrement." },
    ],
    related: ["pilotage-revops", "plateforme-revenue-intelligence", "tableau-de-bord-revops", "reconciliation-crm-facturation"],
  },
  {
    slug: "tableau-de-bord-revops",
    keyword: "Tableau de bord RevOps",
    secondaryKeywords: ["dashboard RevOps", "tableau de bord revenue", "reporting RevOps", "KPI RevOps"],
    title: "Tableau de bord RevOps : les KPIs à suivre et comment le construire",
    description:
      "Construire un tableau de bord RevOps : indicateurs par équipe, sources de données à croiser, fréquence, erreurs à éviter, et comment Revold génère des tableaux vérifiés sur les vraies données.",
    h1: "Tableau de bord RevOps :",
    h1Accent: "les bons KPIs, croisés entre outils",
    answer:
      "Un tableau de bord RevOps rassemble les indicateurs de revenu des ventes, du marketing, du service client et de la finance sur une même vue, à partir de données réconciliées entre le CRM, la facturation et le support. Revold génère ces tableaux par équipe, avec des KPIs câblés et vérifiés sur les données réelles avant d'être affichés.",
    intro:
      "Un tableau de bord RevOps n'est pas un tableau de bord commercial élargi. Sa valeur vient du croisement : le pipeline lu avec la facturation, le churn lu avec les tickets, le marketing lu avec le signé.",
    sections: [
      {
        h2: "Les KPIs d'un tableau de bord RevOps, par équipe",
        paragraphs: ["Chaque pôle a ses indicateurs ; le tableau de direction les agrège."],
        bullets: [
          "Ventes : pipeline en cours, forecast pondéré, deals prêts à signer, stagnants, signé par propriétaire.",
          "Marketing : nouveaux contacts, MQL, passages en SQL, contacts par source, répartition du cycle de vie.",
          "Service client : tickets ouverts par priorité, résolus par propriétaire, sans mise à jour, SLA dépassés, CSAT.",
          "Comptabilité : facturé, encaissé, factures en retard, échéances, MRR, deals signés à facturer.",
        ],
      },
      {
        h2: "Croiser les sources : la vraie valeur du tableau RevOps",
        paragraphs: [
          "Les indicateurs les plus utiles sont ceux qu'aucun outil ne peut produire seul : écart signé / facturé, revenu par source d'acquisition, churn par segment de clients, délai moyen entre signature et premier paiement. Ils exigent que les comptes soient rapprochés entre outils.",
          "Revold propose ces croisements dès que deux outils sont connectés, et filtre les KPIs proposés selon les sources réellement disponibles.",
        ],
      },
      {
        h2: "Construire le tableau : blocs, périodes, vérification",
        paragraphs: [
          "Dans Revold, chaque page de données est composée de tuiles KPI et de blocs retirables ou ajoutables. Un KPI personnalisé est décrit en langage naturel, l'agent propose un câblage (entité, dimension, mesure), le résultat est recalculé sur les vraies données, et l'utilisateur valide avant enregistrement. Les périodes se choisissent parmi des préréglages (semaine, mois, trimestre, exercice fiscal) ou en dates libres.",
        ],
      },
      {
        h2: "Les erreurs à éviter",
        paragraphs: ["Quatre pièges classiques des tableaux de bord RevOps."],
        bullets: [
          "Mélanger les étapes homonymes de plusieurs pipelines sans filtrer le pipeline.",
          "Compter les deals sans montant ou sans date de fermeture dans le forecast.",
          "Lire le churn dans le CRM seul, sans les données d'abonnement.",
          "Multiplier les graphiques sans alerte ni objectif rattaché.",
        ],
      },
    ],
    whyRevold: [
      { title: "KPIs au câblage vérifié", desc: "Chaque indicateur est recalculé sur les vraies données avant d'être affiché ou suivi par une alerte." },
      { title: "Sources nommées et filtrées", desc: "Les KPIs proposés dépendent des outils connectés ; chaque chiffre porte sa source." },
      { title: "Tableaux par équipe", desc: "Espaces de travail par pôle, tuiles et blocs configurables, suggestions adaptées à chaque équipe." },
      { title: "Rapports partagés", desc: "Rapports en carte blanche, exportables et partageables par lien en lecture seule." },
    ],
    faq: [
      { q: "Que doit contenir un tableau de bord RevOps ?", a: "Les indicateurs de revenu des quatre pôles (ventes, marketing, service client, finance) et surtout leurs croisements : écart signé / facturé, revenu par source, churn par segment, délai signature → paiement." },
      { q: "Quelle différence entre un tableau de bord RevOps et un dashboard CRM ?", a: "Le dashboard CRM ne voit que le CRM. Le tableau RevOps croise le CRM avec la facturation, le support et la banque, après rapprochement des comptes." },
      { q: "Peut-on construire un tableau de bord RevOps dans Looker Studio ou Power BI ?", a: "Oui, à condition de modéliser soi-même les connecteurs, les jointures entre outils et la logique de forecast, puis de les maintenir. Revold embarque cette logique et vérifie chaque KPI sur les données réelles." },
      { q: "Les tableaux de bord Revold sont-ils personnalisables ?", a: "Oui : tuiles et blocs ajoutables ou retirables sur chaque page, KPIs personnalisés décrits en langage naturel et vérifiés avant enregistrement, périodes préréglées ou libres." },
    ],
    related: ["pilotage-revops", "plateforme-revops", "pilotage-performance-entreprise", "forecast-commercial"],
  },
  {
    slug: "reconciliation-crm-facturation",
    keyword: "Réconciliation CRM et facturation",
    secondaryKeywords: ["rapprochement CRM facturation", "connecter CRM et facturation", "HubSpot Pennylane", "revenu signé vs facturé"],
    title: "Réconciliation CRM et facturation : mesurer l'écart signé / facturé",
    description:
      "Pourquoi et comment réconcilier le CRM avec la facturation : rapprochement des comptes par SIREN, écart signé / facturé / encaissé, fuites de revenu, et méthode Revold pour HubSpot, Pennylane, Stripe et Sage.",
    h1: "Réconciliation CRM et facturation :",
    h1Accent: "retrouver le revenu perdu entre la signature et la facture",
    answer:
      "La réconciliation CRM et facturation consiste à rapprocher les opportunités signées dans le CRM des factures émises et des paiements reçus, pour mesurer l'écart entre revenu signé, facturé et encaissé. Revold réalise ce rapprochement automatiquement entre HubSpot et Pennylane, Stripe, Chargebee, GoCardless ou Sage, en identifiant les entreprises par SIREN, SIRET et numéro de TVA.",
    intro:
      "Dans la plupart des entreprises, personne ne compare systématiquement ce qui a été signé à ce qui a été facturé. Les deux outils ne partagent ni identifiant ni référentiel. L'écart existe pourtant, et il représente souvent plusieurs pour cent du chiffre d'affaires.",
    sections: [
      {
        h2: "Pourquoi le CRM et la facturation ne se parlent pas",
        paragraphs: [
          "Le CRM nomme les entreprises comme les commerciaux les saisissent. La facturation les nomme comme la comptabilité les enregistre. « Acme », « ACME SAS » et « Acme Group » sont trois comptes pour l'un et un seul client pour l'autre. Sans identifiant commun, aucun rapprochement automatique n'est fiable.",
          "En France, cet identifiant existe : le SIREN, complété par le SIRET et le numéro de TVA intracommunautaire. Revold enrichit les comptes CRM et facturation avec ces identifiants via l'API Sirene et l'INPI, puis rapproche les entreprises sur cette base.",
        ],
      },
      {
        h2: "Ce que révèle la réconciliation",
        paragraphs: ["Une fois les comptes rapprochés, l'écart entre les étapes devient mesurable."],
        bullets: [
          "Deals signés sans facture : revenu à facturer, souvent oublié après un changement d'interlocuteur.",
          "Factures sans deal : revenu non attribué, qui fausse les commissions et le forecast.",
          "Montants différents entre deal et facture : remises non tracées, avenants, erreurs de saisie.",
          "Factures émises non encaissées : retards de paiement à relancer par montant.",
          "Compensations : un écart net faible qui cache des écarts bruts importants dans les deux sens.",
        ],
      },
      {
        h2: "La méthode Revold",
        paragraphs: [
          "La réconciliation suit un ordre précis : rapprochement des entreprises par identifiant légal, puis association des factures aux deals (par entreprise, montant et période), puis calcul des écarts par deal et au global. Chaque étape produit un score de couverture : la part du revenu effectivement suivie de bout en bout.",
          "Les suggestions de rapprochement sont validées par l'utilisateur avant d'être appliquées, et rien ne se lance avant le clic sur le bouton de lancement du moteur.",
        ],
      },
    ],
    whyRevold: [
      { title: "Rapprochement par SIREN, SIRET, TVA", desc: "Enrichissement via l'API Sirene et l'INPI, hiérarchies de comptes (maison mère, filiales) proposées et validées." },
      { title: "Écart brut par deal", desc: "Σ des écarts absolus, pour ne pas laisser les compensations masquer les fuites." },
      { title: "Santé de réconciliation", desc: "Score quotidien sur 100, tendance et écart signé / facturé lus dans le brief." },
      { title: "Connecteurs français", desc: "HubSpot × Pennylane, Sage, Stripe, Chargebee, GoCardless." },
    ],
    faq: [
      { q: "Qu'est-ce que la réconciliation CRM et facturation ?", a: "Le rapprochement des opportunités signées dans le CRM avec les factures émises et les paiements reçus, pour mesurer l'écart entre signé, facturé et encaissé, client par client." },
      { q: "Comment rapprocher les entreprises entre HubSpot et Pennylane ?", a: "Par identifiant légal : SIREN, SIRET ou numéro de TVA, enrichis automatiquement via l'API Sirene. Revold le fait sans intégrateur, puis propose les rapprochements restants à valider." },
      { q: "Quel écart entre signé et facturé est normal ?", a: "Il n'y a pas de norme : l'important est de le mesurer deal par deal et de le faire baisser. Un écart net faible peut cacher des écarts bruts importants qui se compensent." },
      { q: "Revold écrit-il dans mon CRM ou ma facturation ?", a: "Uniquement après validation humaine explicite d'une action (par exemple associer un contact à une entreprise). La synchronisation elle-même est en lecture seule." },
    ],
    related: ["plateforme-revenue", "plateforme-revenue-intelligence", "forecast-commercial", "plateforme-revops"],
  },
];

export function getKeywordPage(slug: string): KeywordPage | undefined {
  return KEYWORD_PAGES.find((p) => p.slug === slug);
}
