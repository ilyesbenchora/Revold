/**
 * Sentry — config serveur (Node.js runtime sur Vercel Functions).
 * Capture les erreurs serveur dans les routes /api et les Server Components.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

if (dsn && env === "production") {
  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: 0.1,
    // Pas de PII automatique : on contrôle ce qu'on envoie via setUser/setContext
    sendDefaultPii: false,
  });
}
