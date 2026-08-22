// Lecture + résolution des personnalisations de page (table page_tiles) :
// tuiles KPI ajoutées (forecast_type OU agg_spec) et tuiles/blocs masqués.

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveKpiValue } from "@/lib/alerts/kpi-resolver";
import { valueFromAggSpec, type AggSpec } from "@/lib/alerts/agg-value";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { parseStoredPeriod, computePeriod, presetLabel, storedPeriodLabel } from "@/lib/reports/periods";

/**
 * agg_spec d'une tuile : la spec d'agrégat + les options d'affichage embarquées
 * (période choisie au funnel, libellé du pipeline ciblé).
 */
type TileAggSpec = AggSpec & { period_preset?: string; pipeline_label?: string };

export type PageTileRow = {
  id: string;
  kind: "kpi" | "hide_tile" | "hide_block" | "tile_order" | "tile_override";
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
  /** Ordre drag & drop de TOUTES les tuiles (clés, défaut + ajoutées) — vide = ordre naturel. */
  tileOrder: string[];
  /** Overrides des tuiles par défaut (✎) : clé → titre/description personnalisés. */
  tileOverrides: Map<string, { rowId: string; title: string | null; sub: string | null }>;
};

const EMPTY: PageCustomization = {
  added: [],
  hiddenTiles: new Map(),
  hiddenBlocks: new Map(),
  tileOrder: [],
  tileOverrides: new Map(),
};

/**
 * Spec d'APERÇU RÉEL d'un bloc de la page (option « Revold ») : un agrégat
 * déterministe représentatif du bloc, recalculé sur les vraies données dans la
 * fenêtre de suggestions (même moteur que les presets). Renseignée par la page
 * pour ses blocs travaillés (pipeline management, transactions à risque…) ; le
 * bloc lui-même se réaffiche toujours avec sa visualisation d'origine exacte.
 */
export type HiddenBlockPreview = {
  entity: string;
  groupBy: string;
  measure: string;
  field?: string | null;
  unit: "currency" | "count" | "percent";
  /** Vue de l'aperçu réel (bar/line/donut/table) — souvent « bar » pour un bloc riche. */
  view: "bar" | "line" | "donut" | "table";
};

export type HiddenBlockMeta = { view?: string; description?: string; preview?: HiddenBlockPreview };

/**
 * Liste des blocs masqués — props directes de BlocksManager. `meta` (optionnel)
 * décrit la visualisation d'origine de chaque bloc (clé → { view, description,
 * preview }) : `view` pilote l'aperçu schématique, `preview` un aperçu RÉEL.
 */
