/**
 * Cross-source report suggestions — reports that combine 2+ different
 * tool categories (CRM × billing, prospection × CRM × billing, etc.).
 *
 * These are the ones that justify Revold's existence: no single connected
 * tool can produce them alone.
 */

import type { DetectedIntegration } from "@/lib/integrations/detect-integrations";
import { getToolCategory, type ToolCategory } from "./report-suggestions";

export type CrossSourceReport = {
  id: string;
  title: string;
  description: string;
  // The categories that must all be present on the portal for this report
  // to make sense. Order doesn't matter.
  requiredCategories: ToolCategory[];
  metrics: string[];
  expectedValue: string;
  priority: "high" | "medium" | "low";
  icon: string;
};

const CROSS_SOURCE_TEMPLATES: CrossSourceReport[] = [
  {
    id: "outbound_to_revenue",
    title: "Outbound → Opportunités → Cash",
    description:
      "Reconstitue le funnel complet : campagnes outbound (Lemlist/Apollo) → meetings → opportunités HubSpot → factures encaissées (Stripe/Pennylane). Le ROI réel par séquence, pas un proxy.",
    requiredCategories: ["outbound", "billing"],
    metrics: [
      "Revenue attribué par séquence outbound",
      "CAC par canal",
      "Cycle moyen first touch → 1ère facture",
      "% de leads outbound qui paient",
    ],
    expectedValue:
      "Identifier les séquences outbound qui génèrent du cash réel — pas juste des meetings.",
    priority: "high",
    icon: "🎯",
  },
  {
    id: "calls_to_won",
    title: "Activité téléphonique → Deals gagnés",
    description:
      "Croise l'activité Aircall/Ringover (volume d'appels, durée, taux de connexion) avec les deals fermés gagnés dans HubSpot pour mesurer l'impact réel du téléphone sur le closing.",
    requiredCategories: ["calling"],
    metrics: [
      "Nb d'appels par deal gagné",
      "Taux de conversion appel → meeting",
      "Top 10 commerciaux par closing assisté téléphone",
      "Heure du jour optimale",
    ],
    expectedValue:
      "Optimiser les cadences téléphoniques data-driven et identifier les patterns gagnants.",
    priority: "high",
    icon: "📞",
  },
  {
    id: "deals_vs_invoices",
    title: "Réconciliation Deals gagnés ↔ Factures encaissées",
    description:
      "Croise systématiquement chaque deal HubSpot 'Closed Won' avec les factures Stripe/Pennylane/Sellsy associées. Fait remonter les fuites revenue : deals gagnés sans facture, écarts forecast vs réalisé.",
    requiredCategories: ["billing"],
    metrics: [
      "Forecast HubSpot vs CA réel encaissé",
      "Deals 'Won' sans facture associée (€)",
      "Écart % par segment / commercial",
      "Délai moyen Won → 1ère facture émise",
    ],
    expectedValue:
      "Récupérer du CA déjà signé et fiabiliser le forecast à 100%.",
    priority: "high",
    icon: "💎",
  },
  {
    id: "esign_cycle_time",
    title: "Cycle de signature → Time-to-close",
    description:
      "Croise les contrats envoyés via PandaDoc/Yousign avec les deals HubSpot pour mesurer le délai exact entre l'envoi et la signature, et identifier les blocages systémiques.",
    requiredCategories: ["esign"],
    metrics: [
      "Temps moyen envoi → signature par segment",
      "Taux d'abandon contrat",
      "Time-to-close par commercial",
      "Contrats relancés vs signés du premier coup",
    ],
    expectedValue: "Réduire le cycle de vente de 15-30% en supprimant les frictions de signature.",
    priority: "high",
    icon: "✍️",
  },
  {
    id: "support_to_churn",
    title: "Tickets support → Risque de churn",
    description:
      "Croise volume et sentiment des tickets Intercom/Zendesk avec les renouvellements et le MRR Stripe pour anticiper les comptes qui vont churner avant qu'ils n'annulent.",
    requiredCategories: ["support", "billing"],
    metrics: [
      "Tickets ouverts à 30j du renew",
      "MRR à risque (€)",
      "Comptes Tier 1 avec ticket urgent",
      "Score de santé prédictif",
    ],
    expectedValue:
      "Détecter le churn 60 jours avant qu'il arrive, action CSM proactive.",
    priority: "high",
    icon: "🚨",
  },
  {
    id: "enrichment_roi",
    title: "ROI de l'enrichissement Kaspr / Dropcontact",
    description:
      "Compare la performance commerciale (taux de réponse, opportunités, deals gagnés) entre les contacts enrichis via Kaspr/Dropcontact/Lusha et les contacts non-enrichis. Quantifie le ROI exact du budget enrichissement.",
    requiredCategories: ["enrichment", "billing"],
    metrics: [
      "Taux conversion enrichi vs non-enrichi",
      "CA moyen sur deals avec contact enrichi",
      "ROI net par outil d'enrichissement (€/€)",
      "% de la base à enrichir prioritairement",
    ],
    expectedValue:
      "Justifier ou réduire le budget enrichissement avec des chiffres exacts.",
    priority: "medium",
    icon: "💎",
  },
  {
    id: "marketing_to_mrr",
    title: "Marketing automation → MRR par lead source",
    description:
      "Croise les campagnes Mailchimp/Brevo avec le MRR Stripe par lead source pour identifier les canaux marketing qui génèrent le plus de revenue récurrent (pas juste des leads).",
    requiredCategories: ["billing"],
    metrics: [
      "MRR généré par campagne",
      "LTV par source d'acquisition",
      "Coût d'acquisition par canal",
      "Top 5 campagnes par CA généré",
    ],
    expectedValue:
      "Réallouer le budget marketing vers les canaux qui apportent vraiment du cash.",
    priority: "high",
    icon: "📊",
  },
  {
    id: "conv_intel_winning_patterns",
    title: "Conversational Intelligence → Patterns gagnants",
    description:
      "Compare les enregistrements Modjo/Gong (talk ratio, objections, mots-clés) entre les deals HubSpot gagnés et perdus pour extraire les patterns conversationnels qui closent.",
    requiredCategories: ["conv_intel"],
    metrics: [
      "Talk ratio sur deals won vs lost",
      "Objections les plus fréquentes",
      "Mots-clés corrélés au closing",
      "Next steps explicites vs implicites",
    ],
    expectedValue:
      "Coaching commercial data-driven et méthode de vente affinée.",
    priority: "medium",
    icon: "🎙️",
  },
  {
    id: "sdr_full_funnel",
    title: "Performance full-funnel par SDR",
    description:
      "Pour chaque SDR : volume outbound (Lemlist/Apollo) → appels passés (Aircall) → meetings bookés (HubSpot) → opportunités créées → deals gagnés → CA encaissé (Stripe). La photo complète et juste de la performance.",
    requiredCategories: ["outbound", "calling", "billing"],
    metrics: [
      "Activité quotidienne par SDR",
      "Conversion par étape de funnel",
      "Revenue généré par SDR (€)",
      "Coût d'acquisition par SDR",
    ],
    expectedValue:
      "Coaching ciblé sur les top performers et identification rapide des décrocheurs.",
    priority: "high",
    icon: "🏆",
  },
  {
    id: "stack_adoption",
    title: "Adoption du stack par utilisateur",
    description:
      "Vue cross-tools de l'adoption : pour chaque commercial, voir quels outils il utilise vraiment (Aircall, Kaspr, PandaDoc, Mailchimp…) et lesquels sont sous-exploités. Pilote la conduite du changement.",
    requiredCategories: [],
    metrics: [
      "% d'adoption par outil et par user",
      "Top 3 outils sous-utilisés",
      "Users à former en priorité",
      "Score d'adoption global de l'équipe",
    ],
    expectedValue:
      "Maximiser le ROI de la stack en adressant la conduite du changement aux bons users.",
    priority: "medium",
    icon: "👥",
  },
];

/**
 * Returns the cross-source reports relevant for the user's portal.
 * A report is relevant when ALL its required categories are detected.
 * Reports with empty `requiredCategories` are always shown.
 */
export function getCrossSourceReports(
  integrations: DetectedIntegration[],
): Array<CrossSourceReport & { availableCategories: ToolCategory[] }> {
  const presentCategories = new Set<ToolCategory>();
  for (const i of integrations) {
    const cat = getToolCategory(i.key);
    if (cat !== "other") presentCategories.add(cat);
  }

  return CROSS_SOURCE_TEMPLATES.filter((tpl) => {
    if (tpl.requiredCategories.length === 0) return true;
    return tpl.requiredCategories.every((c) => presentCategories.has(c));
  })
    .map((tpl) => ({
      ...tpl,
      availableCategories: tpl.requiredCategories.filter((c) =>
        presentCategories.has(c),
      ),
    }))
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
}

export function getAllCrossSourceTemplates(): CrossSourceReport[] {
  return CROSS_SOURCE_TEMPLATES;
}
