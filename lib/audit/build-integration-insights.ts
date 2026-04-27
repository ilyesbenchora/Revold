/**
 * Pure function : génère les insights d'intégration à partir des
 * DetectedIntegration. Sans aucun appel HubSpot live.
 *
 * Utilisé par les pages cache-first (dashboard root, etc.) qui ont déjà
 * récupéré detectedIntegrations via getDetectedIntegrations() (cached).
 *
 * Logique extraite de fetchIntegrationInsights pour pouvoir l'appeler
 * sans le fetch live des intégrations.
 */

import type { DetectedIntegration } from "@/lib/integrations/detect-integrations";
import { getToolCategory } from "@/lib/reports/report-suggestions";

export type IntInsight = {
  key: string;
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  recommendation: string;
};

export function buildIntegrationInsights(
  detectedIntegrations: DetectedIntegration[],
): IntInsight[] {
  const integrationInsights: IntInsight[] = [];

  for (const int of detectedIntegrations) {
    const cat = getToolCategory(int.key);

    // 1. Adoption faible
    if (int.distinctUsers > 0 && int.distinctUsers < 2) {
      integrationInsights.push({
        key: `int_low_adoption_${int.key}`,
        severity: "warning",
        title: `${int.icon} ${int.label} : adoption très faible (${int.distinctUsers} utilisateur)`,
        body: `Seul ${int.distinctUsers} utilisateur exploite ${int.label} alors que l'outil est connecté au CRM.`,
        recommendation: `Identifier un référent ${int.label}, organiser une session de formation et suivre l'usage hebdomadaire dans Revold.`,
      });
    }

    // 2. Outil branché sans usage
    if (int.totalProperties > 0 && int.enrichmentRate === 0) {
      integrationInsights.push({
        key: `int_no_enrichment_${int.key}`,
        severity: "warning",
        title: `${int.icon} ${int.label} : ${int.totalProperties} propriétés synchronisées mais 0% d'enrichissement`,
        body: `${int.label} a installé ses propriétés dans HubSpot mais aucune donnée n'est remontée.`,
        recommendation: `Vérifier la configuration de l'intégration ${int.label} et relancer une formation.`,
      });
    }

    // 3. Outil sans propriétés (source-only)
    if (int.totalProperties === 0 && int.detectionMethods.includes("source_detail")) {
      integrationInsights.push({
        key: `int_source_only_${int.key}`,
        severity: "info",
        title: `${int.icon} ${int.label} : ${int.enrichedRecords.toLocaleString("fr-FR")} enregistrements sans propriétés`,
        body: `${int.label} alimente votre CRM mais aucune propriété personnalisée n'est synchronisée.`,
        recommendation: `Installer la version officielle de l'app ${int.label} sur le marketplace HubSpot.`,
      });
    }

    // 4. Suggestions par catégorie
    const categoryInsights: Record<string, { title: string; body: string; recommendation: string }> = {
      outbound: {
        title: `📈 Activer le rapport « Outbound → Deals gagnés » pour ${int.label}`,
        body: `${int.label} est un outil de prospection. Revold peut croiser séquences envoyées avec opportunités créées et deals gagnés.`,
        recommendation: `Activer le rapport Outbound → Opportunités → Deals gagnés.`,
      },
      calling: {
        title: `📞 Activer le rapport « Activité téléphonique → Pipeline » pour ${int.label}`,
        body: `Les appels via ${int.label} peuvent être croisés avec la création et la progression des deals.`,
        recommendation: `Activer le rapport téléphonie pour identifier les meilleurs créneaux.`,
      },
      billing: {
        title: `💳 Activer la réconciliation Deals ↔ Factures avec ${int.label}`,
        body: `${int.label} gère votre facturation. Revold peut croiser opportunités gagnées avec paiements réels.`,
        recommendation: `Activer le rapport « Réconciliation Deals gagnés ↔ Factures encaissées ».`,
      },
      esign: {
        title: `📝 Activer le rapport « Cycle de signature » pour ${int.label}`,
        body: `${int.label} gère vos contrats. Revold peut mesurer le délai envoi-signature et identifier les blocages.`,
        recommendation: `Activer le rapport e-signature pour réduire le cycle de vente.`,
      },
      enrichment: {
        title: `💎 Mesurer le ROI de ${int.label}`,
        body: `${int.label} enrichit votre base contacts. Revold peut comparer enrichis vs non-enrichis sur conversion et CA.`,
        recommendation: `Activer le rapport « ROI de l'enrichissement ».`,
      },
      support: {
        title: `🎧 Activer le rapport « Tickets → Risque de churn » pour ${int.label}`,
        body: `${int.label} centralise vos tickets. Revold peut croiser le volume avec les renouvellements.`,
        recommendation: `Activer le rapport churn pour anticiper en proactif.`,
      },
      conv_intel: {
        title: `🎙️ Analyser les appels gagnants vs perdus avec ${int.label}`,
        body: `${int.label} analyse vos conversations. Revold peut comparer les patterns entre deals gagnés et perdus.`,
        recommendation: `Activer le rapport conversational intelligence.`,
      },
    };
    if (categoryInsights[cat]) {
      integrationInsights.push({
        key: `int_report_${cat}_${int.key}`,
        severity: "info",
        ...categoryInsights[cat],
      });
    }
  }

  // 5. Insight global : peu d'outils métiers
  const businessToolCount = detectedIntegrations.filter(
    (i) => getToolCategory(i.key) !== "other",
  ).length;
  if (businessToolCount > 0 && businessToolCount < 3) {
    integrationInsights.push({
      key: "int_global_low_stack",
      severity: "info",
      title: `🔌 Seulement ${businessToolCount} outil${businessToolCount > 1 ? "s" : ""} métier détecté${businessToolCount > 1 ? "s" : ""}`,
      body: "Plus vous connectez de sources, plus Revold génère de rapports cross-source à valeur.",
      recommendation: "Consultez Intégration pour découvrir les outils à connecter.",
    });
  }

  return integrationInsights;
}
