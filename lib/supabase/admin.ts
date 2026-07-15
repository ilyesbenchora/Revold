import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase service-role (bypass RLS) — à n'utiliser QUE côté serveur
 * dans des contextes sans session utilisateur (ex: webhook WhatsApp entrant).
 * Ne jamais exposer côté client.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin: URL ou SERVICE_ROLE_KEY manquant.");
  return createClient(url, key, { auth: { persistSession: false } });
}
