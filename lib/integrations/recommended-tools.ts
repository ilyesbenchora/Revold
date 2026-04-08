/**
 * Curated catalog of business tools to connect DIRECTLY to Revold.
 *
 * Unlike HubSpot apps, these integrations sync straight into Revold so the
 * platform can centralize the entire enterprise revenue stack — CRM,
 * facturation, et service client — without requiring HubSpot in the middle.
 */

export type RecommendedTool = {
  key: string;
  label: string;
  vendor: string;
  icon: string;
  // Domain used to fetch the brand logo via logo.clearbit.com/{domain}
  domain: string;
  description: string;
  // Internal Revold connect URL — handled by the Revold integration platform.
  connectUrl: string;
};

export type RecommendedCategory = {
  id: string;
  label: string;
  icon: string;
  description: string;
  tools: RecommendedTool[];
};

// Internal route handled by Revold's integration platform — each tool key
// triggers the corresponding OAuth / API key flow.
const REVOLD_CONNECT = (toolKey: string) => `/dashboard/integration/connect/${toolKey}`;

export const RECOMMENDED_CATEGORIES: RecommendedCategory[] = [
  {
    id: "crm",
    label: "CRM",
    icon: "🗂️",
    description:
      "Synchronisez votre CRM principal directement dans Revold — sans dépendre de HubSpot. Tous vos contacts, deals et activités sont centralisés.",
    tools: [
      { key: "salesforce", label: "Salesforce", vendor: "Salesforce", icon: "☁️", domain: "salesforce.com", description: "CRM leader B2B mondial", connectUrl: REVOLD_CONNECT("salesforce") },
      { key: "pipedrive", label: "Pipedrive", vendor: "Pipedrive", icon: "🟢", domain: "pipedrive.com", description: "CRM pipeline-first pour PME", connectUrl: REVOLD_CONNECT("pipedrive") },
      { key: "zoho", label: "Zoho CRM", vendor: "Zoho", icon: "🟣", domain: "zoho.com", description: "Suite CRM tout-en-un", connectUrl: REVOLD_CONNECT("zoho") },
      { key: "monday", label: "monday CRM", vendor: "monday.com", icon: "🟦", domain: "monday.com", description: "CRM visuel collaboratif", connectUrl: REVOLD_CONNECT("monday") },
    ],
  },
  {
    id: "billing",
    label: "Facturation",
    icon: "💳",
    description:
      "Reconciliez automatiquement les opportunités fermées avec les factures et paiements réels pour piloter le cash, pas seulement le pipeline.",
    tools: [
      { key: "stripe", label: "Stripe", vendor: "Stripe", icon: "💳", domain: "stripe.com", description: "Paiements & abonnements", connectUrl: REVOLD_CONNECT("stripe") },
      { key: "pennylane", label: "Pennylane", vendor: "Pennylane", icon: "📊", domain: "pennylane.com", description: "Comptabilité & gestion FR", connectUrl: REVOLD_CONNECT("pennylane") },
      { key: "sellsy", label: "Sellsy", vendor: "Sellsy", icon: "💼", domain: "sellsy.com", description: "Devis et facturation FR", connectUrl: REVOLD_CONNECT("sellsy") },
      { key: "axonaut", label: "Axonaut", vendor: "Axonaut", icon: "⚙️", domain: "axonaut.com", description: "Gestion d'entreprise FR", connectUrl: REVOLD_CONNECT("axonaut") },
      { key: "quickbooks", label: "QuickBooks", vendor: "Intuit", icon: "📒", domain: "quickbooks.intuit.com", description: "Comptabilité internationale", connectUrl: REVOLD_CONNECT("quickbooks") },
    ],
  },
  {
    id: "support",
    label: "Service client",
    icon: "🎧",
    description:
      "Croisez tickets clients et opportunités pour mesurer la rétention, anticiper le churn et calculer le NPS dans Revold.",
    tools: [
      { key: "intercom", label: "Intercom", vendor: "Intercom", icon: "💬", domain: "intercom.com", description: "Messagerie & support", connectUrl: REVOLD_CONNECT("intercom") },
      { key: "zendesk", label: "Zendesk", vendor: "Zendesk", icon: "🎧", domain: "zendesk.com", description: "Helpdesk & ticketing", connectUrl: REVOLD_CONNECT("zendesk") },
      { key: "crisp", label: "Crisp", vendor: "Crisp", icon: "🗨️", domain: "crisp.chat", description: "Live chat & helpdesk FR", connectUrl: REVOLD_CONNECT("crisp") },
      { key: "freshdesk", label: "Freshdesk", vendor: "Freshworks", icon: "🆘", domain: "freshdesk.com", description: "Support client multicanal", connectUrl: REVOLD_CONNECT("freshdesk") },
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
