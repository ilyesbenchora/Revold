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
import { KpiTilesEditor, type EditorTile } from "./kpi-tiles-editor";

export type DefaultTile = StatTile & { key: string };

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
      sub: "KPI ajouté",
    })),
  ];

  const hiddenDefaults = defaults
    .filter((d) => cust.hiddenTiles.has(d.key))
    .map((d) => ({ key: d.key, label: d.label, rowId: cust.hiddenTiles.get(d.key) as string }));

  return (
    <KpiTilesEditor
      pageKey={pageKey}
      team={PAGE_TILE_TEAM[pageKey] ?? "revops"}
      tiles={tiles}
      hiddenDefaults={hiddenDefaults}
      suggestions={tileSuggestionsForPage(pageKey)}
    />
  );
}
