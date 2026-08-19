/**
 * Templates de tableaux de bord — 2a du plan « tableaux personnalisables ».
 *
 * Un template = une composition de départ (tuiles KPI + tables de données)
 * seedée sous la clé board_<id> à la création du tableau, via l'infra
 * existante : page_tiles (kind 'kpi', agg_spec résolu par valueFromAggSpec)
 * et page_data_tables. AUCUN nouveau moteur : tout reste modifiable ensuite
 * comme n'importe quelle personnalisation (✎, masquage, drag & drop…).
 *
 * Un template n'est PROPOSÉ que si ses entités ont au moins un enregistrement
 * réellement synchronisé — on ne suggère jamais une page qui afficherait des
 * zéros (même philosophie que ENTITY_TARGETS du connecteur sur mesure).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type TemplateTile = {
  title: string;
  unit: "currency" | "count" | "percent";
  /** Spec d'agrégat — même contrat que le cron d'alertes (valueFromAggSpec). */
  agg: {
    entity: string;
    groupBy: string;
    measure: string;
    field?: string;
    target?: string;
    percent_of_total?: boolean;
    multiplier?: number;
  };
};

type TemplateTable = {
  title: string;
  entity: string;
  group_by: string;
  measure: string;
  field?: string | null;
  unit_mode?: "currency" | "count" | "percent" | null;
  view: "table" | "bar" | "line" | "donut";
  description?: string;
};

export type BoardTemplate = {
  id: string;
  label: string;
  description: string;
  /** Entités agrégeables requises (≥ 1 enregistrement synchronisé). */
  entities: string[];
  tiles: TemplateTile[];
  tables: TemplateTable[];
};

/** Table physique de chaque entité agrégeable (miroir de AGG_ENTITY_TABLES). */
const ENTITY_TABLE: Record<string, string> = {
  deals: "deals",
  invoices: "invoices",
  subscriptions: "subscriptions",
  transactions: "bank_transactions",
  tickets: "tickets",
};

