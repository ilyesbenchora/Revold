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
  // Domain used to fetch the brand logo via logo.clearbit.com/{domain}
  domain: string;
  category: "crm" | "billing" | "phone" | "support" | "communication" | "conv_intel";
  /** True si la connexion passe par OAuth (URL spéciale) au lieu du flow API key. */
  oauth?: boolean;
  /** URL de connexion override (ex: /api/integrations/hubspot/connect). */
  connectUrl?: string;
  description: string;
  helpUrl: string;
  helpText: string;
  fields: ConnectField[];
};

export const CONNECTABLE_TOOLS: Record<string, ConnectableTool> = {
  // ── CRM ─────────────────────────────────────────────────────────
  hubspot: {
    key: "hubspot",
    label: "HubSpot",
    vendor: "HubSpot Inc.",
    icon: "🟧",
    domain: "hubspot.com",
    category: "crm",
    oauth: true,
    connectUrl: "/api/integrations/hubspot/connect",
    description: "CRM B2B leader pour PME / mid-market. Le coeur de votre Revenue Stack — 31 scopes lecture pour exploiter pleinement les données.",
    helpUrl: "https://www.hubspot.com/products/crm",
    helpText: "Connexion en un clic via OAuth — vous serez redirigé vers HubSpot pour autoriser l'accès lecture seule.",
    fields: [], // OAuth, pas de champs manuels
  },
  salesforce: {
    key: "salesforce",
    label: "Salesforce",
    vendor: "Salesforce.com",
    icon: "☁️",
    domain: "salesforce.com",
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
    domain: "pipedrive.com",
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
    domain: "zoho.com",
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
    domain: "monday.com",
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
    domain: "stripe.com",
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
    domain: "pennylane.com",
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
    domain: "sellsy.com",
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
    domain: "axonaut.com",
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
    domain: "quickbooks.intuit.com",
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

  // ── Téléphonie ──────────────────────────────────────────────────
  aircall: {
    key: "aircall",
    label: "Aircall",
    vendor: "Aircall",
    icon: "📞",
    domain: "aircall.io",
    category: "phone",
    description: "Téléphonie cloud B2B. Synchronisez les appels (volume, durée, taux de connexion) au niveau owner et deal pour l'analyse activité commerciale.",
    helpUrl: "https://developer.aircall.io/api-references/#authentication",
    helpText: "Récupérez vos identifiants API : Aircall Dashboard → Integrations & API → API Keys.",
    fields: [
      { key: "api_id", label: "API ID", placeholder: "•••••••••••", type: "text" },
      { key: "api_token", label: "API Token", placeholder: "•••••••••••", type: "password" },
    ],
  },
  ringover: {
    key: "ringover",
    label: "Ringover",
    vendor: "Ringover",
    icon: "📞",
    domain: "ringover.com",
    category: "phone",
    description: "Téléphonie cloud française. Croisez les appels avec les deals pour mesurer l'impact du téléphone sur le closing.",
    helpUrl: "https://developers.ringover.com/",
    helpText: "Générez votre API Key : Dashboard Ringover → Account → API Keys.",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "•••••••••••", type: "password" },
    ],
  },

  // ── Service client ──────────────────────────────────────────────
  intercom: {
    key: "intercom",
    label: "Intercom",
    vendor: "Intercom",
    icon: "💬",
    domain: "intercom.com",
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
    domain: "zendesk.com",
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
    domain: "crisp.chat",
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
    domain: "freshdesk.com",
    category: "support",
    description: "Support client multicanal. Centralisez tous les tickets dans Revold.",
    helpUrl: "https://developers.freshdesk.com/api/#authentication",
    helpText: "Récupérez votre API Key : Profile picture → Profile settings → API Key.",
    fields: [
      { key: "subdomain", label: "Sous-domaine Freshdesk", placeholder: "votre-entreprise", type: "text", helper: "Le préfixe de votre URL Freshdesk (votre-entreprise.freshdesk.com)" },
      { key: "api_key", label: "API Key", placeholder: "•••••••••••", type: "password" },
    ],
  },

  // ── Communication ──────────────────────────────────────────────
  slack: {
    key: "slack",
    label: "Slack",
    vendor: "Salesforce / Slack",
    icon: "💬",
    domain: "slack.com",
    category: "communication",
    description: "Recevez vos alertes, coachings et digests Revold dans le canal Slack de votre choix.",
    helpUrl: "https://api.slack.com/messaging/webhooks",
    helpText: "Créez un Incoming Webhook depuis Slack → Apps → Incoming Webhooks. Sélectionnez le canal cible et copiez l'URL fournie.",
    fields: [
      { key: "webhook_url", label: "Webhook URL Slack", placeholder: "https://hooks.slack.com/services/T0/B0/...", type: "password", helper: "URL HTTPS générée par Slack pour votre canal" },
    ],
  },
  teams: {
    key: "teams",
    label: "Microsoft Teams",
    vendor: "Microsoft",
    icon: "👥",
    domain: "microsoft.com",
    category: "communication",
    description: "Cards Teams pour vos alertes et digests Revold dans le canal de votre choix.",
    helpUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
    helpText: "Dans le canal Teams cible : Connecteurs → Incoming Webhook → Configurer → copier l'URL fournie.",
    fields: [
      { key: "webhook_url", label: "Webhook URL Teams", placeholder: "https://outlook.office.com/webhook/...", type: "password", helper: "URL HTTPS du connecteur Incoming Webhook Teams" },
    ],
  },
  gmail: {
    key: "gmail",
    label: "Gmail",
    vendor: "Google",
    icon: "📧",
    domain: "gmail.com",
    category: "communication",
    description: "Notifications email via votre compte Gmail. Recevez les alertes et le digest quotidien sur votre boîte pro.",
    helpUrl: "https://support.google.com/mail/answer/7126229",
    helpText: "Ajoutez simplement les adresses Gmail destinataires dans la page Notifications. Les emails sont envoyés via Resend (DKIM/SPF configurés sur revold.io).",
    fields: [
      { key: "recipients", label: "Adresses Gmail destinataires", placeholder: "alice@gmail.com, bob@workspace.fr", type: "text", helper: "Séparées par virgule. Acceptent aussi Google Workspace." },
    ],
  },
  outlook: {
    key: "outlook",
    label: "Outlook / Microsoft 365",
    vendor: "Microsoft",
    icon: "📨",
    domain: "outlook.com",
    category: "communication",
    description: "Notifications email Outlook / Microsoft 365. Le digest quotidien et les alertes critiques arrivent dans votre Outlook.",
    helpUrl: "https://support.microsoft.com/en-us/office/welcome-to-outlook-com-3920a3c9-2c5b-4a5b-8c5d-1e7e88a45f23",
    helpText: "Ajoutez simplement les adresses Outlook/M365 destinataires. Les emails sont envoyés via Resend (DKIM/SPF configurés sur revold.io, donc pas marqués comme spam).",
    fields: [
      { key: "recipients", label: "Adresses Outlook destinataires", placeholder: "alice@outlook.com, bob@company.com", type: "text", helper: "Séparées par virgule. Microsoft 365 accepté." },
    ],
  },

  // ── Conversation Intelligence ────────────────────────────────────
  praiz: {
    key: "praiz",
    label: "Praiz",
    vendor: "Praiz (FR)",
    icon: "🎙️",
    domain: "praiz.io",
    category: "conv_intel",
    description: "Conversation intelligence française : transcription auto des appels (Aircall, Ringover, Zoom, Meet), analyse IA (talk ratio, objections, sentiment, scoring deal). Branche le webhook Praiz pour enrichir les deals HubSpot dans Revold.",
    helpUrl: "https://help.praiz.io/en/category/public-api-webhooks-1mvk6ti/",
    helpText: "1) Contacte hello@praiz.io pour activer l'API webhooks. 2) Génère un secret aléatoire 32+ caractères. 3) Dans Praiz → configure l'URL webhook fournie par Revold après connexion + header Authorization: Bearer <secret>. 4) Colle le secret ci-dessous.",
    fields: [
      { key: "webhook_secret", label: "Webhook Secret (Bearer token)", placeholder: "gen via openssl rand -hex 32", type: "password", helper: "Secret partagé que Praiz inclura dans le header Authorization de chaque webhook. Vérifié côté Revold pour bloquer les requêtes non-authentifiées." },
    ],
  },
};

export function getConnectableTool(key: string): ConnectableTool | null {
  return CONNECTABLE_TOOLS[key] ?? null;
}

const CATEGORY_LABELS: Record<ConnectableTool["category"], string> = {
  crm: "CRM",
  billing: "Facturation",
  phone: "Téléphonie",
  support: "Service client",
  communication: "Communication",
  conv_intel: "Conversation Intelligence",
};

export function getCategoryLabel(cat: ConnectableTool["category"]): string {
  return CATEGORY_LABELS[cat];
}
