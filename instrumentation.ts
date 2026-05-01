/**
 * Next.js instrumentation hook — appelé une fois au démarrage du runtime.
 * Charge la config Sentry adaptée à l'environnement (node vs edge).
 *
 * Doc: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

