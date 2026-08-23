/**
 * Catalogue STATIQUE des pages de la plateforme pour la recherche globale
 * (home) — libellé affiché, route, et mots-clés de rappel (synonymes métier).
 * Les assets dynamiques (rapports, alertes, objectifs, tableaux de bord,
 * agents) sont cherchés côté API (/api/search).
 */

export type SearchPage = { label: string; href: string; keywords?: string };

export const SEARCH_PAGES: SearchPage[] = [
  { label: "Vue d'ensemble", href: "/dashboard", keywords: "home accueil dashboard" },
  { label: "Mon équipe IA", href: "/dashboard/audit", keywords: "agents experts coach" },
  { label: "Performances — Ventes (Cycle de ventes)", href: "/dashboard/performances/commerciale", keywords: "sales pipeline closing deals ca" },
  { label: "Transactions à risque", href: "/dashboard/performances/commerciale/deals-a-risque", keywords: "deals bloqués risque sans activité" },
  { label: "Transactions expirées (Forecast)", href: "/dashboard/performances/commerciale/forecast-management", keywords: "close date forecast trimestre" },
  { label: "Performances — Marketing", href: "/dashboard/performances/marketing", keywords: "funnel mql sql contacts acquisition" },
  { label: "Publicité", href: "/dashboard/performances/marketing/publicite", keywords: "ads google meta linkedin campagnes" },
  { label: "Appels", href: "/dashboard/appels", keywords: "téléphonie aircall calls" },
  { label: "Trésorerie — Vue d'ensemble", href: "/dashboard/audit/paiement-facturation", keywords: "cash facturation paiement marge ca" },
  { label: "Trésorerie — Facturation", href: "/dashboard/audit/paiement-facturation/facturation", keywords: "factures émission encaissement dso recouvrement" },
  { label: "Trésorerie — Paiement", href: "/dashboard/audit/paiement-facturation/paiement", keywords: "mrr arr churn subscriptions abonnements" },
  { label: "Trésorerie — Comptabilité", href: "/dashboard/audit/paiement-facturation/comptabilite", keywords: "pnl p&l charges produits résultat" },
  { label: "Trésorerie — Prévisionnel", href: "/dashboard/audit/paiement-facturation/previsionnel", keywords: "projection solde 12 mois scénarios runway" },
  { label: "Trésorerie — Clients & fournisseurs", href: "/dashboard/audit/paiement-facturation/clients-fournisseurs", keywords: "créances dettes balance âgée" },
  { label: "Trésorerie — Fiscal & social", href: "/dashboard/audit/paiement-facturation/fiscal", keywords: "tva is urssaf échéances provision" },
  { label: "Service Client", href: "/dashboard/audit/service-client", keywords: "support tickets rétention" },
  { label: "Service Client — Churn", href: "/dashboard/audit/service-client/churn", keywords: "attrition annulations" },
  { label: "Service Client — Renouvellement", href: "/dashboard/audit/service-client/renouvellement", keywords: "contrats renewal" },
  { label: "Service Client — Cross-sell / Upsell", href: "/dashboard/audit/service-client/cross-sell-upsell", keywords: "expansion arpu ltv" },
  { label: "Rapprochement données", href: "/dashboard/donnees", keywords: "qualité data matching doublons" },
  { label: "Enrichissement", href: "/dashboard/enrichissement", keywords: "siren siret tva effectifs sirene inpi" },
  { label: "Tableaux de bord", href: "/dashboard/tableaux-de-bord", keywords: "boards dashboards" },
  { label: "Mes rapports", href: "/dashboard/mes-rapports", keywords: "rapports sauvegardés routines" },
  { label: "Alertes", href: "/dashboard/mes-alertes", keywords: "seuils notifications suivi" },
  { label: "Actions", href: "/dashboard/mes-alertes/actions", keywords: "boîte actions tâches validations" },
  { label: "Objectifs", href: "/dashboard/mes-alertes/objectifs", keywords: "cibles targets okr" },
  { label: "Calendrier", href: "/dashboard/mes-alertes/calendrier", keywords: "échéances agenda" },
  { label: "Intégrations — Mes outils connectés", href: "/dashboard/integration/mes-outils", keywords: "connexions sync" },
  { label: "Bibliothèque d'outils", href: "/dashboard/integration/bibliotheque", keywords: "connecter hubspot stripe pennylane connecteurs" },
  { label: "Import de données", href: "/dashboard/integration/import-fichier", keywords: "csv excel google sheets" },
  { label: "Outil sur mesure", href: "/dashboard/integration/sur-mesure", keywords: "api custom erp" },
  { label: "Serveurs MCP", href: "/dashboard/integration/mcp", keywords: "mcp modèles agents externes" },
  { label: "Paramètres — Général", href: "/dashboard/parametres/general", keywords: "organisation entreprise pays" },
  { label: "Paramètres — Utilisateurs & équipes", href: "/dashboard/parametres/equipe", keywords: "membres invitations rôles pôles droits accès" },
  { label: "Paramètres — Modèle de données", href: "/dashboard/parametres/modele-donnees", keywords: "mapping identifiants résolution règles" },
  { label: "Paramètres — Cohortes", href: "/dashboard/parametres/cohortes", keywords: "segment secteur axes analyse" },
  { label: "Paramètres — Enrichissement", href: "/dashboard/parametres/enrichissement", keywords: "champs sirene propriétés crm" },
  { label: "Paramètres — Intégrations", href: "/dashboard/parametres/integrations", keywords: "outil source par page fréquences" },
  { label: "Paramètres — Agents", href: "/dashboard/parametres/agents", keywords: "personnalisation ia" },
  { label: "Paramètres — Tour de contrôle", href: "/dashboard/parametres/tour-de-controle", keywords: "voix orbe brief récap" },
  { label: "Paramètres — Notifications", href: "/dashboard/parametres/notifications", keywords: "email slack sms whatsapp canaux" },
  { label: "Mon compte", href: "/dashboard/mon-compte", keywords: "profil langue apparence facturation" },
];

/** Match insensible aux accents/majuscules sur libellé + mots-clés. */
export function normalizeSearch(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
