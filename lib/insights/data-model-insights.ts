/**
 * Data Model Insights — context-aware recommendations for the best possible
 * entity resolution configuration based on the tools actually connected.
 *
 * Revold knows what's connected (integrations table + HubSpot token). From
 * that, it can recommend EXACTLY which matching rules to enable, which fields
 * to map, and where the gaps are.
 */

export type DataModelInsight = {
  id: string;
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  body: string;
  recommendation: string;
  category: "matching" | "field_mapping" | "data_quality" | "missing_tool";
};

type ConnectedTool = {
  provider: string;
  isActive: boolean;
};

/** Subset of DetectedIntegration from HubSpot — tools installed on the CRM */
type HubSpotDetectedTool = {
  key: string;
  label: string;
  totalProperties: number;
  enrichmentRate: number;
  distinctUsers: number;
  enrichedRecords: number;
};

type DataModelContext = {
  connectedTools: ConnectedTool[];        // tools connected directly to Revold
  hubSpotDetectedTools: HubSpotDetectedTool[];  // tools detected on HubSpot
  hasHubSpot: boolean;
  contactsCount: number;
  companiesCount: number;
  sourceLinksCount: number;
  contactsWithCompany: number;
  invoicesCount: number;
  subscriptionsCount: number;
  ticketsCount: number;
};

const BILLING_TOOLS = ["stripe", "pennylane", "sellsy", "axonaut", "quickbooks"];
const CRM_TOOLS = ["salesforce", "pipedrive", "zoho", "monday"];
const SUPPORT_TOOLS = ["intercom", "zendesk", "crisp", "freshdesk"];
const FRENCH_BILLING = ["pennylane", "sellsy", "axonaut"];
const CALLING_TOOLS = ["aircall", "ringover"];
const PROSPECTION_TOOLS = ["kaspr", "dropcontact", "lusha", "lemlist", "linkedin_sales_nav"];
const ESIGN_TOOLS = ["pandadoc"];
const AUTOMATION_TOOLS = ["zapier", "make", "n8n", "mailchimp", "brevo", "activecampaign"];

const TOOL_CATEGORY_LABEL: Record<string, string> = {
  billing: "Facturation / ERP",
  calling: "Téléphonie",
  prospection: "Prospection / Enrichissement",
  esign: "Signature électronique",
  automation: "Automatisation / Marketing",
  support: "Service client",
  crm: "CRM",
};

function getToolCategory(key: string): string | null {
  if (BILLING_TOOLS.includes(key)) return "billing";
  if (CALLING_TOOLS.includes(key)) return "calling";
  if (PROSPECTION_TOOLS.includes(key)) return "prospection";
  if (ESIGN_TOOLS.includes(key)) return "esign";
  if (AUTOMATION_TOOLS.includes(key)) return "automation";
  if (SUPPORT_TOOLS.includes(key)) return "support";
  if (CRM_TOOLS.includes(key)) return "crm";
  return null;
}

