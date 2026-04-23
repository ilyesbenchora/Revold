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
import { WorkflowCarousel } from "@/components/workflow-carousel";
import { BlockHeaderIcon } from "@/components/ventes-ui";

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
        detailLoadStatus: { activeCount: 0, detailLoaded: 0, failedIds: [] as Array<{ id: string; name: string; reason: string }> },
        portalId: undefined as string | undefined,
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
            <BlockHeaderIcon icon="workflow" tone="violet" />Workflows détectés
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
      {allWorkflows.length > 0 && !workflowError && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BlockHeaderIcon icon="sparkles" tone="fuchsia" />Analyse exhaustive workflow par workflow
              <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">
                {audit.detailLoadStatus.detailLoaded} / {audit.detailLoadStatus.activeCount}
              </span>
            </h2>
          }
        >
          <p className="text-xs text-slate-500">
            Pour chacun des {audit.detailLoadStatus.activeCount} workflows actifs détectés, on
            décrit en clair : l&apos;objet enrôlé, le nombre de records actuellement inscrits, le
            déclencheur, les types d&apos;actions exécutées, l&apos;état du re-enrollment,
            l&apos;objectif paramétré, et l&apos;analyse contextuelle par profil de workflow.
          </p>

          {/* Diagnostic chargement détail */}
          {audit.detailLoadStatus.failedIds.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold">
                ⚠ {audit.detailLoadStatus.failedIds.length} workflow{audit.detailLoadStatus.failedIds.length > 1 ? "s" : ""} sur {audit.detailLoadStatus.activeCount} sans détail chargé
              </p>
              <p className="mt-1 text-[11px]">
                Ni /automation/v3/workflows/&#123;id&#125; ni /automation/v4/flows/&#123;id&#125; n&apos;ont retourné de détail.
                Cause probable : scope OAuth automation manquant ou workflows custom non standard.
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer font-semibold">Voir les workflows en échec</summary>
                <ul className="mt-1 space-y-0.5 pl-4">
                  {audit.detailLoadStatus.failedIds.slice(0, 20).map((f) => (
                    <li key={f.id} className="text-[11px]">
                      <span className="font-mono">{f.id}</span> — {f.name}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}

          {!audit.portalId && audit.detailLoadStatus.detailLoaded > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold">⚠ Liens HubSpot non disponibles</p>
              <p className="mt-1 text-[11px]">
                Le portalId HubSpot n&apos;a pas pu être déterminé. Les liens &laquo; Voir le workflow
                dans HubSpot &raquo; sont absents. Reconnectez HubSpot via OAuth pour le récupérer.
              </p>
            </div>
          )}

          {activeWorkflows.length > 0 && (
            <div className="mt-4">
              <WorkflowCarousel workflows={audit.workflows} details={audit.details} />
            </div>
          )}
        </CollapsibleBlock>
      )}
    </section>
  );
}
