import type { SupabaseClient } from "@supabase/supabase-js";
import { EnrichedCompaniesPanel, type EnrichedRow } from "./enriched-companies-panel";

/**
 * Entreprises ENRICHIES — chargement serveur (300 plus récentes + total exact),
 * affichage dans un panneau client dépliable avec pagination (même modèle que
 * « Identités à valider »).
 */
export async function EnrichedCompaniesTable({ supabase, orgId }: { supabase: SupabaseClient; orgId: string }) {
  const FULL =
    "name, legal_name, siren, siret, vat_number, official_employee_range, official_revenue, official_revenue_year, activity_label, enriched_at";
  const BASE =
    "name, legal_name, siren, siret, vat_number, official_employee_range, official_revenue, official_revenue_year, enriched_at";
  let rows: EnrichedRow[] = [];
  let total: number | null = null;
  try {
    const run = async (cols: string): Promise<{ data: unknown; error: { message: string } | null; count: number | null }> =>
      (await supabase
        .from("companies")
        .select(cols, { count: "exact" })
        .eq("organization_id", orgId)
        .not("siren", "is", null)
        .order("enriched_at", { ascending: false, nullsFirst: false })
        .limit(300)) as { data: unknown; error: { message: string } | null; count: number | null };
    let res = await run(FULL);
    // Colonne secteur absente (migration non appliquée) → colonnes de base.
    if (res.error && /activity_label/.test(res.error.message)) res = await run(BASE);
    if (!res.error) {
      rows = (res.data as EnrichedRow[] | null) ?? [];
      total = res.count;
    }
  } catch {
    rows = [];
  }
  if (rows.length === 0) return null;

  return <EnrichedCompaniesPanel rows={rows} total={total} />;
}
