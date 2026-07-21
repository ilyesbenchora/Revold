export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getOrgHubspotPortalId } from "@/app/(dashboard)/dashboard/insights-ia/context";
import { getCachedWorkflows } from "@/lib/sync/get-cached-workflows";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { WorkflowCarousel } from "@/components/workflow-carousel";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { CreateDataTableButton } from "@/components/data-tables/create-data-table-button";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { PageSourcesGate } from "@/components/page-sources-gate";

export default async function AutomatisationsPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const snapshot = await getHubspotSnapshot();
  const portalId = await getOrgHubspotPortalId(supabase, orgId);

  // ── SOURCE UNIQUE : cache Supabase ──────────────────────────────────
  // Le sync ETL enrichi (syncWorkflowsEnriched) fetch /v4/flows/{id} pour
  // chaque workflow et merge le détail dans raw_data. Donc le cache contient
  // TOUT ce qu'on peut savoir d'un workflow, sans appel live à l'affichage.
  const { workflows: allWorkflows, details } = await getCachedWorkflows(
    supabase,
    orgId,
    portalId ?? undefined,
  );

  const activeWorkflows = allWorkflows.filter((w) => w.enabled);
  const inactiveWorkflows = allWorkflows.filter((w) => !w.enabled);
  const detailLoaded = details.length;

  // Action stats agrégés depuis les détails locaux
  const a = {
    totalActions: details.reduce((s, d) => s + d.actions.length, 0),
    byCategory: details.reduce(
      (acc, d) => {
        for (const action of d.actions) acc[action.category] = (acc[action.category] ?? 0) + 1;
        return acc;
      },
      { set_property: 0, send_email: 0, create_task: 0, webhook: 0, branch: 0, delay: 0, create_engagement: 0, update_owner: 0, other: 0 } as Record<string, number>,
    ),
    outgoingWebhookHosts: [] as string[],
  };
  const failedDetailIds = activeWorkflows
    .filter((w) => !w.hasDetail)
    .map((w) => ({ id: w.id, name: w.name, reason: "Détail non disponible dans le cache (worker enrichi a échoué pour ce workflow)" }));

  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Automatisations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Audit exhaustif des workflows HubSpot — déclencheur, actions, re-enrollment, objectif.
            {allWorkflows.length > 0 &&
              ` ${allWorkflows.length} workflows détectés (${activeWorkflows.length} actifs, ${detailLoaded} analysés en profondeur).`}
          </p>
        </div>
        <CreateDataTableButton />
      </header>

      <InsightLockedBlock />

      {/* Blocs pilotés par « Outil source par page » — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey="audit_automatisations" categories={["crm"]}>

      {/* ── Synthèse compteurs ── */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Workflows détectés
            {allWorkflows.length > 0 && (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                {activeWorkflows.length} actifs / {allWorkflows.length}
              </span>
            )}
          </h2>
        }
      >
        {allWorkflows.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">
              Aucun workflow détecté dans votre miroir Supabase. Lancez une réconciliation
              complète depuis Settings → Intégrations → Parité.
            </p>
          </div>
        )}

        {/* Données du bloc + alerte chirurgicale. */}
        <div className="mt-4">
          <BlockDataTable
            title="Workflows détectés"
            subtitle="workflows"
            team="revops"
            unit="count"
            nameLabel="Indicateur"
            valueLabel="Valeur"
            rows={[
              { name: "Workflows actifs", value: activeWorkflows.length, unit: "count" },
              { name: "Workflows inactifs", value: inactiveWorkflows.length, unit: "count" },
              { name: "Workflows total", value: allWorkflows.length, unit: "count" },
              { name: "Actions analysées", value: a.totalActions, unit: "count" },
            ]}
            footnote="Source : miroir Supabase des workflows HubSpot. Actifs + inactifs = total."
          />
        </div>
      </CollapsibleBlock>

      {/* ── ANALYSE ÉCRITE workflow par workflow ── */}
      {allWorkflows.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              Analyse exhaustive workflow par workflow
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

          {/* Diagnostic chargement détail */}
          {failedDetailIds.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold">
                ⚠ {failedDetailIds.length} workflow{failedDetailIds.length > 1 ? "s" : ""} actifs sans détail enrichi
              </p>
              <p className="mt-1 text-[11px]">
                Les workflows sont quand même listés en mode lite (nom + ID + état + dates +
                révisions + lien HubSpot). Pour les enrichir : relance &laquo; Resync HubSpot &raquo;
                qui re-tente le détail per workflow ; si toujours bloqué = workflow d&apos;un type
                non supporté par l&apos;API détail (calculation, imported, custom object workflow).
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer font-semibold">Voir les workflows sans détail</summary>
                <ul className="mt-1 space-y-0.5 pl-4">
                  {failedDetailIds.slice(0, 20).map((f) => (
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
            <WorkflowCarousel workflows={allWorkflows} details={details} />
          </div>

          {/* Données du bloc + alerte chirurgicale. */}
          <div className="mt-4">
            <BlockDataTable
              title="Analyse exhaustive workflow par workflow"
              subtitle="couverture de l'analyse"
              team="revops"
              unit="count"
              nameLabel="Indicateur"
              valueLabel="Valeur"
              rows={[
                { name: "Workflows analysés (détail chargé)", value: detailLoaded, unit: "count" },
                { name: "Workflows actifs sans détail", value: failedDetailIds.length, unit: "count" },
              ]}
              footnote="Couverture de l'enrichissement : détails chargés vs workflows actifs restés en mode lite."
            />
          </div>
        </CollapsibleBlock>
      )}

      </PageSourcesGate>

      <PageDataTables pageKey="audit_automatisations" />
    </section>
  );
}
