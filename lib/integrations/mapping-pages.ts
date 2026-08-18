/**
 * Définitions des pages et agents réglables dans « Outil source par page »
 * (Paramètres → Intégrations). Module SERVER-SAFE (aucun "use client") :
 * partagé entre le composant client ToolMappingSettings et la page serveur
 * qui précharge les mappings.
 *
 * ⚠ Ne pas déplacer dans un module "use client" : importée depuis un composant
 * serveur, une constante d'un module client devient une référence client — le
 * serveur ne reçoit PLUS le tableau réel, la requête `in(page_key, …)` part
 * vide et les blocs s'affichent sans aucune sélection alors que la table
 * tool_mappings est intacte (bug du 15-18 août).
 */

export type PageMappingDef = {
  key: string;
  label: string;
  description: string;
  mode: "single" | "multi";
  /** Sous-page : affichée indentée sous son parent ; hérite du mapping parent si vide. */
  parentKey?: string;
};

export type MappingSection = {
  id: string;
  title: string;
  hint: string;
  pages: PageMappingDef[];
};

export const MAPPING_SECTIONS: MappingSection[] = [
  {
    id: "audit",
    title: "Données",
    hint: "Sélection multiple — Revold croise les outils choisis dans l'analyse de chaque page. Une sous-page sans sélection hérite du réglage de sa page parente.",
    pages: [
      { key: "audit_donnees", label: "Rapprochement données", description: "Qualité des données, audit d'onboarding des outils", mode: "multi" },
      { key: "audit_perf_ventes", label: "Performances — Ventes", description: "Pipeline, deals, closing, forecast", mode: "multi" },
      { key: "audit_perf_marketing", label: "Performances — Marketing", description: "Funnel d'acquisition, formulaires, campagnes", mode: "multi" },
      { key: "audit_perf_ads", label: "Performances — Publicité", description: "Ads : dépenses, CPC/CPL, ROAS, conversions par campagne", mode: "multi", parentKey: "audit_perf_marketing" },
      { key: "audit_appels", label: "Appels", description: "Phoning : volume, durée moyenne, taux de décroché", mode: "multi" },
      { key: "audit_paiement_facturation", label: "Trésorerie", description: "Invoices, subscriptions, quotes", mode: "multi" },
      { key: "audit_paiement_facturation_facturation", label: "Facturation", description: "Émission, relances, délais de paiement", mode: "multi", parentKey: "audit_paiement_facturation" },
      { key: "audit_paiement_facturation_paiement", label: "Paiement", description: "Encaissements, impayés, moyens de paiement", mode: "multi", parentKey: "audit_paiement_facturation" },
      { key: "audit_paiement_facturation_comptabilite", label: "Comptabilité", description: "Écritures, P&L réel, balance", mode: "multi", parentKey: "audit_paiement_facturation" },
      { key: "audit_paiement_facturation_previsionnel", label: "Prévisionnel", description: "Projection trésorerie, runway, échéances", mode: "multi", parentKey: "audit_paiement_facturation" },
      { key: "audit_paiement_facturation_clients_fournisseurs", label: "Clients / Fournisseurs", description: "Balance âgée, encours, top débiteurs", mode: "multi", parentKey: "audit_paiement_facturation" },
      { key: "audit_paiement_facturation_fiscal", label: "Fiscal", description: "Échéances TVA, IS, URSSAF", mode: "multi", parentKey: "audit_paiement_facturation" },
      { key: "audit_service_client", label: "Service Client", description: "Tickets, conversations, satisfaction", mode: "multi" },
      { key: "audit_service_client_process", label: "Process", description: "SLA, onboarding, handoff sales → CSM", mode: "multi", parentKey: "audit_service_client" },
      { key: "audit_service_client_churn", label: "Churn", description: "Signaux churn, risque et impact revenue", mode: "multi", parentKey: "audit_service_client" },
      { key: "audit_service_client_cross_sell", label: "Cross-sell / Upsell", description: "ARPU, potentiel d'expansion, multi-produit", mode: "multi", parentKey: "audit_service_client" },
      { key: "audit_service_client_renouvellement", label: "Renouvellement", description: "Renewal rate, GRR, ARR sécurisé / à risque", mode: "multi", parentKey: "audit_service_client" },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    hint: "Sélection multiple — KPIs cross-outils dans la vue de pilotage.",
    pages: [
      { key: "dashboard", label: "Dashboard", description: "Vue d'ensemble & Mes rapports — KPIs en temps réel", mode: "multi" },
    ],
  },
  // Sources par AGENT (clés agent_<agentKey>) : chaque agent expert n'analyse
  // que les outils choisis ici. Sans sélection, l'agent retombe sur tous les
  // outils connectés de son périmètre par défaut.
  {
    id: "agents_equipe",
    title: "Agents — Mon équipe IA",
    hint: "Sélection multiple — chaque agent expert n'analyse que les outils choisis. Sans sélection, l'agent utilise tous les outils connectés de son périmètre.",
    pages: [
      { key: "agent_performance", label: "Agent Performances", description: "Pipeline, deals, closing, forecast", mode: "multi" },
      { key: "agent_paiement-facturation", label: "Agent Trésorerie", description: "Factures, encaissements, cash", mode: "multi" },
      { key: "agent_service-client", label: "Agent Service Client", description: "Tickets, conversations, satisfaction", mode: "multi" },
      { key: "agent_proprietes", label: "Agent Data", description: "Complétude, rapprochement, enrichissement", mode: "multi" },
    ],
  },
];

/** Groupes de sections : "pages" = pages Revold · "agents" = agents. */
export const AGENT_SECTION_IDS = new Set(["agents_equipe"]);

/**
 * Toutes les clés réglables — source unique pour la page Paramètres qui
 * précharge les mappings depuis tool_mappings.
 */
export const MAPPING_PAGE_KEYS: string[] = MAPPING_SECTIONS.flatMap((s) => s.pages.map((p) => p.key));
