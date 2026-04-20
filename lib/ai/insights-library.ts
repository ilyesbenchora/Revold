/**
 * Insight Library — diagnostics CRO/RevOps de 20 ans d'expérience
 *
 * Chaque template est :
 *   - Data-driven : shouldShow conditionné sur des seuils réels
 *   - Quantifié : title et body utilisent des nombres extraits de ctx
 *   - Actionnable : recommendation = action concrète (pas du best-practice générique)
 *
 * Pas de templates "always-on" génériques — ils n'apportent aucune valeur quand
 * Revold doit se distinguer comme un expert qui regarde la VRAIE donnée du client.
 */

export type InsightCategory = "commercial" | "marketing" | "data";
export type Severity = "critical" | "warning" | "info";

export type InsightContext = {
  // ── DEALS ──
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  closingRate: number;
  dealsNoNextActivity: number;
  dealsNoActivity: number;
  dealsNoAmount: number;
  dealsNoCloseDate: number;
  stagnantDeals: number;
  // ── CONTACTS ──
  totalContacts: number;
  leadsCount: number;
  opportunitiesCount: number;
  conversionRate: number;
  orphansCount: number;
  orphanRate: number;
  contactsNoPhone: number;
  contactsNoTitle: number;
  // ── COMPANIES ──
  totalCompanies: number;
  companiesNoIndustry: number;
  companiesNoRevenue: number;
  // ── TRACKING ──
  trackingSample?: number;
  onlineContacts?: number;
  // ── ECOSYSTEM (scopes optional HubSpot) ──
  ticketsCount?: number;
  conversationsCount?: number;
  feedbackCount?: number;
  leadsObjectCount?: number;
  quotesCount?: number;
  lineItemsCount?: number;
  sequencesCount?: number;
  forecastsCount?: number;
  goalsCount?: number;
  invoicesCount?: number;
  subscriptionsCount?: number;
  marketingCampaignsCount?: number;
  marketingEventsCount?: number;
  formsCount?: number;
  customObjectsCount?: number;
  listsCount?: number;
  workflowsCount?: number;
  workflowsActiveCount?: number;
  ownersCount?: number;
  teamsCount?: number;
  appointmentsCount?: number;
};

export type InsightTemplate = {
  key: string;
  category: InsightCategory;
  severity: Severity;
  priority: number;
  shouldShow: (ctx: InsightContext) => boolean;
  build: (ctx: InsightContext) => { title: string; body: string; recommendation: string };
};