export function hiddenBlockList(
  cust: PageCustomization,
  meta?: (blockKey: string) => HiddenBlockMeta | undefined,
): Array<{ key: string; rowId: string; label: string; view?: string; description?: string; preview?: HiddenBlockPreview }> {
  return [...cust.hiddenBlocks.entries()].map(([key, h]) => ({
    key,
    rowId: h.rowId,
    label: h.label,
    ...(meta?.(key) ?? {}),
  }));
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
    // Ordre drag & drop des tuiles (ligne kind='tile_order', agg_spec.order).
    const orderRaw = (rows.find((r) => r.kind === "tile_order")?.agg_spec as unknown as { order?: unknown } | null)?.order;
    return {
      tileOrder: Array.isArray(orderRaw) ? orderRaw.filter((k): k is string => typeof k === "string") : [],
      added: rows.filter((r) => r.kind === "kpi"),
      hiddenTiles: new Map(rows.filter((r) => r.kind === "hide_tile" && r.tile_key).map((r) => [r.tile_key as string, r.id])),
      hiddenBlocks: new Map(
        rows
          .filter((r) => r.kind === "hide_block" && r.tile_key)
          .map((r) => [r.tile_key as string, { rowId: r.id, label: r.title ?? (r.tile_key as string) }]),
      ),
      tileOverrides: new Map(
        rows
          .filter((r) => r.kind === "tile_override" && r.tile_key)
          .map((r) => [
            r.tile_key as string,
            {
              rowId: r.id,
              title: r.title,
              sub: typeof (r.agg_spec as unknown as { sub?: unknown } | null)?.sub === "string"
                ? ((r.agg_spec as unknown as { sub: string }).sub)
                : null,
            },
          ]),
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
  /** Valeur numérique brute (null si non résoluble) — alimente l'alerte chirurgicale. */
  raw: number | null;
  /** Unité de la tuile (percent | currency | count). */
  rawUnit: string | null;
  /** Évolution vs la référence de la veille (▲ vert / ▼ rouge / stable). */
  sub?: string;
  subTone?: "pos" | "neg" | "neutral";
  /** Contexte de calcul affiché en tout petit : pipeline ciblé · période. */
  meta?: string;
  /** Drill-down : requête déterministe + filtres de la tuile (agg_spec) — null si non détaillable. */
  drill?: TileDrill | null;
  /** Câblage brut de la tuile — préremplit le funnel d'édition (✎ en mode Personnaliser). */
  aggSpec?: Record<string, unknown> | null;
  /** Tuile résolue par resolveKpiValue (recette réconciliée) — seul le titre est éditable. */
  forecastType?: string | null;
};

/** Cible de drill-down d'une tuile KPI (mêmes filtres que son calcul). */
export type TileDrill = {
  query: { entity: string; groupBy: string; measure?: string; field?: string; pipeline?: string };
  sources: string[];
  period: { from?: string; to?: string; all?: boolean };
  /** Tuile à ligne cible (CA signé, taux de perte…) : le détail est restreint à ce bucket. */
  bucket?: { raw: string; label: string } | null;
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
      let meta: string | undefined;
      let drill: TileDrill | null = null;
      try {
        if (r.forecast_type) value = await resolveKpiValue(supabase, orgId, r.forecast_type);
        else if (r.agg_spec) {
          const spec = r.agg_spec as TileAggSpec;
          // Période choisie au funnel : preset relatif recalculé à CHAQUE affichage
          // (« ce trimestre » suit le trimestre courant), plage custom figée.
          let dateFrom: string | null = null;
          let dateTo: string | null = null;
          let periodLabel: string | null = null;
          if (spec.period_preset) {
            const stored = parseStoredPeriod(spec.period_preset);
            if (stored.kind === "custom") {
              dateFrom = stored.from;
              dateTo = stored.to;
              periodLabel = storedPeriodLabel(spec.period_preset);
            } else if (stored.kind !== "description" && stored.preset !== "all") {
              const p = computePeriod(stored.preset, new Date());
              dateFrom = p.from;
              dateTo = p.to;
              periodLabel = presetLabel(stored.preset);
            }
          }
          value = await valueFromAggSpec(supabase, orgId, token, { ...spec, date_from: dateFrom, date_to: dateTo });
          const parts = [spec.pipeline_label, periodLabel].filter(Boolean);
          if (parts.length > 0) meta = parts.join(" · ");
          // Drill-down de la tuile : mêmes filtres que son calcul (bucket = tous).
          if (typeof spec.entity === "string" && spec.entity && typeof spec.groupBy === "string" && spec.groupBy) {
            drill = {
              query: {
                entity: spec.entity,
                groupBy: spec.groupBy,
                measure: spec.measure,
                field: spec.field ?? undefined,
                pipeline: spec.pipeline ?? undefined,
              },
              sources: Array.isArray(spec.sources) ? spec.sources : [],
              period: dateFrom && dateTo ? { from: dateFrom, to: dateTo, all: false } : { all: true },
              // Ligne cible (« Gagnés », « Dépassée »…) : le détail montre uniquement ces deals.
              bucket:
                typeof spec.target === "string" && spec.target && spec.target !== "Total"
                  ? { raw: spec.target, label: spec.target }
                  : null,
            };
          }
        }
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
        raw: value,
        rawUnit: r.unit_mode,
        sub,
        subTone,
        meta,
        drill,
        aggSpec: (r.agg_spec as Record<string, unknown> | null) ?? null,
        forecastType: r.forecast_type ?? null,
      };
    }),
  );
}
