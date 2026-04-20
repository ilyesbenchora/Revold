/**
 * Audit Recommendations Library — CRO/RevOps expert recommendations.
 *
 * Pattern factory identique à cycle-ventes-library :
 *   - 1 factory = { id unique, match(snapshot), build(snapshot) }
 *   - match() décide si la reco est pertinente pour l'org courante
 *   - build() produit la reco avec valeurs réelles extraites du snapshot
 *
 * Une recommandation est structurée en :
 *   - painPoint : diagnostic du problème (CRO-level)
 *   - currentState : chiffres réels du CRM
 *   - impact : conséquence business si non adressé
 *   - actionPlan : plan d'action en étapes numérotées avec effort + timeframe
 *   - coachingCategory : détermine vers quelle page insights-ia le coaching activé ira
 */

import type { HubSpotSnapshot } from "@/lib/integrations/hubspot-snapshot";

export type RecoCategory = "donnees" | "process" | "performances" | "adoption";
export type RecoSubcategory = "ventes" | "marketing" | "paiement" | "service_client";
export type Severity = "critical" | "warning" | "info";
export type Effort = "S" | "M" | "L";
export type CoachingCategory =
  | "commercial"
  | "marketing"
  | "data"
  | "integration"
  | "cross-source"
  | "data-model";

export type ActionStep = {
  step: number;
  action: string;
  timeframe: string;
  effort: Effort;
};

export type Recommendation = {
  id: string;
  category: RecoCategory;
  subcategory?: RecoSubcategory;
  severity: Severity;
  title: string;
  painPoint: string;
  currentState: string;
  impact: string;
  actionPlan: ActionStep[];
  coachingCategory: CoachingCategory;
  color: string; // gradient Tailwind
};

type RecommendationFactory = {
  id: string;
  category: RecoCategory;
  subcategory?: RecoSubcategory;
  match: (s: HubSpotSnapshot) => boolean;
  build: (s: HubSpotSnapshot) => Omit<Recommendation, "id" | "category" | "subcategory">;
};

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

const fmtN = (n: number) => n.toLocaleString("fr-FR");
const pct = (top: number, bottom: number) => (bottom > 0 ? Math.round((top / bottom) * 100) : 0);

// ────────────────────────────────────────────────────────────────────────────
// FACTORIES
// ────────────────────────────────────────────────────────────────────────────

