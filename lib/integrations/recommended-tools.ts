/**
 * Curated catalog of business tools to recommend connecting to Revold.
 *
 * Goal: encourage users to bring more enterprise data into Revold so we have a
 * full 360° picture of revenue operations — emailing, prospection, billing,
 * ERP, customer support, conversational intelligence, e-signature.
 */

export type RecommendedTool = {
  key: string;
  label: string;
  vendor: string;
  icon: string;
  description: string;
  // HubSpot marketplace listing — opens in a new tab
  marketplaceUrl?: string;
};

export type RecommendedCategory = {
  id: string;
  label: string;
  icon: string;
  description: string;
  tools: RecommendedTool[];
};

export const RECOMMENDED_CATEGORIES: RecommendedCategory[] = [
  {
    id: "cold_email",
    label: "Cold Email & Prospection",
    icon: "✉️",
    description:
      "Suivez vos campagnes outbound, taux de réponse et leads générés directement dans Revold.",
    tools: [
      { key: "lemlist", label: "Lemlist", vendor: "Lemlist", icon: "✉️", description: "Cold emailing personnalisé", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/sales-enablement/lemlist" },
      { key: "lagrowthmachine", label: "La Growth Machine", vendor: "LGM", icon: "🚀", description: "Multi-canal automation", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/lead-generation/la-growth-machine" },
      { key: "apollo", label: "Apollo.io", vendor: "Apollo", icon: "🛰️", description: "Sales engagement & data", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/sales-enablement/apollo" },
      { key: "salesloft", label: "Salesloft", vendor: "Salesloft", icon: "🎯", description: "Sales engagement platform", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/sales-enablement/salesloft" },
    ],
  },
  {
    id: "enrichment",
    label: "Enrichissement & Sales Intelligence",
    icon: "🔎",
    description:
      "Fiabilisez vos données contacts/sociétés et identifiez les meilleurs comptes à cibler.",
    tools: [
      { key: "kaspr", label: "Kaspr", vendor: "Kaspr", icon: "🔎", description: "Coordonnées B2B vérifiées", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/lead-generation/kaspr" },
      { key: "dropcontact", label: "Dropcontact", vendor: "Dropcontact", icon: "💧", description: "Enrichissement RGPD", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/lead-generation/dropcontact" },
      { key: "lusha", label: "Lusha", vendor: "Lusha", icon: "🔍", description: "Données B2B en temps réel", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/lead-generation/lusha" },
      { key: "zoominfo", label: "ZoomInfo", vendor: "ZoomInfo", icon: "🛰️", description: "Intelligence commerciale", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/lead-generation/zoominfo" },
    ],
  },
  {
    id: "phone",
    label: "Téléphonie & Appels",
    icon: "📞",
    description:
      "Centralisez tous vos appels sortants/entrants avec leur durée, statut et enregistrement.",
    tools: [
      { key: "aircall", label: "Aircall", vendor: "Aircall", icon: "📞", description: "Téléphonie cloud B2B", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/calling/aircall" },
      { key: "ringover", label: "Ringover", vendor: "Ringover", icon: "📞", description: "VoIP & intégration CRM", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/calling/ringover" },
      { key: "justcall", label: "JustCall", vendor: "JustCall", icon: "☎️", description: "Téléphonie & SMS", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/calling/justcall" },
    ],
  },
  {
    id: "esign",
    label: "Signature électronique",
    icon: "📄",
    description:
      "Suivez le cycle de signature de vos contrats : envoi, ouverture, signature, délais.",
    tools: [
      { key: "pandadoc", label: "PandaDoc", vendor: "PandaDoc", icon: "📄", description: "Propositions & e-signature", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/proposal/pandadoc" },
      { key: "yousign", label: "Yousign", vendor: "Yousign", icon: "🖋️", description: "Signature électronique FR", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/proposal/yousign" },
      { key: "docusign", label: "DocuSign", vendor: "DocuSign", icon: "✍️", description: "E-signature internationale", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/proposal/docusign" },
    ],
  },
  {
    id: "billing",
    label: "Facturation & ERP",
    icon: "💳",
    description:
      "Reconciliez automatiquement les opportunités fermées avec les factures et paiements réels.",
    tools: [
      { key: "stripe", label: "Stripe", vendor: "Stripe", icon: "💳", description: "Paiements & abonnements", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/finance/accounting/stripe" },
      { key: "pennylane", label: "Pennylane", vendor: "Pennylane", icon: "📊", description: "Comptabilité & gestion FR", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/finance/accounting/pennylane" },
      { key: "sellsy", label: "Sellsy", vendor: "Sellsy", icon: "💼", description: "CRM, devis et facturation FR", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/finance/accounting/sellsy" },
      { key: "axonaut", label: "Axonaut", vendor: "Axonaut", icon: "⚙️", description: "Gestion d'entreprise FR", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/finance/accounting/axonaut" },
      { key: "quickbooks", label: "QuickBooks", vendor: "Intuit", icon: "📒", description: "Comptabilité internationale", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/finance/accounting/quickbooks-online" },
    ],
  },
  {
    id: "support",
    label: "Service client",
    icon: "🎧",
    description:
      "Croisez tickets clients et opportunités pour mesurer la rétention et le NPS.",
    tools: [
      { key: "intercom", label: "Intercom", vendor: "Intercom", icon: "💬", description: "Messagerie & support", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/customer-service/customer-support/intercom" },
      { key: "zendesk", label: "Zendesk", vendor: "Zendesk", icon: "🎧", description: "Helpdesk & ticketing", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/customer-service/customer-support/zendesk" },
      { key: "crisp", label: "Crisp", vendor: "Crisp", icon: "🗨️", description: "Live chat & helpdesk FR", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/customer-service/customer-support/crisp" },
    ],
  },
  {
    id: "conversation_intel",
    label: "Conversational Intelligence",
    icon: "🎙️",
    description:
      "Analyse IA des appels commerciaux : objections, talk ratio, next steps, deal risk.",
    tools: [
      { key: "modjo", label: "Modjo", vendor: "Modjo", icon: "🎙️", description: "Conversational intelligence FR", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/sales-enablement/modjo" },
      { key: "gong", label: "Gong", vendor: "Gong", icon: "🔔", description: "Revenue intelligence", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/sales-enablement/gong-io" },
      { key: "chorus", label: "Chorus", vendor: "ZoomInfo", icon: "🎶", description: "Conversation analytics", marketplaceUrl: "https://ecosystem.hubspot.com/marketplace/apps/sales/sales-enablement/chorus-ai" },
    ],
  },
];

/**
 * Returns the categories whose tools are NOT yet detected as connected.
 * If at least one tool of a category is connected, that category is filtered out
 * (so we only suggest categories that bring NEW value).
 */
export function getRecommendedCategories(connectedKeys: string[]): RecommendedCategory[] {
  const connectedSet = new Set(connectedKeys);
  return RECOMMENDED_CATEGORIES.map((cat) => ({
    ...cat,
    tools: cat.tools.filter((t) => !connectedSet.has(t.key)),
  })).filter((cat) => cat.tools.length > 0);
}
