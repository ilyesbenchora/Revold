export const maxDuration = 60;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel, getBarColor } from "@/lib/score-utils";
import { HubSpotSyncOrchestrator } from "@/components/hubspot-sync-orchestrator";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { detectIntegrations, type DetectedIntegration } from "@/lib/integrations/detect-integrations";
import { getRecommendedCategories } from "@/lib/integrations/recommended-tools";
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
  let owners: Array<{ email: string; firstName: string; lastName: string; teams: string[] }> = [];

  if (hubspotTokenConfigured) {
    try {
      const [integrations, ownersRes] = await Promise.all([
        detectIntegrations(process.env.HUBSPOT_ACCESS_TOKEN!),
        fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
          headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` },
        }).then((r) => r.ok ? r.json() : { results: [] }),
      ]);
      detectedIntegrations = integrations;
      owners = (ownersRes.results ?? []).map((o: Record<string, unknown>) => ({
        email: o.email as string,
        firstName: (o.firstName as string) || "",
        lastName: (o.lastName as string) || "",
        teams: ((o.teams as Array<{ name: string }>) ?? []).map((t) => t.name),
      }));
    } catch {}
  }

  // DB counts for sync logs
  const [{ data: syncLogs }, { data: integrationsRecords }] = await Promise.all([
    supabase.from("sync_logs").select("*").eq("organization_id", orgId).order("started_at", { ascending: false }).limit(5),
    supabase.from("integrations").select("provider, is_active").eq("organization_id", orgId),
  ]);

  const activeIntegrations = (integrationsRecords ?? []).filter((i) => i.is_active);

  // Aggregate stats
  const totalIntegrations = detectedIntegrations.length;
  const totalSyncedProperties = detectedIntegrations.reduce((s, i) => s + i.totalProperties, 0);
  const avgEnrichmentRate = detectedIntegrations.length > 0
    ? Math.round(detectedIntegrations.reduce((s, i) => s + i.enrichmentRate, 0) / detectedIntegrations.length)
    : 0;
  // Distinct users across all integrations
  const allActiveUsers = new Set<string>();
  detectedIntegrations.forEach((i) => i.topUsers.forEach((u) => allActiveUsers.add(u.ownerId)));
  const totalActiveUsers = allActiveUsers.size;

  // Tools already connected directly to Revold (via the connect/[tool] flow)
  const directlyConnectedKeys = activeIntegrations
    .map((i) => i.provider)
    .filter((p) => p !== "hubspot");

  // Recommended tools to connect (filter out HubSpot-detected AND directly-connected ones)
  const recommendedCategories = getRecommendedCategories([
    ...detectedIntegrations.map((i) => i.key),
    ...directlyConnectedKeys,
  ]);

  // Score Intégration
  const integrationScore = hubspotTokenConfigured
    ? Math.round(
        Math.min(50, totalIntegrations * 8) +
        Math.min(30, avgEnrichmentRate) +
        (owners.length > 10 ? 20 : owners.length > 5 ? 10 : 5)
      )
    : 0;

  return (
    <section className="space-y-8">
      <Suspense><HubSpotSyncOrchestrator /></Suspense>

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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Outils connectés</p>
          <p className="mt-1 text-3xl font-bold text-violet-600">{totalIntegrations}</p>
          <p className="mt-1 text-xs text-slate-400">Détectés via les propriétés CRM</p>
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

      {/* Applications connectées */}
      {detectedIntegrations.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-violet-500" />Applications connectées
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">{totalIntegrations}</span>
            </h2>
          }
        >
          <p className="text-sm text-slate-500">
            Détectées automatiquement via l&apos;analyse des groupes de propriétés CRM. Chaque outil HubSpot installe ses propres champs personnalisés.
          </p>
          <div className="space-y-3">
            {detectedIntegrations.map((int) => (
              <article key={int.key} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{int.icon}</span>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{int.label}</h3>
                      <p className="text-xs text-slate-400">{int.vendor} · {int.objectTypes.join(", ")}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {int.detectionMethods.includes("properties") && (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">Propriétés CRM</span>
                        )}
                        {int.detectionMethods.includes("source_detail") && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">Source d&apos;enregistrement</span>
                        )}
                        {int.detectionMethods.includes("engagements") && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Engagements</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Propriétés synchronisées</p>
                    <p className="text-2xl font-bold text-slate-900">{int.totalProperties}</p>
                  </div>
                </div>

                {/* Enrichment rate (only when detected via properties) */}
                {int.totalProperties > 0 ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">Taux d&apos;enrichissement</span>
                      <span className={`font-bold ${
                        int.enrichmentRate >= 50 ? "text-emerald-600" :
                        int.enrichmentRate >= 20 ? "text-yellow-600" :
                        int.enrichmentRate >= 5 ? "text-orange-500" : "text-red-500"
                      }`}>
                        {int.enrichmentRate}% — {int.enrichedRecords.toLocaleString("fr-FR")} / {int.totalRecords.toLocaleString("fr-FR")} {int.objectTypes[0]}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${getBarColor(int.enrichmentRate)}`}
                        style={{ width: `${Math.min(100, int.enrichmentRate)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                    <span className="font-semibold">{int.enrichedRecords.toLocaleString("fr-FR")}</span> enregistrements détectés via les sources HubSpot ({int.objectTypes.join(", ")}). Aucune propriété personnalisée installée — connectez l&apos;app pour enrichir vos données.
                  </div>
                )}

                <div className={`mt-4 grid grid-cols-1 gap-3 ${int.topProperties.length > 0 ? "md:grid-cols-2" : ""}`}>
                  {/* Top properties */}
                  {int.topProperties.length > 0 && (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Propriétés synchronisées</p>
                      <div className="mt-2 space-y-1.5">
                        {int.topProperties.map((p) => (
                          <div key={p.name} className="flex items-center justify-between text-xs">
                            <span className="truncate text-slate-700">{p.label}</span>
                            <span className="ml-2 shrink-0 font-medium text-slate-500">
                              {p.enrichedCount.toLocaleString("fr-FR")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User adoption */}
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Adoption utilisateurs</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        int.distinctUsers >= 5 ? "bg-emerald-100 text-emerald-700" :
                        int.distinctUsers >= 2 ? "bg-yellow-100 text-yellow-700" :
                        "bg-orange-100 text-orange-700"
                      }`}>{int.distinctUsers} util.</span>
                    </div>
                    {int.topUsers.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {int.topUsers.slice(0, 5).map((u) => (
                          <div key={u.ownerId} className="flex items-center justify-between text-xs">
                            <span className="truncate text-slate-700">{u.name}</span>
                            <span className="ml-2 shrink-0 font-medium text-slate-500">{u.count} connexions</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">Aucun utilisateur identifié</p>
                    )}
                  </div>
                </div>
              </article>
            ))}
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
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-slate-900">{cat.label}</h3>
                    <p className="mt-1 text-xs text-slate-500">{cat.description}</p>
                  </div>
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
                        <p className="truncate text-xs text-slate-500">{tool.description}</p>
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
