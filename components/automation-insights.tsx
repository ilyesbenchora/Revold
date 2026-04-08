import { InsightCard } from "@/components/insight-card";

type Workflow = { id: string; name: string; enabled: boolean; type: string; objectType?: string };

type Props = {
  workflows: Workflow[];
  dealsNoOwnerPct: number;
  dealsNoOwner: number;
  dealsNoNextActivity: number;
  dealsNoActivity: number;
  openDeals: number;
  contacts: number;
  leads: number;
  dismissedKeys?: Set<string>;
};

const HUBSPOT_PORTAL = "48372600";
const NEW_WORKFLOW = `https://app.hubspot.com/workflows/${HUBSPOT_PORTAL}/new`;
const ALL_WORKFLOWS = `https://app.hubspot.com/workflows/${HUBSPOT_PORTAL}`;
const PROPERTIES = `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/settings/properties`;

export function AutomationInsights({
  workflows,
  dealsNoOwnerPct,
  dealsNoOwner,
  dealsNoNextActivity,
  dealsNoActivity,
  openDeals,
  contacts,
  leads,
  dismissedKeys = new Set(),
}: Props) {
  const wfNames = workflows.map((w) => w.name.toLowerCase());
  const hasAttribution = wfNames.some((n) => n.includes("attribut") || n.includes("assign") || n.includes("round") || n.includes("routing"));
  const hasLeadScoring = wfNames.some((n) => n.includes("scoring") || n.includes("score") || n.includes("mql") || n.includes("sql") || n.includes("qualif"));
  const hasRelance = wfNames.some((n) => n.includes("relance") || n.includes("nurturing") || n.includes("dormant") || n.includes("inactif"));
  const hasSLA = wfNames.some((n) => n.includes("sla") || n.includes("premier contact") || n.includes("first contact") || n.includes("response time"));
  const hasRiskAlert = wfNames.some((n) => n.includes("risque") || n.includes("at risk") || n.includes("at-risk") || n.includes("alerte deal"));
  const hasFormFollowUp = wfNames.some((n) => n.includes("formul") || n.includes("post-form") || n.includes("form submit"));
  const hasReengagement = wfNames.some((n) => n.includes("reengage") || n.includes("re-engage") || n.includes("réengage") || n.includes("réveil"));
  const inactiveCreationWorkflows = workflows.filter((w) => !w.enabled && (w.name.toLowerCase().includes("création") || w.name.toLowerCase().includes("creation")));

  type Item = { key: string; severity: "critical" | "warning" | "info"; title: string; body: string; recommendation: string; hubspotUrl: string; show: boolean };

  const items: Item[] = [
    {
      key: "automation_attribution",
      severity: "critical",
      title: "Aucun workflow d'attribution automatique des deals",
      body: `${dealsNoOwnerPct}% des transactions (${dealsNoOwner}) n'ont pas de propriétaire assigné. Sans workflow d'attribution, les deals restent orphelins et la performance commerciale est invisible.`,
      recommendation: "Créer un workflow déclenché à la création d'un deal qui assigne automatiquement un propriétaire selon la source, le segment ou un round-robin.",
      hubspotUrl: NEW_WORKFLOW,
      show: !hasAttribution && dealsNoOwnerPct > 50,
    },
    {
      key: "automation_inactive_creation",
      severity: "warning",
      title: `${inactiveCreationWorkflows.length} workflow${inactiveCreationWorkflows.length > 1 ? "s" : ""} de création de deals désactivé${inactiveCreationWorkflows.length > 1 ? "s" : ""}`,
      body: `Workflows en attente : ${inactiveCreationWorkflows.map((w) => `« ${w.name} »`).join(", ")}.`,
      recommendation: "Vérifier pourquoi ces workflows sont désactivés et les réactiver pour automatiser la création des deals.",
      hubspotUrl: ALL_WORKFLOWS,
      show: inactiveCreationWorkflows.length > 0,
    },
    {
      key: "automation_lead_scoring",
      severity: "critical",
      title: "Aucun workflow de scoring ou qualification des leads",
      body: `${leads.toLocaleString("fr-FR")} contacts (${contacts > 0 ? Math.round((leads / contacts) * 100) : 0}%) restent au statut Lead sans logique de qualification automatique.`,
      recommendation: "Mettre en place un score HubSpot basé sur les ouvertures email, visites web, soumissions formulaire. Workflow qui change le lifecyclestage automatiquement.",
      hubspotUrl: PROPERTIES,
      show: !hasLeadScoring,
    },
    {
      key: "automation_relance",
      severity: "critical",
      title: "Aucun workflow de relance commerciale automatique",
      body: `${dealsNoNextActivity} transactions en cours n'ont aucune prochaine activité planifiée. Sans relance, ces deals risquent de tomber dans l'oubli.`,
      recommendation: "Créer un workflow qui crée une tâche de relance pour le propriétaire dès qu'une transaction est inactive depuis 5 jours sans next activity.",
      hubspotUrl: NEW_WORKFLOW,
      show: !hasRelance && dealsNoNextActivity > openDeals * 0.4,
    },
    {
      key: "automation_sla",
      severity: "warning",
      title: "Aucun SLA premier contact en place",
      body: "Aucun workflow ne vérifie qu'un nouveau lead est contacté dans un délai défini. Contacter un lead dans l'heure augmente la qualification de 7x (HBR).",
      recommendation: "Créer un workflow qui notifie le propriétaire d'un nouveau lead immédiatement, et escalade au manager si pas de premier contact dans les 24h.",
      hubspotUrl: NEW_WORKFLOW,
      show: !hasSLA,
    },
    {
      key: "automation_risk_alert",
      severity: "warning",
      title: "Aucune alerte automatique sur les deals à risque",
      body: `${dealsNoActivity} transactions en cours n'ont aucune activité commerciale. Aucun workflow ne marque les deals à risque.`,
      recommendation: "Créer un workflow qui marque automatiquement un deal comme « à risque » si aucune activité depuis 14 jours, et notifie propriétaire + manager.",
      hubspotUrl: NEW_WORKFLOW,
      show: !hasRiskAlert,
    },
    {
      key: "automation_form_followup",
      severity: "info",
      title: "Pas de séquence de nurturing post-formulaire",
      body: "Aucun workflow déclenché à la soumission d'un formulaire. Les leads ne reçoivent pas d'email de bienvenue ou de séquence de nurturing.",
      recommendation: "Créer un workflow déclenché par formulaire qui envoie une séquence de 3-5 emails de bienvenue et nurturing sur 2-3 semaines.",
      hubspotUrl: NEW_WORKFLOW,
      show: !hasFormFollowUp,
    },
    {
      key: "automation_reengagement",
      severity: "info",
      title: "Pas de workflow de réveil des contacts dormants",
      body: `Sur ${contacts.toLocaleString("fr-FR")} contacts, beaucoup sont inactifs depuis longtemps. Aucun workflow ne tente de les réactiver.`,
      recommendation: "Créer un workflow qui détecte les contacts sans engagement depuis 6 mois et déclenche une campagne de réveil.",
      hubspotUrl: NEW_WORKFLOW,
      show: !hasReengagement,
    },
  ];

  const visible = items.filter((i) => i.show && !dismissedKeys.has(i.key));

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-sm text-emerald-700">Toutes les recommandations automation ont été traitées.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((i) => (
        <InsightCard
          key={i.key}
          templateKey={i.key}
          severity={i.severity}
          title={i.title}
          body={i.body}
          recommendation={i.recommendation}
          hubspotUrl={i.hubspotUrl}
          category="automation"
        />
      ))}
    </div>
  );
}
