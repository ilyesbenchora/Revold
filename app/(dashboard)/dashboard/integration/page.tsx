export const maxDuration = 60;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel } from "@/lib/score-utils";
import { HubSpotSyncOrchestrator } from "@/components/hubspot-sync-orchestrator";
import { ToolSyncOrchestrator } from "@/components/tool-sync-orchestrator";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { type DetectedIntegration } from "@/lib/integrations/detect-integrations";
import { type PortalApp } from "@/lib/integrations/detect-portal-apps";
import { getRecommendedCategories } from "@/lib/integrations/recommended-tools";
import {
  filterBusinessIntegrations,
  computeIntegrationScore,
} from "@/lib/integrations/integration-score";
import {
  getCanonicalIntegrationData,
  getHubspotOwnersCount,
} from "@/lib/supabase/cached";
import { BrandLogo } from "@/components/brand-logo";
import { Suspense } from "react";
import Link from "next/link";

const HUBSPOT_PORTAL = "48372600";

export default async function IntegrationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const connectedTool = typeof sp.connected === "string" ? sp.connected : null;
  const disconnectedTool = typeof sp.disconnected === "string" ? sp.disconnected : null;

  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const hubspotTokenConfigured = !!process.env.HUBSPOT_ACCESS_TOKEN;

  let detectedIntegrations: DetectedIntegration[] = [];
  let portalApps: { privateApps: PortalApp[]; publicApps: PortalApp[]; totalApps: number } = {
    privateApps: [],
    publicApps: [],
    totalApps: 0,
  };
  let ownersCount = 0;

  if (hubspotTokenConfigured) {
    // Same canonical helper as the header → guaranteed identical inputs.
    const [data, count] = await Promise.all([
      getCanonicalIntegrationData(),
      getHubspotOwnersCount(),
    ]);
    detectedIntegrations = data.integrations;
    portalApps = data.portalApps;
    ownersCount = count;
  }

  // DB counts for sync logs
  const [{ data: syncLogs }, { data: integrationsRecords }] = await Promise.all([
    supabase.from("sync_logs").select("*").eq("organization_id", orgId).order("started_at", { ascending: false }).limit(5),
    supabase.from("integrations").select("provider, is_active").eq("organization_id", orgId),
  ]);

  const activeIntegrations = (integrationsRecords ?? []).filter((i) => i.is_active);

  // Same canonical filter used by the header score so KPI numbers and
  // displayed cards always match.
  const businessIntegrations = filterBusinessIntegrations(detectedIntegrations);

  // Aggregate stats — based on the filtered business-integration list
  const totalIntegrations = businessIntegrations.length;
  const totalSyncedProperties = businessIntegrations.reduce((s, i) => s + i.totalProperties, 0);
  const integrationsWithProperties = businessIntegrations.filter((i) => i.totalProperties > 0);
  const avgEnrichmentRate = integrationsWithProperties.length > 0
    ? Math.round(
        integrationsWithProperties.reduce((s, i) => s + i.enrichmentRate, 0) /
          integrationsWithProperties.length,
      )
    : 0;
  // Distinct users across all integrations
  const allActiveUsers = new Set<string>();
  businessIntegrations.forEach((i) => i.topUsers.forEach((u) => allActiveUsers.add(u.ownerId)));
  const totalActiveUsers = allActiveUsers.size;

  // Tools already connected directly to Revold (via the connect/[tool] flow)
  const directlyConnectedKeys = activeIntegrations
    .map((i) => i.provider)
    .filter((p) => p !== "hubspot");

  // Recommended tools to connect (filter out HubSpot-detected AND directly-connected ones)
  const recommendedCategories = getRecommendedCategories([
    ...businessIntegrations.map((i) => i.key),
    ...directlyConnectedKeys,
  ]);

  // Canonical Integration Score — same function as the header so the two
  // numbers are always identical and deterministic across refreshes.
  const integrationScore = hubspotTokenConfigured
    ? computeIntegrationScore(businessIntegrations, ownersCount).score
    : 0;

  return (
    <section className="space-y-8">
      <Suspense><HubSpotSyncOrchestrator /></Suspense>
      <Suspense><ToolSyncOrchestrator /></Suspense>

      {connectedTool && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ <strong>{connectedTool}</strong> est maintenant connecté à Revold. Vos données seront synchronisées en arrière-plan.
        </div>
      )}
      {disconnectedTool && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <strong>{disconnectedTool}</strong> a été déconnecté de Revold.
        </div>
      )}

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Intégration</h1>
        <p className="mt-1 text-sm text-slate-500">
          Outils tiers connectés à votre CRM, propriétés synchronisées et taux d&apos;enrichissement.
        </p>
      </header>

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Intégration" score={integrationScore} />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{integrationScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(integrationScore).className}`}>
              {getScoreLabel(integrationScore).label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Basé sur le nombre d&apos;outils connectés, le taux d&apos;enrichissement et l&apos;équipe.
          </p>
        </div>
      </div>

      {/* Sync button */}
      {hubspotTokenConfigured && (
        <Link href="/dashboard/integration?sync=true"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Synchroniser maintenant
        </Link>
      )}

      {/* Vue d'ensemble */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Outils connectés</p>
          <p className="mt-1 text-3xl font-bold text-violet-600">{totalIntegrations}</p>
          <p className="mt-1 text-xs text-slate-400">Détectés via les propriétés CRM</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Apps portail</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{portalApps.totalApps}</p>
          <p className="mt-1 text-xs text-slate-400">
            {portalApps.privateApps.length} privée{portalApps.privateApps.length > 1 ? "s" : ""} · {portalApps.publicApps.length} publique{portalApps.publicApps.length > 1 ? "s" : ""}
          </p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Propriétés synchronisées</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{totalSyncedProperties}</p>
          <p className="mt-1 text-xs text-slate-400">Tous outils confondus</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Taux d&apos;enrichissement moyen</p>
          <p className={`mt-1 text-3xl font-bold ${avgEnrichmentRate >= 50 ? "text-emerald-600" : avgEnrichmentRate >= 20 ? "text-yellow-600" : "text-orange-500"}`}>
            {avgEnrichmentRate}%
          </p>
          <p className="mt-1 text-xs text-slate-400">Données effectivement remplies</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Utilisateurs actifs</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{totalActiveUsers}</p>
          <p className="mt-1 text-xs text-slate-400">Au moins 1 outil utilisé</p>
        </article>
      </div>

      {/* Apps connectées au portail HubSpot */}
      {portalApps.totalApps > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-blue-500" />Apps connectées au portail HubSpot
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{portalApps.totalApps}</span>
            </h2>
          }
        >
          <p className="text-sm text-slate-500">
            Toutes les applications publiques (marketplace) et privées qui consomment l&apos;API de votre portail HubSpot.
            Indicateur clé pour comprendre l&apos;ampleur de votre stack et identifier les apps actives.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Apps privées */}
            <article className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Apps privées</h3>
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700">
                  {portalApps.privateApps.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Développées en interne ou par des partenaires.</p>
              {portalApps.privateApps.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">Aucune app privée détectée.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {portalApps.privateApps.slice(0, 10).map((app) => (
                    <li key={app.name} className="flex items-center justify-between text-xs">
                      <span className="truncate text-slate-700">{app.name}</span>
                      <span className="ml-2 shrink-0 font-medium text-slate-500">
                        {app.usageCount.toLocaleString("fr-FR")} appels
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            {/* Apps publiques */}
            <article className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Apps publiques (marketplace)</h3>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                  {portalApps.publicApps.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Installées depuis le marketplace HubSpot.</p>
              {portalApps.publicApps.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">Aucune app publique détectée.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {portalApps.publicApps.slice(0, 10).map((app) => (
                    <li key={app.name} className="flex items-center justify-between text-xs">
                      <span className="truncate text-slate-700">{app.name}</span>
                      <span className="ml-2 shrink-0 font-medium text-slate-500">
                        {app.usageCount.toLocaleString("fr-FR")} appels
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </CollapsibleBlock>
      )}

      {/* Already connected to Revold */}
      {directlyConnectedKeys.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />Outils connectés à Revold
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {directlyConnectedKeys.length}
              </span>
            </h2>
          }
        >
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="px-5 py-2">Outil</th>
                  <th className="px-5 py-2">Statut</th>
                  <th className="px-5 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {directlyConnectedKeys.map((provider) => (
                  <tr key={provider} className="border-b border-card-border last:border-0">
                    <td className="px-5 py-2.5 font-medium capitalize text-slate-800">{provider}</td>
                    <td className="px-5 py-2.5">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">✓ Connecté</span>
                    </td>
                    <td className="px-5 py-2.5">
                      <Link href={`/dashboard/integration/connect/${provider}`} className="text-xs font-medium text-accent hover:underline">
                        Reconfigurer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleBlock>
      )}

      {/* Recommended tools to connect */}
      {recommendedCategories.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />Outils à connecter à Revold
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {recommendedCategories.reduce((s, c) => s + c.tools.length, 0)} suggestions
              </span>
            </h2>
          }
        >
          <p className="text-sm text-slate-500">
            Synchronisez ces outils <strong>directement à Revold</strong>, sans passer par HubSpot.
            C&apos;est ça la puissance de Revold : centraliser <strong>toutes les données revenue de votre entreprise</strong> en un seul endroit
            — CRM, facturation, service client — pour piloter le business à 360°.
          </p>
          <div className="space-y-4">
            {recommendedCategories.map((cat) => (
              <article key={cat.id} className="card p-5">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{cat.label}</h3>
                  <p className="mt-1 text-xs text-slate-500">{cat.description}</p>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {cat.tools.map((tool) => (
                    <Link
                      key={tool.key}
                      href={tool.connectUrl}
                      className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-indigo-300 hover:bg-indigo-50/40 transition"
                    >
                      <BrandLogo domain={tool.domain} alt={tool.label} fallback={tool.icon} size={32} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 group-hover:text-indigo-700">{tool.label}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white opacity-0 transition group-hover:opacity-100">
                        Connecter
                      </span>
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </CollapsibleBlock>
      )}

      {/* Sync logs */}
      {syncLogs && syncLogs.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-slate-400" />Dernières synchronisations Revold
            </h2>
          }
        >
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="px-5 py-2">Type</th>
                  <th className="px-5 py-2">Statut</th>
                  <th className="px-5 py-2">Entités</th>
                  <th className="px-5 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map((log) => (
                  <tr key={log.id} className="border-b border-card-border last:border-0">
                    <td className="px-5 py-2.5 font-medium capitalize text-slate-800">{log.entity_type || log.source}</td>
                    <td className="px-5 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        log.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                        log.status === "failed" || log.status === "partial" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {log.status === "completed" ? "Terminé" : log.status === "failed" ? "Erreur" : log.status}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">{log.entity_count}</td>
                    <td className="px-5 py-2.5 text-slate-500">{new Date(log.started_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleBlock>
      )}

      {!hubspotTokenConfigured && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">Aucune intégration configurée. Ajoutez votre token HubSpot dans les variables d&apos;environnement.</p>
        </div>
      )}
    </section>
  );
}
