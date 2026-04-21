/**
 * Configurations des wizards de connexion par outil.
 *
 * Chaque config décrit le pas-à-pas (deep-links, scopes à cocher, format
 * attendu des credentials, validation temps-réel) consommé par
 * `<ConnectWizard>` côté UI.
 *
 * Pour ajouter un nouveau wizard : ajouter une entrée dans WIZARD_CONFIGS.
 * Pas de wizard pour HubSpot (OAuth direct) ni pour les outils comingSoon.
 */

export type WizardField = {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder: string;
  helper?: string;
  monospace?: boolean;
  /** Validation locale temps-réel sur la valeur saisie. */
  validate?: (value: string) => KeyFeedback | null;
};

export type KeyFeedback = {
  severity: "ok" | "warning" | "error";
  title: string;
  body?: string;
};

export type WizardStep = {
  /** Titre court de l'étape. */
  title: string;
  /** Phrase d'introduction. */
  body?: string;
  /** Bouton deep-link vers le tool externe (peut varier selon mode). */
  deepLink?: { url: string; label: string; icon?: string };
  /** Liste de permissions / scopes / cases à cocher côté tool. */
  checklist?: Array<{ label: string; reason?: string }>;
  /** Strings copiables (nom suggéré, webhook URL...). */
  copyables?: Array<{ label: string; value: string }>;
  /** Notes additionnelles. */
  notes?: string[];
};

export type ModeToggle = {
  label: string;
  options: Array<{
    key: string;
    label: string;
    /** Couleur du badge (Tailwind classes). */
    color: "emerald" | "amber" | "indigo";
    /** Description courte du mode. */
    description: string;
  }>;
  defaultKey: string;
  /** Si true, les deepLink des steps sont reformattés via mode-aware URLs. */
  changesDeepLinks?: boolean;
};

export type WizardConfig = {
  /** Couleur principale du tool (utilisée pour les boutons deep-link). */
  brandColor?: { bg: string; hover: string };
  /** Toggle live/test si supporté. */
  modeToggle?: ModeToggle;
  /** Steps en fonction du mode. Si modeToggle.changesDeepLinks, le builder
   *  reçoit le mode actuel pour adapter les URLs. */
  buildSteps: (mode: string) => WizardStep[];
  /** Champs de formulaire à remplir. */
  fields: WizardField[];
  /** Lien vers la doc officielle (footer du wizard). */
  docUrl: string;
};

// ── Validators communs ────────────────────────────────────────────────────

function looksLikeHttpsUrl(value: string, hostHint?: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return false;
    if (hostHint && !u.hostname.includes(hostHint)) return false;
    return true;
  } catch {
    return false;
  }
}

function validateLength(min: number) {
  return (v: string): KeyFeedback | null => {
    if (!v) return null;
    if (v.length < min) {
      return { severity: "warning", title: `Semble trop court (${v.length}/${min} car. min).`, body: "Vérifiez le collage." };
    }
    return { severity: "ok", title: "✓ Format OK." };
  };
}

function validateSubdomain(v: string): KeyFeedback | null {
  if (!v) return null;
  if (/^https?:\/\//.test(v)) {
    return { severity: "error", title: "❌ Mettez seulement le sous-domaine, pas l'URL complète.", body: "Ex : votre-entreprise (sans https:// ni .zendesk.com)." };
  }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(v)) {
    return { severity: "warning", title: "Le sous-domaine ne contient normalement que lettres, chiffres et tirets.", body: undefined };
  }
  return { severity: "ok", title: "✓ Sous-domaine OK." };
}

function validateEmail(v: string): KeyFeedback | null {
  if (!v) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
    return { severity: "error", title: "❌ Format email invalide.", body: undefined };
  }
  return { severity: "ok", title: "✓ Email OK." };
}

