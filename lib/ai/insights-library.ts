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
  // ─────── COMMERCIAL ───────
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
    priority: 95,
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
    priority: 90,
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
    priority: 80,
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
    priority: 75,
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
    priority: 70,
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
    priority: 65,
    shouldShow: (c) => c.openDeals > 0 && c.openDeals < 20,
    build: (c) => ({
      title: `Pipeline trop léger : ${c.openDeals} transactions ouvertes seulement`,
      body: `Un pipeline en bonne santé doit représenter au moins 3x votre objectif de revenu. Avec ${c.openDeals} deals, la marge d'erreur est faible.`,
      recommendation: "Intensifier la prospection et l'acquisition de leads pour alimenter le haut du pipeline. Objectif : 2-3 nouveaux deals par commercial par semaine.",
    }),
  },
  {
    key: "commercial_good_closing_rate",
    category: "commercial",
    severity: "info",
    priority: 30,
    shouldShow: (c) => (c.wonDeals + c.lostDeals) >= 10 && c.closingRate >= 30,
    build: (c) => ({
      title: `Taux de closing solide : ${c.closingRate}%`,
      body: `${c.wonDeals} transactions gagnées sur ${c.wonDeals + c.lostDeals} clôturées — au-dessus du benchmark de 25-30%.`,
      recommendation: "Documenter les facteurs de succès des deals gagnés et les répliquer sur les deals en cours via des playbooks.",
    }),
  },
  {
    key: "commercial_pipeline_review_weekly",
    category: "commercial",
    severity: "info",
    priority: 25,
    shouldShow: () => true,
    build: () => ({
      title: "Mettre en place une revue de pipeline hebdomadaire",
      body: "Une revue de pipeline structurée chaque semaine permet de détecter les blocages tôt et de prioriser les actions commerciales.",
      recommendation: "Créer un rituel hebdomadaire de 30min avec l'équipe sales : top 5 deals chauds, deals à relancer, deals à clôturer en lost.",
    }),
  },

  // ─────── MARKETING ───────
  {
    key: "marketing_no_online_tracking",
    category: "marketing",
    severity: "critical",
    priority: 110,
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
    priority: 100,
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
    priority: 95,
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
    priority: 85,
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
    priority: 80,
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
    priority: 75,
    shouldShow: (c) => c.orphanRate > 15 && c.orphanRate <= 30,
    build: (c) => ({
      title: `${c.orphanRate}% de contacts sans entreprise associée`,
      body: `L'attribution par compte est partielle. ${c.orphansCount} contacts manquent de contexte entreprise.`,
      recommendation: "Créer un workflow d'auto-association : si l'email correspond au domaine d'une entreprise existante, l'associer automatiquement.",
    }),
  },
  {
    key: "marketing_segmentation",
    category: "marketing",
    severity: "info",
    priority: 50,
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
    priority: 40,
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
    priority: 30,
    shouldShow: (c) => c.totalContacts > 0 && c.conversionRate >= 25,
    build: (c) => ({
      title: `Bonne conversion Lead → Opportunité : ${c.conversionRate}%`,
      body: `Le funnel marketing performe bien. Continuez à alimenter le top du funnel pour scaler.`,
      recommendation: "Identifier les sources qui convertissent le mieux et y réinvestir le budget acquisition.",
    }),
  },

  // ─────── DATA ───────
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
    priority: 90,
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
    priority: 85,
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
    priority: 80,
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
    priority: 75,
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
    priority: 50,
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
    priority: 45,
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
    priority: 40,
    shouldShow: (c) => c.totalContacts > 1000,
    build: (c) => ({
      title: "Mettre en place une stratégie de dédoublonnage",
      body: `Avec ${c.totalContacts.toLocaleString("fr-FR")} contacts, le risque de doublons est élevé. Les doublons faussent les rapports et créent de la confusion commerciale.`,
      recommendation: "Utiliser l'outil de gestion des doublons HubSpot mensuellement. Activer la détection automatique sur l'email comme clé unique.",
    }),
  },
];

/**
 * Returns the top non-dismissed insight per category, ranked by priority.
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
    if (!tpl.shouldShow(ctx)) continue;
    if (result[tpl.category].length >= 3) continue; // max 3 per category
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
