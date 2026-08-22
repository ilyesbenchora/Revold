import type { HiddenBlockMeta, HiddenBlockPreview } from "@/lib/kpi/page-tiles";

/**
 * Catalogue PARTAGÉ des aperçus « Revold » des blocs natifs des pages de
 * données. Chaque bloc travaillé (Trésorerie, Service client, Ventes…) déclare
 * ici un agrégat déterministe REPRÉSENTATIF, recalculé sur les vraies données
 * dans la fenêtre de suggestions (option « aperçu réel »). Le bloc lui-même se
 * réaffiche toujours avec sa visualisation d'origine complète (carrousel,
 * funnel, cartes…) — cet aperçu n'en est qu'un extrait chiffré.
 *
 * Un bloc absent du catalogue reste proposé dans les suggestions, avec un
 * aperçu schématique (fallback) — jamais bloquant. On ne mappe donc que les
 * blocs dont un agrégat unique a du sens ; les blocs purement dérivés (certaines
 * estimations fiscales) restent volontairement schématiques.
 */
const p = (
  entity: string,
  groupBy: string,
  measure: string,
  unit: HiddenBlockPreview["unit"],
  view: HiddenBlockPreview["view"],
  field?: string,
): HiddenBlockPreview => ({ entity, groupBy, measure, field: field ?? null, unit, view });

const CATALOG: Record<string, HiddenBlockMeta> = {
  // ── Ventes / pipeline ──
  pipeline_devis: { view: "chart-bar", description: "Pipeline revenue & devis", preview: p("deals", "stage", "sum", "currency", "bar", "amount") },
  pipeline_retenu: { view: "chart-bar", description: "Pipeline pris en compte", preview: p("deals", "stage", "sum", "currency", "bar", "amount") },
  pipeline_expansion: { view: "chart-bar", description: "Pipeline expansion", preview: p("deals", "stage", "sum", "currency", "bar", "amount") },
  potentiel_expansion: { view: "table", description: "Potentiel d'expansion", preview: p("deals", "stage", "sum", "currency", "bar", "amount") },
  engagement_pre_renouvellement: { view: "chart-bar", description: "Engagement pré-renouvellement", preview: p("deals", "stage", "count", "count", "bar") },

  // ── Revenu récurrent / churn ──
  revenus_recurrents: { view: "table", description: "MRR, ARR, abonnements actifs", preview: p("subscriptions", "status", "sum", "currency", "bar", "mrr") },
  sante_subs: { view: "donut", description: "Santé du portefeuille subscriptions", preview: p("subscriptions", "status", "count", "count", "donut") },
  churn_risque: { view: "chart-line", description: "Churn & risque revenue", preview: p("subscriptions", "month_canceled", "count", "count", "line") },
  risque_churn: { view: "donut", description: "Score de risque churn", preview: p("subscriptions", "status", "count", "count", "donut") },
  impact_revenue: { view: "chart-bar", description: "Impact revenue du churn", preview: p("subscriptions", "status", "sum", "currency", "bar", "mrr") },
  retention: { view: "donut", description: "Renouvellement & rétention", preview: p("subscriptions", "status", "count", "count", "donut") },
  arr_securise_risque: { view: "chart-bar", description: "ARR sécurisé vs à risque", preview: p("subscriptions", "status", "sum", "currency", "bar", "mrr") },
  arpu_ltv: { view: "table", description: "Revenue par client (ARPU & LTV)", preview: p("subscriptions", "status", "sum", "currency", "bar", "mrr") },
  cohortes_frequence: { view: "chart-line", description: "Cohortes par fréquence", preview: p("subscriptions", "month_started", "count", "count", "line") },

  // ── Facturation / recouvrement ──
  emission_encaissement: { view: "chart-line", description: "Émission & encaissement", preview: p("invoices", "month_issued", "sum", "currency", "line", "amount_total") },
  recouvrement_dso: { view: "chart-bar", description: "Recouvrement & DSO", preview: p("invoices", "status", "sum", "currency", "bar", "amount_due") },
  creances_clients_bloc: { view: "chart-bar", description: "Créances clients", preview: p("invoices", "status", "sum", "currency", "bar", "amount_due") },

  // ── Trésorerie / comptabilité ──
  dettes_fournisseurs_bloc: { view: "chart-bar", description: "Dettes fournisseurs", preview: p("transactions", "category", "sum", "currency", "bar", "amount_out") },
  balance_classe: { view: "chart-bar", description: "Balance par classe", preview: p("transactions", "category", "sum", "currency", "bar", "amount") },
  pnl: { view: "chart-line", description: "P&L comptable", preview: p("transactions", "month_transaction", "sum", "currency", "line", "amount") },
  top_charges: { view: "chart-bar", description: "Top comptes de charges", preview: p("transactions", "category", "sum", "currency", "bar", "amount_out") },
  projection_treso: { view: "chart-line", description: "Projection de trésorerie", preview: p("transactions", "month_transaction", "sum", "currency", "line", "amount") },

  // ── Service client / support ──
  tickets_volume: { view: "chart-bar", description: "Volume de tickets", preview: p("tickets", "status", "count", "count", "bar") },
  sla_accueil: { view: "chart-bar", description: "SLA d'accueil & première réponse", preview: p("tickets", "status", "count", "count", "bar") },
  onboarding_livraison: { view: "chart-bar", description: "Onboarding & livraison", preview: p("tickets", "status", "count", "count", "bar") },
  capacite_operationnelle: { view: "chart-bar", description: "Capacité opérationnelle", preview: p("tickets", "status", "count", "count", "bar") },
  satisfaction: { view: "donut", description: "Signaux satisfaction & engagement", preview: p("tickets", "status", "count", "count", "donut") },
  signaux_faibles: { view: "donut", description: "Signaux faibles à monitorer", preview: p("tickets", "status", "count", "count", "donut") },
};

/**
 * Résout la meta (view + description + aperçu réel) d'un bloc masqué à partir de
 * sa clé — y compris les clés préfixées par outil (`subs_<key>`, `invoices_<key>`,
 * `cashflow_<key>`). À passer en second argument de `hiddenBlockList`.
 */
export function blockPreviewMeta(blockKey: string): HiddenBlockMeta | undefined {
  if (CATALOG[blockKey]) return CATALOG[blockKey];
  if (blockKey.startsWith("subs_"))
    return { view: "table", description: "MRR, ARR, abonnements actifs, churn", preview: p("subscriptions", "status", "sum", "currency", "bar", "mrr") };
  if (blockKey.startsWith("invoices_"))
    return { view: "table", description: "Factures émises, encaissé, impayés", preview: p("invoices", "month_issued", "sum", "currency", "line", "amount_total") };
  if (blockKey.startsWith("cashflow_"))
    return { view: "chart-line", description: "Trésorerie : flux, solde, runway", preview: p("transactions", "month_transaction", "sum", "currency", "line", "amount") };
  return undefined;
}
