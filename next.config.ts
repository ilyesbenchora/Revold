import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// Wrappe la config Next avec Sentry seulement si DSN est configuré.
// Sinon on retourne la config telle quelle pour ne pas casser les builds locaux.
const finalConfig =
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN
    ? withSentryConfig(nextConfig, {
        silent: true,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        disableLogger: true,
      })
    : nextConfig;

export default finalConfig;
