/**
 * Tuiles KPI configurables d'une page — serveur.
 *
 * Les tuiles PAR DÉFAUT restent calculées en dur dans chaque page (mêmes
 * valeurs qu'avant) mais reçoivent une clé stable : l'utilisateur peut les
 * masquer / réafficher. Les tuiles AJOUTÉES viennent des suggestions du pôle
 * (catalogue du formulaire d'alerte) ou d'un KPI personnalisé, et leur valeur
 * est résolue ici avec le même contrat que le cron d'alertes
 * (resolveKpiValue / valueFromAggSpec).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatTile } from "@/components/kpi-stat-tiles";
import { getPageCustomization, resolveAddedTiles, type PageCustomization } from "@/lib/kpi/page-tiles";
import { tileSuggestionsForPage, PAGE_TILE_TEAM } from "@/lib/kpi/tile-catalog";
import { KpiTilesEditor, type EditorTile, type TileAlertRow } from "./kpi-tiles-editor";

export type DefaultTile = StatTile & {
  key: string;
  /** Valeur numérique brute — rend la tuile sélectionnable dans l'alerte chirurgicale. */
  raw?: number | null;
  /** Unité de la valeur brute (percent | currency | count). */
  rawUnit?: "percent" | "currency" | "count";
};

/** Équipe d'alerte chirurgicale par page (mêmes valeurs que BlockDataTable.team). */
const PAGE_SURGICAL_TEAM: Record<string, string> = {
  perf_ventes: "sales",
  perf_marketing: "marketing",
  audit_paiement_facturation: "finance",
  audit_service_client: "csm",
  audit_adoption: "revops",
  audit_donnees: "revops",
};

export async function ConfigurableKpiTiles({
  supabase,
  orgId,
  pageKey,
  defaults,
  customization,
}: {
  supabase: SupabaseClient;
  orgId: string;
  pageKey: string;
  defaults: DefaultTile[];
  /** Perso déjà chargée par la page (évite un second fetch quand elle gère aussi ses blocs). */
  customization?: PageCustomization;
}) {
  const cust = customization ?? (await getPageCustomization(supabase, orgId, pageKey));

  const visibleDefaults = defaults.filter((d) => !cust.hiddenTiles.has(d.key));
  const added = await resolveAddedTiles(supabase, orgId, cust.added);

  const tiles: EditorTile[] = [
    ...visibleDefaults.map<EditorTile>((d) => ({
      key: d.key,
      kind: "default",
      label: d.label,
      value: d.value,
      tone: d.tone,
      sub: d.sub,
      verdict: d.verdict,
    })),
    ...added.map<EditorTile>((a) => ({
      key: `added-${a.rowId}`,
      kind: "added",
      rowId: a.rowId,
      label: a.label,
      value: a.value,
      tone: "accent",
      sub: a.sub,
      subTone: a.subTone,
    })),
  ];

  const hiddenDefaults = defaults
    .filter((d) => cust.hiddenTiles.has(d.key))
    .map((d) => ({ key: d.key, label: d.label, rowId: cust.hiddenTiles.get(d.key) as string }));

  // Lignes de l'alerte chirurgicale : chaque tuile avec valeur numérique connue
  // (mêmes lignes sélectionnables que sur une table de données).
  const alertRows: TileAlertRow[] = [
    ...visibleDefaults
      .filter((d) => typeof d.raw === "number" && !Number.isNaN(d.raw))
      .map((d) => ({ name: d.label, value: d.raw as number })),
    ...added
      .filter((a) => typeof a.raw === "number" && !Number.isNaN(a.raw))
      .map((a) => ({ name: a.label, value: a.raw as number })),
  ];

  return (
    <KpiTilesEditor
      pageKey={pageKey}
      team={PAGE_TILE_TEAM[pageKey] ?? "revops"}
      alertTeam={PAGE_SURGICAL_TEAM[pageKey] ?? "revops"}
      alertRows={alertRows}
      tiles={tiles}
      hiddenDefaults={hiddenDefaults}
      suggestions={tileSuggestionsForPage(pageKey)}
    />
  );
}
