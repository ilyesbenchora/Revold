export const maxDuration = 60;
// Toujours frais : l'état de la connexion HubSpot change après connect/disconnect
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { HubSpotSyncOrchestrator } from "@/components/hubspot-sync-orchestrator";
import { ToolSyncOrchestrator } from "@/components/tool-sync-orchestrator";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { HubspotConnectionCard } from "@/components/hubspot-connection-card";
import { type DetectedIntegration } from "@/lib/integrations/detect-integrations";
import { type PortalApp } from "@/lib/integrations/detect-portal-apps";
import { getRecommendedCategories } from "@/lib/integrations/recommended-tools";
import {
  filterBusinessIntegrations,
} from "@/lib/integrations/integration-score";
import {
  getCanonicalIntegrationData,
} from "@/lib/supabase/cached";
import { BrandLogo } from "@/components/brand-logo";
import { Suspense } from "react";
import Link from "next/link";

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
  const hsToken = await getHubSpotToken(supabase, orgId);
  const hubspotTokenConfigured = !!hsToken;

  let detectedIntegrations: DetectedIntegration[] = [];
  let portalApps: { privateApps: PortalApp[]; publicApps: PortalApp[]; totalApps: number } = {
    privateApps: [],
    publicApps: [],
    totalApps: 0,
  };
  if (hubspotTokenConfigured) {
    // Same canonical helper as the header → guaranteed identical inputs.
    const data = await getCanonicalIntegrationData();
    detectedIntegrations = data.integrations;
    portalApps = data.portalApps;
  }

  // DB integrations row (full HubSpot row pour le HubspotConnectionCard)
  const { data: integrationsRecords } = await supabase
    .from("integrations")
    .select("*")
    .eq("organization_id", orgId);

  const activeIntegrations = (integrationsRecords ?? []).filter((i) => i.is_active);
  const hsRow = (integrationsRecords ?? []).find((i) => i.provider === "hubspot") ?? null;
  const hasEnvFallback = !!process.env.HUBSPOT_ACCESS_TOKEN;

  // Same canonical filter used by the header score so KPI numbers and
  // displayed cards always match.
  const businessIntegrations = filterBusinessIntegrations(detectedIntegrations);

  // Tools already connected directly to Revold (via the connect/[tool] flow)
  const directlyConnectedKeys = activeIntegrations
    .map((i) => i.provider)
    .filter((p) => p !== "hubspot");

  // Recommended tools to connect (filter out HubSpot-detected AND directly-connected ones)
  const recommendedCategories = getRecommendedCategories([
    ...businessIntegrations.map((i) => i.key),
    ...directlyConnectedKeys,
  ]);

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
          Connectez votre CRM HubSpot et vos outils tiers à Revold.
        </p>
      </header>

      {/* Card de connexion HubSpot — source unique de vérité */}
      <HubspotConnectionCard hsRow={hsRow} hasEnvFallback={hasEnvFallback} />

      <InsightLockedBlock />

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
            C&apos;est ça la puissance de Revold : centraliser <strong>toutes les données revenus de votre entreprise</strong> en un seul endroit
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

    </section>
  );
}