const FACTORIES: RecommendationFactory[] = [
  // ═══════════════════════════════════════════════════════════════════
  // DONNÉES
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "data.orphans_critical",
    category: "donnees",
    match: (s) => s.totalContacts >= 50 && pct(s.orphansCount, s.totalContacts) > 30,
    build: (s) => ({
      severity: "critical",
      title: "Taux d'orphelins critique : ABM impossible",
      painPoint: `${fmtN(s.orphansCount)} contacts ne sont rattachés à aucune entreprise (${pct(s.orphansCount, s.totalContacts)}% de la base). Aucune segmentation par compte, aucun reporting ABM possible, analyse par taille faussée.`,
      currentState: `${pct(s.orphansCount, s.totalContacts)}% de contacts orphelins sur ${fmtN(s.totalContacts)} en base (benchmark B2B sain : < 15%)`,
      impact: "Incapacité à scorer les comptes cibles, pitch DSI difficile (pas de stack account-based clair), pipeline marketing impossible à attribuer aux bonnes companies.",
      actionPlan: [
        { step: 1, action: "Créer un workflow HubSpot d'auto-association par domaine email (si email pro et domaine matche une company existante)", timeframe: "Cette semaine", effort: "S" },
        { step: 2, action: "Lancer un batch d'enrichissement Clearbit/Dropcontact sur les contacts résiduels (~0,30€/contact)", timeframe: "Dans 14 jours", effort: "M" },
        { step: 3, action: "Mettre en place un audit hebdomadaire des orphelins dans /dashboard/donnees pour éviter la régression", timeframe: "Ongoing", effort: "S" },
        { step: 4, action: "Activer un coaching sur la gouvernance data pour documenter le process dans Notion", timeframe: "30 jours", effort: "M" },
      ],
      coachingCategory: "data",
      color: "from-rose-500 to-pink-600",
    }),
  },
  {
    id: "data.phone_coverage",
    category: "donnees",
    match: (s) => s.totalContacts >= 50 && pct(s.contactsNoPhone, s.totalContacts) > 50,
    build: (s) => ({
      severity: "warning",
      title: "Couverture téléphone insuffisante : outbound multicanal bridé",
      painPoint: `${pct(s.contactsNoPhone, s.totalContacts)}% des contacts n'ont pas de numéro de téléphone (${fmtN(s.contactsNoPhone)} contacts). Les SDR ne peuvent pas combiner email + appel, productivité outbound divisée par 2.`,
      currentState: `${fmtN(s.contactsNoPhone)} contacts sans phone sur ${fmtN(s.totalContacts)} (${pct(s.contactsNoPhone, s.totalContacts)}%)`,
      impact: "Perte de 40-60% de la conversion outbound vs multicanal (benchmarks SalesLoft/Outreach). Manque à gagner estimé sur les SDR actuels.",
      actionPlan: [
        { step: 1, action: "Ajouter le champ phone obligatoire dans les forms HubSpot d'acquisition premium (démo, BOFU)", timeframe: "Cette semaine", effort: "S" },
        { step: 2, action: "Lancer un enrichissement batch via Dropcontact ou Cognism sur les contacts en lifecycle MQL+", timeframe: "14 jours", effort: "M" },
        { step: 3, action: "Créer un workflow HubSpot qui déclenche l'enrichissement à la création MQL", timeframe: "30 jours", effort: "M" },
      ],
      coachingCategory: "data",
      color: "from-amber-500 to-orange-600",
    }),
  },
  {
    id: "data.title_coverage",
    category: "donnees",
    match: (s) => s.totalContacts >= 50 && pct(s.contactsNoTitle, s.totalContacts) > 40,
    build: (s) => ({
      severity: "warning",
      title: "Champs jobtitle manquants : personnalisation aveugle",
      painPoint: `${pct(s.contactsNoTitle, s.totalContacts)}% des contacts n'ont pas de poste renseigné. Impossible de cibler par fonction ou niveau hiérarchique. Les sequences génériques sous-performent de 60%.`,
      currentState: `${fmtN(s.contactsNoTitle)} contacts sans jobtitle (${pct(s.contactsNoTitle, s.totalContacts)}%)`,
      impact: "Personnalisation outbound impossible. Taux de réponse sequences plafonné à 3-5% vs 12-15% avec personnalisation par fonction.",
      actionPlan: [
        { step: 1, action: "Enrichissement batch LinkedIn Sales Navigator ou Apollo sur la base existante", timeframe: "30 jours", effort: "M" },
        { step: 2, action: "Champ jobtitle obligatoire dans tous les forms BOFU (démo, fiche produit)", timeframe: "7 jours", effort: "S" },
        { step: 3, action: "Workflow enrichissement auto à la création d'un lifecycle MQL", timeframe: "30 jours", effort: "M" },
        { step: 4, action: "Mapping personas × jobtitle pour le routing SDR par territoire", timeframe: "60 jours", effort: "L" },
      ],
      coachingCategory: "data",
      color: "from-amber-500 to-orange-600",
    }),
  },
  {
    id: "data.industry_coverage",
    category: "donnees",
    match: (s) => s.totalCompanies >= 30 && pct(s.companiesNoIndustry, s.totalCompanies) > 50,
    build: (s) => ({
      severity: "warning",
      title: "Secteurs d'activité manquants : segmentation industry impossible",
      painPoint: `${pct(s.companiesNoIndustry, s.totalCompanies)}% des entreprises n'ont pas de secteur renseigné. Impossible de construire un ICP par industrie, perte de visibilité sur les verticales qui convertissent.`,
      currentState: `${fmtN(s.companiesNoIndustry)} companies sans industry (${pct(s.companiesNoIndustry, s.totalCompanies)}%)`,
      impact: "Incapacité à allouer le budget marketing par secteur performant. Top 3 ICP par industrie invisibles.",
      actionPlan: [
        { step: 1, action: "Activer HubSpot Insights (gratuit) : auto-fill industry depuis le domaine web", timeframe: "Cette semaine", effort: "S" },
        { step: 2, action: "Workflow enrichissement à la création company via Clearbit/Société.com", timeframe: "30 jours", effort: "M" },
        { step: 3, action: "Reporting mensuel win rate × industry pour identifier top 3 ICP", timeframe: "60 jours", effort: "S" },
      ],
      coachingCategory: "data",
      color: "from-amber-500 to-yellow-600",
    }),
  },
  {
    id: "data.revenue_coverage",
    category: "donnees",
    match: (s) => s.totalCompanies >= 30 && pct(s.companiesNoRevenue, s.totalCompanies) > 50,
    build: (s) => ({
      severity: "warning",
      title: "CA entreprise non renseigné : priorisation aveugle",
      painPoint: `${pct(s.companiesNoRevenue, s.totalCompanies)}% des entreprises n'ont pas de CA renseigné. Les sales priorisent à l'aveugle, perdent du temps sur des comptes hors-cible ICP.`,
      currentState: `${fmtN(s.companiesNoRevenue)} companies sans annualrevenue (${pct(s.companiesNoRevenue, s.totalCompanies)}%)`,
      impact: "Coût opportunité énorme : chaque heure sales sur un compte PME quand la cible est ETI = -40% de productivité.",
      actionPlan: [
        { step: 1, action: "Enrichissement Clearbit ou Société.com mensuel sur les companies en base", timeframe: "30 jours", effort: "M" },
        { step: 2, action: "Workflow qui impose annualrevenue avant passage en SQL", timeframe: "14 jours", effort: "M" },
        { step: 3, action: "ICP scoring par taille × secteur × CA dans HubSpot Custom Property", timeframe: "60 jours", effort: "L" },
      ],
      coachingCategory: "data",
      color: "from-amber-500 to-fuchsia-600",
    }),
  },
  {
    id: "data.dedup",
    category: "donnees",
    match: (s) => s.totalContacts >= 1000,
    build: (s) => ({
      severity: "warning",
      title: "Risque doublons élevé sur base de cette taille",
      painPoint: `Avec ${fmtN(s.totalContacts)} contacts en base, les doublons s'accumulent inévitablement. Ils faussent les rapports, polluent les emails (sender reputation) et créent de la confusion sales.`,
      currentState: `${fmtN(s.totalContacts)} contacts (au-delà de 1 000, dédoublonnage manuel ingérable)`,
      impact: "Reporting biaisé + délivrabilité email dégradée + confusion sales qui contactent 2x le même prospect.",
      actionPlan: [
        { step: 1, action: "Lancer HubSpot Manage Duplicates en mode batch sur les 90 derniers jours", timeframe: "Cette semaine", effort: "S" },
        { step: 2, action: "Activer la détection auto sur l'email comme clé unique", timeframe: "7 jours", effort: "S" },
        { step: 3, action: "Process trimestriel de cleanup documenté dans Notion", timeframe: "60 jours", effort: "M" },
      ],
      coachingCategory: "data",
      color: "from-amber-500 to-orange-600",
    }),
  },
  {
    id: "data.lifecycle_missing",
    category: "donnees",
    match: (s) =>
      s.totalContacts >= 100 &&
      Object.values(s.lifecycleByStage ?? {}).filter((st) => st.count > 0).length < 3,
    build: (s) => {
      const usedStages = Object.values(s.lifecycleByStage ?? {}).filter((st) => st.count > 0).length;
      return {
        severity: "critical",
        title: "Lifecycle stages non activés : funnel marketing invisible",
        painPoint: `Seuls ${usedStages}/6 lifecycle stages sont utilisés. Sans les 6 stages (Subscriber → Lead → MQL → SQL → Opportunity → Customer), impossible de mesurer la conversion à chaque transition.`,
        currentState: `${usedStages}/6 stages actifs sur ${fmtN(s.totalContacts)} contacts`,
        impact: "Funnel marketing/sales totalement invisible. Aucune mesure de handoff MQL→SQL, aucune détection de goulet d'étranglement.",
        actionPlan: [
          { step: 1, action: "Activer les 6 lifecycle stages standard HubSpot", timeframe: "Cette semaine", effort: "S" },
          { step: 2, action: "Créer les workflows de progression automatique (Subscriber→Lead à la 1re conversion, etc.)", timeframe: "14 jours", effort: "M" },
          { step: 3, action: "Documenter les critères de passage entre stages (BANT/MEDDIC)", timeframe: "30 jours", effort: "M" },
          { step: 4, action: "Reporting funnel hebdo dans HubSpot Dashboards", timeframe: "30 jours", effort: "S" },
        ],
        coachingCategory: "data-model",
        color: "from-rose-500 to-orange-600",
      };
    },
  },
  {
    id: "data.teams_missing",
    category: "donnees",
    match: (s) => s.ownersCount >= 5 && s.teamsCount === 0,
    build: (s) => ({
      severity: "warning",
      title: "Teams HubSpot non configurées : reporting cross-équipe impossible",
      painPoint: `${s.ownersCount} owners actifs mais aucune team configurée. Reporting par équipe impossible, round-robin par segment cassé, permissions trop ouvertes (chaque sales voit tout).`,
      currentState: `${s.ownersCount} owners, 0 team`,
      impact: "Management aveugle sur la perf par équipe. Risque leak de data sensible entre sales (deals stratégiques).",
      actionPlan: [
        { step: 1, action: "Créer minimum 3 teams : Sales Inbound / Sales Outbound / CSM", timeframe: "Cette semaine", effort: "S" },
        { step: 2, action: "Assigner chaque owner à sa team", timeframe: "Cette semaine", effort: "S" },
        { step: 3, action: "Activer les permissions différenciées par team", timeframe: "14 jours", effort: "M" },
        { step: 4, action: "Construire les reports HubSpot Teams pour comparer perf cross-équipes", timeframe: "30 jours", effort: "M" },
      ],
      coachingCategory: "data-model",
      color: "from-amber-500 to-orange-600",
    }),
  },

  // ═══════════════════════════════════════════════════════════════════
  // PROCESS & ALIGNEMENT
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "process.no_workflows",
    category: "process",
    match: (s) => s.workflowsActiveCount < 5,
    build: (s) => ({
      severity: "critical",
      title: "Automation pipeline absente : tout se fait à la main",
      painPoint: `${s.workflowsActiveCount} workflows actifs seulement. L'équipe sales fait tout en manuel : attribution, relances, tâches de suivi, alertes. -3 à 5h/sales/semaine perdues.`,
      currentState: `${s.workflowsActiveCount}/${s.workflowsCount} workflows actifs`,
      impact: `Économie potentielle : ~${Math.max(1, s.ownersCount * 12)}h/semaine sur l'équipe. Sur 52 semaines, équivaut à 1 ETP.`,
      actionPlan: [
        { step: 1, action: "Workflow attribution auto à la création deal/contact (round-robin par segment)", timeframe: "Cette semaine", effort: "S" },
        { step: 2, action: "Workflow tâche de relance 5 jours sans activité sur un deal actif", timeframe: "7 jours", effort: "S" },
        { step: 3, action: "Workflow tâche de relance 14 jours + escalade manager", timeframe: "14 jours", effort: "M" },
        { step: 4, action: "Workflow email post-démo avec template personnalisé", timeframe: "14 jours", effort: "M" },
        { step: 5, action: "Workflow alerte deal stagnant à l'equipe ou manager", timeframe: "30 jours", effort: "M" },
      ],
      coachingCategory: "commercial",
      color: "from-rose-500 to-pink-600",
    }),
  },
  {
    id: "process.mql_sql_handoff",
    category: "process",
    match: (s) => {
      const mql = s.lifecycleByStage?.["marketingqualifiedlead"]?.count ?? 0;
      const sql = s.lifecycleByStage?.["salesqualifiedlead"]?.count ?? 0;
      return mql >= 30 && (sql === 0 || sql < mql * 0.15);
    },
    build: (s) => {
      const mql = s.lifecycleByStage?.["marketingqualifiedlead"]?.count ?? 0;
      const sql = s.lifecycleByStage?.["salesqualifiedlead"]?.count ?? 0;
      return {
        severity: "critical",
        title: "Handoff Marketing → Sales cassé",
        painPoint: `${mql} MQL mais seulement ${sql} SQL (${pct(sql, mql)}%). Soit les SDR ne traitent pas les MQL, soit le critère SQL est mal défini, soit le handoff manuel est perdu.`,
        currentState: `${mql} MQL → ${sql} SQL (conversion ${pct(sql, mql)}%, benchmark 25-50%)`,
        impact: "Pipeline marketing gaspillé. Le coût acquisition marketing devient non-rentable si 50%+ des MQL ne sont pas travaillés.",
        actionPlan: [
          { step: 1, action: "Définir le critère SQL clair (BANT : Budget + Authority + Need + Timeline) en réunion sales × marketing", timeframe: "Cette semaine", effort: "S" },
          { step: 2, action: "SLA : tout MQL doit être contacté en moins de 5 minutes par un SDR", timeframe: "14 jours", effort: "M" },
          { step: 3, action: "Workflow HubSpot d'attribution auto round-robin SDR à la création MQL", timeframe: "14 jours", effort: "M" },
          { step: 4, action: "Reporting hebdo : MQL non-traités, time-to-contact, conversion SQL par SDR", timeframe: "30 jours", effort: "M" },
        ],
        coachingCategory: "marketing",
        color: "from-rose-500 to-amber-600",
      };
    },
  },
  {
    id: "process.no_forms",
    category: "process",
    match: (s) => s.totalContacts >= 100 && s.formsCount === 0,
    build: (s) => ({
      severity: "critical",
      title: "Top of funnel cassé : aucun form HubSpot",
      painPoint: `${fmtN(s.totalContacts)} contacts en base mais 0 form HubSpot. Si le site convertit, l'attribution source est cassée. Si le site ne convertit pas, c'est le canal inbound n°1 qui manque.`,
      currentState: `0 form HubSpot / ${fmtN(s.totalContacts)} contacts`,
      impact: "Attribution marketing impossible. Pas de pixel HubSpot = pas de re-targeting, pas de scoring comportemental.",
      actionPlan: [
        { step: 1, action: "Créer 3 forms minimum : demande de démo (BOFU), téléchargement content (MOFU), contact (TOFU)", timeframe: "Cette semaine", effort: "S" },
        { step: 2, action: "Installer le pixel HubSpot sur toutes les pages du site", timeframe: "Cette semaine", effort: "S" },
        { step: 3, action: "Connecter les landing pages existantes via HubSpot forms", timeframe: "14 jours", effort: "M" },
        { step: 4, action: "Étendre à 8 forms : par persona × intent (webinar, fiche produit, pricing)", timeframe: "60 jours", effort: "L" },
      ],
      coachingCategory: "marketing",
      color: "from-rose-500 to-orange-600",
    }),
  },
  {
    id: "process.pipeline_review_ritual",
    category: "process",
    match: (s) => s.openDeals >= 10,
    build: (s) => ({
      severity: "info",
      title: "Rituel pipeline review hebdomadaire manquant",
      painPoint: `${fmtN(s.openDeals)} deals ouverts actuels. Sans revue de pipeline structurée hebdo, les deals stagnent en silence et les sales compensent par du sur-optimisme en forecast.`,
      currentState: `${fmtN(s.openDeals)} deals ouverts, ${fmtN(s.stagnantDeals)} stagnants, ${fmtN(s.dealsAtRisk)} à risque`,
      impact: "Stagnation +50% sans rituel. Forecast accuracy < 60% contre 90% avec rituel structuré.",
      actionPlan: [
        { step: 1, action: "Bloquer 30 min fixes chaque lundi 9h avec l'équipe sales", timeframe: "Cette semaine", effort: "S" },
        { step: 2, action: "Agenda structuré : top 5 deals chauds, deals à relancer, deals à clôturer en lost", timeframe: "Ongoing", effort: "S" },
        { step: 3, action: "Dashboard HubSpot dédié au rituel (stagnants, à risque, closing semaine)", timeframe: "14 jours", effort: "M" },
        { step: 4, action: "Escalade manager sur les deals Tier 1 stagnants 7j+", timeframe: "30 jours", effort: "M" },
      ],
      coachingCategory: "commercial",
      color: "from-indigo-500 to-blue-600",
    }),
  },
  {
    id: "process.no_sequences",
    category: "process",
    match: (s) => s.openDeals >= 10 && s.sequencesEnrollments === 0,
    build: (s) => ({
      severity: "warning",
      title: "Sequences Sales Hub non déployées : outbound artisanal",
      painPoint: `Aucune enrollment dans Sales Hub Sequences. Les SDR/AE prospectent à la main, sans cadence ni A/B test. Productivité plafonnée et messages incohérents.`,
      currentState: `0 sequence enrollment, ${fmtN(s.openDeals)} deals ouverts sans outbound structuré`,
      impact: "Productivité outbound divisée par 2 vs équipe avec sequences. Reply rate 3-5% vs 8-15% avec sequences A/B testées.",
      actionPlan: [
        { step: 1, action: "Construire 3 sequences minimum : cold prospect (5-7 touches), follow-up (3 touches), re-engagement dormants", timeframe: "14 jours", effort: "M" },
        { step: 2, action: "Former les SDR à l'enrollment et au tracking reply rate", timeframe: "14 jours", effort: "S" },
        { step: 3, action: "A/B tester chaque sequence sur 100 enrollments avant de choisir la best-performing", timeframe: "30 jours", effort: "M" },
        { step: 4, action: "Reporting mensuel : sequences avec meilleur reply rate, standardisation équipe", timeframe: "60 jours", effort: "M" },
      ],
      coachingCategory: "commercial",
      color: "from-amber-500 to-orange-600",
    }),
  },

  // ═══════════════════════════════════════════════════════════════════
  // PERFORMANCES — VENTES
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "perf.ventes.closing_rate",
    category: "performances",
    subcategory: "ventes",
    match: (s) => s.wonDeals + s.lostDeals >= 10 && s.closingRate < 25,
    build: (s) => ({
      severity: "critical",
      title: "Taux de closing critique",
      painPoint: `Taux de closing actuel : ${s.closingRate}%. Le benchmark B2B se situe entre 25% et 35%. Signal de qualification laxiste, deals non-mûrs qui entrent en pipeline et finissent en lost.`,
      currentState: `${s.wonDeals} gagnés / ${s.wonDeals + s.lostDeals} clôturés = ${s.closingRate}%`,
      impact: `Manque-à-gagner estimé : ${Math.round((s.wonDeals + s.lostDeals) * 0.25 - s.wonDeals)} deals/an si vous montez à 25%. En ticket moyen, c'est ${Math.round(((s.wonDeals + s.lostDeals) * 0.25 - s.wonDeals) * (s.wonDeals > 0 ? s.wonAmount / s.wonDeals : 0)).toLocaleString("fr-FR")}€.`,
      actionPlan: [
        { step: 1, action: "Implémenter MEDDIC en checkpoint obligatoire entre stages Qualification → Proposition", timeframe: "30 jours", effort: "L" },
        { step: 2, action: "Disqualifier 30% des deals au stade Qualification pour nettoyer le pipeline", timeframe: "14 jours", effort: "M" },
        { step: 3, action: "Audit lost reasons structurés : catégoriser prix, concurrent, timing, no decision", timeframe: "30 jours", effort: "M" },
        { step: 4, action: "Playbook commercial documenté en 1 page : ICP, questions Discovery, gestion objections", timeframe: "60 jours", effort: "L" },
      ],
      coachingCategory: "commercial",
      color: "from-rose-500 to-pink-600",
    }),
  },
  {
    id: "perf.ventes.stagnant_deals",
    category: "performances",
    subcategory: "ventes",
    match: (s) => s.openDeals >= 5 && s.stagnantDeals > s.openDeals * 0.3,
    build: (s) => ({
      severity: "critical",
      title: `Stagnation massive : ${s.stagnantDeals} deals figés`,
      painPoint: `${pct(s.stagnantDeals, s.openDeals)}% du pipeline est stagnant (aucune activité depuis 7j+ et pas de next activity). C'est le signal d'une équipe sales débordée OU démotivée OU mal pilotée.`,
      currentState: `${s.stagnantDeals}/${s.openDeals} deals ouverts stagnants`,
      impact: "Forecast irréaliste qui explose au QBR. Ces deals finissent à 80% en lost selon les benchmarks.",
      actionPlan: [
        { step: 1, action: "War room dédiée 2h cette semaine : 1 décision par deal (relance avec plan OU lost)", timeframe: "Cette semaine", effort: "M" },
        { step: 2, action: "Workflow bloquant : interdiction de sauver un deal ouvert sans next_activity_date", timeframe: "14 jours", effort: "M" },
        { step: 3, action: "Rituel hebdo revue des stagnants (déjà dans Process)", timeframe: "Ongoing", effort: "S" },
        { step: 4, action: "Si >50 stagnants : escalade direction commerciale, c'est un problème de capacité", timeframe: "30 jours", effort: "M" },
      ],
      coachingCategory: "commercial",
      color: "from-rose-500 to-orange-600",
    }),
  },
  {
    id: "perf.ventes.forecast_blind",
    category: "performances",
    subcategory: "ventes",
    match: (s) => s.totalDeals >= 20 && pct(s.dealsNoAmount, s.totalDeals) > 30,
    build: (s) => ({
      severity: "warning",
      title: "Forecast aveugle : deals sans montant",
      painPoint: `${pct(s.dealsNoAmount, s.totalDeals)}% des deals (${fmtN(s.dealsNoAmount)}) n'ont aucun montant renseigné. Impossible de calculer la couverture pipeline, le forecast pondéré ou la vélocité.`,
      currentState: `${fmtN(s.dealsNoAmount)}/${fmtN(s.totalDeals)} deals sans amount`,
      impact: "Planification produit/finance impossible. Le board prend des décisions d'investissement aveugles.",
      actionPlan: [
        { step: 1, action: "Champ amount obligatoire dès le stage Qualification (avant Proposition)", timeframe: "7 jours", effort: "S" },
        { step: 2, action: "Workflow de validation : refus de progression vers Proposition si amount < 100€", timeframe: "14 jours", effort: "M" },
        { step: 3, action: "Sprint nettoyage rétroactif sur les deals open sans amount", timeframe: "30 jours", effort: "M" },
        { step: 4, action: "Forecast pondéré hebdo = amount × probability publié dans Slack/email", timeframe: "30 jours", effort: "M" },
      ],
      coachingCategory: "commercial",
      color: "from-orange-500 to-rose-600",
    }),
  },

  // ═══════════════════════════════════════════════════════════════════
  // PERFORMANCES — MARKETING
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "perf.marketing.lead_to_mql",
    category: "performances",
    subcategory: "marketing",
    match: (s) => {
      const lead = s.lifecycleByStage?.["lead"]?.count ?? 0;
      const mql = s.lifecycleByStage?.["marketingqualifiedlead"]?.count ?? 0;
      return lead >= 100 && (mql === 0 || mql < lead * 0.05);
    },
    build: (s) => {
      const lead = s.lifecycleByStage?.["lead"]?.count ?? 0;
      const mql = s.lifecycleByStage?.["marketingqualifiedlead"]?.count ?? 0;
      return {
        severity: "critical",
        title: "Funnel Lead → MQL cassé : leads qui dorment",
        painPoint: `${fmtN(lead)} leads en base mais seulement ${mql} MQL (${pct(mql, lead)}%). Le scoring marketing ne fonctionne pas — soit critères trop stricts, soit aucune automation de qualification active.`,
        currentState: `${pct(mql, lead)}% Lead → MQL (${fmtN(lead)} → ${mql})`,
        impact: `Si seulement 10% étaient nurturés en MQL, ça ferait +${fmtN(Math.round((lead - mql) * 0.1))} MQL = pipeline démultiplié.`,
        actionPlan: [
          { step: 1, action: "Audit du modèle de scoring : quels engagements (visites, opens, downloads) doivent faire passer en MQL ?", timeframe: "14 jours", effort: "M" },
          { step: 2, action: "Workflow auto qui change lifecyclestage = MQL dès franchissement du seuil de scoring", timeframe: "30 jours", effort: "M" },
          { step: 3, action: "Programme de nurturing scoring-based (content + trigger automation)", timeframe: "60 jours", effort: "L" },
          { step: 4, action: "Reporting hebdo : leads convertis en MQL, sources qui performent", timeframe: "30 jours", effort: "S" },
        ],
        coachingCategory: "marketing",
        color: "from-rose-500 to-orange-600",
      };
    },
  },
  {
    id: "perf.marketing.conversion_rate",
    category: "performances",
    subcategory: "marketing",
    match: (s) => s.totalContacts >= 50 && s.conversionRate < 15,
    build: (s) => ({
      severity: "warning",
      title: "Conversion Lead → Opportunité sous benchmark",
      painPoint: `Conversion actuelle : ${s.conversionRate}%. Le benchmark B2B SaaS se situe entre 25% et 40%. Funnel marketing qui perd la majorité de ses leads.`,
      currentState: `${fmtN(s.opportunitiesCount)} opps sur ${fmtN(s.totalContacts)} contacts = ${s.conversionRate}%`,
      impact: `Marge de progression : +${25 - s.conversionRate} points = +${fmtN(Math.round(s.totalContacts * 0.01 * (25 - s.conversionRate)))} opportunités potentielles à acquisition constante.`,
      actionPlan: [
        { step: 1, action: "Aligner marketing et sales sur la définition MQL/SQL (workshop 2h)", timeframe: "Cette semaine", effort: "S" },
        { step: 2, action: "Construire un programme de nurturing 3 séquences (TOFU, MOFU, BOFU)", timeframe: "30 jours", effort: "L" },
        { step: 3, action: "Lead scoring composite (engagement + firmographic) + handoff SDR auto", timeframe: "30 jours", effort: "M" },
        { step: 4, action: "Reporting mensuel : conversion par source pour ré-allouer budget acquisition", timeframe: "60 jours", effort: "M" },
      ],
      coachingCategory: "marketing",
      color: "from-amber-500 to-orange-600",
    }),
  },
  {
    id: "perf.marketing.no_campaigns",
    category: "performances",
    subcategory: "marketing",
    match: (s) => s.totalContacts >= 200 && s.marketingCampaignsCount < 3,
    build: (s) => ({
      severity: "warning",
      title: "Attribution marketing inexistante : ROI invisible",
      painPoint: `${s.marketingCampaignsCount} campagnes marketing trackées seulement. Sans tagging systématique, impossible de mesurer le ROI marketing par initiative (webinar, content, partenariat, ads).`,
      currentState: `${s.marketingCampaignsCount} campaigns HubSpot / ${fmtN(s.totalContacts)} contacts`,
      impact: "Budget marketing alloué à l'aveugle. Sur-investissement sur des canaux non-performants, sous-investissement sur les meilleurs.",
      actionPlan: [
        { step: 1, action: "Tagger TOUTES les actions marketing comme HubSpot Campaigns (ads, email, landing, events)", timeframe: "14 jours", effort: "M" },
        { step: 2, action: "UTM systématiques sur toutes les campagnes externes", timeframe: "Cette semaine", effort: "S" },
        { step: 3, action: "Dashboard mensuel : leads générés + deals créés + revenue par campagne", timeframe: "30 jours", effort: "M" },
        { step: 4, action: "Ré-allocation budget trimestrielle basée sur le ROI", timeframe: "60 jours", effort: "M" },
      ],
      coachingCategory: "marketing",
      color: "from-amber-500 to-fuchsia-600",
    }),
  },

  // ═══════════════════════════════════════════════════════════════════
  // PERFORMANCES — PAIEMENT & FACTURATION
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "perf.paiement.no_invoices",
    category: "performances",
    subcategory: "paiement",
    match: (s) => s.wonDeals >= 10 && s.totalInvoices === 0,
    build: (s) => ({
      severity: "critical",
      title: "Réconciliation deals ↔ factures impossible",
      painPoint: `${s.wonDeals} deals gagnés mais 0 facture HubSpot. Impossible de mesurer l'écart entre le forecast sales et le CA réellement encaissé (DSO, fuites revenue).`,
      currentState: `${s.wonDeals} deals gagnés, ${fmtN(Math.round(s.wonAmount))}€ cumulés, 0 invoice HubSpot`,
      impact: "Fuite revenue potentielle si deals won ne sont pas facturés dans les 30j. Cash flow imprévisible.",
      actionPlan: [
        { step: 1, action: "Activer HubSpot Invoices (inclus dans Sales Hub) OU connecter Stripe/Pennylane", timeframe: "14 jours", effort: "M" },
        { step: 2, action: "Workflow auto : émission invoice dès deal closed-won", timeframe: "30 jours", effort: "M" },
        { step: 3, action: "Dashboard réconciliation : deals won / invoices émises / invoices payées", timeframe: "30 jours", effort: "M" },
        { step: 4, action: "Audit mensuel des écarts > 7 jours deal → invoice", timeframe: "Ongoing", effort: "S" },
      ],
      coachingCategory: "cross-source",
      color: "from-rose-500 to-amber-600",
    }),
  },
  {
    id: "perf.paiement.unpaid",
    category: "performances",
    subcategory: "paiement",
    match: (s) => s.unpaidInvoices > 0,
    build: (s) => ({
      severity: s.unpaidInvoices >= 5 ? "critical" : "warning",
      title: `${s.unpaidInvoices} factures impayées à recouvrer`,
      painPoint: `${s.unpaidInvoices} factures en statut open/uncollectible. Cash bloqué, DSO dégradé, impact direct sur la trésorerie.`,
      currentState: `${s.unpaidInvoices} impayées / ${s.paidInvoices + s.unpaidInvoices} total`,
      impact: "Impact cash flow direct. Chaque jour de retard = coût de portage financier.",
      actionPlan: [
        { step: 1, action: "Workflow de relance auto : J+30 email, J+45 email + appel, J+60 escalade", timeframe: "14 jours", effort: "M" },
        { step: 2, action: "Dashboard recouvrement : impayés par ancienneté (30-60-90j)", timeframe: "7 jours", effort: "S" },
        { step: 3, action: "Responsable recouvrement désigné (CSM ou admin finance)", timeframe: "Cette semaine", effort: "S" },
        { step: 4, action: "Process legal : mise en demeure > 90j, recouvrement externe > 120j", timeframe: "60 jours", effort: "M" },
      ],
      coachingCategory: "cross-source",
      color: "from-rose-500 to-pink-600",
    }),
  },
  {
    id: "perf.paiement.no_subs",
    category: "performances",
    subcategory: "paiement",
    match: (s) => s.wonDeals >= 10 && s.totalSubscriptions === 0,
    build: (s) => ({
      severity: "warning",
      title: "Subscriptions non trackées : MRR/ARR invisible",
      painPoint: `${s.wonDeals} deals gagnés mais 0 subscription HubSpot. Si votre modèle est SaaS récurrent, vous pilotez aveugle sur MRR/ARR/NRR.`,
      currentState: `0 subscription / ${s.wonDeals} deals gagnés`,
      impact: "Impossible de piloter un SaaS sans MRR. Valorisation x5-10 réduite sans métriques SaaS claires.",
      actionPlan: [
        { step: 1, action: "Activer HubSpot Subscriptions ou connecter Stripe Subscriptions", timeframe: "14 jours", effort: "M" },
        { step: 2, action: "Workflow auto : création subscription à partir du deal won", timeframe: "30 jours", effort: "M" },
        { step: 3, action: "Dashboard MRR/ARR/churn rate/NRR dans HubSpot", timeframe: "30 jours", effort: "L" },
        { step: 4, action: "Reporting mensuel MRR au board avec évolution cohort", timeframe: "60 jours", effort: "M" },
      ],
      coachingCategory: "cross-source",
      color: "from-amber-500 to-fuchsia-600",
    }),
  },

  // ═══════════════════════════════════════════════════════════════════
  // PERFORMANCES — SERVICE CLIENT
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "perf.service.no_tickets",
    category: "performances",
    subcategory: "service_client",
    match: (s) => s.totalContacts >= 500 && s.totalTickets === 0,
    build: (s) => ({
      severity: "warning",
      title: "Service client invisible : pas de tickets trackés",
      painPoint: `${fmtN(s.totalContacts)} contacts mais 0 ticket HubSpot. Si vous avez des clients, ils ont des demandes. Soit vous perdez ces demandes, soit vous les traitez ailleurs sans visibilité.`,
      currentState: `0 ticket HubSpot / ${fmtN(s.totalContacts)} contacts`,
      impact: "Aucune visibilité sur les problèmes clients. Churn silencieux non détecté. CSAT non mesurable.",
      actionPlan: [
        { step: 1, action: "Activer HubSpot Service Hub (inclus jusqu'au Pro) OU connecter Zendesk/Intercom", timeframe: "14 jours", effort: "M" },
        { step: 2, action: "Configurer les pipelines tickets (Open → In Progress → Waiting → Closed)", timeframe: "14 jours", effort: "M" },
        { step: 3, action: "Workflow SLA : réponse sous 4h, résolution sous 24h (selon plan client)", timeframe: "30 jours", effort: "M" },
        { step: 4, action: "Survey CSAT post-ticket automatique", timeframe: "60 jours", effort: "M" },
      ],
      coachingCategory: "commercial",
      color: "from-amber-500 to-fuchsia-600",
    }),
  },
  {
    id: "perf.service.no_feedback",
    category: "performances",
    subcategory: "service_client",
    match: (s) => s.totalTickets >= 30 && s.feedbackCount === 0,
    build: (s) => ({
      severity: "warning",
      title: "0 feedback (CSAT/NPS) sur tickets existants",
      painPoint: `${s.totalTickets} tickets ouverts mais 0 feedback collecté. Impossible de détecter les détracteurs avant qu'ils churnent.`,
      currentState: `${s.totalTickets} tickets, 0 feedback`,
      impact: "Churn inéluctable sur les détracteurs non identifiés. Voice of customer absent des décisions produit.",
      actionPlan: [
        { step: 1, action: "Enquête CSAT post-ticket automatique (1 question : 1-5 + commentaire)", timeframe: "14 jours", effort: "M" },
        { step: 2, action: "NPS trimestriel sur la base customer active", timeframe: "30 jours", effort: "M" },
        { step: 3, action: "Workflow alerte CSM si CSAT ≤ 2 sur un compte", timeframe: "30 jours", effort: "M" },
        { step: 4, action: "Dashboard CSAT/NPS/sentiment avec segmentation par account tier", timeframe: "60 jours", effort: "L" },
      ],
      coachingCategory: "commercial",
      color: "from-fuchsia-500 to-rose-600",
    }),
  },
  {
    id: "perf.service.renewal_process",
    category: "performances",
    subcategory: "service_client",
    match: (s) => s.activeSubscriptions >= 20,
    build: (s) => ({
      severity: "info",
      title: "Process de renouvellement à formaliser",
      painPoint: `${s.activeSubscriptions} subscriptions actives. Sans process formalisé de renouvellement, les contrats sont renouvelés en dernière minute (ou perdus).`,
      currentState: `${s.activeSubscriptions} subscriptions actives`,
      impact: "Retention -5 à -10 pts sans process. Chaque point de churn = valorisation divisée sur SaaS.",
      actionPlan: [
        { step: 1, action: "Workflow d'alerte CSM à J-90 avant échéance contrat", timeframe: "14 jours", effort: "M" },
        { step: 2, action: "Business review obligatoire à J-60 avec le customer", timeframe: "30 jours", effort: "M" },
        { step: 3, action: "Checklist de signature à J-30 (proposal de renewal + négociation)", timeframe: "30 jours", effort: "M" },
        { step: 4, action: "Score santé compte composite : usage + NPS + tickets + payment", timeframe: "90 jours", effort: "L" },
      ],
      coachingCategory: "commercial",
      color: "from-emerald-500 to-fuchsia-600",
    }),
  },

  // ═══════════════════════════════════════════════════════════════════
  // ADOPTION
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "adoption.low_owners",
    category: "adoption",
    match: (s) => s.ownersCount < 3 && s.totalContacts >= 100,
    build: (s) => ({
      severity: "warning",
      title: "Équipe HubSpot sous-dimensionnée",
      painPoint: `${s.ownersCount} owners actifs sur ${fmtN(s.totalContacts)} contacts. Soit l'équipe est vraiment petite, soit HubSpot n'est utilisé que par quelques-uns (adoption faible).`,
      currentState: `${s.ownersCount} owners / ${fmtN(s.totalContacts)} contacts`,
      impact: "Adoption faible = CRM qui devient shadow IT. Data incomplète car beaucoup tracker hors HubSpot.",
      actionPlan: [
        { step: 1, action: "Audit : qui devrait être dans HubSpot mais ne l'est pas ?", timeframe: "Cette semaine", effort: "S" },
        { step: 2, action: "Formation onboarding de 1h pour chaque nouveau user HubSpot", timeframe: "14 jours", effort: "M" },
        { step: 3, action: "Champion HubSpot par équipe pour support peer-to-peer", timeframe: "30 jours", effort: "M" },
        { step: 4, action: "Dashboard adoption : login users, actions par user, usage features", timeframe: "60 jours", effort: "M" },
      ],
      coachingCategory: "integration",
      color: "from-amber-500 to-violet-600",
    }),
  },
  {
    id: "adoption.custom_objects",
    category: "adoption",
    match: (s) => s.customObjectsCount >= 5,
    build: (s) => ({
      severity: "info",
      title: `${s.customObjectsCount} custom objects : gouvernance critique`,
      painPoint: `${s.customObjectsCount} custom schemas HubSpot. Sans gouvernance, les data models custom deviennent une dette technique ingérable en 6-12 mois.`,
      currentState: `${s.customObjectsCount} custom objects déployés`,
      impact: "Impossibilité d'évoluer le modèle data sans tout casser. Rapports qui cessent de fonctionner silencieusement.",
      actionPlan: [
        { step: 1, action: "Audit trimestriel : quels custom objects sont utilisés, par qui, pour quoi", timeframe: "30 jours", effort: "M" },
        { step: 2, action: "Documentation Notion centralisée : schéma, owner, règles", timeframe: "30 jours", effort: "M" },
        { step: 3, action: "Process strict d'ajout (validation RevOps avant création)", timeframe: "14 jours", effort: "S" },
        { step: 4, action: "Archiver les custom objects inutilisés (>90j sans update)", timeframe: "60 jours", effort: "M" },
      ],
      coachingCategory: "data-model",
      color: "from-violet-500 to-fuchsia-600",
    }),
  },
  {
    id: "adoption.low_workflows",
    category: "adoption",
    match: (s) => s.workflowsActiveCount >= 10,
    build: (s) => ({
      severity: "info",
      title: `${s.workflowsActiveCount} workflows actifs — audit gouvernance`,
      painPoint: `Volume élevé de workflows actifs. Sans audit régulier, risque de doublons, conflits, actions opposées qui s'annulent silencieusement.`,
      currentState: `${s.workflowsActiveCount}/${s.workflowsCount} workflows actifs`,
      impact: "Comportements CRM imprévisibles. Un workflow qui réassigne contre un autre workflow = data chaos.",
      actionPlan: [
        { step: 1, action: "Audit trimestriel : lister chaque workflow, son trigger, son action, son owner", timeframe: "30 jours", effort: "M" },
        { step: 2, action: "Documentation Notion : chaîne critique de workflows business-critical", timeframe: "30 jours", effort: "M" },
        { step: 3, action: "Désactiver les obsolètes (>90j sans modification et 0 enrollment)", timeframe: "14 jours", effort: "S" },
        { step: 4, action: "Process strict : tout nouveau workflow doit être reviewé par RevOps", timeframe: "Ongoing", effort: "S" },
      ],
      coachingCategory: "integration",
      color: "from-violet-500 to-blue-600",
    }),
  },
  {
    id: "adoption.no_pipelines",
    category: "adoption",
    match: (s) => s.pipelines.length === 1 && s.totalDeals >= 100,
    build: (s) => ({
      severity: "info",
      title: "1 seul pipeline pour tous les deals — à segmenter",
      painPoint: `${fmtN(s.totalDeals)} deals dans 1 seul pipeline. À ce volume, plusieurs pipelines spécialisés (New Business / Renewal / Upsell / Partner) facilitent le pilotage et le forecast.`,
      currentState: `1 pipeline, ${fmtN(s.totalDeals)} deals`,
      impact: "Mixer new business + renewal + upsell dans le même pipeline fausse les KPIs (cycles différents, probabilités différentes).",
      actionPlan: [
        { step: 1, action: "Identifier les types de deals (new / renewal / upsell / partner)", timeframe: "Cette semaine", effort: "S" },
        { step: 2, action: "Créer 3 pipelines dédiés avec stages adaptés à chaque cycle", timeframe: "30 jours", effort: "M" },
        { step: 3, action: "Migration des deals existants par type", timeframe: "30 jours", effort: "M" },
        { step: 4, action: "Reporting par pipeline dans /dashboard/alertes (déjà dispo)", timeframe: "Ongoing", effort: "S" },
      ],
      coachingCategory: "data-model",
      color: "from-violet-500 to-fuchsia-600",
    }),
  },
];

