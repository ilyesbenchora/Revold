export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { HubSpotSyncOrchestrator } from "@/components/hubspot-sync-orchestrator";
import { ToolSyncOrchestrator } from "@/components/tool-sync-orchestrator";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { type PortalApp } from "@/lib/integrations/detect-portal-apps";
import { getCanonicalIntegrationData } from "@/lib/supabase/cached";
import { BrandLogo } from "@/components/brand-logo";
import { CONNECTABLE_TOOLS, type ConnectableTool } from "@/lib/integrations/connect-catalog";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/integrations/category-meta";
import { guessDomain } from "@/lib/integrations/guess-domain";
import { Suspense } from "react";
import Link from "next/link";

export default async function MesOutilsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const connectedTool = typeof sp.connected === "string" ? sp.connected : null;
  const disconnectedTool = typeof sp.disconnected === "string" ? sp.disconnected : null;

  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;

  const supabase = await createSupabaseServerClient();
  const hsToken = await getHubSpotToken(supabase, orgId);

  let portalApps: { privateApps: PortalApp[]; publicApps: PortalApp[]; totalApps: number } = {
    privateApps: [],
    publicApps: [],
    totalApps: 0,
  };
  if (hsToken) portalApps = (await getCanonicalIntegrationData()).portalApps;

  const { data: integrationsRecords } = await supabase
    .from("integrations")
    .select("provider, is_active, refresh_token, portal_id")
    .eq("organization_id", orgId)
    .eq("is_active", true);
  const connectedKeys = new Set((integrationsRecords ?? []).map((i) => i.provider).filter(Boolean));
  if ((integrationsRecords ?? []).some((i) => i.provider === "hubspot" && i.refresh_token && i.portal_id)) {
    connectedKeys.add("hubspot");
  }

  const toolsByCategory: Record<ConnectableTool["category"], ConnectableTool[]> = {
    crm: [], billing: [], phone: [], files: [], support: [], communication: [], conv_intel: [], ads: [],
  };
  for (const tool of Object.values(CONNECTABLE_TOOLS)) toolsByCategory[tool.category].push(tool);

  return (
    <section className="space-y-8">
      <Suspense><HubSpotSyncOrchestrator /></Suspense>
      <Suspense><ToolSyncOrchestrator /></Suspense>

      {connectedTool && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ <strong>{connectedTool}</strong> est maintenant connecté à Revold.
        </div>
      )}
      {disconnectedTool && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <strong>{disconnectedTool}</strong> a été déconnecté de Revold.
        </div>
      )}

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mes outils connectés</h1>
        <p className="mt-1 text-sm text-slate-500">
          Les outils de votre stack revenue déjà connectés à Revold. Ajoutez-en depuis la{" "}
          <Link href="/dashboard/integration/bibliotheque" className="font-medium text-accent hover:underline">bibliothèque d&apos;outils</Link>.
        </p>
      </header>

      {connectedKeys.size === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Aucun outil connecté pour l&apos;instant.</p>
          <Link href="/dashboard/integration/bibliotheque" className="mt-3 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            Parcourir la bibliothèque d&apos;outils →
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-6">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-500 text-xs text-white">✓</span>
            <h2 className="text-lg font-semibold text-slate-900">Outils synchronisés</h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{connectedKeys.size}</span>
          </div>
          <p className="mb-4 text-xs text-slate-500">Vos outils connectés à Revold. Les données convergent automatiquement.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...CATEGORY_ORDER, "files" as const].flatMap((cat) =>
              toolsByCategory[cat]
                .filter((t) => connectedKeys.has(t.key))
                .map((tool) => {
                  const meta = CATEGORY_META[tool.category];
                  return (
                    <Link
                      key={tool.key}
                      href="/dashboard/parametres/integrations"
                      className="group flex items-center gap-3 rounded-xl border border-emerald-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm"
                    >
                      <BrandLogo domain={tool.domain} alt={tool.label} fallback={tool.icon} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{tool.label}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-emerald-700">✓ Connecté · {meta.label}</p>
                      </div>
                    </Link>
                  );
                }),
            )}
          </div>
        </div>
      )}

      {portalApps.totalApps > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              Apps détectées dans le portail HubSpot
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{portalApps.totalApps}</span>
            </h2>
          }
        >
          <p className="text-sm text-slate-500">Applications publiques et privées qui consomment l&apos;API de votre portail HubSpot.</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {([["Apps privées", portalApps.privateApps, "bg-violet-50 text-violet-700"], ["Apps publiques (marketplace)", portalApps.publicApps, "bg-blue-50 text-blue-700"]] as const).map(
              ([label, apps, badge]) => (
                <article key={label} className="card p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badge}`}>{apps.length}</span>
                  </div>
                  {apps.length === 0 ? (
                    <p className="mt-3 text-xs text-slate-400">Aucune app détectée.</p>
                  ) : (
                    <ul className="mt-3 space-y-1.5">
                      {apps.slice(0, 10).map((app) => {
                        const g = guessDomain(app.name);
                        return (
                          <li key={app.name} className="flex items-center gap-2 text-xs">
                            <BrandLogo domain={g.domain} alt={app.name} fallback={g.icon} size={20} />
                            <span className="flex-1 truncate text-slate-700">{app.name}</span>
                            <span className="shrink-0 font-medium text-slate-500">{app.usageCount.toLocaleString("fr-FR")} appels</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              ),
            )}
          </div>
        </CollapsibleBlock>
      )}
    </section>
  );
}