function validateRecipientList(v: string): KeyFeedback | null {
  if (!v) return null;
  const list = v.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) {
    return { severity: "error", title: "❌ Aucun email valide détecté.", body: undefined };
  }
  const invalid = list.filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (invalid.length > 0) {
    return { severity: "error", title: `❌ ${invalid.length} email(s) invalide(s)`, body: invalid.slice(0, 3).join(", ") + (invalid.length > 3 ? "…" : "") };
  }
  return { severity: "ok", title: `✓ ${list.length} email(s) valide(s).`, body: undefined };
}

function validateSlackWebhook(v: string): KeyFeedback | null {
  if (!v) return null;
  if (!looksLikeHttpsUrl(v, "slack.com")) {
    return { severity: "error", title: "❌ URL Slack invalide.", body: "Attendu : https://hooks.slack.com/services/T0/B0/…" };
  }
  return { severity: "ok", title: "✓ URL Slack OK." };
}

function validateTeamsWebhook(v: string): KeyFeedback | null {
  if (!v) return null;
  if (!looksLikeHttpsUrl(v)) {
    return { severity: "error", title: "❌ URL Teams invalide.", body: "Attendu : https://outlook.office.com/webhook/…" };
  }
  return { severity: "ok", title: "✓ URL Teams OK." };
}

// ── Configs par outil ─────────────────────────────────────────────────────

