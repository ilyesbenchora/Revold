export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { auditHubSpotWorkflows } from "@/lib/integrations/hubspot-workflows";
import { getOrgHubspotPortalId } from "@/app/(dashboard)/dashboard/insights-ia/context";
import { getCachedWorkflows } from "@/lib/sync/get-cached-workflows";
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

  // ── 1. SOURCE PRIMAIRE : cache Supabase ─────────────────────────────
  // Garantit qu'on affiche TOUS les workflows présents dans HubSpot
  // (33 dans le cas pilote), sans dépendre du succès des appels live.
  const cachedWorkflows = await getCachedWorkflows(supabase, orgId, portalId ?? undefined);

  // ── 2. ENRICHISSEMENT : audit live des actifs (best-effort) ─────────
  // Récupère les détails (actions, triggers, re-enrollment, recommandations)
  // pour les workflows actifs. Si le live échoue (429, scope manquant, etc.),
  // on garde au moins la liste cache complète au lieu de tout perdre.
  const audit = hsToken
    ? await auditHubSpotWorkflows(hsToken, portalId).catch(() => null)
    : null;

  // Merge : on part du cache (source vérité du nombre), on enrichit avec
  // les hasDetail/url du live, on garde toutes les details du live tel quel.
  const detailMap = new Map<string, true>();
  for (const d of audit?.details ?? []) detailMap.set(d.id, true);

  const allWorkflows = cachedWorkflows.map((w) => ({
    ...w,
    hasDetail: detailMap.has(w.id),
    hubspotUrl: w.hubspotUrl ?? audit?.workflows.find((aw) => aw.id === w.id)?.hubspotUrl,
  }));

  const activeWorkflows = allWorkflows.filter((w) => w.enabled);
  const inactiveWorkflows = allWorkflows.filter((w) => !w.enabled);
  const detailLoaded = audit?.details.length ?? 0;
  const a = audit?.actionStats ?? {
    totalActions: 0,
    byCategory: { set_property: 0, send_email: 0, create_task: 0, webhook: 0, branch: 0, delay: 0, create_engagement: 0, update_owner: 0, other: 0 },
    outgoingWebhookHosts: [] as string[],
  };

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Automatisations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Audit exhaustif des workflows HubSpot — déclencheur, actions, re-enrollment, objectif.
          {allWorkflows.length > 0 &&
            ` ${allWorkflows.length} workflows détectés (${activeWorkflows.length} actifs, ${detailLoaded} analysés en profondeur).`}
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
        {allWorkflows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">
              Aucun workflow détecté dans votre miroir Supabase. Lancez une réconciliation
              complète depuis Settings → Intégrations → Parité.
            </p>
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
      {allWorkflows.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BlockHeaderIcon icon="sparkles" tone="fuchsia" />Analyse exhaustive workflow par workflow
              <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">
                {detailLoaded} / {activeWorkflows.length} analysés
              </span>
            </h2>
          }
        >
          <p className="text-xs text-slate-500">
            <strong>{allWorkflows.length} workflows</strong> détectés depuis le miroir Supabase,
            dont <strong>{activeWorkflows.length} actifs</strong>. Pour chaque actif où un détail
            a pu être chargé live, on décrit en clair : l&apos;objet enrôlé, le déclencheur,
            les types d&apos;actions, l&apos;état du re-enrollment, l&apos;objectif paramétré,
            et l&apos;analyse contextuelle par profil de workflow.
          </p>

          {/* Diagnostic chargement détail — uniquement si l'audit live a tourné et qu'il y a des fails */}
          {audit && audit.detailLoadStatus.failedIds.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold">
                ⚠ {audit.detailLoadStatus.failedIds.length} workflow{audit.detailLoadStatus.failedIds.length > 1 ? "s" : ""} actifs sans détail enrichi
              </p>
              <p className="mt-1 text-[11px]">
                Les workflows sont quand même listés (ID + nom + état). Pour avoir l&apos;analyse
                complète : scope OAuth automation manquant ou rate limit HubSpot atteint.
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

          {!portalId && detailLoaded > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold">⚠ Liens HubSpot non disponibles</p>
              <p className="mt-1 text-[11px]">
                Le portalId HubSpot n&apos;a pas pu être déterminé. Reconnectez HubSpot via OAuth.
              </p>
            </div>
          )}

          <div className="mt-4">
            <WorkflowCarousel workflows={allWorkflows} details={audit?.details ?? []} />
          </div>
        </CollapsibleBlock>
      )}
    </section>
  );
}
