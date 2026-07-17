/**
 * Providers OAuth « publicité & web » (Google Analytics, Google Ads, Meta Ads,
 * LinkedIn Ads), branchés sur le même flow générique que HubSpot.
 *
 * Le code est prêt pour la prod ; il devient « live » dès que les identifiants
 * OAuth (client id/secret) sont fournis en variables d'environnement.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export type OAuthProvider = {
  key: string;
  label: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Paramètres additionnels sur l'URL d'autorisation (ex: access_type Google). */
  extraAuthParams?: Record<string, string>;
  /** Style d'auth à l'échange du token : body (défaut) ou basic (Authorization header). */
  tokenAuthStyle?: "body" | "basic";
};

export const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
  google_analytics: {
    key: "google_analytics",
    label: "Google Analytics",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  google_ads: {
    key: "google_ads",
    label: "Google Ads",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/adwords"],
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  meta_ads: {
    key: "meta_ads",
    label: "Meta Ads",
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["ads_read", "business_management"],
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
  },
  linkedin_ads: {
    key: "linkedin_ads",
    label: "LinkedIn Ads",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["r_ads", "r_ads_reporting"],
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
  },
  // ── OAuth2 standards branchés sur le flow générique (live dès env fournies) ──
  google_calendar: {
    key: "google_calendar",
    label: "Google Calendar",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  salesforce: {
    key: "salesforce",
    label: "Salesforce",
    authUrl: "https://login.salesforce.com/services/oauth2/authorize",
    tokenUrl: "https://login.salesforce.com/services/oauth2/token",
    scopes: ["api", "refresh_token"],
    clientIdEnv: "SALESFORCE_CLIENT_ID",
    clientSecretEnv: "SALESFORCE_CLIENT_SECRET",
  },
  intercom: {
    key: "intercom",
    label: "Intercom",
    authUrl: "https://app.intercom.com/oauth",
    tokenUrl: "https://api.intercom.io/auth/eagle/token",
    scopes: [], // permissions définies dans l'app Intercom
    clientIdEnv: "INTERCOM_CLIENT_ID",
    clientSecretEnv: "INTERCOM_CLIENT_SECRET",
  },
  pipedrive: {
    key: "pipedrive",
    label: "Pipedrive",
    authUrl: "https://oauth.pipedrive.com/oauth/authorize",
    tokenUrl: "https://oauth.pipedrive.com/oauth/token",
    scopes: [], // scopes définis dans l'app Pipedrive
    clientIdEnv: "PIPEDRIVE_CLIENT_ID",
    clientSecretEnv: "PIPEDRIVE_CLIENT_SECRET",
    tokenAuthStyle: "basic",
  },
};

export function getOAuthProvider(key: string): OAuthProvider | null {
  return OAUTH_PROVIDERS[key] ?? null;
}

export function providerRedirectUri(key: string): string {
  return `${APP_URL}/api/integrations/oauth/${key}/callback`;
}

/** URL d'autorisation pour lancer le flow. */
export function buildAuthUrl(p: OAuthProvider, state: string): string {
  const clientId = process.env[p.clientIdEnv] ?? "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: providerRedirectUri(p.key),
    response_type: "code",
    state,
    ...(p.extraAuthParams ?? {}),
  });
  // Certains providers (Intercom, Pipedrive) définissent les scopes dans l'app
  // et refusent un paramètre scope vide → on ne l'ajoute que s'il y en a.
  if (p.scopes.length > 0) params.set("scope", p.scopes.join(" "));
  return `${p.authUrl}?${params.toString()}`;
}

export type OAuthTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

/** Échange le code d'autorisation contre des tokens (POST form standard OAuth2). */
export async function exchangeCode(p: OAuthProvider, code: string): Promise<OAuthTokens> {
  const clientId = process.env[p.clientIdEnv];
  const clientSecret = process.env[p.clientSecretEnv];
  if (!clientId || !clientSecret) throw new Error(`Identifiants OAuth manquants pour ${p.key}`);

  const basic = p.tokenAuthStyle === "basic";
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: providerRedirectUri(p.key),
    // En Basic, les identifiants vont dans l'en-tête, pas dans le corps.
    ...(basic ? {} : { client_id: clientId, client_secret: clientSecret }),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (basic) headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;

  const res = await fetch(p.tokenUrl, { method: "POST", headers, body });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Échange OAuth ${p.key} échoué (${res.status}) : ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as OAuthTokens;
}
