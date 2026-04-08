/**
 * Generic sync framework for any provider connected directly to Revold.
 *
 * Each provider implements a `SourceConnector` that takes a SyncContext and
 * returns a SyncResult. The orchestrator (registry.ts + the API route) is
 * agnostic of which provider is running.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncContext = {
  supabase: SupabaseClient;
  orgId: string;
  provider: string;
  /** Primary credential (the password-type field saved in integrations.access_token). */
  primaryToken: string;
  /** Full credential map saved in integrations.metadata (contains all auth fields). */
  credentials: Record<string, string>;
};

export type SyncStatCount = {
  contacts?: number;
  companies?: number;
  invoices?: number;
  payments?: number;
  subscriptions?: number;
  tickets?: number;
  deals?: number;
};

export type SyncResult = {
  ok: boolean;
  message: string;
  counts: SyncStatCount;
  /** Total entities processed (sum of counts). */
  total: number;
  /** ISO timestamp when the sync ran. */
  ranAt: string;
  /** True when the connector is a stub awaiting implementation. */
  notImplemented?: boolean;
};

export type SourceConnector = (ctx: SyncContext) => Promise<SyncResult>;

/** Build a successful SyncResult from raw counts. */
export function ok(message: string, counts: SyncStatCount): SyncResult {
  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
  return { ok: true, message, counts, total, ranAt: new Date().toISOString() };
}

/** Build a failed SyncResult. */
export function fail(message: string): SyncResult {
  return {
    ok: false,
    message,
    counts: {},
    total: 0,
    ranAt: new Date().toISOString(),
  };
}

/** Build a "not yet implemented" SyncResult so stubs surface gracefully in the UI. */
export function notYetImplemented(provider: string): SyncResult {
  return {
    ok: true,
    message: `Connecteur ${provider} en cours d'implémentation. Vos identifiants sont sauvegardés en sécurité.`,
    counts: {},
    total: 0,
    ranAt: new Date().toISOString(),
    notImplemented: true,
  };
}
