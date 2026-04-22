export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { auditHubSpotWorkflows } from "@/lib/integrations/hubspot-workflows";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { buildAuditRecommendations } from "@/lib/audit/recommendations-library";
import { AuditPageTabs } from "@/components/audit-page-tabs";
import { WorkflowCarousel } from "@/components/workflow-carousel";

export default async function AutomatisationsPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const hsToken = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();
  const totalDeals = snapshot.totalDeals;

  // Deals sans owner (signal d'absence de workflow d'attribution auto)
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

  const recommendations = buildAuditRecommendations(snapshot).process;

  // ── Audit workflows EXHAUSTIF (tous workflows actifs avec détail) ──
  const audit = hsToken
    ? await auditHubSpotWorkflows(hsToken)
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

  // ── Stats anti-pattern RevOps ──
  const multiPurposeCount = audit.details.filter((d) => d.isMultiPurpose).length;
  const noReenrollCount = audit.details.filter((d) => !d.reenrollmentEnabled).length;
  const noGoalCount = audit.details.filter((d) => !d.hasGoal).length;
  const totalRecos = audit.details.reduce((s, d) => s + d.recommendations.length, 0);
  const criticalRecos = audit.details.reduce(
    (s, d) => s + d.recommendations.filter((r) => r.severity === "critical").length,
    0,
  );

  const a = audit.actionStats;
  const actionRows: Array<{ key: string; label: string; count: number; color: string; description: string }> = [
    { key: "set_property", label: "Set property", count: a.byCategory.set_property, color: "bg-indigo-500", description: "Modification automatique d'un champ CRM" },
    { key: "send_email", label: "Email envoyé", count: a.byCategory.send_email, color: "bg-blue-500", description: "Email marketing ou notification interne" },
    { key: "create_task", label: "Tâche créée", count: a.byCategory.create_task, color: "bg-amber-500", description: "Tâche commerciale assignée à un owner" },
    { key: "webhook", label: "Webhook sortant", count: a.byCategory.webhook, color: "bg-fuchsia-500", description: "Appel HTTP vers un outil externe (Zapier, Slack…)" },
    { key: "branch", label: "Branche if/then", count: a.byCategory.branch, color: "bg-violet-500", description: "Logique conditionnelle dans le flow" },
    { key: "delay", label: "Délai d'attente", count: a.byCategory.delay, color: "bg-slate-500", description: "Pause programmée entre 2 actions" },
    { key: "create_engagement", label: "Engagement / Note", count: a.byCategory.create_engagement, color: "bg-emerald-500", description: "Note ou call loggué" },
    { key: "update_owner", label: "Update owner", count: a.byCategory.update_owner, color: "bg-orange-500", description: "Réassignation d'owner / round-robin" },
    { key: "other", label: "Autres", count: a.byCategory.other, color: "bg-slate-400", description: "Actions non catégorisées" },
  ].filter((r) => r.count > 0);

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Automatisations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Audit exhaustif de vos workflows HubSpot — déclencheur, actions, re-enrollment, objectif.
          {audit.details.length > 0 && ` (${audit.details.length} workflows actifs analysés en profondeur, ${a.totalActions} actions extraites)`}
        </p>
      </header>

      <AuditPageTabs
        tabs={[
          { href: "/dashboard/process", label: "Vue d'ensemble" },
          { href: "/dashboard/process/recommandations", label: `Recommandations${recommendations.length > 0 ? ` (${recommendations.length})` : ""}`, highlight: true },
        ]}
      />

      <InsightLockedBlock />

      {/* ── Synthèse haut niveau ── */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-violet-500" />Workflows d&apos;automatisation
            {activeWorkflows.length > 0 && (
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
          <div className="space-y-4">
            {/* KPIs synthèse */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <article className="card p-5 text-center">
                <p className="text-xs text-slate-500">Workflows actifs</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">{activeWorkflows.length}</p>
              </article>
              <article className="card p-5 text-center">
                <p className="text-xs text-slate-500">Inactifs</p>
                <p className="mt-1 text-3xl font-bold text-slate-400">{inactiveWorkflows.length}</p>
              </article>
              <article className="card p-5 text-center">
                <p className="text-xs text-slate-500">Recommandations CRO</p>
                <p className={`mt-1 text-3xl font-bold ${criticalRecos > 0 ? "text-rose-600" : totalRecos > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {totalRecos}
                </p>
                {criticalRecos > 0 && (
                  <p className="mt-1 text-[10px] font-bold text-rose-600">{criticalRecos} critique{criticalRecos > 1 ? "s" : ""}</p>
                )}
              </article>
              <article className="card p-5 text-center">
                <p className="text-xs text-slate-500">Actions analysées</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{a.totalActions}</p>
              </article>
            </div>

            {/* Anti-patterns RevOps détectés */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <article className={`rounded-xl border p-4 ${multiPurposeCount > 0 ? "border-rose-200 bg-rose-50/40" : "border-emerald-200 bg-emerald-50/40"}`}>
                <p className="text-xs font-semibold text-slate-700">Workflows multi-purpose</p>
                <p className={`mt-1 text-2xl font-bold ${multiPurposeCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {multiPurposeCount} / {audit.details.length}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Anti-pattern : 1 workflow doit avoir 1 action principale (RevOps)
                </p>
              </article>
              <article className={`rounded-xl border p-4 ${noReenrollCount > audit.details.length / 2 ? "border-amber-200 bg-amber-50/40" : "border-emerald-200 bg-emerald-50/40"}`}>
                <p className="text-xs font-semibold text-slate-700">Re-enrollment OFF</p>
                <p className={`mt-1 text-2xl font-bold ${noReenrollCount > audit.details.length / 2 ? "text-amber-600" : "text-emerald-600"}`}>
                  {noReenrollCount} / {audit.details.length}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Sans re-enrollment, un record ne peut pas re-passer dans le workflow
                </p>
              </article>
              <article className={`rounded-xl border p-4 ${noGoalCount > audit.details.length / 2 ? "border-amber-200 bg-amber-50/40" : "border-emerald-200 bg-emerald-50/40"}`}>
                <p className="text-xs font-semibold text-slate-700">Sans objectif (goal)</p>
                <p className={`mt-1 text-2xl font-bold ${noGoalCount > audit.details.length / 2 ? "text-amber-600" : "text-emerald-600"}`}>
                  {noGoalCount} / {audit.details.length}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Sans goal, impossible de mesurer la conversion du workflow
                </p>
              </article>
            </div>

            {/* Par type d'objet */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Workflows actifs par type d&apos;objet</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
                <ObjectCard label="Contact" count={audit.countsByObject.contact} color="text-blue-600" />
                <ObjectCard label="Entreprise" count={audit.countsByObject.company} color="text-violet-600" />
                <ObjectCard label="Transaction" count={audit.countsByObject.deal} color="text-indigo-600" />
                <ObjectCard label="Ticket" count={audit.countsByObject.ticket} color="text-fuchsia-600" />
                <ObjectCard label="Lead" count={audit.countsByObject.lead} color="text-amber-600" />
                <ObjectCard label="Custom Object" count={audit.countsByObject.custom} color="text-emerald-600" />
                <ObjectCard label="Inconnu" count={audit.countsByObject.unknown} color="text-slate-400" />
              </div>
            </div>
          </div>
        )}
      </CollapsibleBlock>

      {/* ── Carrousel détaillé par workflow ── */}
      {audit.details.length > 0 && (
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
            Naviguez workflow par workflow avec les flèches. Pour chacun :
            déclencheur, séquence d&apos;actions complète, état du re-enrollment et de l&apos;objectif,
            recommandations CRO/RevOps.
          </p>
          <div className="mt-4">
            <WorkflowCarousel details={audit.details} />
          </div>
        </CollapsibleBlock>
      )}

      {/* ── Synthèse actions agrégées ── */}
      {audit.details.length > 0 && a.totalActions > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Synthèse actions toutes workflows confondus
              <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">
                {a.totalActions}
              </span>
            </h2>
          }
        >
          <p className="text-xs text-slate-500">
            Décomposition des {a.totalActions} actions extraites des {audit.details.length} workflows actifs analysés.
          </p>

          <div className="mt-4 space-y-2">
            {actionRows.map((r) => {
              const pct = a.totalActions > 0 ? Math.round((r.count / a.totalActions) * 100) : 0;
              return (
                <div key={r.key} className="card p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{r.label}</p>
                      <p className="text-[11px] text-slate-500">{r.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-base font-bold text-slate-900 tabular-nums">{r.count}</span>
                      <span className="ml-1 text-[11px] text-slate-400">{pct}%</span>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${r.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {a.outgoingWebhookHosts.length > 0 && (
            <div className="mt-5 rounded-xl border border-fuchsia-200 bg-fuchsia-50/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-700">
                🔗 Webhooks sortants détectés ({a.outgoingWebhookHosts.length})
              </p>
              <p className="mt-1 text-[11px] text-fuchsia-800">
                Domaines vers lesquels vos workflows envoient des données. Permet d&apos;auditer les
                intégrations externes branchées en sortie de HubSpot.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.outgoingWebhookHosts.map((h) => (
                  <span key={h} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-fuchsia-200">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CollapsibleBlock>
      )}

      {/* ── Attribution deals (signal absence workflow round-robin) ── */}
      {totalDeals > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-rose-500" />Attribution deals
            </h2>
          }
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <article className="card p-5 text-center">
              <p className="text-xs text-slate-500">Deals sans owner</p>
              <p className={`mt-1 text-3xl font-bold ${dealsNoOwner > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {dealsNoOwner.toLocaleString("fr-FR")}
              </p>
              <p className="mt-1 text-xs text-slate-400">{dealsNoOwnerPct}% du total</p>
            </article>
            <article className="card p-5 text-center">
              <p className="text-xs text-slate-500">Deals attribués</p>
              <p className="mt-1 text-3xl font-bold text-emerald-600">{(totalDeals - dealsNoOwner).toLocaleString("fr-FR")}</p>
            </article>
            <article className="card p-5 text-center">
              <p className="text-xs text-slate-500">Taux d&apos;attribution</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {totalDeals > 0 ? `${100 - dealsNoOwnerPct}%` : "—"}
              </p>
            </article>
          </div>
        </CollapsibleBlock>
      )}
    </section>
  );
}

function ObjectCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <article className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color} tabular-nums`}>{count}</p>
    </article>
  );
}
