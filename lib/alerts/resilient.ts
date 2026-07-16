import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Écritures « alerts » résilientes aux colonnes manquantes : si une migration
 * n'a pas encore été appliquée (ex : cross_sources, threshold_secondary,
 * agent_key…), on retire la colonne fautive et on réessaie, plutôt que d'échouer.
 */

function missingColumn(message: string): string | null {
  // PostgREST : "Could not find the 'cross_sources' column of 'alerts' in the schema cache"
  const a = /Could not find the '([a-z_0-9]+)' column/i.exec(message);
  if (a) return a[1];
  // Postgres : column "cross_sources" of relation "alerts" does not exist
  const b = /column "?([a-z_0-9]+)"? of relation/i.exec(message);
  if (b) return b[1];
  const c = /column ([a-z_0-9]+) does not exist/i.exec(message);
  if (c) return c[1];
  return null;
}

/** Insert résilient : retire les colonnes inconnues et réessaie (max 6 passes). */
export async function insertAlertResilient(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ id: string | null; error: string | null; dropped: string[] }> {
  const attempt = { ...row };
  const dropped: string[] = [];
  for (let i = 0; i < 6; i++) {
    const { data, error } = await supabase.from("alerts").insert(attempt).select("id").single();
    if (!error) return { id: (data?.id as string) ?? null, error: null, dropped };
    const col = missingColumn(error.message);
    if (col && col in attempt) {
      delete attempt[col];
      dropped.push(col);
      continue;
    }
    return { id: null, error: error.message, dropped };
  }
  return { id: null, error: "Trop de colonnes manquantes", dropped };
}

/** Update résilient : retire les colonnes inconnues et réessaie (max 6 passes). */
export async function updateAlertResilient(
  supabase: SupabaseClient,
  patch: Record<string, unknown>,
  match: { id: string; organization_id: string },
): Promise<{ error: string | null; dropped: string[] }> {
  const attempt = { ...patch };
  const dropped: string[] = [];
  for (let i = 0; i < 6; i++) {
    const { error } = await supabase
      .from("alerts")
      .update(attempt)
      .eq("id", match.id)
      .eq("organization_id", match.organization_id);
    if (!error) return { error: null, dropped };
    const col = missingColumn(error.message);
    if (col && col in attempt) {
      delete attempt[col];
      dropped.push(col);
      continue;
    }
    return { error: error.message, dropped };
  }
  return { error: "Trop de colonnes manquantes", dropped };
}
