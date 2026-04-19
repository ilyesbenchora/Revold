/**
 * Devine un domaine + une icône emoji à partir d'un nom d'app HubSpot
 * (ex: "Slack Integration" -> { domain: "slack.com", icon: "💬" }).
 *
 * Utilisé pour afficher les logos sur la page intégration quand on n'a
 * que le nom retourné par /integrators-public.
 */

import { CONNECTABLE_TOOLS } from "./connect-catalog";

const ALIAS_TO_DOMAIN: Record<string, { domain: string; icon: string }> = {
  // CRM / Sales
  hubspot: { domain: "hubspot.com", icon: "🟧" },
  salesforce: { domain: "salesforce.com", icon: "☁️" },
  pipedrive: { domain: "pipedrive.com", icon: "📊" },
  zoho: { domain: "zoho.com", icon: "🟦" },
  // Email & comms
  gmail: { domain: "gmail.com", icon: "✉️" },
  google: { domain: "google.com", icon: "🔍" },
  outlook: { domain: "microsoft.com", icon: "📧" },
  microsoft: { domain: "microsoft.com", icon: "🪟" },
  office365: { domain: "office.com", icon: "📧" },
  slack: { domain: "slack.com", icon: "💬" },
  teams: { domain: "microsoft.com", icon: "👥" },
  zoom: { domain: "zoom.us", icon: "📹" },
  loom: { domain: "loom.com", icon: "🎬" },
  // Calling
  aircall: { domain: "aircall.io", icon: "📞" },
  ringover: { domain: "ringover.com", icon: "📞" },
  twilio: { domain: "twilio.com", icon: "📞" },
  callrail: { domain: "callrail.com", icon: "📞" },
  // Forms / events
  calendly: { domain: "calendly.com", icon: "📅" },
  typeform: { domain: "typeform.com", icon: "📝" },
  surveymonkey: { domain: "surveymonkey.com", icon: "🐵" },
  // Marketing / ads
  mailchimp: { domain: "mailchimp.com", icon: "🐵" },
  facebook: { domain: "facebook.com", icon: "📘" },
  meta: { domain: "meta.com", icon: "📘" },
  linkedin: { domain: "linkedin.com", icon: "💼" },
  google_ads: { domain: "ads.google.com", icon: "🎯" },
  twitter: { domain: "twitter.com", icon: "🐦" },
  x: { domain: "x.com", icon: "🐦" },
  // Billing / payment
  stripe: { domain: "stripe.com", icon: "💳" },
  pennylane: { domain: "pennylane.com", icon: "💶" },
  sellsy: { domain: "sellsy.com", icon: "🧾" },
  axonaut: { domain: "axonaut.com", icon: "💼" },
  quickbooks: { domain: "quickbooks.intuit.com", icon: "📒" },
  pandadoc: { domain: "pandadoc.com", icon: "📄" },
  docusign: { domain: "docusign.com", icon: "✍️" },
  qonto: { domain: "qonto.com", icon: "🏦" },
  // Support / CS
  intercom: { domain: "intercom.com", icon: "💬" },
  zendesk: { domain: "zendesk.com", icon: "🎟️" },
  crisp: { domain: "crisp.chat", icon: "💬" },
  freshdesk: { domain: "freshdesk.com", icon: "🎫" },
  // Productivity
  notion: { domain: "notion.so", icon: "📓" },
  asana: { domain: "asana.com", icon: "✅" },
  trello: { domain: "trello.com", icon: "📋" },
  monday: { domain: "monday.com", icon: "📅" },
  clickup: { domain: "clickup.com", icon: "🟣" },
  jira: { domain: "atlassian.com", icon: "🔷" },
  // Data / analytics
  segment: { domain: "segment.com", icon: "🧩" },
  mixpanel: { domain: "mixpanel.com", icon: "📈" },
  amplitude: { domain: "amplitude.com", icon: "📊" },
  fullstory: { domain: "fullstory.com", icon: "🎥" },
  hotjar: { domain: "hotjar.com", icon: "🔥" },
  // Outbound / sales engagement
  outreach: { domain: "outreach.io", icon: "🎯" },
  salesloft: { domain: "salesloft.com", icon: "🔄" },
  apollo: { domain: "apollo.io", icon: "🚀" },
  cognism: { domain: "cognism.com", icon: "🧠" },
  lusha: { domain: "lusha.com", icon: "🔍" },
  zoominfo: { domain: "zoominfo.com", icon: "📡" },
};

export function guessDomain(appName: string): { domain: string; icon: string } {
  const lower = appName.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  // 1) match exact dans le catalog officiel
  const fromCatalog = Object.entries(CONNECTABLE_TOOLS).find(
    ([key, tool]) => key.toLowerCase() === lower || tool.label.toLowerCase() === appName.toLowerCase(),
  );
  if (fromCatalog) {
    const [, tool] = fromCatalog;
    return { domain: tool.domain, icon: tool.icon };
  }

  // 2) match dans les alias étendus (par mot-clé)
  for (const [key, val] of Object.entries(ALIAS_TO_DOMAIN)) {
    if (lower.includes(key)) return val;
  }

  // 3) fallback : utilise le 1er mot de l'app + .com
  const firstWord = appName.toLowerCase().split(/[\s_-]+/)[0].replace(/[^a-z0-9]/g, "");
  return { domain: firstWord ? `${firstWord}.com` : "hubspot.com", icon: "🔌" };
}