// Libellés de statut des deals — mêmes valeurs que DEAL_STATUS_LABELS
// (tool-library) : les agg_spec ciblent ces lignes, ne pas les modifier seuls.
const WON = "Gagnés";
const LOST = "Perdus";
const OPEN = "En cours";

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "pipeline_commercial",
    label: "Pipeline commercial",
    description: "CA signé, pipeline en cours, taux de perte — et la répartition par étape.",
    entities: ["deals"],
    tiles: [
      { title: "CA signé", unit: "currency", agg: { entity: "deals", groupBy: "status", measure: "sum", field: "amount", target: WON } },
      { title: "Pipeline en cours", unit: "currency", agg: { entity: "deals", groupBy: "status", measure: "sum", field: "amount", target: OPEN } },
      { title: "Deals gagnés", unit: "count", agg: { entity: "deals", groupBy: "status", measure: "count", target: WON } },
      { title: "Taux de perte", unit: "percent", agg: { entity: "deals", groupBy: "outcome", measure: "count", target: LOST, percent_of_total: true } },
    ],
    tables: [
      { title: "Deals par étape", entity: "deals", group_by: "stage", measure: "count", unit_mode: "count", view: "bar", description: "Volume de deals à chaque étape du pipeline." },
      { title: "CA signé par mois", entity: "deals", group_by: "month_closed", measure: "sum", field: "amount", unit_mode: "currency", view: "line", description: "Montant des deals clôturés, mois par mois." },
    ],
  },
  {
    id: "cockpit_facturation",
    label: "Cockpit facturation",
    description: "CA facturé, encaissé, impayés — et la dynamique d'émission mensuelle.",
    entities: ["invoices"],
    tiles: [
      { title: "CA facturé", unit: "currency", agg: { entity: "invoices", groupBy: "status", measure: "sum", field: "amount_total" } },
      { title: "CA encaissé", unit: "currency", agg: { entity: "invoices", groupBy: "status", measure: "sum", field: "amount_paid" } },
      { title: "Impayés (reste dû)", unit: "currency", agg: { entity: "invoices", groupBy: "status", measure: "sum", field: "amount_due" } },
      { title: "Factures", unit: "count", agg: { entity: "invoices", groupBy: "status", measure: "count" } },
    ],
    tables: [
      { title: "Facturation par mois", entity: "invoices", group_by: "month_issued", measure: "sum", field: "amount_total", unit_mode: "currency", view: "line", description: "Montant facturé par mois d'émission." },
      { title: "Factures par statut", entity: "invoices", group_by: "status", measure: "count", unit_mode: "count", view: "donut", description: "Répartition payées / ouvertes / en retard." },
    ],
  },
  {
    id: "revenu_recurrent",
    label: "Revenu récurrent",
    description: "MRR, ARR, abonnements actifs et churn — la santé du récurrent.",
    entities: ["subscriptions"],
    tiles: [
      { title: "MRR actif", unit: "currency", agg: { entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr", target: "active" } },
      { title: "ARR", unit: "currency", agg: { entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr", target: "active", multiplier: 12 } },
      { title: "Abonnements actifs", unit: "count", agg: { entity: "subscriptions", groupBy: "status", measure: "count", target: "active" } },
      { title: "Taux d'annulation", unit: "percent", agg: { entity: "subscriptions", groupBy: "status", measure: "count", target: "canceled", percent_of_total: true } },
    ],
    tables: [
      { title: "Abonnements par statut", entity: "subscriptions", group_by: "status", measure: "count", unit_mode: "count", view: "donut", description: "Actifs, en essai, annulés…" },
      { title: "MRR par mois de démarrage", entity: "subscriptions", group_by: "month_started", measure: "sum", field: "mrr", unit_mode: "currency", view: "line", description: "MRR gagné par cohorte de démarrage." },
    ],
  },
  {
    id: "tresorerie_flux",
    label: "Flux de trésorerie",
    description: "Encaissements, décaissements, flux net — sur les transactions réelles.",
    entities: ["transactions"],
    tiles: [
      { title: "Encaissements", unit: "currency", agg: { entity: "transactions", groupBy: "direction", measure: "sum", field: "amount_in" } },
      { title: "Décaissements", unit: "currency", agg: { entity: "transactions", groupBy: "direction", measure: "sum", field: "amount_out" } },
      { title: "Flux net", unit: "currency", agg: { entity: "transactions", groupBy: "direction", measure: "sum", field: "amount" } },
      { title: "Transactions", unit: "count", agg: { entity: "transactions", groupBy: "direction", measure: "count" } },
    ],
    tables: [
      { title: "Flux net par mois", entity: "transactions", group_by: "month_transaction", measure: "sum", field: "amount", unit_mode: "currency", view: "line", description: "Encaissements − décaissements, mois par mois." },
      { title: "Dépenses par catégorie", entity: "transactions", group_by: "category", measure: "sum", field: "amount_out", unit_mode: "currency", view: "bar", description: "Où part l'argent, par catégorie de transaction." },
    ],
  },
  {
    id: "suivi_support",
    label: "Suivi support",
    description: "Volume et répartition des tickets — la charge du service client.",
    entities: ["tickets"],
    tiles: [
      { title: "Tickets", unit: "count", agg: { entity: "tickets", groupBy: "status", measure: "count" } },
    ],
    tables: [
      { title: "Tickets par statut", entity: "tickets", group_by: "status", measure: "count", unit_mode: "count", view: "bar", description: "Ouverts, en cours, résolus…" },
    ],
  },
];

/** Version sérialisable pour le client (modal de création). */
export type BoardTemplateOption = { id: string; label: string; description: string };

/**
 * Templates réellement proposables : chaque entité requise a au moins un
 * enregistrement synchronisé (comptages head, coût borné).
 */
export async function availableBoardTemplates(
  supabase: SupabaseClient,
  orgId: string,
): Promise<BoardTemplateOption[]> {
  const entities = [...new Set(BOARD_TEMPLATES.flatMap((t) => t.entities))];
  const counts = new Map<string, number>();
  await Promise.all(
    entities.map(async (e) => {
      const table = ENTITY_TABLE[e];
      if (!table) return counts.set(e, 0);
      try {
        const { count, error } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId);
        counts.set(e, error ? 0 : count ?? 0);
      } catch {
        counts.set(e, 0);
      }
    }),
  );
  return BOARD_TEMPLATES.filter((t) => t.entities.every((e) => (counts.get(e) ?? 0) > 0)).map(
    (t) => ({ id: t.id, label: t.label, description: t.description }),
  );
}

/**
 * Seed la composition d'un template sous la clé board_<id> — best effort :
 * une insertion qui échoue n'empêche pas la création du tableau (la page
 * reste utilisable vierge).
 */
export async function seedBoardFromTemplate(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  boardId: string,
  templateId: string,
): Promise<void> {
  const tpl = BOARD_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return;
  const pageKey = `board_${boardId}`;

  try {
    if (tpl.tiles.length > 0) {
      await supabase.from("page_tiles").insert(
        tpl.tiles.map((t, i) => ({
          organization_id: orgId,
          page_key: pageKey,
          kind: "kpi",
          title: t.title,
          unit_mode: t.unit,
          agg_spec: t.agg,
          position: i,
          created_by: userId,
        })),
      );
    }
  } catch {
    /* best effort — le tableau vierge reste créé */
  }
  try {
    if (tpl.tables.length > 0) {
      await supabase.from("page_data_tables").insert(
        tpl.tables.map((t, i) => ({
          organization_id: orgId,
          page_key: pageKey,
          title: t.title,
          entity: t.entity,
          group_by: t.group_by,
          measure: t.measure,
          field: t.field ?? null,
          unit_mode: t.unit_mode ?? null,
          view: t.view,
          period_preset: "all",
          sources: [],
          description: t.description ?? null,
          position: i,
          created_by: userId,
        })),
      );
    }
  } catch {
    /* idem — les tuiles seedées restent en place */
  }
}
