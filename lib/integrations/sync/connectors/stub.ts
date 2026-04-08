/**
 * Generic stub connector — used for tools whose ingestion logic is not yet
 * implemented. Returns a clean "in progress" SyncResult so the rest of the
 * flow (UI, notifications) keeps working.
 *
 * Each stub records the saved credentials in the integrations table (already
 * done by the connect action) and surfaces a "Bientôt disponible" message
 * instead of crashing the orchestrator.
 *
 * To activate a real ingestion: replace `makeStubConnector("xxx")` in
 * registry.ts with a full SourceConnector implementation.
 */

import type { SourceConnector } from "../types";
import { notYetImplemented } from "../types";

export function makeStubConnector(provider: string): SourceConnector {
  return async () => notYetImplemented(provider);
}
