import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// En-têtes de sécurité HTTP — durcissement examiné par tout scanner DSI et
// pentest (contrôles SoA 8.24/8.26). Appliqués à toutes les routes.
// Pas de Content-Security-Policy stricte ici : elle casserait les scripts
// inline Next + tiers (Sentry) sans nonce ; à traiter séparément avec un nonce
// via middleware (noté au plan M1). Report-Only serait le prochain palier.
const SECURITY_HEADERS = [
  // Force HTTPS pendant 2 ans, sous-domaines inclus (préchargement possible).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Empêche le MIME-sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Anti-clickjacking (doublé par frame-ancestors si CSP ajoutée plus tard).
  { key: "X-Frame-Options", value: "DENY" },
  // Ne fuit pas l'URL complète vers les tiers.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Coupe l'accès par défaut aux capteurs sensibles (le micro reste autorisé
  // en same-origin pour la dictée / tour de contrôle vocale).
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
  // N'expose pas la stack technique.
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
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