export function generateDataModelInsights(ctx: DataModelContext): DataModelInsight[] {
  const insights: DataModelInsight[] = [];
  const activeProviders = new Set(
    ctx.connectedTools.filter((t) => t.isActive).map((t) => t.provider),
  );

  const hasBilling = BILLING_TOOLS.some((t) => activeProviders.has(t));
  const hasFrenchBilling = FRENCH_BILLING.some((t) => activeProviders.has(t));
  const hasExternalCrm = CRM_TOOLS.some((t) => activeProviders.has(t));
  const hasSupport = SUPPORT_TOOLS.some((t) => activeProviders.has(t));
  const billingNames = BILLING_TOOLS.filter((t) => activeProviders.has(t));
  const crmNames = CRM_TOOLS.filter((t) => activeProviders.has(t));
  const supportNames = SUPPORT_TOOLS.filter((t) => activeProviders.has(t));

  // ── Phase 1 : Audit CRM — what's already installed on HubSpot? ──
  // Before recommending anything, scan HubSpot for tools that are ALREADY
  // communicating (or failing to communicate) with the CRM. This tells us
  // what the user's stack looks like BEFORE Revold enters the picture.

  const revoldProviders = activeProviders;
  const hsTools = ctx.hubSpotDetectedTools;

  // Group HubSpot-detected tools by category
  const hsByCat = new Map<string, HubSpotDetectedTool[]>();
  for (const t of hsTools) {
    const cat = getToolCategory(t.key);
    if (!cat) continue;
    if (!hsByCat.has(cat)) hsByCat.set(cat, []);
    hsByCat.get(cat)!.push(t);
  }

  // For each tool on HubSpot, check if also connected to Revold
  for (const t of hsTools) {
    const cat = getToolCategory(t.key);
    if (!cat) continue;
    const catLabel = TOOL_CATEGORY_LABEL[cat] || cat;
    const isOnRevold = revoldProviders.has(t.key);

    if (!isOnRevold) {
      // Tool on HubSpot but NOT on Revold → recommend connecting to Revold
      if (t.enrichmentRate > 0 || t.distinctUsers > 0) {
        insights.push({
          id: `dm_audit_connect_${t.key}`,
          severity: "warning",
          title: `${t.label} est connecté à HubSpot mais pas à Revold`,
          body: `${t.label} (${catLabel}) communique déjà avec HubSpot : ${t.totalProperties} propriétés, ${t.enrichmentRate}% d'enrichissement, ${t.distinctUsers} utilisateur${t.distinctUsers > 1 ? "s" : ""}. Mais sans connexion directe à Revold, les données restent cloisonnées dans HubSpot — vous ne bénéficiez pas des rapports cross-source ni des insights IA croisés.`,
          recommendation: `Connectez ${t.label} directement à Revold depuis la page Intégration. Revold pourra alors croiser ces données avec les autres outils (billing, support, CRM) pour générer des insights impossibles autrement.`,
          category: "missing_tool",
        });
      } else {
        // Tool detected on HubSpot but 0 enrichment → communication broken
        insights.push({
          id: `dm_audit_broken_${t.key}`,
          severity: "critical",
          title: `${t.label} est installé sur HubSpot mais ne communique PAS`,
          body: `${t.label} (${catLabel}) a ${t.totalProperties} propriétés installées dans HubSpot mais 0% d'enrichissement — aucune donnée ne transite. L'intégration HubSpot ↔ ${t.label} est probablement mal configurée ou désactivée.`,
          recommendation: `Vérifiez la configuration de ${t.label} dans HubSpot Settings → Connected Apps. Si l'intégration HubSpot est cassée, connectez ${t.label} directement à Revold comme alternative — Revold récupérera les données via l'API ${t.label} sans dépendre de HubSpot.`,
          category: "data_quality",
        });
      }
    } else {
      // Tool on BOTH HubSpot and Revold → check if communication is optimal
      if (t.enrichmentRate < 20 && t.totalProperties > 0) {
        insights.push({
          id: `dm_audit_low_enrichment_${t.key}`,
          severity: "warning",
          title: `${t.label} : taux d'enrichissement faible (${t.enrichmentRate}%) malgré la double connexion`,
          body: `${t.label} est connecté à HubSpot ET à Revold, mais seulement ${t.enrichmentRate}% des enregistrements ont des données ${t.label} renseignées. Les rapports et insights basés sur ${t.label} seront incomplets.`,
          recommendation: `Vérifiez que les commerciaux utilisent activement ${t.label} et que la synchronisation HubSpot ↔ ${t.label} est bien bidirectionnelle. L'objectif est d'atteindre au moins 50% d'enrichissement pour que les insights soient fiables.`,
          category: "data_quality",
        });
      } else if (t.enrichmentRate >= 50) {
        insights.push({
          id: `dm_audit_good_${t.key}`,
          severity: "success",
          title: `${t.label} communique bien : ${t.enrichmentRate}% d'enrichissement`,
          body: `${t.label} (${catLabel}) est connecté aux deux niveaux (HubSpot + Revold) avec un bon taux d'enrichissement. Les données circulent correctement pour alimenter les rapports cross-source.`,
          recommendation: `Maintenir cette intégration. Vérifiez régulièrement que le taux d'enrichissement reste au-dessus de 50%.`,
          category: "data_quality",
        });
      }
    }
  }

  // Category-level gaps — check if entire categories are missing from HubSpot
  const hsCategories = new Set(Array.from(hsByCat.keys()));

  if (!hsCategories.has("billing")) {
    insights.push({
      id: "dm_audit_no_billing_on_crm",
      severity: "critical",
      title: "Aucun outil de facturation détecté sur HubSpot ni sur Revold",
      body: "Ni HubSpot ni Revold n'a de connexion avec un outil de facturation (Stripe, Pennylane, Sellsy, Axonaut, QuickBooks). Impossible de réconcilier le pipeline commercial avec le cash réellement encaissé. Le forecast restera théorique.",
      recommendation: "Connectez votre outil de facturation à Revold (page Intégration). Même si HubSpot n'a pas d'intégration native avec votre ERP, Revold peut s'y connecter directement via API.",
      category: "missing_tool",
    });
  }

  if (!hsCategories.has("calling") && !hsCategories.has("prospection")) {
    insights.push({
      id: "dm_audit_no_outbound",
      severity: "info",
      title: "Aucun outil de téléphonie ou prospection détecté",
      body: "Sans Aircall, Ringover, Kaspr, Lemlist ou Dropcontact connecté, Revold ne peut pas mesurer l'activité outbound ni le ROI des campagnes de prospection.",
      recommendation: "Si votre équipe utilise un outil de téléphonie ou de prospection, connectez-le à HubSpot ou directement à Revold.",
      category: "missing_tool",
    });
  }

  // ── Phase 2 : Matching strategy recommendations ──

  if (ctx.hasHubSpot && hasBilling) {
    if (hasFrenchBilling) {
      insights.push({
        id: "dm_siren_priority",
        severity: "critical",
        title: "Activez le match SIREN entre HubSpot et " + billingNames.join(" / "),
        body: `Vous avez un CRM (HubSpot) et un outil de facturation français (${billingNames.join(", ")}) connectés. Le SIREN est le meilleur identifiant pour rapprocher les entreprises entre les deux — il est unique, permanent et présent nativement dans les outils comptables FR.`,
        recommendation: "Créez un champ custom 'siren' sur les companies HubSpot et configurez le mapping dans les identifiants uniques ci-dessous. Pennylane/Sellsy/Axonaut ont le SIREN en natif — Revold peut le remonter automatiquement.",
        category: "matching",
      });
    }

    insights.push({
      id: "dm_external_id_billing",
      severity: "warning",
      title: `Mappez les customer_id ${billingNames.join(" / ")} dans HubSpot`,
      body: `Chaque client dans ${billingNames.join(" / ")} a un identifiant unique (customer_id, client_id). Si ce champ est stocké dans HubSpot, Revold fait un match déterministe 1:1 au lieu de chercher par email (qui peut être facturation@ au lieu du signataire).`,
      recommendation: `Créez un champ custom HubSpot par outil (ex: stripe_customer_id, pennylane_client_id) et activez le "Remplissage automatique" dans les règles ci-dessous — Revold écrira l'ID après le premier match réussi.`,
      category: "field_mapping",
    });

    insights.push({
      id: "dm_email_billing_warning",
      severity: "warning",
      title: "Attention au match email entre CRM et facturation",
      body: "L'email de facturation (comptabilite@, admin@) n'est souvent PAS celui du contact commercial (jean.dupont@). Un match email seul entre HubSpot et Stripe/Pennylane crée des faux positifs.",
      recommendation: "Passez le mode \"Match CRM ↔ Billing\" sur \"Email + SIREN\" ou \"Email + ID client externe\" dans la règle email ci-dessous.",
      category: "matching",
    });
  }

  if (ctx.hasHubSpot && hasExternalCrm) {
    insights.push({
      id: "dm_multi_crm",
      severity: "critical",
      title: `Plusieurs CRM détectés : HubSpot + ${crmNames.join(" + ")}`,
      body: "Avoir deux CRM connectés simultanément crée un risque élevé de doublons : le même contact/deal peut exister dans les deux. Il faut désigner un CRM principal comme source de vérité pour les contacts, deals et companies.",
      recommendation: `Choisissez HubSpot OU ${crmNames[0]} comme CRM principal dans la matrice de priorité ci-dessous. L'autre devient une source secondaire en lecture seule. Les deals ne doivent être gérés que dans un seul CRM.`,
      category: "matching",
    });
  }

  if (ctx.hasHubSpot && hasSupport) {
    insights.push({
      id: "dm_support_email",
      severity: "info",
      title: `Match CRM ↔ ${supportNames.join(" / ")} par email : fiable ici`,
      body: `Contrairement au billing, le match email entre HubSpot et ${supportNames.join(" / ")} est fiable car c'est le contact lui-même qui crée le ticket (avec son email professionnel). Pas besoin de SIREN ici.`,
      recommendation: "Gardez le mode \"Email exact\" pour le match CRM ↔ Support. Activez le mapping de l'ID externe (zendesk_user_id, intercom_contact_id) pour accélérer les syncs suivants.",
      category: "matching",
    });
  }

  if (ctx.hasHubSpot && hasBilling && hasSupport) {
    insights.push({
      id: "dm_triangle_complete",
      severity: "success",
      title: "Triangle CRM + Billing + Support complet — data model optimal",
      body: `Vous avez les 3 briques critiques connectées : CRM (HubSpot${hasExternalCrm ? " + " + crmNames.join(", ") : ""}), Billing (${billingNames.join(", ")}), Support (${supportNames.join(", ")}). Revold peut croiser toutes les données : attribution → revenue → rétention.`,
      recommendation: "Vérifiez que les règles SIREN + ID client externe + email sont bien configurées ci-dessous pour que le triangle fonctionne à 100%.",
      category: "matching",
    });
  }

  // ── Missing tools ──

  if (!hasBilling) {
    insights.push({
      id: "dm_no_billing",
      severity: "critical",
      title: "Aucun outil de facturation connecté",
      body: "Sans Stripe, Pennylane, Sellsy ou QuickBooks, Revold ne peut pas calculer le MRR/ARR réel, détecter les fuites revenue (deals gagnés sans facture) ni réconcilier le forecast avec le cash encaissé.",
      recommendation: "Connectez votre outil de facturation depuis la page Intégration → Outils à connecter à Revold.",
      category: "missing_tool",
    });
  }

  if (!hasSupport) {
    insights.push({
      id: "dm_no_support",
      severity: "warning",
      title: "Aucun outil de support connecté",
      body: "Sans Zendesk, Intercom ou Freshdesk, Revold ne peut pas corréler les tickets support avec le risque de churn ni calculer le NRR basé sur la satisfaction client.",
      recommendation: "Connectez votre outil de support pour débloquer les insights churn et la page Performance Service Client.",
      category: "missing_tool",
    });
  }

  // ── Data quality ──

  if (ctx.contactsCount > 0 && ctx.sourceLinksCount === 0) {
    insights.push({
      id: "dm_no_source_links",
      severity: "critical",
      title: "Aucun lien source créé — les outils ne communiquent pas encore",
      body: `Vous avez ${ctx.contactsCount.toLocaleString("fr-FR")} contacts mais 0 lien source (source_links). Cela signifie qu'aucune synchronisation multi-outils n'a encore été exécutée — HubSpot, Stripe, Zendesk etc. restent des silos.`,
      recommendation: "Lancez une première synchronisation depuis la page Intégration (bouton Synchroniser), puis vérifiez que les liens sources se créent dans les stats ci-dessous.",
      category: "data_quality",
    });
  }

  if (ctx.contactsCount > 0 && ctx.sourceLinksCount > 0) {
    const linkRatio = Math.round((ctx.sourceLinksCount / ctx.contactsCount) * 100);
    if (linkRatio < 50) {
      insights.push({
        id: "dm_low_link_ratio",
        severity: "warning",
        title: `Seulement ${linkRatio}% de couverture source_links`,
        body: `${ctx.sourceLinksCount} liens sources pour ${ctx.contactsCount.toLocaleString("fr-FR")} contacts — plus de la moitié de vos contacts n'ont pas de correspondance dans les outils connectés. Les insights cross-source seront incomplets.`,
        recommendation: "Vérifiez que les règles de résolution sont bien activées (SIREN + email + ID client). Lancez une re-synchronisation complète pour tenter de matcher les contacts restants.",
        category: "data_quality",
      });
    } else if (linkRatio >= 80) {
      insights.push({
        id: "dm_good_link_ratio",
        severity: "success",
        title: `Excellente couverture : ${linkRatio}% des contacts ont un lien source`,
        body: `${ctx.sourceLinksCount} liens sources pour ${ctx.contactsCount.toLocaleString("fr-FR")} contacts — votre data model est bien connecté. Les insights cross-source bénéficient d'une base solide.`,
        recommendation: "Continuez à enrichir les champs SIREN et customer_id pour maintenir ce taux au-dessus de 80%.",
        category: "data_quality",
      });
    }
  }

  const orphanRate = ctx.contactsCount > 0
    ? Math.round(((ctx.contactsCount - ctx.contactsWithCompany) / ctx.contactsCount) * 100)
    : 0;
  if (orphanRate > 30 && ctx.contactsCount > 10) {
    insights.push({
      id: "dm_orphan_contacts",
      severity: "warning",
      title: `${orphanRate}% de contacts sans entreprise associée`,
      body: `${ctx.contactsCount - ctx.contactsWithCompany} contacts sur ${ctx.contactsCount.toLocaleString("fr-FR")} n'ont pas de company_id. Le rapprochement par SIREN et domaine ne peut pas fonctionner sans cette association.`,
      recommendation: "Activez un workflow HubSpot d'association automatique contact → company par domaine email, ou lancez un enrichissement via Kaspr/Dropcontact.",
      category: "data_quality",
    });
  }

  if (hasBilling && ctx.invoicesCount === 0 && ctx.subscriptionsCount === 0) {
    insights.push({
      id: "dm_billing_empty",
      severity: "warning",
      title: `${billingNames.join(" / ")} connecté mais 0 facture synchronisée`,
      body: "L'outil de facturation est connecté mais aucune donnée n'a été importée dans les tables canoniques. Les rapports revenue et les insights cross-source sont vides.",
      recommendation: "Lancez la synchronisation depuis la page Intégration ou vérifiez que les identifiants de connexion sont corrects dans Paramètres → Intégrations.",
      category: "data_quality",
    });
  }

  if (hasSupport && ctx.ticketsCount === 0) {
    insights.push({
      id: "dm_support_empty",
      severity: "info",
      title: `${supportNames.join(" / ")} connecté mais 0 ticket synchronisé`,
      body: "L'outil de support est connecté mais aucun ticket n'a été importé. La page Performance Service Client et les insights churn ne fonctionneront pas.",
      recommendation: "Lancez la synchronisation depuis la page Intégration.",
      category: "data_quality",
    });
  }

  return insights;
}
