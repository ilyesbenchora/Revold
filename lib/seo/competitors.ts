/**
 * Pages « Alternative à X / Revold vs X » — une page par outil concurrent ou
 * adjacent, pour capter les requêtes de comparaison (« alternative clari »,
 * « revold vs looker studio », « grow vs revold »…).
 *
 * Règle éditoriale : les faits sur les concurrents sont limités à ce que leurs
 * sites publient (positionnement, catégorie, mode de tarification, CRM cible,
 * langue). Pas de chiffre inventé, pas de jugement de valeur : on décrit la
 * différence de périmètre, et on dit dans quel cas chaque outil est le bon choix.
 */

import type { FaqItem } from "@/lib/seo/site";

export type Competitor = {
  slug: string;
  name: string;
  /** Nom alternatif fréquemment recherché (ex : Data Studio pour Looker Studio). */
  aka?: string;
  category: string;
  /** Description factuelle de l'outil concurrent. */
  summary: string;
  title: string;
  description: string;
  /** Réponse directe (GEO). */
  answer: string;
  /** Lignes du tableau comparatif : critère, concurrent, Revold. */
  table: { criterion: string; them: string; revold: string }[];
  chooseThem: string[];
  chooseRevold: string[];
  faq: FaqItem[];
  /** Pages mots-clés liées. */
  related: string[];
};

const REVOLD_PRICING = "Tarif public : Starter 79,90 € HT/mois, Business 149,90 € HT/mois, Scale à partir de 490,90 € HT/mois ; 14 jours d'essai sans carte bancaire";
const REVOLD_CONNECTORS = "HubSpot, Stripe, Pennylane, Chargebee, GoCardless, Sage (Salesforce, Pipedrive, Zendesk en développement)";
const REVOLD_RECON = "Rapprochement des comptes par SIREN, SIRET et TVA (API Sirene / INPI), réconciliation signé / facturé / encaissé";
const REVOLD_HOSTING = "Application à Paris, base de données à Francfort, IA Anthropic en zone EU sans rétention, RGPD documenté";

