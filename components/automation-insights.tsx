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
};

const HUBSPOT_PORTAL = "48372600";
const NEW_WORKFLOW = `https://app.hubspot.com/workflows/${HUBSPOT_PORTAL}/new`;
const ALL_WORKFLOWS = `https://app.hubspot.com/workflows/${HUBSPOT_PORTAL}`;
const PROPERTIES = `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/settings/properties`;

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
      {label}
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

export function AutomationInsights({
  workflows,
  dealsNoOwnerPct,
  dealsNoOwner,
  dealsNoNextActivity,
  dealsNoActivity,
  openDeals,
  contacts,
  leads,
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

  return (
    <div className="space-y-3">
      {/* 1. Attribution automatique */}
      {!hasAttribution && dealsNoOwnerPct > 50 && (
        <article className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Critique</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Attribution</span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">Aucun workflow d&apos;attribution automatique des deals</h3>
          <p className="mt-1.5 text-sm text-slate-700">
            {dealsNoOwnerPct}% des transactions ({dealsNoOwner}) n&apos;ont pas de propriétaire assigné. Sans workflow d&apos;attribution, les deals restent orphelins et la performance commerciale est invisible.
          </p>
          <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Créer un workflow déclenché à la création d&apos;un deal qui assigne automatiquement un propriétaire selon la source, le segment ou un round-robin.
            </p>
          </div>
          <ActionLink href={NEW_WORKFLOW} label="Créer un workflow d'attribution" />
        </article>
      )}

      {/* 2. Workflows création deals désactivés */}
      {inactiveCreationWorkflows.length > 0 && (
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">Attention</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Workflow inactif</span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            {inactiveCreationWorkflows.length} workflow{inactiveCreationWorkflows.length > 1 ? "s" : ""} de création de deals désactivé{inactiveCreationWorkflows.length > 1 ? "s" : ""}
          </h3>
          <p className="mt-1.5 text-sm text-slate-700">
            Workflows en attente : {inactiveCreationWorkflows.map((w) => `« ${w.name} »`).join(", ")}.
          </p>
          <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Vérifier pourquoi ces workflows sont désactivés et les réactiver pour automatiser la création des deals.
            </p>
          </div>
          <ActionLink href={ALL_WORKFLOWS} label="Voir les workflows" />
        </article>
      )}

      {/* 3. Lead scoring */}
      {!hasLeadScoring && (
        <article className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Critique</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Lead Scoring</span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">Aucun workflow de scoring ou qualification des leads</h3>
          <p className="mt-1.5 text-sm text-slate-700">
            {leads.toLocaleString("fr-FR")} contacts ({contacts > 0 ? Math.round((leads / contacts) * 100) : 0}%) restent au statut Lead sans logique de qualification automatique.
          </p>
          <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Mettre en place un score HubSpot basé sur les ouvertures email, visites web, soumissions formulaire. Workflow qui change le lifecyclestage automatiquement.
            </p>
          </div>
          <ActionLink href={PROPERTIES} label="Configurer le scoring" />
        </article>
      )}

      {/* 4. Relances commerciales */}
      {!hasRelance && dealsNoNextActivity > openDeals * 0.4 && (
        <article className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Critique</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Sales Cadence</span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">Aucun workflow de relance commerciale automatique</h3>
          <p className="mt-1.5 text-sm text-slate-700">
            {dealsNoNextActivity} transactions en cours n&apos;ont aucune prochaine activité planifiée. Sans relance, ces deals risquent de tomber dans l&apos;oubli.
          </p>
          <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Créer un workflow qui crée une tâche de relance pour le propriétaire dès qu&apos;une transaction est inactive depuis 5 jours sans next activity.
            </p>
          </div>
          <ActionLink href={NEW_WORKFLOW} label="Créer un workflow de relance" />
        </article>
      )}

      {/* 5. SLA premier contact */}
      {!hasSLA && (
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">Attention</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">SLA</span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">Aucun SLA premier contact en place</h3>
          <p className="mt-1.5 text-sm text-slate-700">
            Aucun workflow ne vérifie qu&apos;un nouveau lead est contacté dans un délai défini. Contacter un lead dans l&apos;heure augmente la qualification de 7x (HBR).
          </p>
          <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Créer un workflow qui notifie le propriétaire d&apos;un nouveau lead immédiatement, et escalade au manager si pas de premier contact dans les 24h.
            </p>
          </div>
          <ActionLink href={NEW_WORKFLOW} label="Créer un workflow SLA" />
        </article>
      )}

      {/* 6. Alerte deal à risque */}
      {!hasRiskAlert && (
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">Attention</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Risk Management</span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">Aucune alerte automatique sur les deals à risque</h3>
          <p className="mt-1.5 text-sm text-slate-700">
            {dealsNoActivity} transactions en cours n&apos;ont aucune activité commerciale. Aucun workflow ne marque les deals à risque.
          </p>
          <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Créer un workflow qui marque automatiquement un deal comme « à risque » si aucune activité depuis 14 jours, et notifie propriétaire + manager.
            </p>
          </div>
          <ActionLink href={NEW_WORKFLOW} label="Créer un workflow d'alerte risque" />
        </article>
      )}

      {/* 7. Séquence post-formulaire */}
      {!hasFormFollowUp && (
        <article className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">Info</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Marketing Automation</span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">Pas de séquence de nurturing post-formulaire</h3>
          <p className="mt-1.5 text-sm text-slate-700">
            Aucun workflow déclenché à la soumission d&apos;un formulaire. Les leads ne reçoivent pas d&apos;email de bienvenue ou de séquence de nurturing.
          </p>
          <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Créer un workflow déclenché par formulaire qui envoie une séquence de 3-5 emails de bienvenue et nurturing sur 2-3 semaines.
            </p>
          </div>
          <ActionLink href={NEW_WORKFLOW} label="Créer un workflow nurturing" />
        </article>
      )}

      {/* 8. Re-engagement contacts dormants */}
      {!hasReengagement && (
        <article className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">Info</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Re-engagement</span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">Pas de workflow de réveil des contacts dormants</h3>
          <p className="mt-1.5 text-sm text-slate-700">
            Sur {contacts.toLocaleString("fr-FR")} contacts, beaucoup sont inactifs depuis longtemps. Aucun workflow ne tente de les réactiver.
          </p>
          <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Créer un workflow qui détecte les contacts sans engagement depuis 6 mois et déclenche une campagne de réveil.
            </p>
          </div>
          <ActionLink href={NEW_WORKFLOW} label="Créer un workflow de réengagement" />
        </article>
      )}
    </div>
  );
}
