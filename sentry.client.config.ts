/**
 * Sentry — config browser. Capture les erreurs runtime côté client,
 * + Web Vitals. Désactivé hors prod pour éviter le bruit.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

if (dsn && env === "production") {
  Sentry.init({
    dsn,
    environment: env,
    // Sample 10% des sessions pour ne pas exploser la quota
    tracesSampleRate: 0.1,
    // Replay : 0% pour démarrer (volume + RGPD), à activer plus tard si besoin
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Ignore les erreurs non-actionnables qui polluent le dashboard
    ignoreErrors: [
      // Network connectivity (côté user, rien à fix)
      "NetworkError",
      "Failed to fetch",
      "Load failed",
      // Extensions Chrome
      /chrome-extension:\/\//i,
      // Erreurs de service workers/PWA
      "ResizeObserver loop limit exceeded",
    ],
  });
}
