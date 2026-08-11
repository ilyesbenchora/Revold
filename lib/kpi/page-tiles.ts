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
  /** Référence d'évolution (valeur de la veille) — absentes si migration non appliquée. */
  prev_value?: number | null;
  prev_value_at?: string | null;
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
    // Résilient à la migration prev_value non appliquée : on retire les
    // colonnes d'évolution et on réessaie plutôt que perdre la perso.
    const FULL_COLS = "id, kind, tile_key, title, forecast_type, agg_spec, unit_mode, position, prev_value, prev_value_at";
    const BASE_COLS = "id, kind, tile_key, title, forecast_type, agg_spec, unit_mode, position";
    const fetchWith = (cols: string) =>
      supabase
        .from("page_tiles")
        .select(cols)
        .eq("organization_id", orgId)
        .eq("page_key", pageKey)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
    let { data, error } = await fetchWith(FULL_COLS);
    if (error && /prev_value/.test(error.message)) {
      ({ data, error } = await fetchWith(BASE_COLS));
    }
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
  /** Évolution vs la référence de la veille (▲ vert / ▼ rouge / stable). */
  sub?: string;
  subTone?: "pos" | "neg" | "neutral";
};

/** Delta formaté dans l'unité de la tuile (percent → points). */
function formatDelta(delta: number, unit: string | null): string {
  const sign = delta > 0 ? "+" : "−";
  const abs = Math.abs(delta);
  if (unit === "percent") return `${sign}${abs.toLocaleString("fr-FR")} pts`;
  if (unit === "currency")
    return `${sign}${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(abs)}`;
  return `${sign}${abs.toLocaleString("fr-FR")}`;
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Résout la valeur ACTUELLE de chaque tuile ajoutée — même contrat que le cron
 * d'alertes : forecast_type → resolveKpiValue, sinon agg_spec → valueFromAggSpec.
 * L'évolution compare à une référence quotidienne stockée sur la ligne
 * (prev_value / prev_value_at, décalée dès qu'elle a plus de 24 h).
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

      let sub: string | undefined;
      let subTone: "pos" | "neg" | "neutral" | undefined;
      // "prev_value" absent de la ligne = migration non appliquée → pas d'évolution.
      if ("prev_value" in r && value != null) {
        const baseline = r.prev_value == null ? null : Number(r.prev_value);
        const prevAtMs = r.prev_value_at ? Date.parse(r.prev_value_at) : null;
        if (prevAtMs == null || Date.now() - prevAtMs > DAY_MS) {
          // Décale la référence : l'évolution du jour repart de la valeur actuelle.
          try {
            await supabase
              .from("page_tiles")
              .update({ prev_value: value, prev_value_at: new Date().toISOString() })
              .eq("organization_id", orgId)
              .eq("id", r.id);
          } catch {}
        }
        if (baseline != null && prevAtMs != null) {
          const delta = value - baseline;
          if (delta > 0) { sub = `▲ ${formatDelta(delta, r.unit_mode)}`; subTone = "pos"; }
          else if (delta < 0) { sub = `▼ ${formatDelta(delta, r.unit_mode)}`; subTone = "neg"; }
          else { sub = "Stable"; subTone = "neutral"; }
        } else {
          sub = "Évolution dès demain";
          subTone = "neutral";
        }
      }

      return {
        rowId: r.id,
        label: r.title ?? r.forecast_type ?? "KPI",
        value: formatTileValue(value, r.unit_mode),
        sub,
        subTone,
      };
    }),
  );
}
