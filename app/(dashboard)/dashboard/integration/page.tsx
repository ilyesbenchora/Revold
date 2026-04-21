export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { HubSpotSyncOrchestrator } from "@/components/hubspot-sync-orchestrator";
import { ToolSyncOrchestrator } from "@/components/tool-sync-orchestrator";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { type DetectedIntegration } from "@/lib/integrations/detect-integrations";
import { type PortalApp } from "@/lib/integrations/detect-portal-apps";
import { getCanonicalIntegrationData } from "@/lib/supabase/cached";
import { BrandLogo } from "@/components/brand-logo";
import { CONNECTABLE_TOOLS, type ConnectableTool } from "@/lib/integrations/connect-catalog";
import { guessDomain } from "@/lib/integrations/guess-domain";
import { Suspense } from "react";
import Link from "next/link";

const CATEGORY_META: Record<ConnectableTool["category"], { label: string; emoji: string; gradient: string; description: string }> = {
  crm: {
    label: "CRM",
    emoji: "🗂️",
    gradient: "from-orange-500 to-amber-500",
    description: "Source principale de vos contacts, deals, pipelines et activités commerciales.",
  },
  billing: {
    label: "Facturation",
    emoji: "💳",
    gradient: "from-emerald-500 to-teal-500",
    description: "Réconciliez les opportunités fermées avec les factures et paiements réels — pilotez le cash, pas seulement le pipeline.",
  },
  phone: {
    label: "Téléphonie",
    emoji: "📞",
    gradient: "from-indigo-500 to-blue-500",
    description: "Croisez les appels (durée, taux de connexion) avec les deals pour mesurer l'impact du téléphone sur le closing.",
  },
  support: {
    label: "Service client",
    emoji: "🎧",
    gradient: "from-fuchsia-500 to-pink-500",
    description: "Croisez tickets clients et opportunités pour mesurer la rétention, anticiper le churn et calculer le NPS.",
  },
  communication: {
    label: "Communication",
    emoji: "💬",
    gradient: "from-violet-500 to-purple-500",
    description: "Recevez vos alertes Revold + digest quotidien dans Slack, Teams, Gmail ou Outlook — là où votre équipe travaille déjà.",
  },
  conv_intel: {
    label: "Conversation Intelligence",
    emoji: "🎙️",
    gradient: "from-rose-500 to-fuchsia-500",
    description: "Transcription + analyse IA des appels commerciaux. Talk ratio, objections, sentiment, scoring deal — auto-enrichis dans Revold.",
  },
};

