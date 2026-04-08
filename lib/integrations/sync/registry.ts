/**
 * Provider registry — maps each tool key to its sync connector.
 *
 * Adding a new provider:
 *   1. Implement a new SourceConnector in ./connectors/<name>.ts
 *   2. Replace the stub entry below with your real connector
 *
 * Everything else (auth, credentials storage, API route, UI orchestration,
 * sync_logs) is already generic and won't need to change.
 */

import type { SourceConnector } from "./types";
import { stripeConnector } from "./connectors/stripe";
import { pipedriveConnector } from "./connectors/pipedrive";
import { makeStubConnector } from "./connectors/stub";

export const SYNC_REGISTRY: Record<string, SourceConnector> = {
  // ── Billing ────────────────────────────────────────────────────
  stripe: stripeConnector,
  pennylane: makeStubConnector("Pennylane"),
  sellsy: makeStubConnector("Sellsy"),
  axonaut: makeStubConnector("Axonaut"),
  quickbooks: makeStubConnector("QuickBooks"),

  // ── CRM ────────────────────────────────────────────────────────
  salesforce: makeStubConnector("Salesforce"),
  pipedrive: pipedriveConnector,
  zoho: makeStubConnector("Zoho CRM"),
  monday: makeStubConnector("monday CRM"),

  // ── Service client ─────────────────────────────────────────────
  intercom: makeStubConnector("Intercom"),
  zendesk: makeStubConnector("Zendesk"),
  crisp: makeStubConnector("Crisp"),
  freshdesk: makeStubConnector("Freshdesk"),
};

export function getConnector(provider: string): SourceConnector | null {
  return SYNC_REGISTRY[provider] ?? null;
}
