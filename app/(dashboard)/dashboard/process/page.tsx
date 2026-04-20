export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { CollapsibleBlock } from "@/components/collapsible-block";

export default async function ProcessPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const hsToken = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  // Tout vient du snapshot HubSpot live
  const totalContacts = snapshot.totalContacts;
  const leadsCount = snapshot.leadsCount;
  const opportunitiesCount = snapshot.opportunitiesCount;
  const totalDeals = snapshot.totalDeals;

  // Deals sans owner via search dédiée
  let dealsNoOwner = 0;
  let dealsNoOwnerPct = 0;
  if (hsToken) {
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${hsToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "NOT_HAS_PROPERTY" }] }],
          limit: 1,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        dealsNoOwner = d.total ?? 0;
        dealsNoOwnerPct = totalDeals > 0 ? Math.round((dealsNoOwner / totalDeals) * 100) : 0;
      }
    } catch {}
  }

  // Workflows (v3 + v4 mergés depuis snapshot.ecosystem est partiel,
  // ici on a besoin de la liste détaillée pour l'analyse par type)
  let workflows: Array<{ id: string; name: string; enabled: boolean; type: string; objectType?: string }> = [];
  let workflowError: string | null = null;
  if (hsToken) {
    try {
      const [v3Res, v4Res] = await Promise.all([
        fetch("https://api.hubapi.com/automation/v3/workflows", {
          headers: { Authorization: `Bearer ${hsToken}` },
        }),
        fetch("https://api.hubapi.com/automation/v4/flows?limit=200", {
          headers: { Authorization: `Bearer ${hsToken}` },
        }),
      ]);
      const seen = new Set<string>();
      if (v3Res.ok) {
        const data = await v3Res.json();
        for (const w of (data.workflows ?? []) as Array<Record<string, unknown>>) {
          const id = String(w.id);
          if (seen.has(id)) continue;
          seen.add(id);
          workflows.push({
            id,
            name: (w.name as string) || "Sans nom",
            enabled: w.enabled === true,
            type: (w.type as string) || "unknown",
            objectType: w.objectTypeId as string | undefined,
          });
        }
      }
      if (v4Res.ok) {
        const data = await v4Res.json();
        for (const w of (data.results ?? []) as Array<Record<string, unknown>>) {
          const id = String(w.id);
          if (seen.has(id)) continue;
          seen.add(id);
          workflows.push({
            id,
            name: (w.name as string) || "Sans nom",
            enabled: w.isEnabled === true || w.enabled === true,
            type: (w.type as string) || "unknown",
            objectType: w.objectTypeId as string | undefined,
          });
        }
      }
      if (workflows.length === 0) {
        workflowError = "Scope automation manquant ou aucun workflow";
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

  const contacts = totalContacts;
  const leads = leadsCount;
  const opportunities = opportunitiesCount;
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

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Process & Alignement</h1>
        <p className="mt-1 text-sm text-slate-500">
          Workflows d&apos;automatisation et conversion lifecycle.
        </p>
      </header>

      <InsightLockedBlock />

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
