/**
 * Modèle unifié pour la répartition des coachings dans les pages
 * /dashboard/insights-ia/<category>.
 *
 * Chaque coaching (auto-généré, automation, ou manuel depuis un rapport) est
 * normalisé dans cette structure pour être affichable + filtrable de manière
 * homogène par <CoachingTabs>.
 */

export type CoachingSeverity = "critical" | "warning" | "info";

export type CoachingActionType =
  | "workflow"        // créer / modifier / réactiver un workflow HubSpot
  | "property"        // créer / modifier une propriété CRM
  | "integration"     // connecter un outil
  | "report"          // activer un rapport
  | "data_model"      // changement de modèle de données
  | "process";        // process manuel ou organisationnel

export const ACTION_TYPE_LABELS: Record<CoachingActionType, string> = {
  workflow: "Workflow",
  property: "Propriété CRM",
  integration: "Intégration",
  report: "Rapport",
  data_model: "Modèle de données",
  process: "Process",
};

export type UnifiedCoaching = {
  /** id stable pour React keys (templateKey si auto, id de la ligne si manuel) */
  id: string;
  /** indique l'origine pour le rendu (différencie manuel vs auto) */
  source: "auto" | "automation" | "manual";
  /** clef de dismissal (pour les auto-insights, sert à tracker dans insight_dismissals) */
  templateKey?: string;
  /** id de la ligne report_coachings (pour les coachings manuels uniquement) */
  reportCoachingId?: string;
  severity: CoachingSeverity;
  title: string;
  body: string;
  recommendation: string;
  hubspotUrl?: string;
  actionLabel?: string;
  /** catégorie de la page d'accueil (commercial, marketing, ...) */
  category: string;
  /** type d'action déduit (pour le filtre par type) */
  actionType: CoachingActionType;
  /** uniquement utilisé dans l'onglet "Mes coachings IA" */
  status?: "active" | "done" | "removed";
  /** date d'activation (manuel) ou de génération (auto) */
  createdAt?: string;
  /** titre du rapport source (pour les coachings manuels) */
  sourceReportTitle?: string | null;
  /** label du KPI à l'origine du coaching (pour les coachings manuels) */
  kpiLabel?: string | null;
};

/**
 * Déduit le type d'action à partir des indices disponibles.
 * Heuristique tolérante — si rien ne match clairement, retourne "process".
 */
export function inferActionType(args: {
  templateKey?: string;
  hubspotUrl?: string;
  title?: string;
  body?: string;
  recommendation?: string;
  category?: string;
}): CoachingActionType {
  const k = (args.templateKey ?? "").toLowerCase();
  const u = (args.hubspotUrl ?? "").toLowerCase();
  const text = `${args.title ?? ""} ${args.body ?? ""} ${args.recommendation ?? ""}`.toLowerCase();

  // 1) clés bien typées en amont
  if (k.startsWith("automation_")) return "workflow";
  if (k.startsWith("int_report_") || k === "int_global_low_stack") return "report";
  if (k.startsWith("int_")) return "integration";
  if (k.startsWith("dm_")) return "data_model";

  // 2) hubspot URL — gros indicateur
  if (u.includes("/workflows/")) return "workflow";
  if (u.includes("/settings/properties") || u.includes("/properties")) return "property";
  if (u.startsWith("/dashboard/integration") || u.includes("/integrations")) return "integration";
  if (u.startsWith("/dashboard/rapports")) return "report";
  if (u.startsWith("/dashboard/parametres/modele-donnees")) return "data_model";

  // 3) catégorie
  if (args.category === "data-model" || args.category === "data_model") return "data_model";
  if (args.category === "integration") return "integration";

  // 4) mots-clés textuels
  if (/workflow|automatis|scénario|automation/.test(text)) return "workflow";
  if (/propri[eé]t[eé]|champ\b|field|métadonn|formul/.test(text)) return "property";
  if (/int[eé]gr|connect|stripe|hubspot|pennylane|sellsy|salesforce/.test(text)) return "integration";
  if (/rapport|dashboard|reporting/.test(text)) return "report";
  if (/mod[eè]le de donn|data ?model|sch[eé]ma|entit[eé]/.test(text)) return "data_model";

  return "process";
}
