/**
 * Canonical Integration Score
 *
 * Single source of truth for the HubSpot integration score shown in the
 * header AND on the Intégration page. Designed to be deterministic — the
 * same input always produces the same score, no matter how many times
 * the function is called.
 *
 * Why this matters: previous implementations used a sample-based
 * `avgEnrichmentRate` which fluctuated 5-10 points between refreshes
 * because HubSpot Search returns slightly different samples each time.
 *
 * The new formula relies only on stable counts:
 *   • 50 pts — number of business integrations detected (max 7+ tools)
 *   • 20 pts — depth of property synchronisation (max 200 properties)
 *   • 15 pts — owners on the portal (team size proxy)
 *   • 15 pts — distinct active users across detected integrations
 *   ─────────
 *   100 pts total
 */

import type { DetectedIntegration } from "./detect-integrations";

// Tool keys we never want to count as "business integrations" — they are
// system / messaging / chat tools, not RevOps business apps.
export const NOISE_INTEGRATION_KEYS = new Set([
  "outlook", "gmail", "slack", "zoom", "calendly",
  "intercom", "zendesk", "crisp", "freshdesk",
]);

export const NOISE_LABEL_REGEX = new RegExp(
  [
    // Messaging / chat / visio / support
    "\\boutlook\\b", "\\bgmail\\b", "\\bslack\\b", "\\bzoom\\b",
    "calendly", "intercom", "zendesk", "\\bcrisp\\b", "freshdesk",
    "google\\s*calendar", "\\bteams\\b", "whatsapp", "messenger",
    // Files & manual imports / exports
    "\\.xlsx?$", "\\.csv$", "\\.xls$",
    "export\\s*contact", "export\\s*csv", "\\bexports?\\b",
    "\\bimports?\\b", "migration",
    // HubSpot system meters & parameters
    "api[-_\\s]*calls", "api[-_\\s]*usage", "daily[-_\\s]*usage",
    "^paramètre", "^parameter", "créer\\s*et\\s*associer", "create\\s*and\\s*associate",
    // Forms (HubSpot native or third-party form builders)
    "\\bformulaire(s)?\\b", "\\bformulaire\\s*de\\s*contact\\b", "\\bcontact\\s*form\\b",
    // News / data feeds — not business automation tools
    "\\bcfnews\\b", "cf[-_\\s]?news",
    "\\bnews(letter)?\\b", "rss\\s*feed", "data\\s*feed",
  ].join("|"),
  "i",
);

/**
 * Apply the canonical "business integration" filter — used everywhere we
 * display or score the integrations list (page, header, KPIs).
 */
export function filterBusinessIntegrations(
  integrations: DetectedIntegration[],
): DetectedIntegration[] {
  return integrations.filter(
    (i) => !NOISE_INTEGRATION_KEYS.has(i.key) && !NOISE_LABEL_REGEX.test(i.label),
  );
}

export type IntegrationScoreBreakdown = {
  score: number;
  parts: {
    integrations: number;
    properties: number;
    owners: number;
    adoption: number;
  };
};

/**
 * Compute the canonical integration score from a filtered list of business
 * integrations and the portal owner count. Pure function — deterministic.
 */
export function computeIntegrationScore(
  businessIntegrations: DetectedIntegration[],
  ownersCount: number,
): IntegrationScoreBreakdown {
  const totalIntegrations = businessIntegrations.length;
  const totalSyncedProperties = businessIntegrations.reduce(
    (s, i) => s + i.totalProperties,
    0,
  );

  // Distinct users across all integrations (deduped)
  const distinctUsers = new Set<string>();
  for (const i of businessIntegrations) {
    for (const u of i.topUsers) distinctUsers.add(u.ownerId);
  }
  const totalActiveUsers = distinctUsers.size;

  // ── Deterministic scoring (no sample-based components) ──
  // 50 pts max for the count of integrations (~7 tools = full score)
  const integrationsScore = Math.min(50, totalIntegrations * 7);

  // 20 pts max for the depth of synced properties (~200 properties = full score)
  const propertiesScore = Math.min(20, Math.floor(totalSyncedProperties / 10));

  // 15 pts max for the team size (10+ owners on the portal)
  const ownersScore =
    ownersCount >= 10 ? 15 :
    ownersCount >= 5 ? 10 :
    ownersCount >= 1 ? 5 : 0;

  // 15 pts max for the distinct users actually using a connected tool
  const adoptionScore =
    totalActiveUsers >= 10 ? 15 :
    totalActiveUsers >= 5 ? 10 :
    totalActiveUsers >= 1 ? 5 : 0;

  const score = integrationsScore + propertiesScore + ownersScore + adoptionScore;

  return {
    score,
    parts: {
      integrations: integrationsScore,
      properties: propertiesScore,
      owners: ownersScore,
      adoption: adoptionScore,
    },
  };
}
