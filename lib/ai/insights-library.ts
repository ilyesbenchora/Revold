/**
 * Insight Library — CRO/RevOps best practices
 * Each template has a stable key so dismissals persist across sessions.
 * Templates are evaluated against real CRM data and ranked by priority.
 */

export type InsightCategory = "commercial" | "marketing" | "data";
export type Severity = "critical" | "warning" | "info";

export type InsightContext = {
  // Deals
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  closingRate: number; // 0-100
  dealsNoNextActivity: number;
  dealsNoActivity: number;
  dealsNoAmount: number;
  dealsNoCloseDate: number;
  stagnantDeals: number;
  // Contacts
  totalContacts: number;
  leadsCount: number;
  opportunitiesCount: number;
  conversionRate: number; // 0-100
  orphansCount: number;
  orphanRate: number; // 0-100
  contactsNoPhone: number;
  contactsNoTitle: number;
  // Companies
  totalCompanies: number;
  companiesNoIndustry: number;
  companiesNoRevenue: number;
  // Tracking (web analytics)
  trackingSample?: number;
  onlineContacts?: number;
};

export type InsightTemplate = {
  key: string;
  category: InsightCategory;
  severity: Severity;
  priority: number; // higher = more urgent
  shouldShow: (ctx: InsightContext) => boolean;
  build: (ctx: InsightContext) => { title: string; body: string; recommendation: string };
};

