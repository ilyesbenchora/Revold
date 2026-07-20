"use client";

import { SurgicalAlertButton, type SurgicalUnit } from "./surgical-alert-button";
import type { SavedTable } from "./data-table-card";

type Row = { name: string; value: number };

/**
 * CTA « alerte technique » chirurgical d'une table de données sauvegardée.
 * Adaptateur au-dessus de {@link SurgicalAlertButton} : la table fournit
 * naturellement une spec d'agrégat, donc le cron rapproche l'alerte des vraies
 * données sans passer par l'agent.
 */
export function TableAlertButton({ table, rows, team }: { table: SavedTable; rows: Row[]; team: string }) {
  return (
    <SurgicalAlertButton
      title={table.title}
      scopeLabel={`la table « ${table.title} » (${table.entity} · groupé par ${table.group_by})`}
      impactScope={`la table ${table.title}`}
      rows={rows}
      team={team}
      unit={(table.unit_mode as SurgicalUnit) || "count"}
      aggSpec={{
        entity: table.entity,
        groupBy: table.group_by,
        measure: table.measure,
        field: table.field,
      }}
      crossed={Boolean(table.custom_kpi)}
      totalLabel="Total de la table"
      sourceKey={`table:${table.id}`}
    />
  );
}