export const COMPETITORS: Competitor[] = [
  {
    slug: "clari",
    name: "Clari",
    category: "Plateforme de revenue enterprise (États-Unis)",
    summary:
      "Clari est une plateforme américaine de Revenue Orchestration : forecast, inspection du pipeline, capture d'activité commerciale et analyse de conversations, principalement pour des organisations commerciales enterprise équipées de Salesforce. Le tarif est communiqué sur devis.",
    title: "Alternative à Clari : Revold vs Clari pour les entreprises françaises",
    description:
      "Clari ou Revold ? Comparatif factuel : périmètre (CRM seul vs CRM × facturation × banque), CRM cible, langue, rapprochement des comptes, hébergement et tarification. Quand choisir l'un ou l'autre.",
    answer:
      "Clari est une plateforme de revenue enterprise centrée sur le forecast et le pipeline Salesforce, facturée sur devis et en anglais. Revold est une alternative française à Clari pour les PME et ETI : elle connecte HubSpot, Stripe, Pennylane, Chargebee, GoCardless et Sage, réconcilie les comptes par SIREN et suit le revenu jusqu'à l'encaissement, avec un tarif public à partir de 79,90 € HT par mois.",
    table: [
      { criterion: "Périmètre du revenu", them: "Pipeline et forecast à partir du CRM et de l'activité commerciale", revold: "CRM × facturation × banque × support : signé, facturé, encaissé" },
      { criterion: "CRM cible", them: "Salesforce en priorité", revold: "HubSpot (OAuth en un clic) ; Salesforce et Pipedrive en développement" },
      { criterion: "Rapprochement des comptes", them: "Sur les objets du CRM", revold: REVOLD_RECON },
      { criterion: "Langue de l'interface", them: "Anglais", revold: "Français" },
      { criterion: "Cible", them: "Équipes commerciales enterprise", revold: "PME et ETI B2B de 10 à 500 salariés" },
      { criterion: "Tarification", them: "Sur devis", revold: REVOLD_PRICING },
      { criterion: "Hébergement et données", them: "Infrastructure américaine (voir leur documentation)", revold: REVOLD_HOSTING },
      { criterion: "IA", them: "RevAI : forecast, résumés, conversations", revold: "Moteur déterministe pour les chiffres, agents experts par pôle pour le langage, tour de contrôle vocale" },
    ],
    chooseThem: [
      "Votre organisation commerciale compte plusieurs centaines de vendeurs sur Salesforce.",
      "Vous avez besoin d'analyse de conversations (appels, e-mails) à grande échelle.",
      "Votre budget outils revenue se compte en dizaines de milliers d'euros par an.",
    ],
    chooseRevold: [
      "Vous êtes une PME ou ETI française sur HubSpot avec Pennylane, Stripe, Chargebee, GoCardless ou Sage.",
      "Vous voulez suivre le revenu jusqu'à la facture et l'encaissement, pas seulement le pipeline.",
      "Vous voulez un tarif public, un essai gratuit et un déploiement en une matinée, sans équipe data.",
      "Vos données doivent rester en Europe.",
    ],
    faq: [
      { q: "Revold est-il un équivalent français de Clari ?", a: "Revold couvre le forecast et le pipeline comme Clari, mais son périmètre est plus large (facturation, banque, support) et sa cible différente (PME et ETI françaises sur HubSpot plutôt qu'enterprise sur Salesforce)." },
      { q: "Clari fonctionne-t-il avec HubSpot ?", a: "Clari met en avant Salesforce comme CRM principal ; consultez leur documentation pour les autres CRM. Revold est conçu autour de HubSpot avec une connexion OAuth en un clic." },
      { q: "Combien coûte Clari par rapport à Revold ?", a: "Clari ne publie pas ses tarifs (sur devis). Revold affiche trois plans : 79,90 €, 149,90 € et à partir de 490,90 € HT par mois, avec 14 jours d'essai gratuit." },
      { q: "Peut-on migrer de Clari vers Revold ?", a: "Il n'y a rien à migrer : Revold lit vos outils sources (CRM, facturation) en lecture seule. La configuration des indicateurs et alertes se fait en une matinée." },
    ],
    related: ["plateforme-revenue-intelligence", "forecast-commercial", "plateforme-revops"],
  },
  {
    slug: "grow",
    name: "Grow",
    aka: "Grow.com",
    category: "Business Intelligence no-code (États-Unis)",
    summary:
      "Grow (grow.com, groupe Epicor) est un outil de Business Intelligence no-code destiné aux PME : connecteurs de données, tableaux de bord et rapports. C'est un outil de visualisation généraliste, sans logique métier de revenu embarquée.",
    title: "Alternative à Grow : Revold vs Grow pour piloter le revenu",
    description:
      "Grow ou Revold ? Grow est un outil de BI no-code généraliste ; Revold est une plateforme RevOps qui embarque la réconciliation CRM × facturation, le forecast et les alertes. Comparatif et cas d'usage.",
    answer:
      "Grow est un outil de Business Intelligence no-code qui affiche les données que l'on y connecte, sans logique de revenu intégrée. Revold est une alternative à Grow pour le pilotage du revenu : les connecteurs, le rapprochement des comptes par SIREN, la réconciliation signé / facturé / encaissé, le forecast et les alertes sont fournis, sans modélisation à construire.",
    table: [
      { criterion: "Catégorie", them: "Business Intelligence no-code", revold: "Plateforme RevOps / Revenue Intelligence" },
      { criterion: "Logique de revenu", them: "À construire dans les rapports (jointures, formules)", revold: "Embarquée : réconciliation, forecast pondéré, alertes, audit CRM" },
      { criterion: "Rapprochement des comptes entre outils", them: "Manuel, par clés à définir", revold: REVOLD_RECON },
      { criterion: "Connecteurs", them: "Large catalogue de sources génériques", revold: REVOLD_CONNECTORS },
      { criterion: "Restitution", them: "Tableaux de bord et rapports", revold: "Tableaux par équipe, briefs vocaux, récaps, alertes sur Slack, Teams, e-mail, SMS, WhatsApp" },
      { criterion: "Langue", them: "Anglais", revold: "Français" },
      { criterion: "Tarification", them: "Sur devis", revold: REVOLD_PRICING },
      { criterion: "Hébergement", them: "États-Unis (voir leur documentation)", revold: REVOLD_HOSTING },
    ],
    chooseThem: [
      "Vous avez besoin d'un outil de BI générique pour des données hors revenu (opérations, stocks, RH).",
      "Vous disposez d'une personne pour modéliser et maintenir les rapports.",
    ],
    chooseRevold: [
      "Votre besoin est le pilotage du revenu : pipeline, forecast, facturation, encaissement, churn.",
      "Vous ne voulez pas construire ni maintenir les jointures entre CRM et facturation.",
      "Vous voulez des alertes et des objectifs suivis automatiquement, pas seulement des graphiques.",
      "Vous êtes une entreprise française et voulez une interface en français, des données en Europe.",
    ],
    faq: [
      { q: "Grow et Revold sont-ils comparables ?", a: "Ils répondent à des besoins différents. Grow est un outil de BI généraliste ; Revold est une plateforme de pilotage du revenu avec la logique métier intégrée. Pour du reporting revenue B2B, Revold évite de reconstruire cette logique." },
      { q: "Peut-on utiliser Grow et Revold ensemble ?", a: "Oui. Revold pilote le revenu à partir des outils sources ; Grow peut rester l'outil de BI pour les autres domaines de l'entreprise." },
      { q: "Revold propose-t-il des tableaux de bord personnalisables comme Grow ?", a: "Oui : tuiles et blocs ajoutables sur chaque page, KPIs personnalisés décrits en langage naturel et vérifiés sur les données réelles, rapports partageables par lien." },
    ],
    related: ["tableau-de-bord-revops", "plateforme-revops", "pilotage-performance-entreprise"],
  },
  {
    slug: "looker-studio",
    name: "Looker Studio",
    aka: "Google Data Studio",
    category: "Reporting et visualisation (Google)",
    summary:
      "Looker Studio, anciennement Google Data Studio, est l'outil gratuit de reporting et de visualisation de Google. Il se connecte à de nombreuses sources (Google Ads, Analytics, Sheets, BigQuery, connecteurs partenaires) et permet de construire des rapports partageables. Une version Pro payante ajoute des fonctions d'administration.",
    title: "Alternative à Looker Studio (Data Studio) pour le reporting revenue",
    description:
      "Looker Studio (ex Data Studio) ou Revold pour piloter le revenu ? Looker Studio visualise ; Revold connecte CRM et facturation, réconcilie les comptes et produit forecast et alertes. Comparatif et cas d'usage.",
    answer:
      "Looker Studio (anciennement Google Data Studio) est un outil gratuit de visualisation : il affiche des données qu'il faut connecter, joindre et modéliser soi-même. Revold est une alternative à Looker Studio pour le reporting revenue B2B : les connecteurs CRM et facturation, le rapprochement des comptes par SIREN, le forecast, les alertes et les briefs par équipe sont fournis, sans modélisation.",
    table: [
      { criterion: "Catégorie", them: "Visualisation et reporting", revold: "Plateforme RevOps / Revenue Intelligence" },
      { criterion: "Connexion CRM et facturation", them: "Via connecteurs partenaires ou exports (Sheets, BigQuery)", revold: `Connecteurs natifs en lecture seule : ${REVOLD_CONNECTORS}` },
      { criterion: "Jointure entre outils", them: "Fusion de données à configurer manuellement", revold: REVOLD_RECON },
      { criterion: "Forecast et alertes", them: "Absents (formules à construire, pas d'alerte native)", revold: "Forecast pondéré par échéance, alertes et objectifs au câblage vérifié" },
      { criterion: "Restitution", them: "Rapports visuels partageables", revold: "Tableaux par équipe, rapports partagés, briefs vocaux, notifications multicanales" },
      { criterion: "Maintenance", them: "À votre charge (connecteurs, schémas, formules)", revold: "Synchronisation et logique métier maintenues par Revold" },
      { criterion: "Tarification", them: "Gratuit ; Looker Studio Pro payant", revold: REVOLD_PRICING },
      { criterion: "Hébergement", them: "Google Cloud", revold: REVOLD_HOSTING },
    ],
    chooseThem: [
      "Vous voulez un outil gratuit de visualisation pour des données marketing (Google Ads, Analytics) ou des feuilles Sheets.",
      "Vous avez déjà un entrepôt de données modélisé (BigQuery) et une personne pour entretenir les rapports.",
    ],
    chooseRevold: [
      "Votre besoin est le revenu : pipeline, signé, facturé, encaissé, churn, réconciliés entre outils.",
      "Vous ne voulez pas construire ni maintenir les connecteurs et les jointures.",
      "Vous voulez des alertes, des objectifs et des briefs, pas seulement des graphiques.",
      "Vous voulez que chaque KPI soit vérifié sur les données réelles avant d'être affiché.",
    ],
    faq: [
      { q: "Looker Studio est-il gratuit ?", a: "Oui, Looker Studio est gratuit ; une version Pro payante ajoute des fonctions d'administration et de support. Le coût réel est le temps de connexion, de modélisation et de maintenance des rapports." },
      { q: "Peut-on connecter HubSpot et Pennylane à Looker Studio ?", a: "Via des connecteurs partenaires ou des exports intermédiaires, puis en configurant la fusion des données. Revold connecte ces outils nativement et rapproche les comptes par SIREN sans configuration." },
      { q: "Revold remplace-t-il Looker Studio ?", a: "Pour le pilotage du revenu, oui : connecteurs, réconciliation, forecast et alertes sont intégrés. Looker Studio peut rester utile pour le reporting marketing ou des données hors revenu." },
      { q: "Data Studio et Looker Studio, est-ce le même outil ?", a: "Oui. Google Data Studio a été renommé Looker Studio en 2022." },
    ],
    related: ["tableau-de-bord-revops", "reconciliation-crm-facturation", "plateforme-revenue"],
  },
  {
    slug: "gong",
    name: "Gong",
    category: "Revenue Intelligence par l'analyse de conversations (États-Unis)",
    summary:
      "Gong est une plateforme américaine de Revenue Intelligence fondée sur la capture et l'analyse des conversations commerciales (appels, visioconférences, e-mails), avec des fonctions de forecast et de coaching. Elle vise les équipes commerciales de taille importante et communique ses tarifs sur devis.",
    title: "Alternative à Gong : Revold vs Gong pour la Revenue Intelligence en France",
    description:
      "Gong ou Revold ? Gong analyse les conversations commerciales ; Revold réconcilie CRM, facturation et banque pour piloter le revenu jusqu'à l'encaissement. Comparatif factuel et cas d'usage.",
    answer:
      "Gong est une plateforme de Revenue Intelligence centrée sur l'enregistrement et l'analyse des conversations commerciales, pour de grandes équipes de vente, avec un tarif sur devis. Revold est une alternative française qui aborde la Revenue Intelligence par les données : CRM, facturation, banque et support réconciliés par SIREN, forecast, alertes et briefs par équipe, avec un tarif public.",
    table: [
      { criterion: "Source principale", them: "Conversations commerciales (appels, visios, e-mails) + CRM", revold: "CRM × facturation × banque × support" },
      { criterion: "Fonction centrale", them: "Analyse de conversations, coaching, forecast", revold: "Réconciliation du revenu, forecast pondéré, alertes, audit CRM, briefs par équipe" },
      { criterion: "Rapprochement des comptes", them: "Sur les objets du CRM", revold: REVOLD_RECON },
      { criterion: "CRM cible", them: "Salesforce, HubSpot et autres CRM enterprise", revold: "HubSpot ; Salesforce et Pipedrive en développement" },
      { criterion: "Langue", them: "Anglais (transcription multilingue)", revold: "Français" },
      { criterion: "Tarification", them: "Sur devis, par utilisateur", revold: REVOLD_PRICING },
      { criterion: "Hébergement", them: "Infrastructure américaine (options régionales, voir leur documentation)", revold: REVOLD_HOSTING },
    ],
    chooseThem: [
      "Votre priorité est le coaching des commerciaux à partir de leurs appels et visioconférences.",
      "Vous avez une grande équipe de vente et un budget par utilisateur conséquent.",
    ],
    chooseRevold: [
      "Votre priorité est la fiabilité du revenu : ce qui est signé, facturé, encaissé.",
      "Vous voulez piloter quatre équipes (ventes, marketing, service client, comptabilité) et pas seulement les ventes.",
      "Vous êtes une PME ou ETI française et voulez un tarif public et des données en Europe.",
    ],
    faq: [
      { q: "Gong et Revold font-ils la même chose ?", a: "Non. Gong part des conversations commerciales ; Revold part des données de revenu (CRM, facturation, banque). Les deux se réclament de la Revenue Intelligence mais couvrent des besoins différents." },
      { q: "Revold enregistre-t-il les appels ?", a: "Non. Revold n'enregistre pas les conversations. Il propose une tour de contrôle vocale pour écouter un brief et dicter des demandes, ce qui est différent de l'analyse d'appels." },
      { q: "Peut-on utiliser Gong et Revold ensemble ?", a: "Oui : Gong pour le coaching sur les conversations, Revold pour la réconciliation du revenu et le pilotage par équipe." },
    ],
    related: ["revenue-intelligence", "plateforme-revenue-intelligence", "forecast-commercial"],
  },
  {
    slug: "power-bi",
    name: "Power BI",
    aka: "Microsoft Power BI",
    category: "Business Intelligence (Microsoft)",
    summary:
      "Power BI est l'outil de Business Intelligence de Microsoft : modélisation de données, tableaux de bord et rapports, intégré à Microsoft 365 et Azure. Puissant et généraliste, il demande de modéliser les données et d'écrire des mesures (DAX) pour toute logique métier.",
    title: "Alternative à Power BI pour le pilotage du revenue B2B",
    description:
      "Power BI ou Revold pour piloter le revenu ? Power BI est une BI généraliste à modéliser ; Revold embarque connecteurs, réconciliation CRM × facturation, forecast et alertes. Comparatif et cas d'usage.",
    answer:
      "Power BI est un outil de Business Intelligence généraliste de Microsoft, qui exige de modéliser les données et d'écrire les mesures pour toute logique de revenu. Revold est une alternative à Power BI pour le pilotage du revenu B2B : connecteurs CRM et facturation, rapprochement des comptes par SIREN, réconciliation signé / facturé / encaissé, forecast et alertes sont fournis prêts à l'emploi.",
    table: [
      { criterion: "Catégorie", them: "Business Intelligence généraliste", revold: "Plateforme RevOps / Revenue Intelligence" },
      { criterion: "Logique de revenu", them: "À modéliser (relations, mesures DAX)", revold: "Embarquée et vérifiée sur les données réelles" },
      { criterion: "Connecteurs CRM et facturation", them: "Connecteurs génériques ou intermédiaires", revold: REVOLD_CONNECTORS },
      { criterion: "Rapprochement des comptes", them: "Clés de jointure à définir", revold: REVOLD_RECON },
      { criterion: "Alertes et actions", them: "Alertes de seuil sur visuels ; pas d'action dans les outils sources", revold: "Alertes et objectifs vérifiés, actions exécutées dans le CRM après validation" },
      { criterion: "Compétences requises", them: "Modélisation, DAX, administration", revold: "Aucune compétence data" },
      { criterion: "Tarification", them: "Licences par utilisateur (voir Microsoft)", revold: REVOLD_PRICING },
      { criterion: "Hébergement", them: "Microsoft Azure (régions au choix)", revold: REVOLD_HOSTING },
    ],
    chooseThem: [
      "Vous avez une équipe data et un entrepôt de données à exploiter au-delà du revenu.",
      "Votre entreprise est standardisée sur Microsoft 365 et Azure avec des besoins de BI transverses.",
    ],
    chooseRevold: [
      "Vous voulez piloter le revenu sans projet BI : connecteurs, réconciliation et forecast prêts à l'emploi.",
      "Vous voulez des briefs par équipe et des alertes suivies automatiquement.",
      "Vous voulez que chaque KPI soit vérifié avant d'être affiché, sans DAX ni maintenance.",
    ],
    faq: [
      { q: "Power BI peut-il faire du RevOps ?", a: "Oui, à condition de modéliser soi-même les données du CRM et de la facturation, de définir les jointures entre comptes et d'écrire les mesures de forecast. Revold fournit cette logique intégrée." },
      { q: "Revold et Power BI sont-ils complémentaires ?", a: "Oui : Revold pour le pilotage du revenu par équipe, Power BI pour la BI transverse de l'entreprise." },
      { q: "Faut-il des compétences techniques pour Revold ?", a: "Non. La connexion des outils se fait par OAuth ou clé API, le rapprochement des comptes est automatique, et les KPIs personnalisés se décrivent en langage naturel puis sont vérifiés." },
    ],
    related: ["tableau-de-bord-revops", "pilotage-performance-entreprise", "plateforme-revops"],
  },
  {
    slug: "salesforce-revenue-intelligence",
    name: "Salesforce Revenue Intelligence",
    aka: "Sales Cloud Einstein",
    category: "Module de Revenue Intelligence de Salesforce",
    summary:
      "Salesforce Revenue Intelligence est un module analytique de Sales Cloud : tableaux de bord de pipeline, forecast et insights Einstein, disponible pour les clients Salesforce en complément de leur licence. Il exploite les données présentes dans Salesforce.",
    title: "Alternative à Salesforce Revenue Intelligence pour HubSpot et la facturation",
    description:
      "Salesforce Revenue Intelligence ou Revold ? Le module Salesforce analyse le CRM Salesforce ; Revold réconcilie HubSpot avec la facturation et la banque. Comparatif et cas d'usage.",
    answer:
      "Salesforce Revenue Intelligence est un module analytique réservé aux clients Sales Cloud, qui exploite les données du CRM Salesforce. Revold est une alternative pour les entreprises sur HubSpot, et pour celles qui veulent suivre le revenu au-delà du CRM : facturation, banque et support réconciliés par SIREN, forecast, alertes et briefs par équipe.",
    table: [
      { criterion: "Prérequis", them: "Licence Salesforce Sales Cloud", revold: "Un CRM (HubSpot) et un outil de facturation ; Salesforce en développement" },
      { criterion: "Périmètre des données", them: "Objets Salesforce", revold: "CRM × facturation × banque × support" },
      { criterion: "Rapprochement des comptes", them: "Interne à Salesforce", revold: REVOLD_RECON },
      { criterion: "Équipes couvertes", them: "Ventes", revold: "Ventes, marketing, service client, comptabilité" },
      { criterion: "Langue", them: "Multilingue (Salesforce)", revold: "Français" },
      { criterion: "Tarification", them: "Complément de licence Salesforce (voir Salesforce)", revold: REVOLD_PRICING },
      { criterion: "Hébergement", them: "Salesforce (régions au choix)", revold: REVOLD_HOSTING },
    ],
    chooseThem: [
      "Votre CRM est Salesforce et votre besoin se limite au pipeline et au forecast commercial.",
      "Vous voulez rester dans l'écosystème Salesforce sans outil tiers.",
    ],
    chooseRevold: [
      "Votre CRM est HubSpot.",
      "Vous voulez réconcilier le CRM avec Pennylane, Stripe, Chargebee, GoCardless ou Sage.",
      "Vous voulez piloter quatre équipes avec des briefs et des alertes, pas seulement les ventes.",
    ],
    faq: [
      { q: "Revold fonctionne-t-il avec Salesforce ?", a: "Le connecteur Salesforce est en développement. Aujourd'hui Revold se connecte à HubSpot en un clic, et aux outils de facturation Stripe, Pennylane, Chargebee, GoCardless et Sage." },
      { q: "Quelle différence entre le module Salesforce et Revold ?", a: "Le module Salesforce analyse le CRM Salesforce. Revold rapproche le CRM de la facturation et de la banque pour mesurer l'écart entre signé, facturé et encaissé, et restitue par équipe." },
    ],
    related: ["plateforme-revenue-intelligence", "reconciliation-crm-facturation", "forecast-commercial"],
  },
  {
    slug: "aviso",
    name: "Aviso",
    aka: "Aviso AI",
    category: "Forecast et Revenue Intelligence par l'IA (États-Unis)",
    summary:
      "Aviso est une plateforme américaine de Revenue Intelligence orientée forecast par IA, inspection du pipeline et guidance des commerciaux, destinée aux organisations commerciales enterprise. Tarif sur devis.",
    title: "Alternative à Aviso : Revold pour le forecast et le pilotage du revenu",
    description:
      "Aviso ou Revold ? Aviso vise le forecast IA enterprise ; Revold réconcilie CRM, facturation et banque pour un forecast rapproché du réel, avec un tarif public. Comparatif factuel.",
    answer:
      "Aviso est une plateforme de Revenue Intelligence enterprise centrée sur le forecast par IA et la guidance des commerciaux, facturée sur devis. Revold est une alternative française qui calcule un forecast pondéré déterministe, le rapproche de la facturation et de l'encaissement, et restitue par équipe, avec un tarif public à partir de 79,90 € HT par mois.",
    table: [
      { criterion: "Fonction centrale", them: "Forecast prédictif par IA, guidance des commerciaux", revold: "Forecast pondéré déterministe rapproché du facturé et de l'encaissé" },
      { criterion: "Périmètre", them: "CRM et activité commerciale", revold: "CRM × facturation × banque × support" },
      { criterion: "Rapprochement des comptes", them: "Sur les objets du CRM", revold: REVOLD_RECON },
      { criterion: "Cible", them: "Enterprise", revold: "PME et ETI B2B" },
      { criterion: "Langue", them: "Anglais", revold: "Français" },
      { criterion: "Tarification", them: "Sur devis", revold: REVOLD_PRICING },
      { criterion: "Hébergement", them: "États-Unis (voir leur documentation)", revold: REVOLD_HOSTING },
    ],
    chooseThem: [
      "Vous cherchez un forecast prédictif enterprise sur de gros volumes de deals et d'historique.",
    ],
    chooseRevold: [
      "Vous voulez un forecast explicable, recalculable, et confronté à la facturation réelle.",
      "Vous êtes une entreprise française sur HubSpot et Pennylane, Stripe ou Sage.",
      "Vous voulez un tarif public et des données hébergées en Europe.",
    ],
    faq: [
      { q: "Le forecast Revold utilise-t-il l'IA ?", a: "Non pour le calcul : le forecast est déterministe (montant × probabilité d'étape, par échéance et par pipeline). L'IA sert à rédiger les briefs et répondre aux questions à partir de ces chiffres." },
      { q: "Revold convient-il à une grande entreprise ?", a: "Revold cible d'abord les entreprises de 10 à 500 salariés. Le plan Scale, avec connecteurs illimités et advisor RevOps dédié, s'adresse aux ETI." },
    ],
    related: ["forecast-commercial", "plateforme-revenue-intelligence", "pilotage-revops"],
  },
  {
    slug: "boostup",
    name: "BoostUp",
    aka: "BoostUp.ai",
    category: "Plateforme RevOps et forecast (États-Unis)",
    summary:
      "BoostUp.ai est une plateforme américaine de Revenue Operations : forecast, inspection du pipeline et analyse d'activité pour des équipes commerciales enterprise, avec un tarif communiqué sur devis.",
    title: "Alternative à BoostUp : Revold, plateforme RevOps française",
    description:
      "BoostUp ou Revold ? BoostUp est une plateforme RevOps enterprise américaine ; Revold est une plateforme RevOps française qui réconcilie CRM, facturation et banque avec un tarif public. Comparatif.",
    answer:
      "BoostUp est une plateforme RevOps américaine orientée forecast et inspection du pipeline pour des équipes enterprise, sur devis. Revold est une alternative française pour les PME et ETI : rapprochement des comptes par SIREN, réconciliation signé / facturé / encaissé, forecast, alertes et briefs par équipe, avec un tarif public.",
    table: [
      { criterion: "Fonction centrale", them: "Forecast et inspection du pipeline", revold: "Réconciliation du revenu, forecast, alertes, audit CRM, briefs par équipe" },
      { criterion: "Périmètre", them: "CRM et activité commerciale", revold: "CRM × facturation × banque × support" },
      { criterion: "Rapprochement des comptes", them: "Sur les objets du CRM", revold: REVOLD_RECON },
      { criterion: "Équipes couvertes", them: "Ventes, RevOps", revold: "Ventes, marketing, service client, comptabilité" },
      { criterion: "Langue", them: "Anglais", revold: "Français" },
      { criterion: "Tarification", them: "Sur devis", revold: REVOLD_PRICING },
      { criterion: "Hébergement", them: "États-Unis (voir leur documentation)", revold: REVOLD_HOSTING },
    ],
    chooseThem: ["Votre organisation commerciale enterprise cherche un outil d'inspection de pipeline très détaillé sur Salesforce."],
    chooseRevold: [
      "Vous voulez suivre le revenu jusqu'à l'encaissement et piloter quatre équipes.",
      "Vous êtes une PME ou ETI française sur HubSpot.",
      "Vous voulez un tarif public et un essai gratuit.",
    ],
    faq: [
      { q: "Revold est-il une plateforme RevOps ?", a: "Oui : Revold connecte CRM, facturation, banque et support, réconcilie les comptes par SIREN et pilote le revenu par équipe avec forecast, alertes, objectifs et actions." },
      { q: "Quelle est la différence principale entre BoostUp et Revold ?", a: "Le périmètre : BoostUp se concentre sur le pipeline commercial ; Revold suit le revenu jusqu'à la facture et l'encaissement, pour les entreprises françaises." },
    ],
    related: ["plateforme-revops", "logiciel-revops", "forecast-commercial"],
  },
  {
    slug: "metabase",
    name: "Metabase",
    category: "Business Intelligence open source",
    summary:
      "Metabase est un outil de Business Intelligence open source (avec une version cloud payante) qui permet d'interroger des bases de données et de construire des tableaux de bord. Il ne se connecte pas directement aux outils SaaS : il faut d'abord rapatrier les données dans une base.",
    title: "Alternative à Metabase pour le reporting revenue sans entrepôt de données",
    description:
      "Metabase ou Revold pour piloter le revenu ? Metabase interroge une base de données que vous devez alimenter ; Revold se connecte directement au CRM et à la facturation et réconcilie les comptes. Comparatif.",
    answer:
      "Metabase est un outil de BI open source qui interroge des bases de données : il faut d'abord y rapatrier les données du CRM et de la facturation, puis modéliser les jointures. Revold est une alternative à Metabase pour le pilotage du revenu : connexion directe aux outils, rapprochement des comptes par SIREN, réconciliation, forecast et alertes, sans entrepôt de données.",
    table: [
      { criterion: "Catégorie", them: "Business Intelligence open source", revold: "Plateforme RevOps / Revenue Intelligence" },
      { criterion: "Source des données", them: "Bases de données (à alimenter par ETL)", revold: `Connecteurs natifs : ${REVOLD_CONNECTORS}` },
      { criterion: "Rapprochement des comptes", them: "À modéliser en SQL", revold: REVOLD_RECON },
      { criterion: "Forecast et alertes", them: "Alertes sur requêtes ; forecast à construire", revold: "Forecast pondéré, alertes et objectifs vérifiés, actions dans les outils" },
      { criterion: "Compétences requises", them: "SQL, ETL, administration", revold: "Aucune compétence data" },
      { criterion: "Tarification", them: "Open source auto-hébergé ou cloud payant (voir Metabase)", revold: REVOLD_PRICING },
      { criterion: "Hébergement", them: "Au choix (auto-hébergé) ou cloud Metabase", revold: REVOLD_HOSTING },
    ],
    chooseThem: [
      "Vous avez déjà un entrepôt de données et une équipe capable d'écrire le SQL et de maintenir l'ETL.",
      "Vous voulez un outil de BI ouvert pour des données hors revenu.",
    ],
    chooseRevold: [
      "Vous n'avez pas d'entrepôt de données ni d'équipe data.",
      "Vous voulez la logique de revenu prête à l'emploi : réconciliation, forecast, alertes, briefs.",
      "Vous voulez des KPIs vérifiés sur les données réelles avant affichage.",
    ],
    faq: [
      { q: "Peut-on connecter HubSpot à Metabase ?", a: "Pas directement : il faut extraire les données HubSpot vers une base (via un ETL) puis les interroger. Revold se connecte à HubSpot en un clic et synchronise en lecture seule." },
      { q: "Revold est-il open source ?", a: "Non. Revold est un service SaaS hébergé en Europe, avec un tarif public et un essai gratuit de 14 jours." },
    ],
    related: ["tableau-de-bord-revops", "reconciliation-crm-facturation", "plateforme-revenue"],
  },
];

export function getCompetitor(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}