const PCT = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export const INSIGHT_LIBRARY: InsightTemplate[] = [
  // ════════════════════════════════════════════════════════════════════
  // COMMERCIAL — diagnostics data-driven niveau CRO
  // ════════════════════════════════════════════════════════════════════

  {
    key: "commercial_low_closing_rate",
    category: "commercial",
    severity: "critical",
    priority: 100,
    shouldShow: (c) => c.wonDeals + c.lostDeals >= 5 && c.closingRate < 20,
    build: (c) => ({
      title: `Taux de closing critique : ${c.closingRate}% (benchmark B2B : 25-35%)`,
      body: `${c.wonDeals} deals gagnés sur ${c.wonDeals + c.lostDeals} clôturés. Diagnostic : qualification trop laxiste, deals non-mûrs entrent en pipeline et finissent en lost. Manque-à-gagner estimé : ${Math.round((c.wonDeals + c.lostDeals) * 0.25 - c.wonDeals)} deals/an si vous montez à 25%.`,
      recommendation: "Implémenter MEDDIC ou BANT en checkpoint obligatoire entre stage Qualification → Proposition. Disqualifier 30% des deals au stade Qualification — ils pollueront moins le pipeline et amélioreront le taux mécaniquement.",
    }),
  },
  {
    key: "commercial_no_next_activity",
    category: "commercial",
    severity: "critical",
    priority: 99,
    shouldShow: (c) => c.openDeals >= 5 && c.dealsNoNextActivity > c.openDeals * 0.4,
    build: (c) => ({
      title: `${c.dealsNoNextActivity} deals ouverts sans next activity (${PCT(c.dealsNoNextActivity, c.openDeals)}% du pipeline)`,
      body: `Sur ${c.openDeals} deals en cours, ${c.dealsNoNextActivity} n'ont aucune prochaine action planifiée. Probabilité de stagnation puis perte : ~70% à 30 jours selon les benchmarks Sales Hub.`,
      recommendation: "Workflow HubSpot bloquant : interdire la sauvegarde d'un deal en stage actif sans champ next_activity_date renseigné. Audit one-shot sur les deals existants avec règle de relance forcée sous 5 jours ouvrés.",
    }),
  },
  {
    key: "commercial_no_activity_burn",
    category: "commercial",
    severity: "critical",
    priority: 98,
    shouldShow: (c) => c.openDeals >= 5 && c.dealsNoActivity > c.openDeals * 0.25,
    build: (c) => ({
      title: `${c.dealsNoActivity} deals créés mais jamais travaillés (${PCT(c.dealsNoActivity, c.openDeals)}% du pipeline)`,
      body: `Ces deals ont été ouverts dans le CRM puis abandonnés. Ils faussent le forecast, bloquent les rapports de couverture et polluent les revues de pipeline.`,
      recommendation: "Sprint nettoyage cette semaine : pour chaque deal sans activité, choix binaire en 2min — soit 1 action concrète planifiée (call, email, RDV), soit clôture en lost (avec lost_reason). Max 30 deals par sales/jour.",
    }),
  },
  {
    key: "commercial_stagnant_critical",
    category: "commercial",
    severity: "critical",
    priority: 97,
    shouldShow: (c) => c.openDeals >= 5 && c.stagnantDeals > c.openDeals * 0.35,
    build: (c) => ({
      title: `War room nécessaire : ${c.stagnantDeals} deals stagnants (${PCT(c.stagnantDeals, c.openDeals)}% du pipeline figé)`,
      body: `Plus du tiers du pipeline n'a aucune activité depuis 7+ jours. C'est le signal d'une équipe sales débordée OU démotivée OU mal pilotée. Risque : forecast irréaliste qui explose au QBR.`,
      recommendation: "Bloquer 2h cette semaine pour une war room stagnation : 1 deal = 1 décision (relance avec next activity OU lost OU escalade manager). Si > 50 deals stagnants, escalade direction commerciale — c'est un problème de capacité.",
    }),
  },
  {
    key: "commercial_no_amount_forecast_blind",
    category: "commercial",
    severity: "critical",
    priority: 96,
    shouldShow: (c) => c.totalDeals >= 10 && c.dealsNoAmount > c.totalDeals * 0.4,
    build: (c) => ({
      title: `Forecast aveugle : ${PCT(c.dealsNoAmount, c.totalDeals)}% des deals sans montant`,
      body: `${c.dealsNoAmount} deals sur ${c.totalDeals} n'ont aucun montant renseigné. Impossible de calculer la couverture pipeline (3x objectif), le forecast pondéré ou la vélocité.`,
      recommendation: "Champ amount obligatoire dès le stage Qualification (avant Proposition). Workflow validation : refus de progression vers Proposition si amount = null OR amount < 100€. Audit rétroactif sur les deals open avec rappel sales.",
    }),
  },
  {
    key: "commercial_no_close_date_planning",
    category: "commercial",
    severity: "warning",
    priority: 90,
    shouldShow: (c) => c.totalDeals >= 10 && c.dealsNoCloseDate > c.totalDeals * 0.4,
    build: (c) => ({
      title: `${PCT(c.dealsNoCloseDate, c.totalDeals)}% des deals sans date de closing`,
      body: `${c.dealsNoCloseDate} deals sans close_date estimée. Forecast mensuel et trimestriel impossibles. Les sales sont dans le brouillard.`,
      recommendation: "Champ closedate obligatoire avant passage en Proposition. Règle : la date peut bouger mais doit toujours exister. Workflow d'alerte 14j avant close_date pour pousser la signature.",
    }),
  },
  {
    key: "commercial_low_pipeline_volume",
    category: "commercial",
    severity: "critical",
    priority: 95,
    shouldShow: (c) => c.openDeals > 0 && c.openDeals < 15,
    build: (c) => ({
      title: `Pipeline anémique : ${c.openDeals} deals ouverts seulement`,
      body: `Avec ${c.openDeals} deals actifs, vous êtes sous le seuil critique. Règle CRO : pipeline ≥ 3x objectif trimestriel. Un seul churn de gros deal vous fait rater le quarter.`,
      recommendation: `Plan d'urgence inbound + outbound combiné dès cette semaine. Cible : x3 le pipeline en 60 jours. Mobiliser SDR sur ${Math.max(20, c.openDeals * 3)} deals nouveaux à créer.`,
    }),
  },
  {
    key: "commercial_high_lost_ratio",
    category: "commercial",
    severity: "warning",
    priority: 88,
    shouldShow: (c) => c.wonDeals + c.lostDeals >= 10 && c.lostDeals > c.wonDeals * 2,
    build: (c) => ({
      title: `Trop de lost : ratio ${(c.lostDeals / Math.max(c.wonDeals, 1)).toFixed(1)}x lost vs won`,
      body: `${c.lostDeals} perdus pour ${c.wonDeals} gagnés. L'équipe brûle du temps sur des deals non-qualifiés ou face à de mauvais concurrents. Coût opportunité énorme.`,
      recommendation: "ICP strict + scoring lead automatique. Disqualifier dès la 1re call si l'un des critères ICP manque. Analyser les top 10 lost reasons pour identifier les patterns récurrents (prix, timing, concurrent dominant, mauvais profil).",
    }),
  },
  {
    key: "commercial_no_owner",
    category: "commercial",
    severity: "warning",
    priority: 85,
    shouldShow: (c) => c.openDeals >= 5 && (c.ownersCount ?? 0) > 0,
    build: (c) => ({
      title: `Vérifier l'attribution owners sur les ${c.openDeals} deals ouverts`,
      body: `${c.ownersCount ?? 0} owners actifs dans HubSpot. Les deals sans owner ne sont suivis par personne — perte garantie.`,
      recommendation: "Workflow HubSpot d'attribution auto à la création (round-robin par segment, source ou industrie). Audit hebdo des deals sans hubspot_owner_id via report dédié.",
    }),
  },
  {
    key: "commercial_no_sequences",
    category: "commercial",
    severity: "warning",
    priority: 82,
    shouldShow: (c) => c.openDeals >= 10 && (c.sequencesCount ?? 0) === 0,
    build: () => ({
      title: "0 sequence Sales Hub déployée — outbound artisanal",
      body: "Aucune sequence détectée. Les SDR/AE prospectent à la main, sans cadence ni A/B test. Productivité plafonnée et messages incohérents.",
      recommendation: "Construire 3 sequences de base : cold prospect (5-7 touches), nurturing tiède (3 touches sur 21j), réactivation dormants (2 touches espacées). Tracker open/reply rate dans Sales Hub.",
    }),
  },
  {
    key: "commercial_sequences_few",
    category: "commercial",
    severity: "info",
    priority: 60,
    shouldShow: (c) => (c.sequencesCount ?? 0) >= 1 && (c.sequencesCount ?? 0) < 5,
    build: (c) => ({
      title: `Seulement ${c.sequencesCount} sequence${(c.sequencesCount ?? 0) > 1 ? "s" : ""} active${(c.sequencesCount ?? 0) > 1 ? "s" : ""} sur Sales Hub`,
      body: "Sequences existantes mais peu nombreuses. Probablement un cold outreach unique sans variantes par persona ou par segment.",
      recommendation: "Décliner 1 sequence par persona × phase funnel (cold, follow-up, post-démo, nurturing). Mesurer la sequence avec le meilleur reply rate et standardiser sur l'équipe.",
    }),
  },
  {
    key: "commercial_no_forecasts",
    category: "commercial",
    severity: "info",
    priority: 70,
    shouldShow: (c) => c.totalDeals >= 20 && (c.forecastsCount ?? 0) === 0,
    build: () => ({
      title: "Aucun forecast HubSpot enregistré",
      body: "Sales Hub Forecast Tool inutilisé. Les sales ne soumettent pas leur prévision personnelle — la direction commerciale n'a pas de baseline pour comparer engagement vs réalité.",
      recommendation: "Activer le Forecast Tool. Rituel mensuel : chaque sales soumet son commit + best case + most likely. Comparer en fin de mois pour identifier les sur/sous-estimateurs systématiques.",
    }),
  },
  {
    key: "commercial_no_goals",
    category: "commercial",
    severity: "info",
    priority: 68,
    shouldShow: (c) => (c.ownersCount ?? 0) >= 2 && (c.goalsCount ?? 0) === 0,
    build: (c) => ({
      title: `0 objectif (Goal HubSpot) défini pour ${c.ownersCount ?? 0} sales`,
      body: "Les commerciaux n'ont pas d'objectifs structurés dans HubSpot Goals. Coaching aveugle, impossibilité de mesurer attainment.",
      recommendation: "Définir des objectifs trimestriels par sales : nombre de deals créés, nombre de meetings bookés, montant de pipeline généré, montant won. Revue mensuelle 1-on-1 sur l'attainment.",
    }),
  },
  {
    key: "commercial_quotes_low",
    category: "commercial",
    severity: "warning",
    priority: 78,
    shouldShow: (c) => c.openDeals >= 10 && (c.quotesCount ?? 0) < c.openDeals * 0.3,
    build: (c) => ({
      title: `Très peu de devis émis : ${c.quotesCount ?? 0} quotes pour ${c.openDeals} deals ouverts`,
      body: "Le ratio quotes/deals est anormalement bas. Soit les sales font des devis hors HubSpot (fuite data), soit ils n'envoient pas de devis formel (cycle de vente long).",
      recommendation: "Audit : 100% des deals en stage Proposition doivent avoir un quote HubSpot associé. Si l'équipe utilise un autre outil, intégration ou migration vers HubSpot Quotes.",
    }),
  },
  {
    key: "commercial_low_appointments",
    category: "commercial",
    severity: "warning",
    priority: 75,
    shouldShow: (c) => c.openDeals >= 10 && (c.appointmentsCount ?? 0) < c.openDeals * 0.5,
    build: (c) => ({
      title: `Peu de meetings logués : ${c.appointmentsCount ?? 0} pour ${c.openDeals} deals ouverts`,
      body: "Le ratio meetings/deals suggère que les sales ne loguent pas tous leurs RDV dans HubSpot. Perte de signal sur la santé deal et le coaching impossible.",
      recommendation: "Imposer le calendrier HubSpot Meetings (ou intégration Google/Outlook). Tout meeting client doit créer un engagement automatiquement. Coaching basé sur le ratio meetings → next stage.",
    }),
  },
  {
    key: "commercial_pipeline_per_rep",
    category: "commercial",
    severity: "info",
    priority: 65,
    shouldShow: (c) => c.openDeals >= 20 && (c.ownersCount ?? 0) >= 2,
    build: (c) => {
      const dealsPerRep = Math.round(c.openDeals / Math.max(1, c.ownersCount ?? 1));
      return {
        title: `${dealsPerRep} deals en moyenne par sales (${c.openDeals} deals / ${c.ownersCount ?? 0} owners)`,
        body: `Charge de pipeline ${dealsPerRep > 30 ? "élevée — risque de dilution" : dealsPerRep < 10 ? "faible — sous-utilisation" : "dans la fourchette"}. Cible CRO : 15-25 deals actifs par sales selon cycle.`,
        recommendation: dealsPerRep > 30
          ? "Re-balancer le pipeline. Identifier les top 20 deals par sales et clôturer les autres en lost ou re-attribuer."
          : dealsPerRep < 10
            ? "Capacity sales sous-utilisée. Pousser sur la création de deals via outbound ou ré-allouer du headcount."
            : "Maintenir cette charge. Auditer trimestriellement.",
      };
    },
  },
  {
    key: "commercial_no_workflows_active",
    category: "commercial",
    severity: "warning",
    priority: 80,
    shouldShow: (c) => c.openDeals >= 5 && (c.workflowsActiveCount ?? 0) === 0,
    build: () => ({
      title: "0 workflow d'automatisation actif",
      body: "Aucun workflow HubSpot actif. L'équipe sales fait tout à la main : assignation, relances, tâches de suivi. Productivité perdue de 3-5h/sales/semaine.",
      recommendation: "Construire 5 workflows critiques : (1) attribution auto à la création, (2) tâche de relance 5j sans activité, (3) tâche relance 14j sans activité, (4) email post-démo, (5) alerte deal stagnant manager.",
    }),
  },
  {
    key: "commercial_few_workflows",
    category: "commercial",
    severity: "info",
    priority: 55,
    shouldShow: (c) => (c.workflowsCount ?? 0) >= 1 && (c.workflowsActiveCount ?? 0) > 0 && (c.workflowsActiveCount ?? 0) < (c.workflowsCount ?? 0) * 0.5,
    build: (c) => ({
      title: `${(c.workflowsCount ?? 0) - (c.workflowsActiveCount ?? 0)} workflows désactivés sur ${c.workflowsCount ?? 0}`,
      body: "Beaucoup de workflows existent mais sont éteints. Soit pollution historique, soit features désactivées suite à un incident.",
      recommendation: "Audit workflows désactivés : archiver les obsolètes, réactiver les pertinents (avec test A/B). Documenter pourquoi chaque workflow off est off.",
    }),
  },
  {
    key: "commercial_few_pipelines",
    category: "commercial",
    severity: "info",
    priority: 50,
    shouldShow: (c) => c.totalDeals >= 50 && (c.lineItemsCount ?? 0) < c.wonDeals * 0.5,
    build: (c) => ({
      title: `Peu de line items : ${c.lineItemsCount ?? 0} sur ${c.wonDeals} deals gagnés`,
      body: "Le ratio line_items/won deals suggère que les sales ne décomposent pas leurs deals par produit. Impossible de mesurer ARPU par SKU ou cross-sell.",
      recommendation: "Imposer le mapping produits dans HubSpot via Products + Line items. Reporting revenue par produit, identifier les bundles à prioriser.",
    }),
  },
  {
    key: "commercial_leads_object_unused",
    category: "commercial",
    severity: "info",
    priority: 45,
    shouldShow: (c) => c.totalContacts >= 100 && (c.leadsObjectCount ?? 0) === 0,
    build: () => ({
      title: "L'objet Leads HubSpot n'est pas utilisé",
      body: "L'objet Leads (différent de contacts) permet de gérer la phase pré-MQL. Sans lui, les SDR mélangent prospects froids et contacts qualifiés dans la même base.",
      recommendation: "Activer l'objet Leads pour le top of funnel. Workflow de conversion Lead → Contact à la qualification SQL. Dashboard SDR séparé du CRM principal.",
    }),
  },

  // ════════════════════════════════════════════════════════════════════
  // MARKETING — diagnostics data-driven
  // ════════════════════════════════════════════════════════════════════

  {
    key: "marketing_no_online_tracking",
    category: "marketing",
    severity: "critical",
    priority: 100,
    shouldShow: (c) => (c.trackingSample ?? 0) > 0 && (c.onlineContacts ?? 0) === 0,
    build: () => ({
      title: "0 contact tracké en ligne sur les 100 derniers",
      body: "Aucune source online (SEO, paid, social, email) détectée. Soit le pixel HubSpot n'est pas installé, soit tous les contacts viennent d'imports manuels offline.",
      recommendation: "Installer le tracking code HubSpot sur tout le site. Activer les forms HubSpot. Connecter les landing pages. Vérifier hs_analytics_source sur les nouveaux contacts à 7j.",
    }),
  },
  {
    key: "marketing_low_conversion_rate",
    category: "marketing",
    severity: "critical",
    priority: 99,
    shouldShow: (c) => c.totalContacts >= 50 && c.conversionRate < 10,
    build: (c) => ({
      title: `Conversion Lead → Opp critique : ${c.conversionRate}% (benchmark B2B : 25-40%)`,
      body: `${c.opportunitiesCount} opportunités sur ${c.totalContacts} contacts. Funnel marketing qui perd 90%+ des leads — soit qualification ratée, soit handoff sales-marketing cassé, soit ICP mal défini.`,
      recommendation: "Audit MQL→SQL : critères de scoring trop laxistes (top of funnel pollué) OU process de qualification trop strict (perte de leads viables). Réunion alignement marketing × sales semaine prochaine.",
    }),
  },
  {
    key: "marketing_high_orphans",
    category: "marketing",
    severity: "critical",
    priority: 98,
    shouldShow: (c) => c.totalContacts >= 50 && c.orphanRate > 30,
    build: (c) => ({
      title: `${c.orphansCount} contacts orphelins (${c.orphanRate}%) — ABM impossible`,
      body: `${c.orphanRate}% des contacts ne sont rattachés à aucune entreprise. Reporting par compte cassé, account-based marketing impossible, segmentation par taille faussée.`,
      recommendation: "Workflow auto-association : si email pro et domaine matche une company existante, association automatique. Pour les orphelins restants, batch d'enrichissement Dropcontact/Clearbit ce mois.",
    }),
  },
  {
    key: "marketing_low_conversion_warning",
    category: "marketing",
    severity: "warning",
    priority: 90,
    shouldShow: (c) => c.totalContacts >= 50 && c.conversionRate >= 10 && c.conversionRate < 25,
    build: (c) => ({
      title: `Conversion Lead → Opp : ${c.conversionRate}% (en-dessous du benchmark 25%)`,
      body: `${c.opportunitiesCount} opportunités sur ${c.totalContacts} contacts. Marge de progression de ${25 - c.conversionRate} points = +${Math.round(c.totalContacts * 0.01 * (25 - c.conversionRate))} opportunités potentielles à acquisition constante.`,
      recommendation: "Construire un programme de nurturing en 3 séquences (TOFU/MOFU/BOFU). Lead scoring sur engagement (visites site, email opens, content downloads). Handoff SDR à un seuil de score défini.",
    }),
  },
  {
    key: "marketing_no_forms",
    category: "marketing",
    severity: "warning",
    priority: 88,
    shouldShow: (c) => c.totalContacts >= 100 && (c.formsCount ?? 0) === 0,
    build: (c) => ({
      title: `0 form HubSpot mais ${c.totalContacts} contacts — d'où viennent-ils ?`,
      body: "Aucun form HubSpot détecté. Si le site convertit, l'attribution source est cassée. Si le site ne convertit pas, c'est le canal n°1 inbound qui manque.",
      recommendation: "Audit site web : combien de pages ont un CTA ? Quelle est la conversion ? Soit migrer les forms tiers vers HubSpot Forms (attribution unifiée), soit créer 3-5 forms HubSpot sur les pages clés (homepage, product, pricing, blog).",
    }),
  },
  {
    key: "marketing_few_forms",
    category: "marketing",
    severity: "info",
    priority: 65,
    shouldShow: (c) => (c.formsCount ?? 0) >= 1 && (c.formsCount ?? 0) < 5,
    build: (c) => ({
      title: `Seulement ${c.formsCount} form${(c.formsCount ?? 0) > 1 ? "s" : ""} HubSpot actif${(c.formsCount ?? 0) > 1 ? "s" : ""}`,
      body: "Peu de points de conversion en place. Les meilleurs sites B2B ont 8-15 forms (par persona, par étape funnel, par produit).",
      recommendation: "Construire 1 form par persona × intent : fiche commerciale (BOFU), démo (BOFU), guide (TOFU), webinaire (MOFU), newsletter (TOFU). A/B tester progressivement.",
    }),
  },
  {
    key: "marketing_no_workflows",
    category: "marketing",
    severity: "warning",
    priority: 85,
    shouldShow: (c) => c.totalContacts >= 100 && (c.workflowsActiveCount ?? 0) < 3,
    build: (c) => ({
      title: `Très peu de workflows marketing actifs (${c.workflowsActiveCount ?? 0})`,
      body: `Avec ${c.totalContacts} contacts en base, l'équipe marketing fait beaucoup de manuel. ROI marketing limité par le manque d'automation.`,
      recommendation: "5 workflows critiques à activer : (1) MQL→SQL auto, (2) nurturing TOFU, (3) re-engagement dormants, (4) post-event follow-up, (5) lead scoring composite.",
    }),
  },
  {
    key: "marketing_no_lifecycle_progress",
    category: "marketing",
    severity: "warning",
    priority: 82,
    shouldShow: (c) => c.totalContacts >= 100 && c.opportunitiesCount === 0,
    build: (c) => ({
      title: `${c.totalContacts} contacts en base mais 0 opportunité`,
      body: "Lifecycle stages probablement non configurés, ou personne ne les met à jour. Le funnel est invisible.",
      recommendation: "Activer les lifecycle stages standard. Workflows de progression auto basés sur scoring (Subscriber → Lead → MQL → SQL → Opportunity → Customer). Reporting funnel hebdo.",
    }),
  },
  {
    key: "marketing_few_campaigns",
    category: "marketing",
    severity: "info",
    priority: 70,
    shouldShow: (c) => c.totalContacts >= 200 && (c.marketingCampaignsCount ?? 0) < 3,
    build: (c) => ({
      title: `Seulement ${c.marketingCampaignsCount ?? 0} campagne marketing trackée`,
      body: "Sans tracking de campagnes, impossible de mesurer le ROI marketing par initiative (webinar, content, partenariat, ads).",
      recommendation: "Tagger TOUTES les actions marketing comme Campaigns dans HubSpot. Reporting mensuel : leads générés + deals attribués + revenue par campagne.",
    }),
  },
  {
    key: "marketing_no_events",
    category: "marketing",
    severity: "info",
    priority: 60,
    shouldShow: (c) => c.totalContacts >= 200 && (c.marketingEventsCount ?? 0) === 0,
    build: () => ({
      title: "0 marketing event tracké dans HubSpot",
      body: "Webinars, conférences, salons inexistants dans le CRM ou trackés ailleurs. Attribution cassée pour les sources event-driven (souvent les plus chaudes).",
      recommendation: "Connecter Zoom/Webex/On24 à HubSpot. Chaque participant → contact + lifecycle update. Reporting event ROI : participants → leads → opportunities → revenue.",
    }),
  },
  {
    key: "marketing_lists_unused",
    category: "marketing",
    severity: "warning",
    priority: 75,
    shouldShow: (c) => c.totalContacts >= 200 && (c.listsCount ?? 0) < 5,
    build: (c) => ({
      title: `${c.listsCount ?? 0} listes seulement pour ${c.totalContacts} contacts`,
      body: "Très peu de segmentation. Les campagnes touchent des audiences trop larges, l'engagement plafonne.",
      recommendation: "Construire 10-15 listes dynamiques : par lifecycle, par persona, par intent (visiteurs pricing 7j), par engagement (opens 30j), par segment (industrie, taille). Personnaliser les campagnes par segment.",
    }),
  },
  {
    key: "marketing_few_opportunities",
    category: "marketing",
    severity: "warning",
    priority: 78,
    shouldShow: (c) => c.totalContacts > 200 && c.opportunitiesCount > 0 && c.opportunitiesCount < c.totalContacts * 0.05,
    build: (c) => ({
      title: `Seulement ${c.opportunitiesCount} opportunités sur ${c.totalContacts} contacts`,
      body: `${c.opportunitiesCount.toLocaleString("fr-FR")} opportunités créées sur ${c.totalContacts.toLocaleString("fr-FR")} contacts en base. Potentiel énorme dormant : ~${Math.round(c.totalContacts * 0.1).toLocaleString("fr-FR")} contacts probablement réactivables.`,
      recommendation: "Campagne réactivation : segmenter les contacts non-engagés depuis 6 mois, offre exclusive ou content premium pour re-engager. Re-scorer les leads après 7j de campagne.",
    }),
  },
  {
    key: "marketing_attribution_workflow_low",
    category: "marketing",
    severity: "warning",
    priority: 76,
    shouldShow: (c) => c.totalContacts >= 50 && c.orphanRate > 15 && c.orphanRate <= 30,
    build: (c) => ({
      title: `${c.orphanRate}% de contacts orphelins — ABM partiellement cassé`,
      body: `${c.orphansCount} contacts manquent de contexte entreprise. Les rapports par compte sont biaisés.`,
      recommendation: "Workflow d'auto-association par domaine email. Process mensuel d'enrichissement des résiduels via Clearbit/Dropcontact.",
    }),
  },
  {
    key: "marketing_segmentation",
    category: "marketing",
    severity: "info",
    priority: 50,
    shouldShow: (c) => c.totalContacts >= 500,
    build: (c) => ({
      title: `Base de ${c.totalContacts.toLocaleString("fr-FR")} contacts à segmenter`,
      body: "À cette taille de base, des campagnes génériques perdent 60%+ d'efficacité. La personnalisation par segment double l'engagement.",
      recommendation: "10 listes intelligentes : par secteur (top 5), par taille (PME/ETI/Grand compte), par lifecycle, par engagement récent. Personnaliser les campagnes par segment.",
    }),
  },

  // ════════════════════════════════════════════════════════════════════
  // DATA — diagnostics qualité CRM
  // ════════════════════════════════════════════════════════════════════

  {
    key: "data_no_phone",
    category: "data",
    severity: "warning",
    priority: 95,
    shouldShow: (c) => c.totalContacts >= 50 && c.contactsNoPhone > c.totalContacts * 0.4,
    build: (c) => ({
      title: `${PCT(c.contactsNoPhone, c.totalContacts)}% des contacts sans téléphone (${c.contactsNoPhone.toLocaleString("fr-FR")})`,
      body: "Outbound multicanal impossible. Les SDR ne peuvent pas combiner email + appel sur ces contacts — productivité divisée par 2.",
      recommendation: "Enrichissement batch via Dropcontact ou Cognism (~0.30€/contact). Champ phone obligatoire dans tous les forms d'acquisition à partir de la prochaine sprint.",
    }),
  },
  {
    key: "data_no_title",
    category: "data",
    severity: "warning",
    priority: 92,
    shouldShow: (c) => c.totalContacts >= 50 && c.contactsNoTitle > c.totalContacts * 0.4,
    build: (c) => ({
      title: `${PCT(c.contactsNoTitle, c.totalContacts)}% des contacts sans poste (${c.contactsNoTitle.toLocaleString("fr-FR")})`,
      body: "Personnalisation outbound aveugle. Impossible de cibler par fonction ou niveau hiérarchique. Les sequences génériques sous-performent de 60%.",
      recommendation: "Enrichissement LinkedIn Sales Navigator ou Apollo. Champ jobtitle obligatoire dans les forms BOFU. Workflow d'enrichissement déclenché au lifecycle MQL.",
    }),
  },
  {
    key: "data_companies_no_industry",
    category: "data",
    severity: "warning",
    priority: 88,
    shouldShow: (c) => c.totalCompanies >= 30 && c.companiesNoIndustry > c.totalCompanies * 0.5,
    build: (c) => ({
      title: `${PCT(c.companiesNoIndustry, c.totalCompanies)}% des entreprises sans secteur d'activité`,
      body: `${c.companiesNoIndustry} entreprises sans industry. Segmentation industry impossible, ICP par secteur invisible.`,
      recommendation: "Activer HubSpot Insights (auto-fill par domaine) ou enrichissement Clearbit. Workflow déclenché à la création company pour fill automatique sous 24h.",
    }),
  },
  {
    key: "data_companies_no_revenue",
    category: "data",
    severity: "warning",
    priority: 85,
    shouldShow: (c) => c.totalCompanies >= 30 && c.companiesNoRevenue > c.totalCompanies * 0.5,
    build: (c) => ({
      title: `${PCT(c.companiesNoRevenue, c.totalCompanies)}% des entreprises sans CA renseigné`,
      body: "Impossible de scorer la taille des comptes. Les sales priorisent à l'aveugle, perdent du temps sur des comptes hors-cible.",
      recommendation: "Enrichissement Clearbit/Société.com mensuel. Champ annualrevenue obligatoire avant passage en SQL. ICP scoring basé sur taille CA + secteur.",
    }),
  },
  {
    key: "data_orphan_companies",
    category: "data",
    severity: "warning",
    priority: 80,
    shouldShow: (c) => c.totalContacts >= 50 && c.orphanRate > 15 && c.orphanRate <= 30,
    build: (c) => ({
      title: `${c.orphansCount} contacts orphelins (${c.orphanRate}%) à associer`,
      body: "Ces contacts existent dans le CRM mais sans entreprise. Valeur business limitée — pas d'analyse compte ni de ABM possible.",
      recommendation: "Workflow d'auto-association par domaine email actif sur les nouveaux contacts. Batch one-shot sur les orphelins existants via le matching domaine.",
    }),
  },
  {
    key: "data_dedup",
    category: "data",
    severity: "warning",
    priority: 78,
    shouldShow: (c) => c.totalContacts >= 1000,
    build: (c) => ({
      title: `Risque doublons élevé : ${c.totalContacts.toLocaleString("fr-FR")} contacts en base`,
      body: "À ce volume, les doublons s'accumulent inévitablement. Ils faussent les rapports, polluent les emails (sender reputation) et créent de la confusion sales.",
      recommendation: "Lancer l'outil Manage Duplicates HubSpot ce mois. Activer la détection auto sur l'email comme clé unique. Process trimestriel de cleanup.",
    }),
  },
  {
    key: "data_high_property_count",
    category: "data",
    severity: "info",
    priority: 60,
    shouldShow: (c) => (c.customObjectsCount ?? 0) >= 10,
    build: (c) => ({
      title: `${c.customObjectsCount} schemas custom — gouvernance critique`,
      body: "Beaucoup de custom objects = beaucoup de gouvernance nécessaire. Sans audit, le CRM devient illisible et les nouvelles features cassent l'existant.",
      recommendation: "Audit trimestriel : qui utilise chaque custom object, est-il à jour, peut-il être archivé ? Documentation Notion centralisée. Process strict d'ajout (validation par le RevOps).",
    }),
  },
  {
    key: "data_inactive_users",
    category: "data",
    severity: "info",
    priority: 58,
    shouldShow: (c) => (c.ownersCount ?? 0) > 5,
    build: (c) => ({
      title: `${c.ownersCount ?? 0} owners HubSpot — risque licences inactives`,
      body: "À cette taille, certains utilisateurs sont probablement inactifs (anciens collaborateurs, freelances ponctuels). Risque sécurité + gaspillage budget.",
      recommendation: "Audit trimestriel des dernières connexions. Désactiver tout utilisateur inactif >90j. Process automatique au offboarding RH.",
    }),
  },
  {
    key: "data_teams_unused",
    category: "data",
    severity: "info",
    priority: 55,
    shouldShow: (c) => (c.ownersCount ?? 0) >= 5 && (c.teamsCount ?? 0) === 0,
    build: (c) => ({
      title: `${c.ownersCount ?? 0} owners mais 0 équipe configurée`,
      body: "Sans Teams, impossible de faire du reporting par équipe (sales, marketing, CS) ou du round-robin par segment.",
      recommendation: "Configurer les Teams selon votre org : Sales Inbound, Sales Outbound, Marketing, CS, etc. Permissions différenciées + reports par team.",
    }),
  },
  {
    key: "data_quality_phone_partial",
    category: "data",
    severity: "info",
    priority: 50,
    shouldShow: (c) => c.totalContacts >= 50 && c.contactsNoPhone <= c.totalContacts * 0.4 && c.contactsNoPhone > c.totalContacts * 0.15,
    build: (c) => ({
      title: `${PCT(c.contactsNoPhone, c.totalContacts)}% des contacts sans téléphone — couverture moyenne`,
      body: `${c.contactsNoPhone} contacts à enrichir pour atteindre 90% de couverture phone. Tâche d'enrichissement budgétisable (~${Math.round(c.contactsNoPhone * 0.3)}€).`,
      recommendation: "Enrichissement ciblé sur les contacts en lifecycle MQL+. Skip les Subscriber/Lead pour économiser le budget enrichment.",
    }),
  },

  // ════════════════════════════════════════════════════════════════════
  // STARTER TEMPLATES — orgs nouvelles, peu de données opérationnelles
  // ════════════════════════════════════════════════════════════════════

  // ── Commercial setup ──
  {
    key: "starter_commercial_no_pipeline",
    category: "commercial",
    severity: "critical",
    priority: 100,
    shouldShow: (c) => c.totalDeals < 5,
    build: (c) => ({
      title: `Pipeline vide : ${c.totalDeals} deal${c.totalDeals > 1 ? "s" : ""} en base`,
      body: "Avant de scaler, il faut un funnel testé. Cible setup : 20 deals dans le pipeline pour valider les stages et calibrer les premiers KPIs (closing rate, cycle, ticket moyen).",
      recommendation: "Plan 30 jours : 10 deals via outbound SDR (LinkedIn + email), 5 via inbound (formulaires + content), 5 via referral (clients existants ou réseau perso fondateurs).",
    }),
  },
  {
    key: "starter_no_owners",
    category: "commercial",
    severity: "critical",
    priority: 99,
    shouldShow: (c) => (c.ownersCount ?? 0) === 0,
    build: () => ({
      title: "0 owner HubSpot configuré — attribution impossible",
      body: "Sans utilisateurs HubSpot actifs, aucun deal/contact n'est attribué. Premier blocage avant tout travail commercial.",
      recommendation: "Settings > Users → ajouter chaque sales/marketing/CSM. Permissions différenciées par rôle. Une fois ≥ 2 users, créer les Teams correspondantes.",
    }),
  },
  {
    key: "starter_pipeline_setup",
    category: "commercial",
    severity: "warning",
    priority: 95,
    shouldShow: (c) => c.totalDeals < 5,
    build: () => ({
      title: "Définir les 5-7 stages du pipeline avant d'ouvrir des deals",
      body: "Pipeline mal designé = data illisible 6 mois plus tard. Stages standards B2B SaaS : Discovery → Qualification → Démo → Proposition → Négociation → Signature → Won/Lost.",
      recommendation: "Workshop 2h avec sales lead : définir les critères d'entrée/sortie de chaque stage (BANT, MEDDIC). Documenter dans Notion + créer les stages dans HubSpot.",
    }),
  },
  {
    key: "starter_icp_documented",
    category: "commercial",
    severity: "warning",
    priority: 90,
    shouldShow: (c) => c.totalContacts < 100,
    build: () => ({
      title: "Documenter l'ICP avant le 1er sprint sales",
      body: "Sans ICP (Ideal Customer Profile) documenté en 1 page, l'équipe sales tire à vue. 80% des leads disqualifiés en 1 call = perte de temps massive.",
      recommendation: "ICP en 1 page : secteur, taille (CA + employés), persona (titre + niveau), pain principal, déclencheurs achat, no-go signals. Ré-évaluer trimestriellement.",
    }),
  },
  {
    key: "starter_first_workflow",
    category: "commercial",
    severity: "warning",
    priority: 88,
    shouldShow: (c) => (c.workflowsActiveCount ?? 0) === 0 && c.totalDeals >= 1,
    build: () => ({
      title: "Activer le 1er workflow : attribution automatique",
      body: "Premier workflow critique : à la création d'un deal/contact, attribution automatique à un owner (round-robin ou par segment). Évite les deals orphelins.",
      recommendation: "HubSpot > Automation > Workflows. Trigger : Deal created. Action : assign owner round-robin. Test sur 5 deals avant rollout complet.",
    }),
  },

  // ── Marketing setup ──
  {
    key: "starter_marketing_no_acquisition",
    category: "marketing",
    severity: "critical",
    priority: 100,
    shouldShow: (c) => c.totalContacts < 50,
    build: (c) => ({
      title: `Base contacts faible : ${c.totalContacts} contact${c.totalContacts > 1 ? "s" : ""}`,
      body: "Sans base contacts, aucun pipeline marketing possible. Cible setup : 1000 contacts en 12 mois via 3 sources d'acquisition.",
      recommendation: "Plan acquisition multi-canal : (1) SEO content (1 article/semaine), (2) LinkedIn outreach (50 connexions/jour), (3) lead magnet (ebook ou template) promu sur 5 canaux.",
    }),
  },
  {
    key: "starter_no_forms",
    category: "marketing",
    severity: "critical",
    priority: 99,
    shouldShow: (c) => (c.formsCount ?? 0) === 0,
    build: () => ({
      title: "Aucun form HubSpot — top of funnel inbound cassé",
      body: "Sans forms HubSpot, impossible de capter et tracker les leads inbound. Toutes les visites site sont perdues.",
      recommendation: "Créer 3 forms minimum cette semaine : (1) demande de démo, (2) téléchargement de contenu, (3) contact. Installer le pixel HubSpot sur tout le site.",
    }),
  },
  {
    key: "starter_lifecycle_setup",
    category: "marketing",
    severity: "warning",
    priority: 95,
    shouldShow: (c) => c.opportunitiesCount === 0,
    build: () => ({
      title: "Activer les Lifecycle Stages avant la 1re campagne",
      body: "Lifecycle stages = colonne vertébrale du funnel marketing. Sans eux, impossible de mesurer la conversion lead→opp→customer.",
      recommendation: "Activer les 6 stages standard (Subscriber → Lead → MQL → SQL → Opportunity → Customer). Workflow auto pour la transition Lead → MQL basée sur scoring.",
    }),
  },
  {
    key: "starter_first_campaign",
    category: "marketing",
    severity: "warning",
    priority: 88,
    shouldShow: (c) => (c.marketingCampaignsCount ?? 0) === 0,
    build: () => ({
      title: "Tagger toutes les actions marketing comme Campaigns",
      body: "Sans tag Campaign, le ROI marketing n'est pas mesurable. Premier outil de gouvernance.",
      recommendation: "Toute action marketing > Marketing Campaigns > Create campaign. Inclure : email, landing page, ads, events. Reporting mensuel revenue par campagne.",
    }),
  },
  {
    key: "starter_first_nurturing",
    category: "marketing",
    severity: "info",
    priority: 80,
    shouldShow: (c) => c.totalContacts >= 10 && (c.workflowsActiveCount ?? 0) === 0,
    build: () => ({
      title: "Construire le 1er workflow nurturing",
      body: "Email automation 4-5 touches sur 21 jours pour les nouveaux leads. ROI mesurable dès le 2e mois.",
      recommendation: "Trigger : nouveau Lead. Touch 1 (J0): bienvenue + valeur. Touch 2 (J3): cas client. Touch 3 (J7): contenu pédago. Touch 4 (J14): démo. Touch 5 (J21): re-engagement ou marquage cold.",
    }),
  },

  // ── Data setup ──
  {
    key: "starter_data_governance",
    category: "data",
    severity: "warning",
    priority: 90,
    shouldShow: (c) => c.totalContacts < 100 && c.totalDeals < 50,
    build: () => ({
      title: "Définir la gouvernance data avant le scale",
      body: "Le moment idéal pour fixer les règles est AVANT d'avoir 10k records. Sans gouvernance précoce, dette technique CRM garantie.",
      recommendation: "Document Notion en 1 page : naming convention propriétés, lifecycle ownership, validation des champs critiques (email, phone, jobtitle), process trimestriel d'audit.",
    }),
  },
  {
    key: "starter_required_fields",
    category: "data",
    severity: "warning",
    priority: 85,
    shouldShow: (c) => c.totalDeals < 50,
    build: () => ({
      title: "Configurer les champs obligatoires par stage dès maintenant",
      body: "Avant le 1er rush commercial, fixer les champs obligatoires par lifecycle stage = data complète from day 1.",
      recommendation: "MQL → email + jobtitle. SQL → phone + company + lead_source. Opportunity → amount + closedate. Customer → contract value + start date. Bloquer la progression sans ces champs.",
    }),
  },
  {
    key: "starter_no_teams",
    category: "data",
    severity: "info",
    priority: 70,
    shouldShow: (c) => (c.ownersCount ?? 0) >= 2 && (c.teamsCount ?? 0) === 0,
    build: (c) => ({
      title: `${c.ownersCount ?? 0} owners actifs mais 0 team configurée`,
      body: "Avec ≥ 2 utilisateurs, créer des Teams permet le reporting groupé, le round-robin par équipe, les permissions différenciées.",
      recommendation: "Settings > Teams → créer minimum 2 teams (ex: Sales + CSM). Assigner chaque user. Activer les reports Teams pour comparer perf cross-équipes.",
    }),
  },
  {
    key: "starter_first_enrichment",
    category: "data",
    severity: "info",
    priority: 65,
    shouldShow: (c) => c.totalCompanies >= 5 && (c.companiesNoIndustry > c.totalCompanies * 0.5 || c.companiesNoRevenue > c.totalCompanies * 0.5),
    build: () => ({
      title: "Activer HubSpot Insights (gratuit) pour enrichir les companies",
      body: "Auto-fill par domaine : industry, revenue, employees, description, technologies. Gratuit et automatique sur les nouveaux records.",
      recommendation: "HubSpot > Settings > Properties > HubSpot Insights → activer. Pour l'existant, lancer un workflow batch d'enrichissement sur les companies déjà en base.",
    }),
  },
  {
    key: "starter_dedup_baseline",
    category: "data",
    severity: "info",
    priority: 60,
    shouldShow: (c) => c.totalContacts >= 50 && c.totalContacts < 1000,
    build: () => ({
      title: "Lancer le 1er audit de doublons avant 1k contacts",
      body: "Plus tôt = plus simple. Au-delà de 1k contacts, le cleanup manuel devient ingérable.",
      recommendation: "HubSpot > Contacts > Manage Duplicates. Review batch hebdo. Activer la détection auto sur l'email pour bloquer les futurs doublons à la création.",
    }),
  },
];

/**
 * Sélectionne jusqu'à 20 templates non-dismissés par catégorie, classés par priorité.
 * Templates conditionnés par ctx — ne fireront pas si la donnée n'est pas là.
 */
export function selectInsights(
  ctx: InsightContext,
  dismissedKeys: Set<string>,
): Record<InsightCategory, Array<{ key: string; severity: Severity; title: string; body: string; recommendation: string; category: InsightCategory }>> {
  const result: Record<InsightCategory, Array<{ key: string; severity: Severity; title: string; body: string; recommendation: string; category: InsightCategory }>> = {
    commercial: [],
    marketing: [],
    data: [],
  };

  const sorted = [...INSIGHT_LIBRARY].sort((a, b) => b.priority - a.priority);

  for (const tpl of sorted) {
    if (dismissedKeys.has(tpl.key)) continue;
    try {
      if (!tpl.shouldShow(ctx)) continue;
    } catch {
      continue;
    }
    if (result[tpl.category].length >= 20) continue;
    const built = tpl.build(ctx);
    result[tpl.category].push({
      key: tpl.key,
      severity: tpl.severity,
      category: tpl.category,
      ...built,
    });
  }

  return result;
}
