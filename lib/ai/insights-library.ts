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
  contactsNoEmail?: number;
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
  // ── LIFECYCLE DISTRIBUTION (vraies valeurs HubSpot) ──
  lifecycleByStage?: Record<string, { label: string; count: number }>;
  customersCount?: number;
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

  // ── LIFECYCLE DISTRIBUTION DIAGNOSTICS (utilise la VRAIE distribution HubSpot) ──
  {
    key: "marketing_lifecycle_lead_to_mql_drop",
    category: "marketing",
    severity: "critical",
    priority: 102,
    shouldShow: (c) => {
      if (!c.lifecycleByStage) return false;
      const lead = c.lifecycleByStage["lead"]?.count ?? 0;
      const mql = c.lifecycleByStage["marketingqualifiedlead"]?.count ?? 0;
      return lead >= 100 && mql < lead * 0.05;
    },
    build: (c) => {
      const lead = c.lifecycleByStage?.["lead"]?.count ?? 0;
      const mql = c.lifecycleByStage?.["marketingqualifiedlead"]?.count ?? 0;
      const dropRate = Math.round(((lead - mql) / Math.max(lead, 1)) * 100);
      return {
        title: `Funnel cassé Lead → MQL : ${lead.toLocaleString("fr-FR")} leads → seulement ${mql} MQL (${dropRate}% drop)`,
        body: `Sur ${lead.toLocaleString("fr-FR")} leads, ${mql} ont été qualifiés en MQL. Le scoring marketing ne fonctionne pas — soit critères trop stricts, soit aucune automation de qualification active.`,
        recommendation: "Audit du modèle de scoring : quels engagements (emails, visites, downloads) doivent passer un Lead en MQL ? Workflow auto qui change le lifecyclestage = MQL dès franchissement du seuil. Cible : 10-20% conversion Lead → MQL.",
      };
    },
  },
  {
    key: "marketing_lifecycle_mql_to_sql_drop",
    category: "marketing",
    severity: "critical",
    priority: 101,
    shouldShow: (c) => {
      if (!c.lifecycleByStage) return false;
      const mql = c.lifecycleByStage["marketingqualifiedlead"]?.count ?? 0;
      const sql = c.lifecycleByStage["salesqualifiedlead"]?.count ?? 0;
      return mql >= 50 && sql < mql * 0.2;
    },
    build: (c) => {
      const mql = c.lifecycleByStage?.["marketingqualifiedlead"]?.count ?? 0;
      const sql = c.lifecycleByStage?.["salesqualifiedlead"]?.count ?? 0;
      return {
        title: `Handoff MQL → SQL cassé : ${mql} MQL → ${sql} SQL`,
        body: `Les MQL ne se transforment pas en SQL. Soit les SDR ne traitent pas les MQL, soit le critère SQL est mal défini, soit le handoff manuel est perdu.`,
        recommendation: "SLA marketing/sales : tout MQL doit être contacté < 5 minutes. Workflow d'attribution auto SDR à la création MQL. Critère SQL clair (BANT/MEDDIC). Reporting hebdo MQL non-traités.",
      };
    },
  },
  {
    key: "marketing_lifecycle_pipeline_health",
    category: "marketing",
    severity: "info",
    priority: 75,
    shouldShow: (c) => {
      if (!c.lifecycleByStage) return false;
      const opp = c.lifecycleByStage["opportunity"]?.count ?? 0;
      return opp > 100;
    },
    build: (c) => {
      const opp = c.lifecycleByStage?.["opportunity"]?.count ?? 0;
      const cust = c.customersCount ?? 0;
      return {
        title: `${opp.toLocaleString("fr-FR")} opportunités en lifecycle vs ${cust} customers`,
        body: `Stock d'opportunités très élevé. Soit le funnel marketing/sales ne se déclenche pas (handoff bloqué), soit lifecycle stage non maintenu (devrait être Customer après signature).`,
        recommendation: "Audit : combien de ces opportunités ont une activité <30j ? Workflow auto qui passe les contacts en Customer dès que leur company a un deal won. Sinon le funnel reste artificiellement haut.",
      };
    },
  },
  {
    key: "data_lifecycle_subscriber_unused",
    category: "data",
    severity: "info",
    priority: 65,
    shouldShow: (c) => {
      if (!c.lifecycleByStage) return false;
      const sub = c.lifecycleByStage["subscriber"]?.count ?? 0;
      return sub === 0 && c.totalContacts > 100;
    },
    build: (c) => ({
      title: `0 contact en lifecycle "Subscriber" sur ${c.totalContacts.toLocaleString("fr-FR")} contacts`,
      body: "Le stage Subscriber (newsletter, blog) est inutilisé. Soit pas de newsletter en place, soit les souscripteurs entrent directement en Lead — perte du marqueur top-of-funnel.",
      recommendation: "Activer le stage Subscriber sur les opt-in newsletter + content. Workflow Subscriber → Lead à la 1re conversion (form, démo). Permet de mesurer la conversion newsletter → pipeline.",
    }),
  },
  {
    key: "marketing_no_customers",
    category: "marketing",
    severity: "warning",
    priority: 80,
    shouldShow: (c) => {
      if (!c.lifecycleByStage) return false;
      const cust = c.customersCount ?? 0;
      return cust < 5 && c.totalContacts >= 500 && c.wonDeals >= 5;
    },
    build: (c) => ({
      title: `${c.wonDeals} deals gagnés mais seulement ${c.customersCount ?? 0} contact${(c.customersCount ?? 0) > 1 ? "s" : ""} en lifecycle Customer`,
      body: "Désync entre deals won et lifecycle Customer. Workflow manquant qui devrait passer le contact principal d'un company à Customer dès qu'un deal est won.",
      recommendation: "Workflow déclenché : Deal status = Closed Won → set lifecyclestage = Customer sur tous les contacts associés. Backfill batch sur les deals won historiques.",
    }),
  },
  {
    key: "marketing_lifecycle_distribution_audit",
    category: "marketing",
    severity: "info",
    priority: 50,
    shouldShow: (c) => {
      if (!c.lifecycleByStage) return false;
      const stages = Object.values(c.lifecycleByStage);
      const usedStages = stages.filter((s) => s.count > 0).length;
      return usedStages >= 3 && c.totalContacts >= 500;
    },
    build: (c) => {
      const stages = Object.entries(c.lifecycleByStage ?? {})
        .filter(([, v]) => v.count > 0)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([, v]) => `${v.label} (${v.count.toLocaleString("fr-FR")})`)
        .join(", ");
      return {
        title: `Distribution lifecycle : ${stages}`,
        body: "Audit la répartition de votre base. Un funnel sain en B2B SaaS suit une pyramide : beaucoup de Lead/Subscriber, moins de MQL, encore moins de SQL/Opp, et un noyau de Customer.",
        recommendation: "Si la distribution est anormale (ex: plus d'Opportunités que de Leads), c'est un signe que les transitions automatiques sont cassées ou que le lifecycle n'est plus mis à jour.",
      };
    },
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
  // EMPTY-STATE TEMPLATES — orgs réellement vides (CRM tout neuf)
  // ════════════════════════════════════════════════════════════════════
  // Ces templates ne firent QUE si TOUTES les data sources sont à 0.
  // Évite les faux positifs "0 contact" quand l'API HubSpot a temporairement
  // échoué sur un endpoint donné.

  {
    key: "empty_org_setup",
    category: "commercial",
    severity: "info",
    priority: 80,
    shouldShow: (c) =>
      c.totalDeals === 0 && c.totalContacts === 0 && c.totalCompanies === 0 &&
      (c.ownersCount ?? 0) === 0,
    build: () => ({
      title: "CRM vide — kit de démarrage RevOps",
      body: "Aucun deal, contact, company, ni owner détecté. Soit le portail HubSpot vient d'être créé, soit la connexion OAuth ne renvoie pas la donnée.",
      recommendation: "1) Vérifier la connexion HubSpot dans Paramètres > Intégrations. 2) Ajouter au moins 2 owners HubSpot. 3) Définir le pipeline (5-7 stages standards B2B). 4) Activer Lifecycle Stages.",
    }),
  },

  // ════════════════════════════════════════════════════════════════════
  // LIFECYCLE-DRIVEN TEMPLATES — exploitent la distribution réelle HubSpot
  // ════════════════════════════════════════════════════════════════════
  // Ces templates utilisent c.lifecycleByStage qui contient le count exact
  // par stage HubSpot (récupéré via /crm/v3/properties/contacts/lifecyclestage
  // + /search?filter=EQ par stage). Diagnostic CRO sur les VRAIS chiffres.

  {
    key: "lifecycle_funnel_subscriber_to_lead",
    category: "marketing",
    severity: "warning",
    priority: 85,
    shouldShow: (c) => {
      if (!c.lifecycleByStage) return false;
      const sub = c.lifecycleByStage["subscriber"]?.count ?? 0;
      const lead = c.lifecycleByStage["lead"]?.count ?? 0;
      return sub >= 50 && lead < sub * 0.3;
    },
    build: (c) => {
      const sub = c.lifecycleByStage?.["subscriber"]?.count ?? 0;
      const lead = c.lifecycleByStage?.["lead"]?.count ?? 0;
      return {
        title: `Funnel Subscriber → Lead : ${sub} subscribers → ${lead} leads (${PCT(lead, sub)}%)`,
        body: `Conversion newsletter → lead très basse. Soit le content de nurturing ne déclenche pas l'intérêt commercial, soit le scoring qui passe en Lead est mal calibré.`,
        recommendation: "Auditer le programme nurturing post-Subscriber : 4-5 emails sur 21j avec content pédagogique progressif. Workflow auto Subscriber→Lead à la 1re conversion (form, démo, content premium).",
      };
    },
  },
  {
    key: "lifecycle_funnel_opp_to_customer",
    category: "commercial",
    severity: "warning",
    priority: 90,
    shouldShow: (c) => {
      if (!c.lifecycleByStage) return false;
      const opp = c.lifecycleByStage["opportunity"]?.count ?? 0;
      const cust = c.customersCount ?? 0;
      return opp >= 50 && cust < opp * 0.05;
    },
    build: (c) => {
      const opp = c.lifecycleByStage?.["opportunity"]?.count ?? 0;
      const cust = c.customersCount ?? 0;
      return {
        title: `Conversion Opportunity → Customer : ${opp} opps → ${cust} customers (${PCT(cust, opp)}%)`,
        body: `Stock énorme d'opportunities qui ne se transforme pas en customer. Soit cycle de vente très long, soit lifecycle non maintenu (deals won qui ne déclenchent pas le passage en Customer).`,
        recommendation: "Workflow déclenché : Deal closed-won → set lifecyclestage = Customer sur les contacts associés. Audit immédiat : combien de deals won ont été oubliés au stage Opportunity ?",
      };
    },
  },
  {
    key: "lifecycle_funnel_lead_to_mql_extreme",
    category: "marketing",
    severity: "critical",
    priority: 105,
    shouldShow: (c) => {
      if (!c.lifecycleByStage) return false;
      const lead = c.lifecycleByStage["lead"]?.count ?? 0;
      const mql = c.lifecycleByStage["marketingqualifiedlead"]?.count ?? 0;
      return lead >= 500 && mql < lead * 0.02;
    },
    build: (c) => {
      const lead = c.lifecycleByStage?.["lead"]?.count ?? 0;
      const mql = c.lifecycleByStage?.["marketingqualifiedlead"]?.count ?? 0;
      return {
        title: `Critical : ${lead.toLocaleString("fr-FR")} leads dorment, seulement ${mql} MQL (${PCT(mql, lead)}%)`,
        body: `${(lead - mql).toLocaleString("fr-FR")} leads non qualifiés. Si seulement 10% étaient nurturés en MQL, ça ferait +${Math.round((lead - mql) * 0.1).toLocaleString("fr-FR")} MQL = pipeline démultiplié.`,
        recommendation: "URGENT : programme de nurturing scoring-based. Critères MQL : 3+ visites site OU 1 download content OU 1 form premium. Workflow auto qui passe en MQL dès franchissement du seuil.",
      };
    },
  },
  {
    key: "lifecycle_funnel_mql_to_sql",
    category: "commercial",
    severity: "critical",
    priority: 102,
    shouldShow: (c) => {
      if (!c.lifecycleByStage) return false;
      const mql = c.lifecycleByStage["marketingqualifiedlead"]?.count ?? 0;
      const sql = c.lifecycleByStage["salesqualifiedlead"]?.count ?? 0;
      return mql >= 30 && sql < mql * 0.15;
    },
    build: (c) => {
      const mql = c.lifecycleByStage?.["marketingqualifiedlead"]?.count ?? 0;
      const sql = c.lifecycleByStage?.["salesqualifiedlead"]?.count ?? 0;
      return {
        title: `Handoff Marketing → Sales cassé : ${mql} MQL → ${sql} SQL (${PCT(sql, mql)}%)`,
        body: `MQL générés par marketing ne deviennent pas SQL. Soit SDR/AE ne traitent pas les MQL (pas de SLA), soit critère SQL trop strict.`,
        recommendation: "SLA : tout MQL contacté < 15 minutes. Workflow round-robin attribution SDR à la création MQL. Définir critère SQL clair (BANT) en réunion sales × marketing hebdo.",
      };
    },
  },
  {
    key: "lifecycle_funnel_sql_to_opp",
    category: "commercial",
    severity: "warning",
    priority: 95,
    shouldShow: (c) => {
      if (!c.lifecycleByStage) return false;
      const sql = c.lifecycleByStage["salesqualifiedlead"]?.count ?? 0;
      const opp = c.lifecycleByStage["opportunity"]?.count ?? 0;
      return sql >= 30 && opp < sql * 0.5;
    },
    build: (c) => {
      const sql = c.lifecycleByStage?.["salesqualifiedlead"]?.count ?? 0;
      const opp = c.lifecycleByStage?.["opportunity"]?.count ?? 0;
      return {
        title: `Conversion SQL → Opportunity : ${sql} SQL → ${opp} opps (${PCT(opp, sql)}%)`,
        body: `SQL identifiés mais pas convertis en deals. Cycle de discovery trop long ou qualification SQL trop optimiste.`,
        recommendation: "Audit du process Discovery : durée moyenne SQL → 1er meeting, taux de RDV honorés, taux de création deal post-meeting. Cible : 70% des SQL créent un deal sous 14j.",
      };
    },
  },
  {
    key: "lifecycle_distribution_overview",
    category: "marketing",
    severity: "info",
    priority: 55,
    shouldShow: (c) => {
      if (!c.lifecycleByStage) return false;
      const stagesUsed = Object.values(c.lifecycleByStage).filter((s) => s.count > 0).length;
      return stagesUsed >= 3 && c.totalContacts >= 100;
    },
    build: (c) => {
      const stages = Object.entries(c.lifecycleByStage ?? {})
        .filter(([, v]) => v.count > 0)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 6);
      const summary = stages
        .map(([, v]) => `${v.label} ${v.count.toLocaleString("fr-FR")}`)
        .join(" · ");
      return {
        title: `Distribution lifecycle actuelle : ${summary}`,
        body: `Funnel global : ${c.totalContacts.toLocaleString("fr-FR")} contacts répartis sur ${stages.length} stages utilisés. Pyramide saine = beaucoup en Subscriber/Lead, moins en MQL, encore moins en SQL/Opp, noyau Customer.`,
        recommendation: "Si la distribution est inversée (plus d'Opps que de Leads = funnel cassé). Audit hebdo de la pyramide pour détecter les paliers où ça coince.",
      };
    },
  },

  // ════════════════════════════════════════════════════════════════════
  // ECOSYSTEM-DRIVEN TEMPLATES — exploitent les counts précis HubSpot
  // ════════════════════════════════════════════════════════════════════

  {
    key: "ecosystem_tickets_no_csat",
    category: "data",
    severity: "warning",
    priority: 78,
    shouldShow: (c) => (c.ticketsCount ?? 0) >= 30 && (c.feedbackCount ?? 0) === 0,
    build: (c) => ({
      title: `${c.ticketsCount} tickets ouverts mais 0 feedback (CSAT/NPS)`,
      body: `Service client actif (${c.ticketsCount} tickets) mais aucune mesure de satisfaction. Impossible de détecter les détracteurs avant qu'ils churnent.`,
      recommendation: "Enquête CSAT post-ticket auto (survey 1 question : note 1-5 + commentaire). NPS trimestriel sur la base customer. Workflow alerte CSM si CSAT ≤ 2 sur un compte.",
    }),
  },
  {
    key: "ecosystem_subscriptions_no_renewal_workflow",
    category: "commercial",
    severity: "warning",
    priority: 82,
    shouldShow: (c) => (c.subscriptionsCount ?? 0) >= 20 && (c.workflowsActiveCount ?? 0) < 5,
    build: (c) => ({
      title: `${c.subscriptionsCount} subscriptions actives mais peu d'automation renewal`,
      body: `Recurring revenue significatif (${c.subscriptionsCount} subs) sans workflows dédiés. Risque churn élevé sur les renewals non préparés.`,
      recommendation: "3 workflows renewal critiques : (1) alerte CSM J-90 avant fin contrat, (2) email upsell après NPS promoteur, (3) escalade COO si compte Tier 1 sans renewal call J-60.",
    }),
  },
  {
    key: "ecosystem_invoices_unpaid_audit",
    category: "data",
    severity: "warning",
    priority: 80,
    shouldShow: (c) => (c.invoicesCount ?? 0) >= 20,
    build: (c) => ({
      title: `${c.invoicesCount} factures HubSpot — audit recouvrement nécessaire`,
      body: "Volume de facturation significatif. Sans dashboard de suivi des impayés croisé avec deals HubSpot, perte de cash garantie sur les retards.",
      recommendation: "Dashboard impayés : factures > 30j non payées avec owner sales associé. Workflow alerte hebdo sales pour relance. Intégration Stripe/Pennylane pour synchro paiements live.",
    }),
  },
  {
    key: "ecosystem_quotes_low_conversion",
    category: "commercial",
    severity: "warning",
    priority: 88,
    shouldShow: (c) =>
      (c.quotesCount ?? 0) >= 10 && c.openDeals >= 20 && (c.quotesCount ?? 0) < c.openDeals * 0.4,
    build: (c) => ({
      title: `${c.quotesCount} quotes pour ${c.openDeals} deals ouverts (${PCT(c.quotesCount ?? 0, c.openDeals)}%)`,
      body: "Trop peu de devis émis vs deals en cours. Soit les sales font les devis hors HubSpot (fuite data), soit les deals stagnent au stade Proposition sans devis formel.",
      recommendation: "Process : 100% des deals au stade Proposition doivent avoir un quote HubSpot associé. Templates de quotes pré-remplis pour accélérer. Tracking quote-to-close cycle.",
    }),
  },
  {
    key: "ecosystem_sequences_low_for_pipeline",
    category: "commercial",
    severity: "warning",
    priority: 84,
    shouldShow: (c) => (c.sequencesCount ?? 0) < 100 && c.totalContacts >= 1000 && (c.ownersCount ?? 0) >= 2,
    build: (c) => ({
      title: `Outbound sous-utilisé : ${c.sequencesCount ?? 0} enrollments sur ${c.totalContacts.toLocaleString("fr-FR")} contacts`,
      body: `Base de ${c.totalContacts.toLocaleString("fr-FR")} contacts mais activité Sales Hub Sequences faible. Cadence de prospection insuffisante par rapport au potentiel.`,
      recommendation: "Cible Sales Hub : 3-5 sequences actives par SDR (cold, follow-up, breakup, re-engagement). Reply rate cible 8-15%. A/B test des objets/CTA mensuels.",
    }),
  },
  {
    key: "ecosystem_workflows_volume",
    category: "commercial",
    severity: "info",
    priority: 50,
    shouldShow: (c) => (c.workflowsActiveCount ?? 0) >= 10,
    build: (c) => ({
      title: `${c.workflowsActiveCount} workflows actifs — audit gouvernance`,
      body: "Volume de workflows élevé. Sans audit régulier, risque de doublons, conflits, actions opposées qui s'annulent (deal réassigné par 2 workflows différents par exemple).",
      recommendation: "Audit trimestriel : lister chaque workflow, son trigger, son action, son owner. Documenter dans Notion. Désactiver les obsolètes. Identifier les chaînes critiques pour ne pas les casser.",
    }),
  },
  {
    key: "ecosystem_owners_no_teams",
    category: "data",
    severity: "warning",
    priority: 72,
    shouldShow: (c) => (c.ownersCount ?? 0) >= 5 && (c.teamsCount ?? 0) === 0,
    build: (c) => ({
      title: `${c.ownersCount} owners actifs mais 0 team configurée`,
      body: "Reporting par équipe impossible. Round-robin par segment cassé. Permissions trop ouvertes (chaque sales voit tout au lieu de son périmètre).",
      recommendation: "Settings > Teams : créer minimum 3 teams (Inbound Sales, Outbound Sales, CSM). Assigner chaque user. Activer permissions différenciées + reports Teams.",
    }),
  },
  {
    key: "ecosystem_pipelines_singleton",
    category: "commercial",
    severity: "info",
    priority: 60,
    shouldShow: (c) => c.totalDeals >= 100 && (c.lifecycleByStage ? Object.keys(c.lifecycleByStage).length : 0) >= 5,
    build: (c) => ({
      title: `Audit pipeline : ${c.totalDeals.toLocaleString("fr-FR")} deals sur 1 seul pipeline ?`,
      body: "À ce volume, plusieurs pipelines spécialisés (New business / Renewal / Upsell / Partner) facilitent le pilotage et le forecast.",
      recommendation: "Découper le pipeline principal : New business (cycle long) + Renewal (cycle court) + Upsell. Chaque pipeline a ses propres stages adaptés à la nature du deal.",
    }),
  },
  {
    key: "ecosystem_high_orphan_rate_company_lib",
    category: "data",
    severity: "critical",
    priority: 92,
    shouldShow: (c) => c.totalContacts >= 500 && c.orphansCount > c.totalContacts * 0.4,
    build: (c) => ({
      title: `${c.orphansCount.toLocaleString("fr-FR")} contacts orphelins (${c.orphanRate}%) — ABM cassé sur 50%+ de la base`,
      body: `Plus de ${c.orphanRate}% des contacts ne sont rattachés à aucune company. Reporting par compte faussé, scoring account-based impossible, segmentation par taille d'entreprise inutilisable.`,
      recommendation: "URGENT : workflow auto-association par domaine email + batch one-shot enrichissement Clearbit/Dropcontact (~0.30€/contact = budget acceptable). Cible 90% de couverture sous 30j.",
    }),
  },
  {
    key: "ecosystem_critical_email_missing",
    category: "data",
    severity: "critical",
    priority: 96,
    shouldShow: (c) => c.totalContacts >= 100 && (c.contactsNoEmail ?? 0) > c.totalContacts * 0.1,
    build: (c) => ({
      title: `${c.contactsNoEmail} contacts sans email (${PCT(c.contactsNoEmail ?? 0, c.totalContacts)}%) — outbound impossible`,
      body: "Sans email, les contacts sont injoignables par email/sequences/nurturing. Données collectées (sites web, événements, partners) mais email perdu en route.",
      recommendation: "Audit collecte : forms HubSpot avec email obligatoire. Workflow d'alerte ou suppression auto des contacts sans email après 30j. Process de re-collecte sur les contacts existants.",
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