// ────────────────────────────────────────────────────────────────────────────
// RUNNER
// ────────────────────────────────────────────────────────────────────────────

export type AuditRecommendations = {
  donnees: Recommendation[];
  process: Recommendation[];
  performances: Recommendation[]; // toutes sous-catégories combinées
  adoption: Recommendation[];
};

export function buildAuditRecommendations(snapshot: HubSpotSnapshot): AuditRecommendations {
  const result: AuditRecommendations = {
    donnees: [],
    process: [],
    performances: [],
    adoption: [],
  };

  for (const factory of FACTORIES) {
    try {
      if (!factory.match(snapshot)) continue;
      const built = factory.build(snapshot);
      const reco: Recommendation = {
        id: factory.id,
        category: factory.category,
        subcategory: factory.subcategory,
        ...built,
      };
      result[factory.category].push(reco);
    } catch {
      // Une factory défaillante ne casse pas le runner
    }
  }

  return result;
}

export const SUBCATEGORY_LABELS: Record<RecoSubcategory, { label: string; emoji: string; gradient: string }> = {
  ventes: { label: "Ventes", emoji: "💼", gradient: "from-blue-500 to-indigo-600" },
  marketing: { label: "Marketing", emoji: "📣", gradient: "from-amber-500 to-orange-600" },
  paiement: { label: "Paiement & Facturation", emoji: "💰", gradient: "from-emerald-500 to-teal-600" },
  service_client: { label: "Service Client", emoji: "🎧", gradient: "from-fuchsia-500 to-pink-600" },
};

export const SEVERITY_LABELS: Record<Severity, { label: string; bg: string; text: string }> = {
  critical: { label: "Critique", bg: "bg-rose-100", text: "text-rose-700" },
  warning: { label: "Important", bg: "bg-amber-100", text: "text-amber-700" },
  info: { label: "Amélioration", bg: "bg-blue-100", text: "text-blue-700" },
};

export const EFFORT_LABELS: Record<Effort, { label: string; bg: string }> = {
  S: { label: "Small (<2h)", bg: "bg-emerald-100 text-emerald-700" },
  M: { label: "Medium (1 sprint)", bg: "bg-amber-100 text-amber-700" },
  L: { label: "Large (>1 sprint)", bg: "bg-rose-100 text-rose-700" },
};