const CATEGORY_ORDER: ConnectableTool["category"][] = ["crm", "billing", "phone", "support", "conv_intel", "communication"];

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
    const data = await getCanonicalIntegrationData();
    detectedIntegrations = data.integrations;
    portalApps = data.portalApps;
  }

  // Lecture stricte de la table integrations pour CETTE org : on prend
  // uniquement les rows actives (multi-tenant safe, sans fallback env).
  const { data: integrationsRecords } = await supabase
    .from("integrations")
    .select("provider, is_active, refresh_token, portal_id")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  const connectedKeys = new Set(
    (integrationsRecords ?? []).map((i) => i.provider).filter(Boolean),
  );
  // HubSpot OAuth réel : refresh_token + portal_id requis
  const hubspotOAuthConnected = (integrationsRecords ?? []).some(
    (i) => i.provider === "hubspot" && i.refresh_token && i.portal_id,
  );
  if (hubspotOAuthConnected) connectedKeys.add("hubspot");

  // Group tools by category
  const toolsByCategory: Record<ConnectableTool["category"], ConnectableTool[]> = {
    crm: [],
    billing: [],
    phone: [],
    support: [],
    communication: [],
    conv_intel: [],
  };
  for (const tool of Object.values(CONNECTABLE_TOOLS)) {
    toolsByCategory[tool.category].push(tool);
  }

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
        <h1 className="text-2xl font-semibold text-slate-900">Intégration</h1>
        <p className="mt-1 text-sm text-slate-500">
          Connectez votre stack revenue : CRM, facturation, téléphonie, service client.
          Tout converge dans Revold.
        </p>
      </header>

      <InsightLockedBlock />

      {/* ── BLOC TOP : Outils synchronisés (apparaît UNIQUEMENT si ≥ 1 connecté) ── */}
      {connectedKeys.size > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-500 text-xs text-white">
              ✓
            </span>
            <h2 className="text-lg font-semibold text-slate-900">
              Outils principaux synchronisés
            </h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
              {connectedKeys.size}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Vos outils CRM, facturation, téléphonie et service client connectés à Revold.
            Les données convergent automatiquement.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_ORDER.flatMap((cat) =>
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
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-slate-900">{tool.label}</p>
                          <span className="shrink-0 text-xs">{meta.emoji}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-emerald-700 font-medium">
                          ✓ Connecté · {meta.label}
                        </p>
                      </div>
                    </Link>
                  );
                }),
            )}
          </div>
        </div>
      )}

      {/* ── BLOCS CATEGORIES : outils à connecter (ne montre QUE les non-connectés) ── */}
      <div className="space-y-6">
        {CATEGORY_ORDER.map((cat) => {
          const meta = CATEGORY_META[cat];
          const tools = toolsByCategory[cat].filter((t) => !connectedKeys.has(t.key));
          if (tools.length === 0) return null; // Catégorie entièrement connectée → masquer

          return (
            <div key={cat} className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br ${meta.gradient} text-xs text-white`}>
                  {meta.emoji}
                </span>
                {meta.label}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  à connecter
                </span>
              </h2>
              <p className="text-xs text-slate-500">{meta.description}</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => {
                  if (tool.comingSoon) {
                    return (
                      <div
                        key={tool.key}
                        aria-disabled
                        className="relative flex cursor-not-allowed items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 opacity-70"
                        title="Connecteur en cours de développement — disponible bientôt"
                      >
                        <div className="grayscale">
                          <BrandLogo domain={tool.domain} alt={tool.label} fallback={tool.icon} size={36} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-700">{tool.label}</p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{tool.vendor}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                          Bientôt
                        </span>
                      </div>
                    );
                  }
                  const url = tool.connectUrl ?? `/dashboard/integration/connect/${tool.key}`;
                  return (
                    <Link
                      key={tool.key}
                      href={url}
                      className="group relative flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-accent/40 hover:bg-slate-50/50"
                    >
                      <BrandLogo domain={tool.domain} alt={tool.label} fallback={tool.icon} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{tool.label}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{tool.vendor}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent opacity-0 transition group-hover:opacity-100">
                        Connecter
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Apps détectées dans le portail HubSpot — info contextuelle gardée */}
      {portalApps.totalApps > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-blue-500" />Apps détectées dans le portail HubSpot
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{portalApps.totalApps}</span>
            </h2>
          }
        >
          <p className="text-sm text-slate-500">
            Applications publiques (marketplace) et privées qui consomment l&apos;API de votre portail HubSpot.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Apps privées</h3>
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700">
                  {portalApps.privateApps.length}
                </span>
              </div>
              {portalApps.privateApps.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">Aucune app privée détectée.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {portalApps.privateApps.slice(0, 10).map((app) => {
                    const g = guessDomain(app.name);
                    return (
                      <li key={app.name} className="flex items-center gap-2 text-xs">
                        <BrandLogo domain={g.domain} alt={app.name} fallback={g.icon} size={20} />
                        <span className="flex-1 truncate text-slate-700">{app.name}</span>
                        <span className="shrink-0 font-medium text-slate-500">
                          {app.usageCount.toLocaleString("fr-FR")} appels
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
            <article className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Apps publiques (marketplace)</h3>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                  {portalApps.publicApps.length}
                </span>
              </div>
              {portalApps.publicApps.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">Aucune app publique détectée.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {portalApps.publicApps.slice(0, 10).map((app) => {
                    const g = guessDomain(app.name);
                    return (
                      <li key={app.name} className="flex items-center gap-2 text-xs">
                        <BrandLogo domain={g.domain} alt={app.name} fallback={g.icon} size={20} />
                        <span className="flex-1 truncate text-slate-700">{app.name}</span>
                        <span className="shrink-0 font-medium text-slate-500">
                          {app.usageCount.toLocaleString("fr-FR")} appels
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          </div>
        </CollapsibleBlock>
      )}
    </section>
  );
}
