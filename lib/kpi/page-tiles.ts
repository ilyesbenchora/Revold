// Lecture + résolution des personnalisations de page (table page_tiles) :
// tuiles KPI ajoutées (forecast_type OU agg_spec) et tuiles/blocs masqués.

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveKpiValue } from "@/lib/alerts/kpi-resolver";
import { valueFromAggSpec, type AggSpec } from "@/lib/alerts/agg-value";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";

export type PageTileRow = {
  id: string;
  kind: "kpi" | "hide_tile" | "hide_block";
  tile_key: string | null;
  title: string | null;
  forecast_type: string | null;
  agg_spec: AggSpec | null;
  unit_mode: string | null;
  position: number;
};

export type PageCustomization = {
  /** Tuiles KPI ajoutées, ordonnées. */
  added: PageTileRow[];
  /** Clés des tuiles par défaut masquées → id de ligne (pour restaurer). */
  hiddenTiles: Map<string, string>;
  /** Clés des blocs par défaut masqués → ligne (id pour restaurer + label affiché). */
  hiddenBlocks: Map<string, { rowId: string; label: string }>;
};

const EMPTY: PageCustomization = { added: [], hiddenTiles: new Map(), hiddenBlocks: new Map() };

/** Liste { rowId, label } des blocs masqués — props directes de BlocksManager. */
export function hiddenBlockList(cust: PageCustomization): Array<{ rowId: string; label: string }> {
  return [...cust.hiddenBlocks.values()];
}

/** Charge la personnalisation d'une page. Résilient : table absente → aucune perso. */
export async function getPageCustomization(
  supabase: SupabaseClient,
  orgId: string,
  pageKey: string,
): Promise<PageCustomization> {
  try {
    const { data, error } = await supabase
      .from("page_tiles")
      .select("id, kind, tile_key, title, forecast_type, agg_spec, unit_mode, position")
      .eq("organization_id", orgId)
      .eq("page_key", pageKey)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error || !data) return EMPTY;
    const rows = data as unknown as PageTileRow[];
    return {
      added: rows.filter((r) => r.kind === "kpi"),
      hiddenTiles: new Map(rows.filter((r) => r.kind === "hide_tile" && r.tile_key).map((r) => [r.tile_key as string, r.id])),
      hiddenBlocks: new Map(
        rows
          .filter((r) => r.kind === "hide_block" && r.tile_key)
          .map((r) => [r.tile_key as string, { rowId: r.id, label: r.title ?? (r.tile_key as string) }]),
      ),
    };
  } catch {
    return EMPTY;
  }
}

export function formatTileValue(v: number | null, unit: string | null): string {
  if (v == null) return "—";
  if (unit === "percent") return `${v.toLocaleString("fr-FR")} %`;
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  return v.toLocaleString("fr-FR");
}

export type ResolvedAddedTile = {
  rowId: string;
  label: string;
  value: string;
};

/**
 * Résout la valeur ACTUELLE de chaque tuile ajoutée — même contrat que le cron
 * d'alertes : forecast_type → resolveKpiValue, sinon agg_spec → valueFromAggSpec.
 */
export async function resolveAddedTiles(
  supabase: SupabaseClient,
  orgId: string,
  added: PageTileRow[],
): Promise<ResolvedAddedTile[]> {
  if (added.length === 0) return [];
  const token = added.some((r) => !r.forecast_type && r.agg_spec)
    ? await getHubSpotToken(supabase, orgId)
    : null;
  return Promise.all(
    added.map(async (r) => {
      let value: number | null = null;
      try {
        if (r.forecast_type) value = await resolveKpiValue(supabase, orgId, r.forecast_type);
        else if (r.agg_spec) value = await valueFromAggSpec(supabase, orgId, token, r.agg_spec);
      } catch {}
      return {
        rowId: r.id,
        label: r.title ?? r.forecast_type ?? "KPI",
        value: formatTileValue(value, r.unit_mode),
      };
    }),
  );
}