export const WIZARD_CONFIGS: Record<string, WizardConfig> = {
  // ════════════════════════════════════════════════════════════════════
  //  STRIPE — gardé ici aussi pour cohérence (le composant dédié peut
  //  rester actif si on le préfère, mais cette config peut le remplacer)
  // ════════════════════════════════════════════════════════════════════
  stripe: {
    brandColor: { bg: "bg-[#635BFF]", hover: "hover:bg-[#4F45FF]" },
    docUrl: "https://docs.stripe.com/keys#create-restricted-api-secret-key",
    modeToggle: {
      label: "Mode de connexion",
      defaultKey: "live",
      changesDeepLinks: true,
      options: [
        { key: "live", label: "Live", color: "emerald", description: "Mode live : vos vraies données (lecture seule, aucune écriture)." },
        { key: "test", label: "Test", color: "amber", description: "Mode test : aucune donnée prod touchée — idéal pour valider le flow." },
      ],
    },
    buildSteps: (mode) => [
      {
        title: "Ouvrez Stripe dans un nouvel onglet",
        body: `Le bouton ci-dessous ouvre directement la page de création d'une nouvelle clé ${mode === "test" ? "de test" : "live"} dans votre dashboard Stripe.`,
        deepLink: {
          url: mode === "test"
            ? "https://dashboard.stripe.com/test/apikeys/create"
            : "https://dashboard.stripe.com/apikeys/create",
          label: `Ouvrir Stripe → Créer ma clé ${mode === "test" ? "(test)" : "(live)"}`,
        },
      },
      {
        title: "Configurez la Restricted Key",
        copyables: [{ label: "Nom suggéré", value: "Revold (lecture seule)" }],
        checklist: [
          { label: "Customers", reason: "Identifier les clients pour le matching HubSpot" },
          { label: "Charges", reason: "Détecter paiements et paiements échoués" },
          { label: "Invoices", reason: "Réconcilier deals gagnés ↔ factures émises" },
          { label: "Subscriptions", reason: "Calculer MRR, ARR, NRR, churn" },
          { label: "Payment Intents", reason: "Suivre les tentatives de paiement" },
          { label: "Balance", reason: "Smoke test du ping (permission la plus petite)" },
          { label: "Products", reason: "Catalogue pour l'analyse par produit" },
          { label: "Prices", reason: "Upsell / cross-sell par tier de prix" },
        ],
        notes: [
          "Toutes les permissions doivent être en READ uniquement (laissez le reste sur None).",
          `Cliquez « Create key » en bas. Stripe affichera la clé une seule fois — copiez-la (rk_${mode === "test" ? "test" : "live"}_…).`,
        ],
      },
      {
        title: "Collez la clé dans Revold",
        body: "Stripe revalidera automatiquement la clé via /v1/balance avant l'activation.",
      },
    ],
    fields: [
      {
        key: "secret_key",
        label: "Restricted Key Stripe",
        type: "password",
        placeholder: "rk_live_•••••••••••",
        monospace: true,
        validate: (v) => {
          if (!v) return null;
          if (v.startsWith("pk_")) return { severity: "error", title: "❌ Publishable Key détectée.", body: "Stripe a deux clés. Utilisez une Secret Key (sk_) ou Restricted Key (rk_)." };
          if (v.startsWith("whsec_")) return { severity: "error", title: "❌ Secret webhook détecté.", body: "Allez dans Developers → API keys (et non Webhooks)." };
          if (v.startsWith("rk_test_") || v.startsWith("sk_test_")) return { severity: "warning", title: "⚠️ Mode test détecté.", body: "Vos données test seront synchronisées." };
          if (v.startsWith("rk_live_") || v.startsWith("sk_live_")) return { severity: "ok", title: "✓ Clé live détectée.", body: "Validation auprès de Stripe au submit." };
          return { severity: "error", title: "❌ Format non reconnu.", body: "Une clé Stripe valide commence par sk_/rk_ live ou test." };
        },
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  PENNYLANE
  // ════════════════════════════════════════════════════════════════════
  pennylane: {
    brandColor: { bg: "bg-blue-600", hover: "hover:bg-blue-700" },
    docUrl: "https://pennylane.readme.io/reference/authentication",
    buildSteps: () => [
      {
        title: "Ouvrez votre espace Pennylane",
        body: "Connectez-vous puis allez dans Paramètres → API → Générer un token.",
        deepLink: { url: "https://app.pennylane.com/", label: "Ouvrir Pennylane → Mon espace" },
      },
      {
        title: "Générez un API Token",
        notes: [
          "Cliquez sur « Générer un nouveau token ».",
          "Donnez-lui le nom suggéré ci-dessous, en lecture seule.",
          "Copiez le token — il ne sera affiché qu'une seule fois.",
        ],
        copyables: [{ label: "Nom suggéré", value: "Revold (lecture seule)" }],
      },
      {
        title: "Collez le token dans Revold",
        body: "Pennylane revalidera automatiquement via /customers?per_page=1 avant l'activation.",
      },
    ],
    fields: [
      {
        key: "api_token",
        label: "API Token Pennylane",
        type: "password",
        placeholder: "•••••••••••",
        monospace: true,
        validate: validateLength(20),
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  SELLSY
  // ════════════════════════════════════════════════════════════════════
  sellsy: {
    brandColor: { bg: "bg-orange-600", hover: "hover:bg-orange-700" },
    docUrl: "https://api.sellsy.com/doc/v2/#section/Authentication",
    buildSteps: () => [
      {
        title: "Ouvrez Sellsy",
        body: "Allez dans API & Webhooks → Application access pour créer une App OAuth2.",
        deepLink: { url: "https://go.sellsy.com/", label: "Ouvrir Sellsy → Settings" },
      },
      {
        title: "Créez l'application Revold",
        copyables: [{ label: "Nom suggéré", value: "Revold (lecture seule)" }],
        notes: [
          "Type : OAuth2 client_credentials (server-to-server).",
          "Scopes recommandés : companies:read, individuals:read, invoices:read.",
          "Sellsy affiche le Client ID et le Client Secret après création.",
        ],
      },
      {
        title: "Collez Client ID + Secret dans Revold",
        body: "Sellsy revalidera automatiquement en échangeant les credentials contre un access_token.",
      },
    ],
    fields: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "•••••••••••", monospace: true },
      {
        key: "client_secret",
        label: "Client Secret",
        type: "password",
        placeholder: "•••••••••••",
        monospace: true,
        validate: validateLength(20),
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  AXONAUT
  // ════════════════════════════════════════════════════════════════════
  axonaut: {
    brandColor: { bg: "bg-emerald-600", hover: "hover:bg-emerald-700" },
    docUrl: "https://axonaut.com/api/v2",
    buildSteps: () => [
      {
        title: "Ouvrez Axonaut",
        body: "Connectez-vous puis allez dans Paramètres → Développeurs → API.",
        deepLink: { url: "https://axonaut.com/", label: "Ouvrir Axonaut" },
      },
      {
        title: "Récupérez votre API Key",
        notes: [
          "Si aucune clé n'existe, cliquez sur « Générer une clé API ».",
          "Copiez la clé — elle reste consultable depuis cette page si besoin.",
        ],
      },
      {
        title: "Collez l'API Key dans Revold",
        body: "Axonaut revalidera via /companies?page=1 avant activation.",
      },
    ],
    fields: [
      {
        key: "api_key",
        label: "API Key Axonaut",
        type: "password",
        placeholder: "•••••••••••",
        monospace: true,
        validate: validateLength(20),
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  QUICKBOOKS
  // ════════════════════════════════════════════════════════════════════
  quickbooks: {
    brandColor: { bg: "bg-emerald-700", hover: "hover:bg-emerald-800" },
    docUrl: "https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0",
    buildSteps: () => [
      {
        title: "Ouvrez Intuit Developer Portal",
        body: "Créez une app OAuth2 si vous n'en avez pas déjà une.",
        deepLink: { url: "https://developer.intuit.com/app/developer/dashboard", label: "Ouvrir Intuit Developer" },
      },
      {
        title: "Récupérez vos credentials",
        notes: [
          "Dans l'app : onglet Keys & OAuth pour Client ID + Client Secret.",
          "Onglet Sandbox / Production selon l'environnement à connecter.",
          "Lancez le OAuth Playground pour obtenir un Refresh Token (scope com.intuit.quickbooks.accounting).",
          "Le Realm ID (Company ID) est affiché en haut du dashboard QuickBooks Online.",
        ],
      },
      {
        title: "Collez les 4 credentials dans Revold",
        body: "QuickBooks revalidera en rafraîchissant le token + 1 query Customer.",
      },
    ],
    fields: [
      { key: "company_id", label: "Company ID (Realm ID)", type: "text", placeholder: "1234567890", monospace: true },
      { key: "client_id", label: "Client ID", type: "text", placeholder: "•••••••••••", monospace: true },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "•••••••••••", monospace: true, validate: validateLength(20) },
      { key: "refresh_token", label: "Refresh Token", type: "password", placeholder: "•••••••••••", monospace: true, validate: validateLength(30) },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  INTERCOM
  // ════════════════════════════════════════════════════════════════════
  intercom: {
    brandColor: { bg: "bg-blue-600", hover: "hover:bg-blue-700" },
    docUrl: "https://developers.intercom.com/building-apps/docs/authentication-types",
    buildSteps: () => [
      {
        title: "Ouvrez Intercom Developer Hub",
        body: "Settings → Developer Hub → Your apps. Créez une app si nécessaire.",
        deepLink: { url: "https://app.intercom.com/a/apps/_/developer-hub", label: "Ouvrir Intercom Developer Hub" },
      },
      {
        title: "Récupérez l'Access Token",
        notes: [
          "Dans votre app : section Authentication.",
          "Copiez l'Access Token (commence par dG9rOg== en base64).",
          "Permissions recommandées : Read contacts, Read conversations, Read companies.",
        ],
      },
      {
        title: "Collez l'Access Token dans Revold",
        body: "Intercom revalidera via /me avant activation.",
      },
    ],
    fields: [
      {
        key: "access_token",
        label: "Access Token Intercom",
        type: "password",
        placeholder: "dG9rOg•••••••••••",
        monospace: true,
        validate: validateLength(30),
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  ZENDESK
  // ════════════════════════════════════════════════════════════════════
  zendesk: {
    brandColor: { bg: "bg-emerald-700", hover: "hover:bg-emerald-800" },
    docUrl: "https://support.zendesk.com/hc/en-us/articles/4408889192858",
    buildSteps: () => [
      {
        title: "Activez l'API token côté Zendesk",
        body: "Admin Center → Apps and integrations → APIs → Zendesk API.",
        deepLink: { url: "https://support.zendesk.com/admin/apps-integrations/apis/zendesk-api/settings/tokens", label: "Ouvrir Zendesk Admin → API Tokens" },
        notes: ["Activez « Token Access » si ce n'est pas déjà fait."],
      },
      {
        title: "Créez un nouveau token",
        copyables: [{ label: "Description suggérée", value: "Revold (lecture seule)" }],
        notes: [
          "Cliquez sur « Add API token » et collez la description.",
          "Copiez le token affiché — il ne sera plus visible ensuite.",
        ],
      },
      {
        title: "Collez sous-domaine + email + token dans Revold",
        body: "Zendesk revalidera via /users/me.json avant activation.",
      },
    ],
    fields: [
      { key: "subdomain", label: "Sous-domaine Zendesk", type: "text", placeholder: "votre-entreprise", helper: "Le préfixe avant .zendesk.com", validate: validateSubdomain },
      { key: "email", label: "Email admin", type: "text", placeholder: "admin@entreprise.com", validate: validateEmail },
      { key: "api_token", label: "API Token", type: "password", placeholder: "•••••••••••", monospace: true, validate: validateLength(20) },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  CRISP
  // ════════════════════════════════════════════════════════════════════
  crisp: {
    brandColor: { bg: "bg-blue-500", hover: "hover:bg-blue-600" },
    docUrl: "https://docs.crisp.chat/guides/rest-api/authentication/",
    buildSteps: () => [
      {
        title: "Ouvrez Crisp Marketplace",
        body: "Allez dans Marketplace → Vos plugins → REST API.",
        deepLink: { url: "https://marketplace.crisp.chat/", label: "Ouvrir Crisp Marketplace" },
      },
      {
        title: "Créez un Plugin Token",
        copyables: [{ label: "Nom suggéré", value: "Revold (lecture seule)" }],
        notes: [
          "Type : Plugin REST API.",
          "Scopes : website:profiles:read, website:conversations:read.",
          "Crisp affiche l'identifier + key — copiez les deux.",
        ],
      },
      {
        title: "Récupérez votre Website ID",
        body: "Settings → Website Settings → Setup instructions. Le Website ID est dans le snippet.",
      },
      {
        title: "Collez les 3 valeurs dans Revold",
        body: "Crisp revalidera via /website/{id}/people/stats.",
      },
    ],
    fields: [
      { key: "website_id", label: "Website ID", type: "text", placeholder: "•••••••••••", monospace: true },
      { key: "identifier", label: "Plugin Identifier", type: "text", placeholder: "•••••••••••", monospace: true },
      { key: "key", label: "Plugin Key", type: "password", placeholder: "•••••••••••", monospace: true, validate: validateLength(20) },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  FRESHDESK
  // ════════════════════════════════════════════════════════════════════
  freshdesk: {
    brandColor: { bg: "bg-emerald-600", hover: "hover:bg-emerald-700" },
    docUrl: "https://developers.freshdesk.com/api/#authentication",
    buildSteps: () => [
      {
        title: "Ouvrez votre profil Freshdesk",
        body: "Photo de profil → Profile settings. La clé API est en haut à droite.",
        deepLink: { url: "https://www.freshworks.com/freshdesk/", label: "Ouvrir Freshdesk" },
      },
      {
        title: "Récupérez votre API Key",
        notes: [
          "Cliquez sur « View API Key » et copiez la valeur.",
          "Si vous ne voyez pas la section, demandez à un admin d'activer l'accès API.",
        ],
      },
      {
        title: "Collez sous-domaine + clé dans Revold",
        body: "Freshdesk revalidera via /agents/me avant activation.",
      },
    ],
    fields: [
      { key: "subdomain", label: "Sous-domaine Freshdesk", type: "text", placeholder: "votre-entreprise", helper: "Le préfixe avant .freshdesk.com", validate: validateSubdomain },
      { key: "api_key", label: "API Key", type: "password", placeholder: "•••••••••••", monospace: true, validate: validateLength(20) },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  SLACK — webhook URL
  // ════════════════════════════════════════════════════════════════════
  slack: {
    brandColor: { bg: "bg-[#4A154B]", hover: "hover:bg-[#3a103b]" },
    docUrl: "https://api.slack.com/messaging/webhooks",
    buildSteps: () => [
      {
        title: "Créez une app Slack (ou utilisez-en une existante)",
        body: "Cliquez ci-dessous puis « Create New App » → From scratch.",
        deepLink: { url: "https://api.slack.com/apps", label: "Ouvrir Slack API → My Apps" },
      },
      {
        title: "Activez Incoming Webhooks",
        notes: [
          "Dans votre app : Features → Incoming Webhooks → Activate (toggle).",
          "Cliquez « Add New Webhook to Workspace ».",
          "Sélectionnez le canal cible (recommandé : un canal #revold-alerts dédié).",
          "Slack affiche l'URL — copiez-la.",
        ],
      },
      {
        title: "Collez l'URL webhook dans Revold",
        body: "Revold validera le format HTTPS hooks.slack.com avant activation.",
      },
    ],
    fields: [
      {
        key: "webhook_url",
        label: "Webhook URL Slack",
        type: "password",
        placeholder: "https://hooks.slack.com/services/T0/B0/…",
        monospace: true,
        validate: validateSlackWebhook,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  TEAMS — webhook URL
  // ════════════════════════════════════════════════════════════════════
  teams: {
    brandColor: { bg: "bg-[#5059C9]", hover: "hover:bg-[#414AAB]" },
    docUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
    buildSteps: () => [
      {
        title: "Ouvrez Microsoft Teams",
        body: "Allez dans le canal cible (recommandé : un canal Revold-Alerts dédié).",
        deepLink: { url: "https://teams.microsoft.com/", label: "Ouvrir Microsoft Teams" },
      },
      {
        title: "Ajoutez le connecteur Incoming Webhook",
        notes: [
          "Dans le canal : « ⋯ » → Connecteurs.",
          "Cherchez « Incoming Webhook » → Configurer.",
          "Donnez un nom (ex : Revold) et une icône, puis cliquez « Créer ».",
          "Teams affiche l'URL — copiez-la.",
        ],
      },
      {
        title: "Collez l'URL webhook dans Revold",
        body: "Revold validera le format HTTPS avant activation.",
      },
    ],
    fields: [
      {
        key: "webhook_url",
        label: "Webhook URL Teams",
        type: "password",
        placeholder: "https://outlook.office.com/webhook/…",
        monospace: true,
        validate: validateTeamsWebhook,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  GMAIL — recipient list
  // ════════════════════════════════════════════════════════════════════
  gmail: {
    brandColor: { bg: "bg-red-600", hover: "hover:bg-red-700" },
    docUrl: "https://support.google.com/mail/answer/7126229",
    buildSteps: () => [
      {
        title: "Pas de clé API à créer",
        body: "Les emails sont envoyés depuis Revold via Resend (DKIM/SPF configurés sur revold.io). Vous indiquez juste les destinataires.",
      },
      {
        title: "Listez les adresses Gmail / Workspace destinataires",
        notes: [
          "Séparez les emails par virgule, point-virgule ou espace.",
          "Recommandation : créez d'abord une alias-list interne pour pouvoir ajouter/retirer des membres sans repasser par Revold.",
        ],
      },
    ],
    fields: [
      {
        key: "recipients",
        label: "Adresses Gmail destinataires",
        type: "text",
        placeholder: "alice@gmail.com, bob@workspace.fr",
        helper: "Séparées par virgule. Google Workspace accepté.",
        validate: validateRecipientList,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  OUTLOOK — recipient list
  // ════════════════════════════════════════════════════════════════════
  outlook: {
    brandColor: { bg: "bg-[#0078D4]", hover: "hover:bg-[#006bbe]" },
    docUrl: "https://support.microsoft.com/en-us/office/welcome-to-outlook-com-3920a3c9-2c5b-4a5b-8c5d-1e7e88a45f23",
    buildSteps: () => [
      {
        title: "Pas de clé API à créer",
        body: "Les emails sont envoyés depuis Revold via Resend (DKIM/SPF configurés sur revold.io, donc pas marqués spam).",
      },
      {
        title: "Listez les adresses Outlook / M365 destinataires",
        notes: [
          "Séparez les emails par virgule, point-virgule ou espace.",
          "Microsoft 365 accepté (alice@entreprise.onmicrosoft.com par ex.).",
        ],
      },
    ],
    fields: [
      {
        key: "recipients",
        label: "Adresses Outlook destinataires",
        type: "text",
        placeholder: "alice@outlook.com, bob@company.com",
        helper: "Séparées par virgule. Microsoft 365 accepté.",
        validate: validateRecipientList,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  //  PRAIZ — webhook secret (Bearer)
  // ════════════════════════════════════════════════════════════════════
  praiz: {
    brandColor: { bg: "bg-fuchsia-600", hover: "hover:bg-fuchsia-700" },
    docUrl: "https://help.praiz.io/en/category/public-api-webhooks-1mvk6ti/",
    buildSteps: () => [
      {
        title: "Demandez l'activation API à Praiz",
        body: "Contactez hello@praiz.io pour activer l'API webhooks sur votre compte.",
        deepLink: { url: "mailto:hello@praiz.io?subject=Activation%20API%20webhooks", label: "Écrire à hello@praiz.io" },
      },
      {
        title: "Générez un secret aléatoire 32+ caractères",
        notes: [
          "Sur macOS/Linux : `openssl rand -hex 32` dans un terminal.",
          "Sur Windows PowerShell : `[Convert]::ToHexString((1..32 | %% { Get-Random -Max 256 }))`.",
          "Ce secret servira à signer chaque webhook entrant pour authentifier Praiz côté Revold.",
        ],
      },
      {
        title: "Configurez Praiz",
        notes: [
          "Dans Praiz : ajoutez une URL webhook = celle fournie par Revold après cette étape.",
          "Header HTTP : Authorization: Bearer <votre secret>.",
        ],
      },
      {
        title: "Collez le secret dans Revold",
        body: "Revold vérifiera ensuite chaque webhook entrant avec ce secret (HMAC timing-safe).",
      },
    ],
    fields: [
      {
        key: "webhook_secret",
        label: "Webhook Secret (Bearer)",
        type: "password",
        placeholder: "32+ chars random",
        monospace: true,
        validate: (v) => {
          if (!v) return null;
          if (v.length < 16) return { severity: "error", title: "❌ Secret trop court.", body: "Utilisez 32+ caractères pour la sécurité (openssl rand -hex 32)." };
          if (v.length < 32) return { severity: "warning", title: "⚠️ Secret accepté mais court.", body: "Recommandé : 32+ caractères." };
          return { severity: "ok", title: "✓ Longueur OK.", body: undefined };
        },
      },
    ],
  },
};

export function getWizardConfig(toolKey: string): WizardConfig | null {
  return WIZARD_CONFIGS[toolKey] ?? null;
}
