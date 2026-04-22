/**
 * Analyse ÉCRITE (texte naturel) des workflows actifs HubSpot.
 * Pour chaque workflow détecté, génère un paragraphe descriptif structuré
 * qui répond aux 4 questions clés RevOps :
 *   1. Quel objet est enrôlé ?
 *   2. Quel est le déclencheur ?
 *   3. Quels TYPES d'actions sont exécutés ?
 *   4. Re-enrollment activé ? Objectif paramétré ?
 *
 * Pas de blocs visuels — du texte que l'utilisateur peut lire et
 * partager en CR de réunion.
 */

import type { WorkflowDetail, WorkflowActionCategory } from "@/lib/integrations/hubspot-workflows";

const OBJECT_LABEL: Record<string, string> = {
  contact: "contacts",
  company: "entreprises",
  deal: "transactions",
  ticket: "tickets",
  lead: "leads",
  custom: "objets custom",
  unknown: "records (objet non détecté)",
};

const ACTION_LABEL: Record<WorkflowActionCategory, string> = {
  set_property: "modification de propriété CRM",
  send_email: "envoi d'email",
  create_task: "création de tâche",
  webhook: "webhook sortant",
  branch: "logique conditionnelle (if/then)",
  delay: "délai d'attente",
  create_engagement: "création d'engagement (note/call)",
  update_owner: "réassignation d'owner",
  other: "action diverse",
};

function pluralize(n: number, singular: string, plural?: string): string {
  return n > 1 ? plural ?? `${singular}s` : singular;
}

function describeWorkflow(w: WorkflowDetail): {
  paragraph: string;
  alerts: string[];
} {
  const objet = OBJECT_LABEL[w.objectType] ?? "records";
  const actionsCount = w.actions.length;

  // Trigger
  const trigger = w.triggerCriteriaCount === 0
    ? `se déclenche sans aucun filter (enrôle automatiquement tous les ${objet} créés)`
    : `se déclenche quand : ${w.triggerDescription}`;

  // Actions
  const actionsList = w.uniqueActionCategories
    .map((cat) => ACTION_LABEL[cat])
    .join(", ");
  const actionsDescription = actionsCount === 0
    ? "ne contient aucune action listée par l'API HubSpot"
    : `exécute ${actionsCount} ${pluralize(actionsCount, "action")} au total répartie${actionsCount > 1 ? "s" : ""} sur ${w.uniqueActionCategories.length} ${pluralize(w.uniqueActionCategories.length, "type")} (${actionsList})`;

  // Re-enrollment
  const reenrollment = w.reenrollmentEnabled
    ? "Le re-enrollment est ACTIVÉ : un même record peut re-passer dans le workflow s'il remplit à nouveau les critères de déclenchement."
    : "Le re-enrollment est DÉSACTIVÉ : un record qui sort du workflow ne peut plus jamais y revenir, même s'il remplit à nouveau les critères.";

  // Goal
  const goal = w.hasGoal
    ? `Un objectif est paramétré : ${w.goalDescription}. Les records qui atteignent cet objectif sortent automatiquement du workflow (bonne pratique RevOps : permet de mesurer le taux de conversion du workflow).`
    : "Aucun objectif (goal) n'est paramétré. Les records ne sortent pas automatiquement du workflow tant qu'ils n'atteignent pas la fin de la séquence — impossible de mesurer le taux de conversion ni de stopper la séquence dès l'objectif atteint.";

  // Multi-purpose
  const multiPurpose = w.isMultiPurpose
    ? `⚠ ANTI-PATTERN REVOPS : ce workflow combine ${w.uniqueActionCategories.length} types d'actions différents. La règle est "1 workflow = 1 objectif précis". Devrait être splitté en ${w.uniqueActionCategories.length} workflows distincts pour permettre de mesurer l'impact de chaque action isolément.`
    : actionsCount > 0
      ? `Ce workflow respecte le principe "1 workflow = 1 action principale" (${ACTION_LABEL[w.uniqueActionCategories[0] ?? "other"]}).`
      : "";

  const paragraph = [
    `Ce workflow cible les ${objet} et ${trigger}.`,
    `Une fois enrôlé, il ${actionsDescription}.`,
    reenrollment,
    goal,
    multiPurpose,
  ].filter(Boolean).join(" ");

  // Liste d'alertes pour mise en évidence
  const alerts: string[] = [];
  if (!w.reenrollmentEnabled && /relance|nurturing|scoring|reactivat|réveil/i.test(w.name)) {
    alerts.push("Re-enrollment OFF mais nom évoque une relance/scoring");
  }
  if (!w.hasGoal) alerts.push("Objectif (goal) manquant");
  if (w.isMultiPurpose) alerts.push("Multi-purpose (viole 1 workflow = 1 action)");
  if (w.triggerCriteriaCount === 0) alerts.push("Déclencheur sans filter");
  if (w.actions.some((a) => a.category === "webhook")) alerts.push("Webhook sortant détecté");

  return { paragraph, alerts };
}

export function WorkflowTextAnalysis({ details }: { details: WorkflowDetail[] }) {
  if (details.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Aucun workflow actif n&apos;a pu être analysé en détail. Vérifiez le scope OAuth automation
        ou contactez Revold si vos workflows actifs ne remontent pas.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {details.map((w, i) => {
        const { paragraph, alerts } = describeWorkflow(w);
        return (
          <article
            key={w.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Workflow #{i + 1} sur {details.length}
                </p>
                <h3 className="mt-0.5 text-base font-bold text-slate-900">{w.name}</h3>
              </div>
              {alerts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {alerts.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800"
                    >
                      ⚠ {a}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-700">{paragraph}</p>

            {w.recommendations.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-700">
                  ✨ Recommandations CRO/RevOps
                </p>
                <ol className="space-y-2 text-sm leading-relaxed text-slate-700">
                  {w.recommendations.map((r, idx) => (
                    <li key={idx}>
                      <span className="font-semibold">
                        {r.severity === "critical" ? "🔴 " : r.severity === "warning" ? "🟠 " : "🔵 "}
                        {r.title} :{" "}
                      </span>
                      {r.body}{" "}
                      <span className="font-medium text-slate-900">
                        Action recommandée : {r.recommendation}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
