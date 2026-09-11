/**
 * Socle SEO / GEO (Generative Engine Optimization) du site revold.ai.
 *
 * Une seule source de vérité pour les FAITS de marque (nom, éditeur,
 * fondateur, tarifs, intégrations, liens) réutilisée par les métadonnées, les
 * données structurées schema.org, `llms.txt` et les pages de contenu. Les
 * moteurs génératifs (ChatGPT, Claude, Perplexity, AI Overviews) citent plus
 * volontiers une entité décrite de façon COHÉRENTE partout : même nom, même
 * définition, mêmes chiffres.
 */

import { PLANS, TRIAL_DAYS } from "@/lib/billing/plans";

export const SITE_URL = "https://revold.ai";
export const SITE_NAME = "Revold";

/** Définition canonique en une phrase — reprise mot pour mot partout (GEO). */
export const BRAND_DEFINITION =
  "Revold est une plateforme française de Revenue Intelligence et de pilotage RevOps qui connecte le CRM, la facturation, la banque et le support des entreprises B2B, réconcilie leurs données par SIREN, SIRET et TVA, et transforme ces données en prévisions, alertes et actions.";

export const BRAND = {
  name: SITE_NAME,
  alternateNames: ["Revold — Revenue Intelligence", "Revold.ai", "Revold RevOps"],
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  ogImage: `${SITE_URL}/og.png`,
  editor: "Air Rise Inc.",
  foundingDate: "2025",
  founder: { name: "Ilyes Benchora", role: "Fondateur, expert RevOps", linkedin: "https://www.linkedin.com/company/revold" },
  country: "France",
  languages: ["fr-FR"],
  sameAs: ["https://www.linkedin.com/company/revold"],
  contact: { support: "support@revold.ai", security: "security@revold.ai", dpo: "dpo@revold.ai" },
  hosting: "Application hébergée à Paris (Vercel, région cdg1), base de données à Francfort (Supabase, AWS eu-central-1), IA Anthropic en zone EU sans rétention.",
  integrations: ["HubSpot", "Stripe", "Pennylane", "Chargebee", "GoCardless", "Sage"],
  notifications: ["Slack", "Microsoft Teams", "e-mail", "SMS", "WhatsApp"],
  trialDays: TRIAL_DAYS,
} as const;

/** Tarifs publics, lus depuis la source de vérité de la facturation. */
export const PRICING = [
  { key: "starter", name: PLANS.starter.name, monthly: PLANS.starter.monthlyPrice, yearly: PLANS.starter.yearlyPrice, connectors: "3 connecteurs" },
  { key: "growth", name: PLANS.growth.name, monthly: PLANS.growth.monthlyPrice, yearly: PLANS.growth.yearlyPrice, connectors: "6 connecteurs" },
  { key: "scale", name: PLANS.scale.name, monthly: PLANS.scale.monthlyPrice, yearly: PLANS.scale.yearlyPrice, connectors: "connecteurs illimités", from: true },
] as const;

export const fmtPrice = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(v);

/** Capacités clés (mêmes libellés que la home et la bibliothèque marketplace). */
export const CAPABILITIES = [
  "Rapprochement des comptes par SIREN, SIRET et numéro de TVA (API Sirene / INPI)",
  "Réconciliation CRM × facturation × banque : signé, facturé, encaissé sur une même ligne",
  "Prévisions de revenus pondérées et suivi des dates de fermeture",
  "Alertes et objectifs au câblage vérifié sur les vraies données",
  "Audit CRM automatique : complétude, doublons, orphelins, deals stagnants",
  "Équipe d'agents IA experts par pôle (ventes, marketing, service client, comptabilité)",
  "Tour de contrôle vocale : brief du jour et récaps d'équipe lus à voix haute",
  "Actions exécutées dans les outils connectés après validation humaine",
] as const;

// ── Générateurs JSON-LD (schema.org) ────────────────────────────────────────

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: BRAND.name,
    alternateName: [...BRAND.alternateNames],
    url: BRAND.url,
    logo: { "@type": "ImageObject", url: BRAND.logo },
    description: BRAND_DEFINITION,
    foundingDate: BRAND.foundingDate,
    founder: { "@type": "Person", "@id": `${SITE_URL}/a-propos#founder`, name: BRAND.founder.name, jobTitle: BRAND.founder.role },
    parentOrganization: { "@type": "Organization", name: BRAND.editor },
    areaServed: "FR",
    knowsLanguage: "fr",
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: BRAND.contact.support, availableLanguage: ["French"] }],
    sameAs: [...BRAND.sameAs],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: BRAND.name,
    url: SITE_URL,
    inLanguage: "fr-FR",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

/** Le produit : SoftwareApplication + offres (tarifs publics). */
export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: BRAND.name,
    alternateName: "Revold Revenue Intelligence",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Revenue Intelligence / RevOps",
    operatingSystem: "Web",
    url: SITE_URL,
    image: BRAND.ogImage,
    description: BRAND_DEFINITION,
    inLanguage: "fr-FR",
    featureList: [...CAPABILITIES],
    publisher: { "@id": `${SITE_URL}/#organization` },
    offers: PRICING.map((p) => ({
      "@type": "Offer",
      name: `Plan ${p.name}`,
      price: p.monthly.toFixed(2),
      priceCurrency: "EUR",
      url: `${SITE_URL}/tarifs`,
      availability: "https://schema.org/InStock",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: p.monthly.toFixed(2),
        priceCurrency: "EUR",
        unitText: "MONTH",
        billingIncrement: 1,
      },
    })),
  };
}

export type FaqItem = { q: string; a: string };
export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

export function webPageJsonLd(input: { path: string; name: string; description: string; about?: string[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}${input.path}#webpage`,
    url: `${SITE_URL}${input.path}`,
    name: input.name,
    description: input.description,
    inLanguage: "fr-FR",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#software` },
    ...(input.about ? { keywords: input.about.join(", ") } : {}),
  };
}

export function personJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/a-propos#founder`,
    name: BRAND.founder.name,
    jobTitle: BRAND.founder.role,
    worksFor: { "@id": `${SITE_URL}/#organization` },
    url: `${SITE_URL}/a-propos`,
    sameAs: [...BRAND.sameAs],
  };
}

export function blogPostingJsonLd(a: { slug: string; title: string; description: string; date: string; author: string; category?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${SITE_URL}/blog/${a.slug}#article`,
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    dateModified: a.date,
    inLanguage: "fr-FR",
    mainEntityOfPage: `${SITE_URL}/blog/${a.slug}`,
    image: BRAND.ogImage,
    author: { "@type": "Person", "@id": `${SITE_URL}/a-propos#founder`, name: a.author },
    publisher: { "@id": `${SITE_URL}/#organization` },
    ...(a.category ? { articleSection: a.category } : {}),
  };
}
