/**
 * Authentication catalog for tools that connect directly to Revold.
 *
 * For each tool, defines the fields the user needs to provide (API key,
 * subdomain, etc.) and a doc URL where they can find them. The credentials
 * are stored in the `integrations` table (Supabase).
 *
 * Fastest path: API-key based auth. OAuth would require per-vendor app
 * registration which isn't necessary for an MVP placeholder.
 */

export type ConnectField = {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password";
  helper?: string;
};

export type ConnectableTool = {
  key: string;
  label: string;
  vendor: string;
  icon: string;
  category: "crm" | "billing" | "support";
  description: string;
  helpUrl: string;
  helpText: string;
  fields: ConnectField[];
};

export const CONNECTABLE_TOOLS: Record<string, ConnectableTool> = {
  // ── CRM ─────────────────────────────────────────────────────────
  salesforce: {
    key: "salesforce",
    label: "Salesforce",
    vendor: "Salesforce.com",
    icon: "☁️",
    category: "crm",
    description: "CRM B2B leader mondial. Synchronisez contacts, comptes, opportunités et activités directement dans Revold.",
    helpUrl: "https://help.salesforce.com/s/articleView?id=sf.user_security_token.htm",
    helpText: "Récupérez votre Security Token depuis Salesforce : Setup → Personal Information → Reset Security Token.",
    fields: [
      { key: "instance_url", label: "Instance URL", placeholder: "https://votre-domaine.my.salesforce.com", type: "text", helper: "L'URL de votre instance Salesforce" },
      { key: "username", label: "Email Salesforce", placeholder: "vous@entreprise.com", type: "text" },
      { key: "security_token", label: "Security Token", placeholder: "•••••••••••", type: "password", helper: "Token reçu par email après reset" },
    ],
  },
  pipedrive: {
    key: "pipedrive",
    label: "Pipedrive",
    vendor: "Pipedrive",
    icon: "🟢",
    category: "crm",
    description: "CRM pipeline-first orienté PME. Synchronisez deals, contacts et activités.",
    helpUrl: "https://support.pipedrive.com/en/article/how-can-i-find-my-personal-api-key",
    helpText: "Récupérez votre API Token : Settings → Personal preferences → API.",
    fields: [
      { key: "company_domain", label: "Sous-domaine Pipedrive", placeholder: "votre-entreprise", type: "text", helper: "Le préfixe de votre URL Pipedrive (votre-entreprise.pipedrive.com)" },
      { key: "api_token", label: "API Token", placeholder: "•••••••••••", type: "password" },
    ],
  },
  zoho: {
    key: "zoho",
    label: "Zoho CRM",
    vendor: "Zoho Corporation",
    icon: "🟣",
    category: "crm",
    description: "Suite CRM tout-en-un. Synchronisez leads, comptes, deals et tâches.",
    helpUrl: "https://www.zoho.com/crm/developer/docs/api/v6/auth-request.html",
    helpText: "Générez un OAuth refresh token via le Zoho API Console (Self-Client).",
    fields: [
      { key: "data_center", label: "Data center", placeholder: "eu, com, in...", type: "text", helper: "Votre datacenter Zoho (eu pour l'Europe)" },
      { key: "client_id", label: "Client ID", placeholder: "1000.XXXXXXXX", type: "text" },
      { key: "client_secret", label: "Client Secret", placeholder: "•••••••••••", type: "password" },
      { key: "refresh_token", label: "Refresh Token", placeholder: "•••••••••••", type: "password" },
    ],
  },
  monday: {
    key: "monday",
    label: "monday CRM",
    vendor: "monday.com",
    icon: "🟦",
    category: "crm",
    description: "CRM visuel collaboratif. Synchronisez vos boards CRM, items et activités.",
    helpUrl: "https://developer.monday.com/api-reference/docs/authentication",
    helpText: "Récupérez votre API Token : Avatar → Developers → My access tokens.",
    fields: [
      { key: "api_token", label: "API Token", placeholder: "•••••••••••", type: "password" },
    ],
  },

  // ── Facturation & ERP ───────────────────────────────────────────
  stripe: {
    key: "stripe",
    label: "Stripe",
    vendor: "Stripe",
    icon: "💳",
    category: "billing",
    description: "Paiements & abonnements. Synchronisez factures, paiements et clients dans Revold.",
    helpUrl: "https://dashboard.stripe.com/apikeys",
    helpText: "Récupérez votre Restricted Key (mode lecture seule recommandé) depuis le dashboard Stripe.",
    fields: [
      { key: "secret_key", label: "Secret Key", placeholder: "sk_live_•••••••••••", type: "password" },
    ],
  },
  pennylane: {
    key: "pennylane",
    label: "Pennylane",
    vendor: "Pennylane",
    icon: "📊",
    category: "billing",
    description: "Comptabilité & gestion FR. Synchronisez factures, paiements et clients.",
    helpUrl: "https://pennylane.readme.io/reference/authentication",
    helpText: "Récupérez votre API Token : Paramètres → API → Générer un token.",
    fields: [
      { key: "api_token", label: "API Token", placeholder: "•••••••••••", type: "password" },
    ],
  },
  sellsy: {
    key: "sellsy",
    label: "Sellsy",
    vendor: "Sellsy",
    icon: "💼",
    category: "billing",
    description: "Devis & facturation FR. Centralisez vos opportunités et factures.",
    helpUrl: "https://api.sellsy.com/doc/v2/#section/Authentication",
    helpText: "Créez une App OAuth2 dans Sellsy → API and webhooks → Application access.",
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "•••••••••••", type: "text" },
      { key: "client_secret", label: "Client Secret", placeholder: "•••••••••••", type: "password" },
    ],
  },
  axonaut: {
    key: "axonaut",
    label: "Axonaut",
    vendor: "Axonaut",
    icon: "⚙️",
    category: "billing",
    description: "Gestion d'entreprise FR. Synchronisez devis, factures, paiements.",
    helpUrl: "https://axonaut.com/api/v2",
    helpText: "Récupérez votre API Key : Paramètres → Développeurs → API.",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "•••••••••••", type: "password" },
    ],
  },
  quickbooks: {
    key: "quickbooks",
    label: "QuickBooks",
    vendor: "Intuit",
    icon: "📒",
    category: "billing",
    description: "Comptabilité internationale. Synchronisez factures, paiements et clients.",
    helpUrl: "https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0",
    helpText: "Créez une App sur le Intuit Developer portal pour obtenir vos identifiants OAuth2.",
    fields: [
      { key: "company_id", label: "Company ID (Realm ID)", placeholder: "1234567890", type: "text" },
      { key: "client_id", label: "Client ID", placeholder: "•••••••••••", type: "text" },
      { key: "client_secret", label: "Client Secret", placeholder: "•••••••••••", type: "password" },
      { key: "refresh_token", label: "Refresh Token", placeholder: "•••••••••••", type: "password" },
    ],
  },

  // ── Service client ──────────────────────────────────────────────
  intercom: {
    key: "intercom",
    label: "Intercom",
    vendor: "Intercom",
    icon: "💬",
    category: "support",
    description: "Messagerie & support client. Croisez tickets et opportunités pour anticiper le churn.",
    helpUrl: "https://developers.intercom.com/building-apps/docs/authentication-types",
    helpText: "Récupérez votre Access Token : Settings → Developer Hub → Your apps → Authentication.",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "•••••••••••", type: "password" },
    ],
  },
  zendesk: {
    key: "zendesk",
    label: "Zendesk",
    vendor: "Zendesk",
    icon: "🎧",
    category: "support",
    description: "Helpdesk & ticketing. Mesurez la santé des comptes et anticipez le churn.",
    helpUrl: "https://support.zendesk.com/hc/en-us/articles/4408889192858",
    helpText: "Activez l'API token : Admin Center → Apps and integrations → APIs → Zendesk API.",
    fields: [
      { key: "subdomain", label: "Sous-domaine Zendesk", placeholder: "votre-entreprise", type: "text", helper: "Le préfixe de votre URL Zendesk (votre-entreprise.zendesk.com)" },
      { key: "email", label: "Email admin", placeholder: "admin@entreprise.com", type: "text" },
      { key: "api_token", label: "API Token", placeholder: "•••••••••••", type: "password" },
    ],
  },
  crisp: {
    key: "crisp",
    label: "Crisp",
    vendor: "Crisp",
    icon: "🗨️",
    category: "support",
    description: "Live chat & helpdesk FR. Synchronisez conversations et tickets.",
    helpUrl: "https://docs.crisp.chat/guides/rest-api/authentication/",
    helpText: "Créez un Plugin Token : Marketplace → Vos plugins → REST API.",
    fields: [
      { key: "website_id", label: "Website ID", placeholder: "•••••••••••", type: "text" },
      { key: "identifier", label: "Plugin Identifier", placeholder: "•••••••••••", type: "text" },
      { key: "key", label: "Plugin Key", placeholder: "•••••••••••", type: "password" },
    ],
  },
  freshdesk: {
    key: "freshdesk",
    label: "Freshdesk",
    vendor: "Freshworks",
    icon: "🆘",
    category: "support",
    description: "Support client multicanal. Centralisez tous les tickets dans Revold.",
    helpUrl: "https://developers.freshdesk.com/api/#authentication",
    helpText: "Récupérez votre API Key : Profile picture → Profile settings → API Key.",
    fields: [
      { key: "subdomain", label: "Sous-domaine Freshdesk", placeholder: "votre-entreprise", type: "text", helper: "Le préfixe de votre URL Freshdesk (votre-entreprise.freshdesk.com)" },
      { key: "api_key", label: "API Key", placeholder: "•••••••••••", type: "password" },
    ],
  },
};

export function getConnectableTool(key: string): ConnectableTool | null {
  return CONNECTABLE_TOOLS[key] ?? null;
}

const CATEGORY_LABELS: Record<ConnectableTool["category"], string> = {
  crm: "CRM",
  billing: "Facturation & ERP",
  support: "Service client",
};

export function getCategoryLabel(cat: ConnectableTool["category"]): string {
  return CATEGORY_LABELS[cat];
}
