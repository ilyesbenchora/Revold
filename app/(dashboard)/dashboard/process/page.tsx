export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { auditHubSpotWorkflows } from "@/lib/integrations/hubspot-workflows";
import { getOrgHubspotPortalId } from "@/app/(dashboard)/dashboard/insights-ia/context";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { buildAuditRecommendations } from "@/lib/audit/recommendations-library";
import { AuditPageTabs } from "@/components/audit-page-tabs";
import { WorkflowTextAnalysis } from "@/components/workflow-text-analysis";

export default async function AutomatisationsPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const hsToken = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();
  const portalId = await getOrgHubspotPortalId(supabase, orgId);

  const recommendations = buildAuditRecommendations(snapshot).process;

  // ── Audit workflows EXHAUSTIF ──
  const audit = hsToken
    ? await auditHubSpotWorkflows(hsToken, portalId)
    : {
        workflows: [],
        details: [],
        countsByObject: { contact: 0, company: 0, deal: 0, ticket: 0, lead: 0, custom: 0, unknown: 0 },
        actionStats: { totalActions: 0, byCategory: { set_property: 0, send_email: 0, create_task: 0, webhook: 0, branch: 0, delay: 0, create_engagement: 0, update_owner: 0, other: 0 }, outgoingWebhookHosts: [] },
        error: undefined,
      };

  const allWorkflows = audit.workflows;
  const activeWorkflows = allWorkflows.filter((w) => w.enabled);
  const inactiveWorkflows = allWorkflows.filter((w) => !w.enabled);
  const workflowError = audit.error ?? null;
  const a = audit.actionStats;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Automatisations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Audit exhaustif des workflows HubSpot — déclencheur, actions, re-enrollment, objectif.
          {audit.details.length > 0 && ` ${audit.details.length} workflows actifs analysés en profondeur.`}
        </p>
      </header>

      <AuditPageTabs
        tabs={[
          { href: "/dashboard/process", label: "Vue d'ensemble" },
          { href: "/dashboard/process/recommandations", label: `Recommandations${recommendations.length > 0 ? ` (${recommendations.length})` : ""}`, highlight: true },
        ]}
      />

      <InsightLockedBlock />

      {/* ── Synthèse compteurs ── */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-violet-500" />Workflows détectés
            {allWorkflows.length > 0 && (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                {activeWorkflows.length} actifs / {allWorkflows.length}
              </span>
            )}
          </h2>
        }
      >
        {workflowError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-medium text-amber-800">{workflowError}</p>
            <p className="mt-1 text-xs text-amber-700">
              Pour afficher les workflows, ajoutez le scope <code>automation</code> à votre app HubSpot.
            </p>
          </div>
        ) : allWorkflows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">Aucun workflow détecté dans votre portail HubSpot.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <article className="card p-5 text-center">
              <p className="text-xs text-slate-500">Actifs</p>
              <p className="mt-1 text-3xl font-bold text-emerald-600">{activeWorkflows.length}</p>
            </article>
            <article className="card p-5 text-center">
              <p className="text-xs text-slate-500">Inactifs</p>
              <p className="mt-1 text-3xl font-bold text-slate-400">{inactiveWorkflows.length}</p>
            </article>
            <article className="card p-5 text-center">
              <p className="text-xs text-slate-500">Total</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{allWorkflows.length}</p>
            </article>
            <article className="card p-5 text-center">
              <p className="text-xs text-slate-500">Actions analysées</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{a.totalActions}</p>
            </article>
          </div>
        )}
      </CollapsibleBlock>

      {/* ── ANALYSE ÉCRITE workflow par workflow ── */}
      {audit.details.length > 0 ? (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Analyse exhaustive workflow par workflow
              <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">
                {audit.details.length}
              </span>
            </h2>
          }
        >
          <p className="text-xs text-slate-500">
            Pour chacun des {audit.details.length} workflows actifs analysés, on décrit en clair :
            l&apos;objet enrôlé, le déclencheur, les types d&apos;actions exécutées, l&apos;état du
            re-enrollment, l&apos;objectif paramétré, et les recommandations CRO/RevOps spécifiques.
          </p>
          <div className="mt-4">
            <WorkflowTextAnalysis details={audit.details} />
          </div>
        </CollapsibleBlock>
      ) : allWorkflows.length > 0 && !workflowError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="text-sm font-bold text-amber-900">⚠ Détail workflows non disponible</p>
          <p className="mt-1 text-xs text-amber-800">
            {allWorkflows.length} workflows détectés mais le détail (actions, déclencheur, goal,
            re-enrollment) n&apos;a pas pu être chargé via /automation/v4/flows/&#123;id&#125;.
            Cela peut venir d&apos;un scope OAuth manquant ou de workflows v3 legacy non migrés
            vers v4. Allez sur la page diagnostic pour voir les vraies réponses HubSpot.
          </p>
        </div>
      ) : null}
    </section>
  );
}
