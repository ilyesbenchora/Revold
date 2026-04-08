import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel } from "@/lib/score-utils";

export default async function ProcessPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  // Lifecycle + insights data
  const [
    { count: totalContacts },
    { count: leadsCount },
    { count: opportunitiesCount },
    { count: totalDeals },
    { count: openDeals },
    { count: dealsNoNextActivity },
    { count: dealsNoActivity },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_mql", false).eq("is_sql", false),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).is("next_activity_date", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).eq("sales_activities_count", 0),
  ]);

  // Deals sans owner via HubSpot Search API (the DB doesn't store owner)
  let dealsNoOwner = 0;
  let dealsNoOwnerPct = 0;
  if (process.env.HUBSPOT_ACCESS_TOKEN) {
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "NOT_HAS_PROPERTY" }] }],
          limit: 1,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        dealsNoOwner = d.total ?? 0;
        const totalForPct = totalDeals ?? 1;
        dealsNoOwnerPct = totalForPct > 0 ? Math.round((dealsNoOwner / totalForPct) * 100) : 0;
      }
    } catch {}
  }

  // Workflows from HubSpot API
  let workflows: Array<{ id: string; name: string; enabled: boolean; type: string; objectType?: string }> = [];
  let workflowError: string | null = null;
  if (process.env.HUBSPOT_ACCESS_TOKEN) {
    try {
      const res = await fetch("https://api.hubapi.com/automation/v4/flows?limit=100", {
        headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` },
      });
      if (res.ok) {
        const data = await res.json();
        workflows = (data.results ?? []).map((w: Record<string, unknown>) => ({
          id: w.id as string,
          name: (w.name as string) || "Sans nom",
          enabled: w.isEnabled === true || w.enabled === true,
          type: (w.type as string) || "unknown",
          objectType: w.objectTypeId as string | undefined,
        }));
      } else {
        workflowError = "Scope automation manquant sur l'app HubSpot";
      }
    } catch {
      workflowError = "Impossible de récupérer les workflows";
    }
  }

  const activeWorkflows = workflows.filter((w) => w.enabled);
  const inactiveWorkflows = workflows.filter((w) => !w.enabled);

  // Workflows par type d'objet
  const workflowsByObject: Record<string, number> = { "Contact": 0, "Entreprise": 0, "Transaction": 0, "Autre": 0 };
  activeWorkflows.forEach((w) => {
    const obj = w.objectType || "";
    if (obj.includes("0-1") || obj.toLowerCase().includes("contact")) workflowsByObject.Contact++;
    else if (obj.includes("0-2") || obj.toLowerCase().includes("compan")) workflowsByObject.Entreprise++;
    else if (obj.includes("0-3") || obj.toLowerCase().includes("deal")) workflowsByObject.Transaction++;
    else workflowsByObject.Autre++;
  });

  // Workflows sans objectif (proxy: workflows sans nom descriptif ou marqués sans goal)
  const workflowsNoGoal = activeWorkflows.filter((w) =>
    !w.name || w.name.toLowerCase().includes("test") || w.name.toLowerCase().includes("brouillon") || w.name === "Sans nom"
  ).length;

  const contacts = totalContacts ?? 0;
  const leads = leadsCount ?? 0;
  const opportunities = opportunitiesCount ?? 0;
  const lifecycleRate = contacts > 0 ? Math.round((opportunities / contacts) * 100) : 0;

  // Detect missing workflow types by analyzing existing workflow names
  const wfNames = workflows.map((w) => w.name.toLowerCase());
  const hasAttribution = wfNames.some((n) => n.includes("attribut") || n.includes("assign") || n.includes("round") || n.includes("routing"));
  const hasLeadScoring = wfNames.some((n) => n.includes("scoring") || n.includes("score") || n.includes("mql") || n.includes("sql") || n.includes("qualif"));
  const hasRelance = wfNames.some((n) => n.includes("relance") || n.includes("nurturing") || n.includes("dormant") || n.includes("inactif"));
  const hasSLA = wfNames.some((n) => n.includes("sla") || n.includes("premier contact") || n.includes("first contact") || n.includes("response time"));
  const hasRiskAlert = wfNames.some((n) => n.includes("risque") || n.includes("at risk") || n.includes("at-risk") || n.includes("alerte deal"));
  const hasFormFollowUp = wfNames.some((n) => n.includes("formul") || n.includes("post-form") || n.includes("form submit"));
  const hasReengagement = wfNames.some((n) => n.includes("reengage") || n.includes("re-engage") || n.includes("réengage") || n.includes("réveil"));
  const inactiveCreationWorkflows = workflows.filter((w) => !w.enabled && (w.name.toLowerCase().includes("création") || w.name.toLowerCase().includes("creation")));

  // Score Process: workflow health + lifecycle
  const workflowHealthScore = workflows.length > 0
    ? Math.round((activeWorkflows.length / workflows.length) * 100)
    : 0;
  const processScore = Math.round(
    workflowHealthScore * 0.4 +
    Math.min(100, lifecycleRate * 3) * 0.3 +
    (activeWorkflows.length > 5 ? 100 : activeWorkflows.length * 20) * 0.3
  );

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Process</h1>
        <p className="mt-1 text-sm text-slate-500">
          Workflows d&apos;automatisation et conversion lifecycle.
        </p>
      </header>

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Process" score={processScore} colorClass="stroke-indigo-500" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{processScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(processScore).className}`}>
              {getScoreLabel(processScore).label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Basé sur la santé des workflows et la conversion lifecycle.
          </p>
        </div>
      </div>

      {/* Workflows */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-violet-500" />Workflows d&apos;automatisation
        </h2>

        {workflowError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-medium text-amber-800">{workflowError}</p>
            <p className="mt-1 text-xs text-amber-700">
              Pour afficher les workflows, ajoutez le scope <code>automation</code> à votre app privée HubSpot.
            </p>
          </div>
        ) : workflows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">Aucun workflow détecté dans votre portail HubSpot.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <article className="card p-5 text-center">
                <p className="text-xs text-slate-500">Workflows actifs</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">{activeWorkflows.length}</p>
              </article>
              <article className="card p-5 text-center">
                <p className="text-xs text-slate-500">Workflows inactifs</p>
                <p className="mt-1 text-3xl font-bold text-slate-400">{inactiveWorkflows.length}</p>
              </article>
              <article className="card p-5 text-center">
                <p className="text-xs text-slate-500">Total workflows</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{workflows.length}</p>
              </article>
              <article className="card p-5 text-center">
                <p className="text-xs text-slate-500">Sans objectif défini</p>
                <p className={`mt-1 text-3xl font-bold ${workflowsNoGoal > 0 ? "text-orange-500" : "text-emerald-600"}`}>{workflowsNoGoal}</p>
              </article>
            </div>

            {/* Par type d'objet */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Workflows actifs par type d&apos;objet</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <article className="card p-4">
                  <p className="text-xs text-slate-500">Contact</p>
                  <p className="mt-1 text-2xl font-bold text-blue-600">{workflowsByObject.Contact}</p>
                </article>
                <article className="card p-4">
                  <p className="text-xs text-slate-500">Entreprise</p>
                  <p className="mt-1 text-2xl font-bold text-violet-600">{workflowsByObject.Entreprise}</p>
                </article>
                <article className="card p-4">
                  <p className="text-xs text-slate-500">Transaction</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-600">{workflowsByObject.Transaction}</p>
                </article>
                <article className="card p-4">
                  <p className="text-xs text-slate-500">Autre</p>
                  <p className="mt-1 text-2xl font-bold text-slate-600">{workflowsByObject.Autre}</p>
                </article>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Lifecycle */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />Conversion lifecycle
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{contacts.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Leads</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{leads.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Opportunités</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{opportunities.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de conversion</p>
            <p className={`mt-1 text-3xl font-bold ${lifecycleRate >= 25 ? "text-emerald-600" : lifecycleRate >= 10 ? "text-yellow-600" : "text-orange-500"}`}>{lifecycleRate}%</p>
            <p className="mt-1 text-xs text-slate-400">Lead vers Opportunité</p>
          </article>
        </div>
      </div>

      {/* Insights IA Automation */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
            <path d="M10 21v1a2 2 0 0 0 4 0v-1" />
          </svg>
          Insights IA Automation
        </h2>
        <p className="text-sm text-slate-500">Workflows manquants ou sous-exploités pour optimiser vos processus RevOps.</p>

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
                {dealsNoOwnerPct}% des transactions ({dealsNoOwner}) n&apos;ont pas de propriétaire assigné. Sans workflow d&apos;attribution (round-robin, par territoire, par produit), les deals restent orphelins et la performance commerciale est invisible.
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  Créer un workflow déclenché à la création d&apos;un deal qui assigne automatiquement un propriétaire selon la source, le segment ou un round-robin entre les commerciaux d&apos;une équipe.
                </p>
              </div>
              <a href="https://app.hubspot.com/workflows/48372600/new" target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
                Créer un workflow d&apos;attribution
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
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
                Vous avez {inactiveCreationWorkflows.length} workflow(s) de création automatique de transactions qui ne tournent pas : {inactiveCreationWorkflows.map((w) => `« ${w.name} »`).join(", ")}.
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  Vérifier pourquoi ces workflows sont désactivés et les réactiver pour automatiser la création des deals depuis les contacts qualifiés.
                </p>
              </div>
              <a href="https://app.hubspot.com/workflows/48372600" target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
                Voir les workflows
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
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
                {leads.toLocaleString("fr-FR")} contacts ({contacts > 0 ? Math.round((leads / contacts) * 100) : 0}%) restent au statut Lead sans logique de qualification automatique. Pas de transition Lead → MQL → SQL basée sur le comportement ou l&apos;engagement.
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  Mettre en place un score HubSpot (champ HubSpot Score) basé sur les ouvertures email, visites web, soumissions formulaire. Créer un workflow qui change le lifecyclestage automatiquement quand le score dépasse un seuil.
                </p>
              </div>
              <a href="https://app.hubspot.com/contacts/48372600/settings/properties" target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
                Configurer le scoring
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </article>
          )}

          {/* 4. Relances commerciales */}
          {!hasRelance && (dealsNoNextActivity ?? 0) > (openDeals ?? 1) * 0.4 && (
            <article className="rounded-xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Critique</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Sales Cadence</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">Aucun workflow de relance commerciale automatique</h3>
              <p className="mt-1.5 text-sm text-slate-700">
                {dealsNoNextActivity} transactions en cours n&apos;ont aucune prochaine activité planifiée. Sans workflow de relance, ces deals risquent de tomber dans l&apos;oubli et de ne jamais se conclure.
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  Créer un workflow qui crée automatiquement une tâche de relance pour le propriétaire dès qu&apos;une transaction est inactive depuis 5 jours sans next activity planifiée.
                </p>
              </div>
              <a href="https://app.hubspot.com/workflows/48372600/new" target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
                Créer un workflow de relance
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
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
                Aucun workflow ne vérifie qu&apos;un nouveau lead est contacté dans un délai défini. Selon Harvard Business Review, contacter un lead dans l&apos;heure augmente la probabilité de qualification de 7x.
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  Créer un workflow qui notifie le propriétaire d&apos;un nouveau lead immédiatement après création, et escalade au manager si pas de premier contact dans les 24h.
                </p>
              </div>
              <a href="https://app.hubspot.com/workflows/48372600/new" target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
                Créer un workflow SLA
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
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
                {dealsNoActivity} transactions en cours n&apos;ont aucune activité commerciale enregistrée. Aucun workflow ne marque les deals à risque ou ne notifie le manager.
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  Créer un workflow qui marque automatiquement un deal comme « à risque » si aucune activité depuis 14 jours, et envoie une notification au propriétaire et au manager.
                </p>
              </div>
              <a href="https://app.hubspot.com/workflows/48372600/new" target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
                Créer un workflow d&apos;alerte risque
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
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
                Aucun workflow déclenché à la soumission d&apos;un formulaire. Les leads ne reçoivent pas d&apos;email de bienvenue ou de séquence de nurturing automatique.
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  Créer un workflow déclenché par la soumission d&apos;un formulaire qui envoie une séquence de 3-5 emails de bienvenue et nurturing sur 2-3 semaines.
                </p>
              </div>
              <a href="https://app.hubspot.com/workflows/48372600/new" target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
                Créer un workflow nurturing
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
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
                Sur {contacts.toLocaleString("fr-FR")} contacts, beaucoup sont inactifs depuis longtemps. Aucun workflow ne tente de les réactiver via un email de réengagement.
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation CRO</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  Créer un workflow qui détecte les contacts sans engagement depuis 6 mois et déclenche une campagne de réveil (email + tâche commerciale).
                </p>
              </div>
              <a href="https://app.hubspot.com/workflows/48372600/new" target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
                Créer un workflow de réengagement
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