export const INSIGHT_LIBRARY: InsightTemplate[] = [
  // ════════════════════════════════════════════════════
  // COMMERCIAL (20 templates)
  // ════════════════════════════════════════════════════
  {
    key: "commercial_low_closing_rate",
    category: "commercial",
    severity: "critical",
    priority: 100,
    shouldShow: (c) => (c.wonDeals + c.lostDeals) >= 5 && c.closingRate < 20,
    build: (c) => ({
      title: `Taux de closing critique : ${c.closingRate}%`,
      body: `Sur ${c.wonDeals + c.lostDeals} transactions clôturées, seulement ${c.wonDeals} ont été gagnées. Le benchmark se situe entre 25% et 35%.`,
      recommendation: "Auditer les transactions perdues pour identifier les causes récurrentes (prix, concurrence, qualification). Renforcer le process de qualification (BANT, MEDDIC) avant d'avancer un deal.",
    }),
  },
  {
    key: "commercial_no_next_activity",
    category: "commercial",
    severity: "critical",
    priority: 99,
    shouldShow: (c) => c.openDeals > 0 && c.dealsNoNextActivity > c.openDeals * 0.5,
    build: (c) => ({
      title: `${c.dealsNoNextActivity} transactions sans prochaine activité planifiée`,
      body: `${Math.round((c.dealsNoNextActivity / c.openDeals) * 100)}% des transactions en cours n'ont aucune activité planifiée. Ces deals risquent de stagner et d'être perdus.`,
      recommendation: "Imposer la règle « pas de deal sans next activity » dans le CRM. Bloquer la sauvegarde d'un deal si aucune prochaine étape n'est datée.",
    }),
  },
  {
    key: "commercial_no_activity",
    category: "commercial",
    severity: "critical",
    priority: 98,
    shouldShow: (c) => c.openDeals > 0 && c.dealsNoActivity > c.openDeals * 0.3,
    build: (c) => ({
      title: `${c.dealsNoActivity} transactions sans aucune activité commerciale`,
      body: `Ces deals ont été créés mais jamais travaillés. Ils gonflent artificiellement le pipeline et faussent les prévisions.`,
      recommendation: "Lancer un sprint de qualification cette semaine : chaque deal sans activité doit être contacté ou clôturé en lost.",
    }),
  },
  {
    key: "commercial_stagnant_deals",
    category: "commercial",
    severity: "warning",
    priority: 92,
    shouldShow: (c) => c.stagnantDeals > 5,
    build: (c) => ({
      title: `${c.stagnantDeals} transactions stagnantes détectées`,
      body: `Ces deals n'ont eu aucune activité depuis plus de 7 jours et n'ont pas de prochain RDV. Ils sont à risque de tomber dans l'oubli.`,
      recommendation: "Mettre en place une revue de pipeline hebdomadaire pour traiter les deals stagnants : relance, escalade ou clôture.",
    }),
  },
  {
    key: "commercial_no_amount",
    category: "commercial",
    severity: "warning",
    priority: 90,
    shouldShow: (c) => c.totalDeals > 0 && c.dealsNoAmount > c.totalDeals * 0.5,
    build: (c) => ({
      title: `${Math.round((c.dealsNoAmount / c.totalDeals) * 100)}% des transactions sans montant`,
      body: `${c.dealsNoAmount} transactions n'ont pas de montant renseigné. Impossible de construire un forecast fiable ou de calculer la couverture pipeline.`,
      recommendation: "Rendre le champ montant obligatoire dès qu'un deal entre dans la phase de qualification ou de proposition commerciale.",
    }),
  },
  {
    key: "commercial_no_close_date",
    category: "commercial",
    severity: "warning",
    priority: 88,
    shouldShow: (c) => c.totalDeals > 0 && c.dealsNoCloseDate > c.totalDeals * 0.5,
    build: (c) => ({
      title: `${Math.round((c.dealsNoCloseDate / c.totalDeals) * 100)}% des transactions sans date de closing`,
      body: `Sans date de closing prévisionnelle, impossible de construire un forecast fiable par mois ou par trimestre.`,
      recommendation: "Exiger une date de closing estimée dès la création du deal. Cette date peut bouger mais doit toujours exister.",
    }),
  },
  {
    key: "commercial_low_pipeline_volume",
    category: "commercial",
    severity: "warning",
    priority: 85,
    shouldShow: (c) => c.openDeals > 0 && c.openDeals < 20,
    build: (c) => ({
      title: `Pipeline trop léger : ${c.openDeals} transactions ouvertes seulement`,
      body: `Un pipeline en bonne santé doit représenter au moins 3x votre objectif de revenu. Avec ${c.openDeals} deals, la marge d'erreur est faible.`,
      recommendation: "Intensifier la prospection et l'acquisition de leads pour alimenter le haut du pipeline. Objectif : 2-3 nouveaux deals par commercial par semaine.",
    }),
  },
  {
    key: "commercial_high_lost_ratio",
    category: "commercial",
    severity: "warning",
    priority: 82,
    shouldShow: (c) => (c.wonDeals + c.lostDeals) >= 10 && c.lostDeals > c.wonDeals * 2,
    build: (c) => ({
      title: `Trop de transactions perdues : ${c.lostDeals} lost vs ${c.wonDeals} gagnées`,
      body: `Ratio lost/won de ${(c.lostDeals / Math.max(c.wonDeals, 1)).toFixed(1)}. Les commerciaux passent du temps sur des deals non qualifiés ou face à de la mauvaise concurrence.`,
      recommendation: "Construire un ICP strict (Ideal Customer Profile) et disqualifier rapidement les leads hors-cible. Mettre en place un scoring lost reasons pour identifier les patterns.",
    }),
  },
  {
    key: "commercial_pipeline_concentration",
    category: "commercial",
    severity: "warning",
    priority: 80,
    shouldShow: (c) => c.openDeals > 0 && c.openDeals < 10 && c.totalDeals >= 20,
    build: (c) => ({
      title: `Pipeline concentré sur peu de deals : ${c.openDeals} ouverts`,
      body: `Concentrer son pipeline sur trop peu de deals expose à des trous d'air en cas de perte d'un gros compte. Risque commercial élevé.`,
      recommendation: "Diversifier le pipeline avec des deals de différentes tailles. Cible : au moins 15-20 deals ouverts simultanément par commercial.",
    }),
  },
  {
    key: "commercial_average_deal_size",
    category: "commercial",
    severity: "info",
    priority: 70,
    shouldShow: (c) => c.wonDeals >= 5 && c.dealsNoAmount < c.totalDeals * 0.3,
    build: (c) => ({
      title: `Calculer le ticket moyen pour piloter par valeur`,
      body: `Avec ${c.wonDeals} deals gagnés, le panier moyen est mesurable. Comparer le ticket par segment, secteur ou source révèle les segments les plus rentables.`,
      recommendation: "Créer un dashboard ticket moyen par persona et par source. Réinvestir l'acquisition sur les segments à plus forte valeur.",
    }),
  },
  {
    key: "commercial_velocity_review",
    category: "commercial",
    severity: "info",
    priority: 68,
    shouldShow: (c) => c.totalDeals >= 20,
    build: () => ({
      title: "Mesurer la vélocité du pipeline (deals/semaine)",
      body: "La vélocité = nombre de deals × ticket moyen × win rate / cycle de vente. C'est l'indicateur n°1 d'une équipe sales performante.",
      recommendation: "Tracker la vélocité chaque semaine dans un dashboard dédié. Identifier le levier le plus impactant (ticket, win rate, cycle) et travailler dessus en priorité.",
    }),
  },
  {
    key: "commercial_stage_conversion",
    category: "commercial",
    severity: "info",
    priority: 65,
    shouldShow: (c) => c.totalDeals >= 20,
    build: () => ({
      title: "Auditer le funnel par étape (taux de conversion stage à stage)",
      body: "Identifier les étapes du pipeline où le taux de chute est le plus élevé révèle les vrais blocages : qualification, démo, négo, closing.",
      recommendation: "Construire un rapport HubSpot stage-to-stage conversion. Coacher les commerciaux sur l'étape la plus faible avec des role-plays ciblés.",
    }),
  },
  {
    key: "commercial_pipeline_review_weekly",
    category: "commercial",
    severity: "info",
    priority: 60,
    shouldShow: () => true,
    build: () => ({
      title: "Mettre en place une revue de pipeline hebdomadaire",
      body: "Une revue de pipeline structurée chaque semaine permet de détecter les blocages tôt et de prioriser les actions commerciales.",
      recommendation: "Créer un rituel hebdomadaire de 30min avec l'équipe sales : top 5 deals chauds, deals à relancer, deals à clôturer en lost.",
    }),
  },
  {
    key: "commercial_call_quotas",
    category: "commercial",
    severity: "info",
    priority: 58,
    shouldShow: (c) => c.openDeals > 10,
    build: () => ({
      title: "Mettre en place des quotas d'activités hebdomadaires",
      body: "Sans quotas (X appels, Y emails, Z RDV par semaine), les commerciaux compensent le manque d'activité par de l'optimisme dans le forecast.",
      recommendation: "Définir avec chaque commercial des quotas d'activités basés sur le pipeline cible. Tracker hebdo via dashboard HubSpot Sales Hub.",
    }),
  },
  {
    key: "commercial_loss_reason_tracking",
    category: "commercial",
    severity: "warning",
    priority: 78,
    shouldShow: (c) => c.lostDeals >= 10,
    build: (c) => ({
      title: `Tracker les raisons de perte (${c.lostDeals} deals lost analysables)`,
      body: `${c.lostDeals} deals perdus sans cause structurée = aucune amélioration du process possible. C'est de la donnée business gâchée.`,
      recommendation: "Rendre obligatoire le champ « lost reason » à la clôture. Catégories : prix, concurrence, timing, qualification, no decision, autre. Analyse mensuelle.",
    }),
  },
  {
    key: "commercial_stalled_high_value",
    category: "commercial",
    severity: "critical",
    priority: 95,
    shouldShow: (c) => c.stagnantDeals > 0 && c.openDeals > 0 && c.stagnantDeals > c.openDeals * 0.4,
    build: (c) => ({
      title: `Concentration de deals stagnants : ${Math.round((c.stagnantDeals / c.openDeals) * 100)}% du pipeline`,
      body: `${c.stagnantDeals} deals sur ${c.openDeals} ouverts sont à l'arrêt. Le pipeline est gelé.`,
      recommendation: "Lancer une war room stagnation : revue 1-by-1 de chaque deal bloqué avec décision binaire (relance avec next activity OU clôture lost).",
    }),
  },
  {
    key: "commercial_deals_per_rep",
    category: "commercial",
    severity: "info",
    priority: 55,
    shouldShow: (c) => c.openDeals >= 30,
    build: (c) => ({
      title: `Mesurer la charge de pipeline par commercial (${c.openDeals} deals ouverts)`,
      body: `Trop de deals par commercial dilue l'attention. Trop peu sous-utilise la capacité.`,
      recommendation: "Cible : 15-25 deals actifs par commercial selon cycle. Re-balancer le pipeline si certains sont surchargés et d'autres sous-occupés.",
    }),
  },
  {
    key: "commercial_no_associated_company",
    category: "commercial",
    severity: "warning",
    priority: 73,
    shouldShow: (c) => c.openDeals > 5 && c.orphanRate > 30,
    build: (c) => ({
      title: `Deals B2B sans entreprise associée : risque rapport`,
      body: `Avec ${c.orphanRate}% de contacts orphelins, beaucoup de deals risquent d'être mal attribués au niveau compte. Impossible de mesurer la part-of-wallet ou le land & expand.`,
      recommendation: "Workflow d'auto-association deal ↔ company via le contact principal. Audit mensuel des deals sans company.",
    }),
  },
  {
    key: "commercial_good_closing_rate",
    category: "commercial",
    severity: "info",
    priority: 35,
    shouldShow: (c) => (c.wonDeals + c.lostDeals) >= 10 && c.closingRate >= 30,
    build: (c) => ({
      title: `Taux de closing solide : ${c.closingRate}%`,
      body: `${c.wonDeals} transactions gagnées sur ${c.wonDeals + c.lostDeals} clôturées — au-dessus du benchmark de 25-30%.`,
      recommendation: "Documenter les facteurs de succès des deals gagnés et les répliquer sur les deals en cours via des playbooks.",
    }),
  },
  {
    key: "commercial_playbook_creation",
    category: "commercial",
    severity: "info",
    priority: 50,
    shouldShow: (c) => c.wonDeals >= 5,
    build: (c) => ({
      title: `Construire un playbook commercial à partir des ${c.wonDeals} deals gagnés`,
      body: "Les patterns des deals gagnés sont une mine d'or : profil ICP, parcours type, objections résolues, durée moyenne par étape.",
      recommendation: "Interviewer les commerciaux sur les 5 derniers deals gagnés. Documenter les questions clés posées en discovery, les démos qui closent, les arguments décisifs.",
    }),
  },

  // ════════════════════════════════════════════════════
  // MARKETING (20 templates)
  // ════════════════════════════════════════════════════
  {
    key: "marketing_no_online_tracking",
    category: "marketing",
    severity: "critical",
    priority: 100,
    shouldShow: (c) => (c.trackingSample ?? 0) > 0 && (c.onlineContacts ?? 0) === 0,
    build: () => ({
      title: "Aucun contact tracké en ligne",
      body: "100% des contacts proviennent de sources offline. Le tracking HubSpot (script de suivi, formulaires, landing pages) n'est pas actif ou pas installé sur votre site web.",
      recommendation: "Installer le code de suivi HubSpot sur votre site, activer les formulaires HubSpot et connecter vos landing pages pour commencer à tracker les sources online (SEO, Ads, Social, Email).",
    }),
  },
  {
    key: "marketing_low_conversion_rate",
    category: "marketing",
    severity: "critical",
    priority: 99,
    shouldShow: (c) => c.totalContacts > 0 && c.conversionRate < 10,
    build: (c) => ({
      title: `Conversion Lead → Opportunité critique : ${c.conversionRate}%`,
      body: `Sur ${c.totalContacts.toLocaleString("fr-FR")} contacts, seulement ${c.opportunitiesCount.toLocaleString("fr-FR")} sont en phase Opportunité. Le funnel marketing perd la majorité de ses leads.`,
      recommendation: "Auditer le scoring des leads et le process de qualification. Mettre en place un workflow de nurturing pour réchauffer les leads froids.",
    }),
  },
  {
    key: "marketing_high_orphans",
    category: "marketing",
    severity: "critical",
    priority: 98,
    shouldShow: (c) => c.totalContacts > 0 && c.orphanRate > 30,
    build: (c) => ({
      title: `${c.orphansCount.toLocaleString("fr-FR")} contacts orphelins (${c.orphanRate}%)`,
      body: `${c.orphanRate}% des contacts ne sont rattachés à aucune entreprise. Impossible d'analyser par compte ou de faire de l'ABM.`,
      recommendation: "Activer l'association automatique par domaine email dans HubSpot. Lancer un nettoyage manuel pour les orphelins restants.",
    }),
  },
  {
    key: "marketing_low_conversion_warning",
    category: "marketing",
    severity: "warning",
    priority: 88,
    shouldShow: (c) => c.totalContacts > 0 && c.conversionRate >= 10 && c.conversionRate < 25,
    build: (c) => ({
      title: `Conversion Lead → Opportunité à améliorer : ${c.conversionRate}%`,
      body: `${c.conversionRate}% de conversion est dans la moyenne basse. Le benchmark B2B SaaS se situe entre 25% et 40%.`,
      recommendation: "Aligner marketing et sales sur les critères d'un MQL/SQL. Mettre en place des séquences de nurturing par persona.",
    }),
  },
  {
    key: "marketing_few_opportunities",
    category: "marketing",
    severity: "warning",
    priority: 86,
    shouldShow: (c) => c.totalContacts > 100 && c.opportunitiesCount < 50,
    build: (c) => ({
      title: `Peu d'opportunités créées : ${c.opportunitiesCount}`,
      body: `Avec ${c.totalContacts.toLocaleString("fr-FR")} contacts en base, seulement ${c.opportunitiesCount} sont en phase Opportunité. Le potentiel commercial n'est pas exploité.`,
      recommendation: "Lancer une campagne de réactivation des contacts dormants pour identifier les opportunités latentes dans la base existante.",
    }),
  },
  {
    key: "marketing_attribution_workflow",
    category: "marketing",
    severity: "warning",
    priority: 80,
    shouldShow: (c) => c.orphanRate > 15 && c.orphanRate <= 30,
    build: (c) => ({
      title: `${c.orphanRate}% de contacts sans entreprise associée`,
      body: `L'attribution par compte est partielle. ${c.orphansCount} contacts manquent de contexte entreprise.`,
      recommendation: "Créer un workflow d'auto-association : si l'email correspond au domaine d'une entreprise existante, l'associer automatiquement.",
    }),
  },
  {
    key: "marketing_lead_source_attribution",
    category: "marketing",
    severity: "warning",
    priority: 78,
    shouldShow: (c) => c.totalContacts > 100,
    build: (c) => ({
      title: `Attribution source manquante sur ${c.totalContacts.toLocaleString("fr-FR")} contacts`,
      body: "Sans hs_analytics_source renseigné, impossible de mesurer le ROI des canaux d'acquisition (SEO, Ads, social, email, partenaires).",
      recommendation: "Vérifier que le tracking pixel HubSpot est installé partout. Activer les UTM systématiques sur toutes les campagnes payantes.",
    }),
  },
  {
    key: "marketing_no_lifecycle_stages",
    category: "marketing",
    severity: "warning",
    priority: 76,
    shouldShow: (c) => c.totalContacts > 100 && c.opportunitiesCount === 0,
    build: () => ({
      title: "Aucun lifecycle stage utilisé dans la base contacts",
      body: "Sans lifecycle stage (Subscriber, Lead, MQL, SQL, Opportunity, Customer), impossible de mesurer le funnel marketing.",
      recommendation: "Définir les critères de progression entre stages et automatiser la transition via workflows HubSpot. C'est la fondation du funnel.",
    }),
  },
  {
    key: "marketing_segmentation",
    category: "marketing",
    severity: "info",
    priority: 60,
    shouldShow: (c) => c.totalContacts > 500,
    build: (c) => ({
      title: "Segmenter votre base contacts pour des campagnes ciblées",
      body: `Avec ${c.totalContacts.toLocaleString("fr-FR")} contacts, des campagnes génériques perdent en efficacité. La segmentation augmente l'engagement de 60%.`,
      recommendation: "Créer des listes intelligentes par secteur, taille d'entreprise, fonction, lifecycle stage. Personnaliser les campagnes par segment.",
    }),
  },
  {
    key: "marketing_lead_magnet",
    category: "marketing",
    severity: "info",
    priority: 50,
    shouldShow: () => true,
    build: () => ({
      title: "Créer un lead magnet pour générer plus de leads qualifiés",
      body: "Un lead magnet (ebook, template, webinar, calculator) capture des leads avec une intention claire et permet un nurturing efficace.",
      recommendation: "Identifier le pain point n°1 de votre cible et créer un asset téléchargeable. Le promouvoir via Ads, SEO, social et email signature.",
    }),
  },
  {
    key: "marketing_good_conversion",
    category: "marketing",
    severity: "info",
    priority: 35,
    shouldShow: (c) => c.totalContacts > 0 && c.conversionRate >= 25,
    build: (c) => ({
      title: `Bonne conversion Lead → Opportunité : ${c.conversionRate}%`,
      body: `Le funnel marketing performe bien. Continuez à alimenter le top du funnel pour scaler.`,
      recommendation: "Identifier les sources qui convertissent le mieux et y réinvestir le budget acquisition.",
    }),
  },
  {
    key: "marketing_nurturing_program",
    category: "marketing",
    severity: "warning",
    priority: 75,
    shouldShow: (c) => c.totalContacts > 200 && c.opportunitiesCount < c.totalContacts * 0.15,
    build: (c) => ({
      title: `Manque de programme de nurturing (${c.totalContacts - c.opportunitiesCount} leads dormants)`,
      body: "Sans nurturing, 80% des leads non immédiatement matures sont perdus. C'est le plus gros gisement de pipeline gratuit.",
      recommendation: "Construire 3 séquences de nurturing : top funnel (éducation), middle funnel (use cases), bottom funnel (preuves sociales/démos).",
    }),
  },
  {
    key: "marketing_inbound_outbound_split",
    category: "marketing",
    severity: "info",
    priority: 55,
    shouldShow: (c) => c.totalContacts > 100,
    build: () => ({
      title: "Mesurer le mix inbound vs outbound dans le pipeline",
      body: "Connaître la proportion de deals issus de chaque canal d'acquisition oriente l'allocation budget marketing/SDR.",
      recommendation: "Tagger chaque deal avec sa source primaire. Construire un rapport « source → revenu » mensuel pour piloter le mix.",
    }),
  },
  {
    key: "marketing_persona_definition",
    category: "marketing",
    severity: "info",
    priority: 48,
    shouldShow: () => true,
    build: () => ({
      title: "Documenter les buyer personas et les utiliser dans toutes les campagnes",
      body: "Sans persona structuré (problèmes, objectifs, objections, vocabulaire), les campagnes restent génériques et le taux de réponse plafonne.",
      recommendation: "Interviewer 5 clients par persona cible. Construire des fiches d'1 page : profile, pain points, success metrics, no-go signals.",
    }),
  },
  {
    key: "marketing_landing_page_optimization",
    category: "marketing",
    severity: "info",
    priority: 45,
    shouldShow: (c) => (c.onlineContacts ?? 0) > 50,
    build: () => ({
      title: "Optimiser les landing pages pour augmenter le taux de conversion",
      body: "Le taux de conversion d'une landing page B2B varie de 1% à 15% selon le ciblage et le design. Marge d'amélioration énorme.",
      recommendation: "A/B tester un élément à la fois (headline, CTA, formulaire). Outils : HubSpot A/B testing ou VWO. Cibler 3-5% conversion minimum.",
    }),
  },
  {
    key: "marketing_email_engagement",
    category: "marketing",
    severity: "warning",
    priority: 70,
    shouldShow: (c) => c.totalContacts > 500,
    build: (c) => ({
      title: `Mesurer l'engagement email sur ${c.totalContacts.toLocaleString("fr-FR")} contacts`,
      body: "Sans tracking d'opens/clicks, les campagnes email tournent à l'aveugle. Les non-engagés polluent les délivrabilités.",
      recommendation: "Activer le scoring d'engagement par contact. Pruner trimestriellement les non-engagés depuis 6+ mois (ou les segmenter en re-engagement).",
    }),
  },
  {
    key: "marketing_content_strategy",
    category: "marketing",
    severity: "info",
    priority: 42,
    shouldShow: () => true,
    build: () => ({
      title: "Aligner le contenu marketing sur les objections sales",
      body: "Les meilleurs contenus marketing répondent aux objections récurrentes en sales. Cycle court entre besoin terrain et production éditoriale.",
      recommendation: "Sync mensuel marketing × sales sur les 5 objections les plus fréquentes. Produire 1 contenu pédagogique par objection (article, vidéo, fiche).",
    }),
  },
  {
    key: "marketing_account_based_marketing",
    category: "marketing",
    severity: "info",
    priority: 40,
    shouldShow: (c) => c.totalCompanies > 50 && c.orphanRate < 30,
    build: (c) => ({
      title: `Lancer une stratégie ABM sur les ${c.totalCompanies} comptes en base`,
      body: "L'ABM (Account-Based Marketing) cible les comptes à plus haut potentiel avec des messages personnalisés. ROI typique 2-3x supérieur au lead gen classique.",
      recommendation: "Identifier les top 50 comptes cibles. Construire des séquences personnalisées par compte. Aligner SDR + AE + marketing sur ces comptes.",
    }),
  },
  {
    key: "marketing_referral_program",
    category: "marketing",
    severity: "info",
    priority: 38,
    shouldShow: (c) => c.wonDeals > 20,
    build: (c) => ({
      title: `Activer un programme de référencement (${c.wonDeals} clients existants)`,
      body: "Les leads issus du référencement convertissent 3-5x mieux que les autres sources. C'est l'acquisition la moins chère en B2B.",
      recommendation: "Construire un programme structuré : ask systématique post-onboarding, incentive (commission, cadeau, cause), tracking dans le CRM.",
    }),
  },
  {
    key: "marketing_brand_search_visibility",
    category: "marketing",
    severity: "info",
    priority: 36,
    shouldShow: () => true,
    build: () => ({
      title: "Mesurer la visibilité de la marque (volume de recherche, share of voice)",
      body: "La part de marché digitale (search) est un leading indicator du pipeline futur. Les mots-clés en croissance prédisent les leads à 3-6 mois.",
      recommendation: "Tracker mensuellement les volumes de recherche brand vs concurrents (SEMrush, Ahrefs). Investir contenu/SEO sur les mots-clés à fort intent.",
    }),
  },

  // ════════════════════════════════════════════════════
  // DATA (20 templates)
  // ════════════════════════════════════════════════════
  {
    key: "data_no_phone",
    category: "data",
    severity: "warning",
    priority: 95,
    shouldShow: (c) => c.totalContacts > 0 && c.contactsNoPhone > c.totalContacts * 0.5,
    build: (c) => ({
      title: `${Math.round((c.contactsNoPhone / c.totalContacts) * 100)}% des contacts sans téléphone`,
      body: `${c.contactsNoPhone.toLocaleString("fr-FR")} contacts n'ont pas de numéro de téléphone renseigné. Cela limite la prospection multicanale.`,
      recommendation: "Enrichir la base via un outil tiers (Dropcontact, Clearbit, Lusha) ou rendre le champ téléphone obligatoire dans les formulaires.",
    }),
  },
  {
    key: "data_no_title",
    category: "data",
    severity: "warning",
    priority: 92,
    shouldShow: (c) => c.totalContacts > 0 && c.contactsNoTitle > c.totalContacts * 0.5,
    build: (c) => ({
      title: `${Math.round((c.contactsNoTitle / c.totalContacts) * 100)}% des contacts sans poste`,
      body: `Le poste permet de qualifier le décideur et de personnaliser les approches commerciales. Sans cette information, la qualification est aveugle.`,
      recommendation: "Ajouter le champ poste dans tous les formulaires d'acquisition. Enrichir les contacts existants via LinkedIn Sales Navigator ou Dropcontact.",
    }),
  },
  {
    key: "data_companies_no_industry",
    category: "data",
    severity: "warning",
    priority: 88,
    shouldShow: (c) => c.totalCompanies > 0 && c.companiesNoIndustry > c.totalCompanies * 0.7,
    build: (c) => ({
      title: `${Math.round((c.companiesNoIndustry / c.totalCompanies) * 100)}% des entreprises sans secteur d'activité`,
      body: `${c.companiesNoIndustry.toLocaleString("fr-FR")} entreprises n'ont pas de secteur renseigné. Impossible de segmenter par industrie.`,
      recommendation: "Activer l'enrichissement automatique HubSpot Insights ou utiliser un outil tiers pour récupérer les secteurs depuis le domaine.",
    }),
  },
  {
    key: "data_companies_no_revenue",
    category: "data",
    severity: "warning",
    priority: 85,
    shouldShow: (c) => c.totalCompanies > 0 && c.companiesNoRevenue > c.totalCompanies * 0.7,
    build: (c) => ({
      title: `${Math.round((c.companiesNoRevenue / c.totalCompanies) * 100)}% des entreprises sans CA`,
      body: `Le chiffre d'affaires est essentiel pour qualifier la taille des comptes et prioriser le commercial.`,
      recommendation: "Enrichir les entreprises avec des données firmographic via Clearbit, ZoomInfo ou un outil similaire.",
    }),
  },
  {
    key: "data_orphan_companies",
    category: "data",
    severity: "warning",
    priority: 80,
    shouldShow: (c) => c.totalContacts > 0 && c.orphanRate > 20 && c.orphanRate <= 30,
    build: (c) => ({
      title: `${c.orphansCount.toLocaleString("fr-FR")} contacts orphelins à enrichir`,
      body: `Ces contacts existent dans le CRM mais sans entreprise associée. Leur valeur business est limitée.`,
      recommendation: "Lancer un workflow d'enrichissement automatique des contacts orphelins via le domaine email.",
    }),
  },
  {
    key: "data_required_fields",
    category: "data",
    severity: "info",
    priority: 60,
    shouldShow: () => true,
    build: () => ({
      title: "Définir les champs obligatoires par lifecycle stage",
      body: "Chaque étape du lifecycle devrait exiger des informations spécifiques (qualification, contexte, taille, budget).",
      recommendation: "Configurer des champs requis dans HubSpot par lifecycle stage pour bloquer la progression d'un contact incomplet.",
    }),
  },
  {
    key: "data_validation_rules",
    category: "data",
    severity: "info",
    priority: 55,
    shouldShow: () => true,
    build: () => ({
      title: "Mettre en place des règles de validation sur les champs",
      body: "Les règles de validation (format email, format téléphone, valeurs autorisées) garantissent la qualité de la donnée à la saisie.",
      recommendation: "Configurer les regex de validation dans HubSpot pour les champs critiques (email, téléphone, code postal).",
    }),
  },
  {
    key: "data_dedup_strategy",
    category: "data",
    severity: "info",
    priority: 50,
    shouldShow: (c) => c.totalContacts > 1000,
    build: (c) => ({
      title: "Mettre en place une stratégie de dédoublonnage",
      body: `Avec ${c.totalContacts.toLocaleString("fr-FR")} contacts, le risque de doublons est élevé. Les doublons faussent les rapports et créent de la confusion commerciale.`,
      recommendation: "Utiliser l'outil de gestion des doublons HubSpot mensuellement. Activer la détection automatique sur l'email comme clé unique.",
    }),
  },
  {
    key: "data_email_validation",
    category: "data",
    severity: "warning",
    priority: 78,
    shouldShow: (c) => c.totalContacts > 100,
    build: (c) => ({
      title: `Valider les emails sur ${c.totalContacts.toLocaleString("fr-FR")} contacts`,
      body: "Les emails invalides détruisent la délivrabilité et faussent les KPIs marketing. Un taux de bounce >5% pénalise la sender reputation.",
      recommendation: "Brancher un service d'email verification (NeverBounce, ZeroBounce) sur les nouveaux leads. Auditer trimestriellement la base.",
    }),
  },
  {
    key: "data_property_governance",
    category: "data",
    severity: "warning",
    priority: 73,
    shouldShow: () => true,
    build: () => ({
      title: "Mettre en place une gouvernance des propriétés CRM",
      body: "Sans gouvernance, les propriétés s'accumulent : doublons sémantiques, champs orphelins, valeurs incohérentes. Le CRM devient illisible.",
      recommendation: "Audit trimestriel : qui crée des champs ? lesquels sont vraiment utilisés ? Archive les obsolètes. Documenter chaque champ actif.",
    }),
  },
  {
    key: "data_country_normalization",
    category: "data",
    severity: "warning",
    priority: 70,
    shouldShow: (c) => c.totalContacts > 200,
    build: () => ({
      title: "Normaliser les valeurs pays / état / ville",
      body: "« France », « FR », « FRANCE », « france » apparaissent comme 4 valeurs différentes. Reporting géographique cassé.",
      recommendation: "Forcer les listes déroulantes (dropdown) sur pays/états. Workflow de normalisation rétroactive sur la base existante.",
    }),
  },
  {
    key: "data_no_lifecycle",
    category: "data",
    severity: "critical",
    priority: 90,
    shouldShow: (c) => c.totalContacts > 100 && c.opportunitiesCount === 0 && c.totalDeals < 5,
    build: () => ({
      title: "Lifecycle stage inutilisé : funnel marketing aveugle",
      body: "Aucun contact n'a progressé dans le lifecycle. Impossible de mesurer la conversion lead → MQL → SQL → opportunity.",
      recommendation: "Activer immédiatement les lifecycle stages standard. Mettre en place des règles de progression auto via workflows.",
    }),
  },
  {
    key: "data_pii_compliance",
    category: "data",
    severity: "warning",
    priority: 75,
    shouldShow: (c) => c.totalContacts > 500,
    build: () => ({
      title: "Audit RGPD : preuves de consentement",
      body: "Avec une base contacts conséquente, l'absence de preuves de consentement (date, source, contenu) expose à des risques RGPD lourds.",
      recommendation: "Activer le module GDPR HubSpot. Tracer pour chaque contact : date opt-in, source, version des CGU. Process documenté de droit à l'oubli.",
    }),
  },
  {
    key: "data_owner_assignment",
    category: "data",
    severity: "warning",
    priority: 68,
    shouldShow: (c) => c.totalDeals > 10 && c.openDeals > 0,
    build: (c) => ({
      title: `Vérifier l'attribution des owners sur les deals (${c.openDeals} ouverts)`,
      body: "Deals sans owner = deals sans responsable = deals perdus. C'est l'erreur n°1 des CRM mal gouvernés.",
      recommendation: "Workflow d'attribution auto à la création (round-robin, segment, source). Audit hebdo des deals sans owner via report HubSpot.",
    }),
  },
  {
    key: "data_field_documentation",
    category: "data",
    severity: "info",
    priority: 45,
    shouldShow: () => true,
    build: () => ({
      title: "Documenter les définitions des champs critiques",
      body: "« MRR », « ARR », « lifecycle stage »... les définitions diffèrent par personne. Sans documentation, le reporting est ingérable.",
      recommendation: "Créer un data dictionary dans Notion/Confluence : nom du champ, définition, source, owner, exemples. Référencer dans HubSpot.",
    }),
  },
  {
    key: "data_source_tracking_quality",
    category: "data",
    severity: "warning",
    priority: 65,
    shouldShow: (c) => c.totalContacts > 100,
    build: (c) => ({
      title: `Renseigner la source originale sur ${c.totalContacts.toLocaleString("fr-FR")} contacts`,
      body: "Sans source originale (création), impossible de mesurer le ROI marketing par canal.",
      recommendation: "Champ « Original Source » obligatoire à la création. Workflow de fallback si vide (heuristique sur referrer/UTM).",
    }),
  },
  {
    key: "data_company_hierarchy",
    category: "data",
    severity: "info",
    priority: 42,
    shouldShow: (c) => c.totalCompanies > 100,
    build: () => ({
      title: "Activer les hiérarchies parent ↔ filiales sur les comptes",
      body: "Pour les groupes multi-entités, l'absence de hiérarchie cache les opportunités cross-sell intra-groupe.",
      recommendation: "Activer la fonction parent/child companies de HubSpot. Documenter les hiérarchies via enrichissement (Société.com, BvD).",
    }),
  },
  {
    key: "data_inactive_users_cleanup",
    category: "data",
    severity: "info",
    priority: 40,
    shouldShow: () => true,
    build: () => ({
      title: "Auditer les utilisateurs CRM inactifs (sécurité + licences)",
      body: "Les anciens collaborateurs avec accès CRM = risque sécurité + gaspillage de licences.",
      recommendation: "Audit trimestriel : qui s'est connecté dans les 90 derniers jours ? Désactiver les inactifs. Process automatique au offboarding.",
    }),
  },
  {
    key: "data_property_naming_convention",
    category: "data",
    severity: "info",
    priority: 38,
    shouldShow: () => true,
    build: () => ({
      title: "Adopter une convention de nommage des propriétés",
      body: "Champs « lead_score », « LeadScore », « Lead Score » coexistent → confusion + bugs reporting. Convention claire = cleanup.",
      recommendation: "Standard recommandé : snake_case en français ou anglais, préfixé par catégorie (sales_, marketing_, ops_). Documenté + enforcé en review.",
    }),
  },
];

/**
 * Returns up to 20 non-dismissed insights per category, ranked by priority.
 * Cap relevé de 3 → 20 pour exposer toute la profondeur de la library
 * (60 templates au total). L'UI peut paginer/scroller au besoin.
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

  // ⚠ Plus de short-circuit "org vide" : on laisse les templates always-on
  // (gouvernance, validation, RGPD, playbooks, etc.) s'afficher même sans
  // données chargées, car ce sont de vrais conseils CRO/RevOps universels.
  // Les templates conditionnés (ex: "X% sans téléphone") ne fireront pas
  // tant qu'il n'y a pas de données — leur shouldShow s'en charge.

  const sorted = [...INSIGHT_LIBRARY].sort((a, b) => b.priority - a.priority);

  for (const tpl of sorted) {
    if (dismissedKeys.has(tpl.key)) continue;
    if (!tpl.shouldShow(ctx)) continue;
    if (result[tpl.category].length >= 20) continue; // max 20 per category
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
