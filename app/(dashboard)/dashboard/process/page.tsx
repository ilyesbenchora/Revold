import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel } from "@/lib/score-utils";
import { CollapsibleBlock } from "@/components/collapsible-block";

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
        <h1 className="text-2xl font-semibold text-slate-900">Process & Alignement</h1>
        <p className="mt-1 text-sm text-slate-500">
          Workflows d&apos;automatisation et conversion lifecycle.
        </p>
      </header>

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Process & Alignement" score={processScore} />
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
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-violet-500" />Workflows d&apos;automatisation
          </h2>
        }
      >
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
      </CollapsibleBlock>

      {/* Lifecycle */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-amber-500" />Conversion lifecycle
          </h2>
        }
      >
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
      </CollapsibleBlock>
    </section>
  );
}
