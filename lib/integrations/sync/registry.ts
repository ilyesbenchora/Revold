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
import { intercomConnector } from "./connectors/intercom";
import { zendeskConnector } from "./connectors/zendesk";
import { freshdeskConnector } from "./connectors/freshdesk";
import { crispConnector } from "./connectors/crisp";
import { salesforceConnector } from "./connectors/salesforce";
import { zohoConnector } from "./connectors/zoho";
import { mondayConnector } from "./connectors/monday";
import { pennylaneConnector } from "./connectors/pennylane";
import { sellsyConnector } from "./connectors/sellsy";
import { axonautConnector } from "./connectors/axonaut";
import { quickbooksConnector } from "./connectors/quickbooks";

export const SYNC_REGISTRY: Record<string, SourceConnector> = {
  // ── Billing & ERP ──────────────────────────────────────────────
  stripe: stripeConnector,
  pennylane: pennylaneConnector,
  sellsy: sellsyConnector,
  axonaut: axonautConnector,
  quickbooks: quickbooksConnector,

  // ── CRM ────────────────────────────────────────────────────────
  salesforce: salesforceConnector,
  pipedrive: pipedriveConnector,
  zoho: zohoConnector,
  monday: mondayConnector,

  // ── Service client ─────────────────────────────────────────────
  intercom: intercomConnector,
  zendesk: zendeskConnector,
  crisp: crispConnector,
  freshdesk: freshdeskConnector,
};

export function getConnector(provider: string): SourceConnector | null {
  return SYNC_REGISTRY[provider] ?? null;
}
